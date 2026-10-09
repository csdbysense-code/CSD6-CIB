"""ทดสอบเว็บไซต์แบบอัตโนมัติ (ไม่ต้องใช้อินเทอร์เน็ต)

รันบนเครื่อง:  python -m unittest -v
GitHub Actions จะรันให้อัตโนมัติทุกครั้งที่ push (ดู .github/workflows/ci.yml)
"""

import io
import os
import re
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("IMAGE_CACHE_DIR", tempfile.mkdtemp(prefix="csd6-test-cache-"))

from PIL import Image  # noqa: E402

import app as site  # noqa: E402
import imageproxy  # noqa: E402

PAGES = ["/", "/about", "/success", "/advertise", "/contact"]


class PageTests(unittest.TestCase):
    def setUp(self):
        self.client = site.app.test_client()

    def test_pages_render(self):
        for path in PAGES + ["/privacy-policy"]:
            with self.subTest(path=path):
                res = self.client.get(path)
                self.assertEqual(res.status_code, 200)
                self.assertIn("text/html", res.content_type)

    def test_page_structure(self):
        # เคยมีปัญหา <header> ครอบทั้งหน้า, <main> ซ้อนกัน และ <h1> 2 ตัว
        for path in PAGES:
            with self.subTest(path=path):
                html = self.client.get(path).get_data(as_text=True)
                self.assertEqual(html.count("<h1"), 1, "ควรมี h1 หน้าละ 1 ตัว")
                self.assertEqual(html.count("<main"), 1, "ควรมี main หน้าละ 1 ตัว")
                self.assertEqual(html.count("<header"), 1, "ควรมี header หน้าละ 1 ตัว")
                self.assertEqual(html.count("<header"), html.count("</header>"))

    def test_seo_tags(self):
        descriptions = set()
        for path in PAGES:
            with self.subTest(path=path):
                html = self.client.get(path).get_data(as_text=True)
                canonical = re.search(r'<link rel="canonical" href="([^"]+)"', html)
                self.assertIsNotNone(canonical)
                self.assertEqual(canonical.group(1), site.SITE_URL + path)
                self.assertIn(f'property="og:url" content="{site.SITE_URL}{path}"', html)
                description = re.search(r'<meta name="description" content="([^"]+)"', html).group(1)
                descriptions.add(description)
        self.assertEqual(len(descriptions), len(PAGES), "แต่ละหน้าควรมีคำอธิบาย (description) ของตัวเอง")

    def test_no_inline_scripts_or_handlers(self):
        # JavaScript แยกไว้ใน static/js ทั้งหมด และไม่ใช้ onclick ใน HTML
        for path in PAGES:
            with self.subTest(path=path):
                html = self.client.get(path).get_data(as_text=True)
                self.assertNotRegex(html, r"<script>(?!\s*</script>)")
                self.assertNotRegex(html, r"\son[a-z]+=\"")

    def test_static_assets_exist(self):
        seen = set()
        for path in PAGES:
            html = self.client.get(path).get_data(as_text=True)
            for asset in re.findall(r'(?:src|href)="(/static/[^"?]+)', html):
                seen.add(asset)
        self.assertTrue(seen)
        for asset in sorted(seen):
            with self.subTest(asset=asset):
                self.assertEqual(self.client.get(asset).status_code, 200)

    def test_static_cache_headers(self):
        html = self.client.get("/").get_data(as_text=True)
        css = re.search(r'href="(/static/css/style\.css\?v=\d+)"', html)
        self.assertIsNotNone(css, "ลิงก์ CSS ควรมี ?v= เพื่อให้ cache ได้นาน")
        self.assertIn("max-age=31536000", self.client.get(css.group(1)).headers["Cache-Control"])

    def test_robots_sitemap_favicon(self):
        robots = self.client.get("/robots.txt").get_data(as_text=True)
        self.assertIn(f"Sitemap: {site.SITE_URL}/sitemap.xml", robots)
        sitemap = self.client.get("/sitemap.xml").get_data(as_text=True)
        for path in PAGES:
            self.assertIn(f"<loc>{site.SITE_URL}{path}</loc>", sitemap)
        favicon = self.client.get("/favicon.ico")
        self.assertEqual(favicon.status_code, 200)
        self.assertEqual(favicon.mimetype, "image/png")

    def test_custom_404(self):
        res = self.client.get("/no-such-page")
        self.assertEqual(res.status_code, 404)
        html = res.get_data(as_text=True)
        self.assertIn("ไม่พบหน้าที่ต้องการ", html)
        self.assertIn('id="mainMenu"', html)


class ImageEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = site.app.test_client()

    def test_rejects_bad_requests(self):
        for query in ("", "?src=abc", "?src=ftp://example.com/a.jpg", "?src=https://example.com/a.jpg&w=333", "?src=https://example.com/a.jpg&w=abc"):
            with self.subTest(query=query):
                self.assertEqual(self.client.get("/img" + query).status_code, 400)

    def test_blocks_internal_addresses(self):
        # ห้ามใช้ /img ยิงเข้าเครือข่ายภายในของ server (SSRF)
        for src in ("http://127.0.0.1/a.jpg", "http://localhost/a.jpg", "http://10.0.0.1/a.jpg", "http://169.254.169.254/latest/meta-data/"):
            with self.subTest(src=src):
                self.assertEqual(self.client.get("/img", query_string={"src": src, "w": 600}).status_code, 404)

    def test_never_redirects(self):
        # /api/image เดิม redirect ไปเว็บอื่นได้ (open redirect) — ต้องไม่มีอีกแล้ว
        self.assertEqual(self.client.get("/api/image?url=https://example.com").status_code, 404)

    def test_rate_limit(self):
        ip = "203.0.113.7"
        site._image_misses.pop(ip, None)
        allowed = sum(site.allow_image_miss(ip) for _ in range(site.IMAGE_MISS_LIMIT + 5))
        self.assertEqual(allowed, site.IMAGE_MISS_LIMIT)


class ImageProxyTests(unittest.TestCase):
    def test_direct_url(self):
        cases = {
            "https://drive.google.com/file/d/1MonEaj_FcPl0un8M4xRfqWir96Lu-KLB/view?usp=drive_link":
                "https://drive.google.com/thumbnail?id=1MonEaj_FcPl0un8M4xRfqWir96Lu-KLB&sz=w1600",
            "https://www.youtube.com/watch?v=SAnvpfxGI3s": "https://i.ytimg.com/vi/SAnvpfxGI3s/hqdefault.jpg",
            "https://youtu.be/SAnvpfxGI3s": "https://i.ytimg.com/vi/SAnvpfxGI3s/hqdefault.jpg",
            "https://www.facebook.com/photo/?fbid=1136697392197130&set=a.1":
                "https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=1136697392197130",
            "https://example.com/news/1": "https://example.com/news/1",
        }
        for src, expected in cases.items():
            with self.subTest(src=src):
                self.assertEqual(imageproxy.direct_url(src), expected)

    def test_resize_makes_small_opaque_image(self):
        source = io.BytesIO()
        Image.new("RGBA", (1600, 900), (255, 0, 0, 128)).save(source, "PNG")
        for fmt in ("jpeg", "webp"):
            with self.subTest(fmt=fmt):
                out = Image.open(io.BytesIO(imageproxy.resize(source.getvalue(), 600, fmt)))
                self.assertEqual(out.format.lower(), fmt)
                self.assertEqual(out.size, (600, 338))
                self.assertEqual(out.mode, "RGB")

    def test_resize_rejects_non_images(self):
        with self.assertRaises(imageproxy.ImageError):
            imageproxy.resize(b"<svg onload=alert(1)></svg>", 600, "jpeg")

    def test_og_image_parsing(self):
        page = '<head><meta property="og:image" content="/media/a.jpg?x=1&amp;y=2"></head>'
        self.assertEqual(imageproxy._find_og_image(page, "https://news.example.com/post/1"),
                         "https://news.example.com/media/a.jpg?x=1&y=2")


if __name__ == "__main__":
    unittest.main()
