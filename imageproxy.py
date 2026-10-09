"""ดึงรูปจากลิงก์ภายนอก (Google Drive / Facebook / YouTube / เว็บข่าว) ย่อขนาด แล้วเก็บ cache ไว้ที่ server

ลิงก์ใน Google Sheet มีหลายแบบ ทั้งลิงก์รูปตรงๆ ลิงก์ไฟล์ Drive และลิงก์หน้าโพสต์/หน้าข่าว
โมดูลนี้จะหารูปจริงให้ ย่อให้พอดีกับการ์ด และส่งออกจาก server ของเราเอง
- ผู้เข้าชมไม่ต้องโหลดรูปจาก Facebook/Google โดยตรง (ดีต่อ PDPA)
- รูปทุกรูปถูกแปลงใหม่ด้วย Pillow จึงไม่มีทางส่งไฟล์อื่นที่ไม่ใช่รูปออกไป
- ไม่มีการ redirect ไปเว็บอื่น (ปิดช่องโหว่ open redirect ของ /api/image เดิม)
"""

import hashlib
import html
import io
import ipaddress
import os
import re
import socket
import tempfile
import threading
import time
import urllib.request
from urllib.parse import parse_qs, urljoin, urlparse

from PIL import Image, ImageOps

ALLOWED_WIDTHS = (200, 400, 600, 800, 1200)
MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024
CACHE_DIR = os.environ.get("IMAGE_CACHE_DIR") or os.path.join(tempfile.gettempdir(), "csd6-image-cache")
CACHE_TTL = 7 * 24 * 60 * 60
CACHE_MAX_FILES = 3000
FAIL_TTL = 10 * 60  # ถ้าหารูปไม่เจอ รอ 10 นาทีค่อยลองใหม่

Image.MAX_IMAGE_PIXELS = 40_000_000  # กันไฟล์รูปขนาดผิดปกติ (decompression bomb)

BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
# Facebook แสดง og:image ให้เฉพาะ crawler
CRAWLER_UAS = (
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Twitterbot/1.0",
)
OG_PATTERNS = (
    re.compile(r"""<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::src)?["'][^>]*content=["']([^"']+)""", re.I),
    re.compile(r"""<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']""", re.I),
)


class ImageError(Exception):
    pass


def is_public_url(url):
    """อนุญาตเฉพาะ http(s) ที่ชี้ไปยัง IP สาธารณะ (กัน SSRF เข้าเครือข่ายภายใน)"""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False
    try:
        for info in socket.getaddrinfo(parsed.hostname, None):
            if not ipaddress.ip_address(info[4][0]).is_global:
                return False
    except (socket.gaierror, ValueError):
        return False
    return True


class _CheckedRedirect(urllib.request.HTTPRedirectHandler):
    # ตรวจปลายทางทุกครั้งที่ถูก redirect ไม่ใช่แค่ URL แรก
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not is_public_url(newurl):
            raise ImageError("redirect ไปยังที่อยู่ที่ไม่อนุญาต")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_opener = urllib.request.build_opener(_CheckedRedirect)
# ดาวน์โหลดจากเว็บภายนอกพร้อมกันได้ไม่เกิน 8 รายการต่อ worker (กัน server ทำงานหนักเกินไป)
_download_slots = threading.BoundedSemaphore(8)


def _fetch(url, user_agent):
    if not is_public_url(url):
        raise ImageError("URL ไม่อนุญาต")
    req = urllib.request.Request(url, headers={"User-Agent": user_agent, "Accept-Language": "th,en;q=0.8"})
    with _download_slots, _opener.open(req, timeout=10) as resp:
        data = resp.read(MAX_DOWNLOAD_BYTES + 1)
        if len(data) > MAX_DOWNLOAD_BYTES:
            raise ImageError("ไฟล์ใหญ่เกินไป")
        return resp.headers.get_content_type(), data, resp.geturl()


def _is_facebook(url):
    host = urlparse(url).hostname or ""
    return host.endswith(("facebook.com", "fb.watch", "fbsbx.com"))


def _user_agents(url):
    return CRAWLER_UAS + (BROWSER_UA,) if _is_facebook(url) else (BROWSER_UA,) + CRAWLER_UAS


def direct_url(src):
    """แปลงลิงก์ที่รู้รูปแบบให้เป็นลิงก์รูปโดยตรง ถ้าไม่รู้จักคืนลิงก์เดิม"""
    parsed = urlparse(src)
    host = parsed.hostname or ""

    drive = re.search(r"drive\.google\.com/.*(?:/d/|[?&]id=)([a-zA-Z0-9_-]{10,})", src)
    if drive:
        return f"https://drive.google.com/thumbnail?id={drive.group(1)}&sz=w1600"

    youtube = re.search(r"(?:youtube\.com/(?:watch\?v=|shorts/|embed/)|youtu\.be/)([a-zA-Z0-9_-]{6,})", src)
    if youtube:
        return f"https://i.ytimg.com/vi/{youtube.group(1)}/hqdefault.jpg"

    # ลิงก์รูป Facebook (photo?fbid=...) ดึงจาก lookaside ได้ตรงๆ ไม่ต้องเปิดหน้าโพสต์
    if host.endswith("facebook.com") and "photo" in parsed.path:
        fbid = parse_qs(parsed.query).get("fbid", [""])[0]
        if fbid.isdigit():
            return f"https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id={fbid}"

    return src


def _find_og_image(page, base_url):
    for pattern in OG_PATTERNS:
        match = pattern.search(page)
        if match:
            return urljoin(base_url, html.unescape(match.group(1)))
    return None


def download_image(src):
    """คืน bytes ของรูปต้นฉบับ (ถ้าเป็นหน้าเว็บจะหาจาก og:image)"""
    url = direct_url(src)
    for ua in _user_agents(url):
        try:
            content_type, data, final_url = _fetch(url, ua)
        except ImageError:
            raise
        except Exception:
            continue
        if content_type.startswith("image/"):
            return data
        if content_type in ("text/html", "application/xhtml+xml"):
            og = _find_og_image(data.decode("utf-8", errors="ignore"), final_url)
            if not og:
                continue
            for og_ua in _user_agents(og):
                try:
                    og_type, og_data, _ = _fetch(og, og_ua)
                except ImageError:
                    raise
                except Exception:
                    continue
                if og_type.startswith("image/"):
                    return og_data
    raise ImageError("หารูปจากลิงก์นี้ไม่พบ")


def resize(data, width, fmt):
    try:
        img = Image.open(io.BytesIO(data))
        img.draft("RGB", (width * 2, width * 2))  # JPEG: ถอดรหัสแบบย่อ เร็วขึ้นมาก
        img = ImageOps.exif_transpose(img)
    except Exception as exc:
        raise ImageError("ไฟล์ไม่ใช่รูปภาพที่รองรับ") from exc

    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        background = Image.new("RGB", img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[-1])
        img = background
    else:
        img = img.convert("RGB")

    if img.width > width:
        img.thumbnail((width, width * 3), Image.LANCZOS)

    out = io.BytesIO()
    if fmt == "webp":
        img.save(out, "WEBP", quality=78, method=4)
    else:
        img.save(out, "JPEG", quality=80, optimize=True, progressive=True)
    return out.getvalue()


class ImageCache:
    def __init__(self, directory=CACHE_DIR):
        self.directory = directory
        self._failures = {}
        self._locks = {}
        self._guard = threading.Lock()
        os.makedirs(directory, exist_ok=True)

    def _path(self, src, width, fmt):
        key = hashlib.sha256(f"{src}|{width}|{fmt}".encode()).hexdigest()
        return os.path.join(self.directory, key[:2], f"{key}.{fmt}")

    def cached(self, src, width, fmt):
        path = self._path(src, width, fmt)
        try:
            if time.time() - os.path.getmtime(path) < CACHE_TTL:
                with open(path, "rb") as f:
                    return f.read()
        except OSError:
            pass
        return None

    def recently_failed(self, src):
        failed_at = self._failures.get(src)
        return failed_at is not None and time.time() - failed_at < FAIL_TTL

    def create(self, src, width, fmt):
        with self._guard:
            lock = self._locks.setdefault(self._path(src, width, fmt), threading.Lock())
        with lock:  # ถ้ามีคำขอรูปเดียวกันพร้อมกัน ให้ดาวน์โหลดแค่ครั้งเดียว
            existing = self.cached(src, width, fmt)
            if existing:
                return existing
            try:
                data = resize(download_image(src), width, fmt)
            except ImageError:
                if len(self._failures) > 5000:
                    self._failures.clear()
                self._failures[src] = time.time()
                raise
            self._failures.pop(src, None)
            self._write(self._path(src, width, fmt), data)
            return data

    def _write(self, path, data):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = f"{path}.{threading.get_ident()}.tmp"
        with open(tmp, "wb") as f:
            f.write(data)
        os.replace(tmp, path)
        if hash(path) % 50 == 0:
            self._prune()

    def _prune(self):
        files = []
        for folder, _, names in os.walk(self.directory):
            files += [os.path.join(folder, n) for n in names if not n.endswith(".tmp")]
        if len(files) <= CACHE_MAX_FILES:
            return
        files.sort(key=lambda p: os.path.getmtime(p))
        for path in files[: len(files) - int(CACHE_MAX_FILES * 0.8)]:
            try:
                os.remove(path)
            except OSError:
                pass
