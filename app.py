import os
import threading
import time
from collections import defaultdict, deque

from flask import Flask, Response, abort, render_template, request, send_from_directory

from imageproxy import ALLOWED_WIDTHS, ImageCache, ImageError, is_public_url


class CSD6Flask(Flask):
    # ไฟล์ static ที่มี ?v=... (ใส่ให้อัตโนมัติด้านล่าง) cache ได้ 1 ปี เพราะเปลี่ยนไฟล์เมื่อไร v ก็เปลี่ยน
    # ไฟล์ที่ถูกเรียกจาก CSS โดยตรง (ไม่มี v) cache 1 วัน
    def get_send_file_max_age(self, filename):
        return 365 * 24 * 60 * 60 if request.args.get("v") else 24 * 60 * 60


app = CSD6Flask(__name__)
# ให้ /about/ (มี / ท้าย) เปิดได้เหมือน /about ไม่ขึ้น 404
app.url_map.strict_slashes = False

# ที่อยู่เว็บจริง ใช้ทำ canonical / og:url / sitemap (เปลี่ยนได้ผ่าน environment variable)
SITE_URL = os.environ.get("SITE_URL", "https://csd6-cib.onrender.com").rstrip("/")

# หน้าที่แสดงในเมนูและ sitemap
PAGES = [
    ("index", "/"),
    ("about", "/about"),
    ("success", "/success"),
    ("advertise", "/advertise"),
    ("contact", "/contact"),
    ("privacy", "/privacy-policy"),
]


@app.url_defaults
def add_static_version(endpoint, values):
    # ใส่เวลาที่แก้ไขไฟล์ล่าสุดต่อท้ายลิงก์ static เพื่อให้ผู้ใช้ได้ไฟล์ใหม่ทันทีหลังอัปเดต
    if endpoint == "static" and "filename" in values:
        path = os.path.join(app.static_folder, values["filename"])
        try:
            values["v"] = int(os.stat(path).st_mtime)
        except OSError:
            pass


@app.context_processor
def inject_site():
    path = request.path.rstrip("/") or "/"  # /about/ กับ /about คือหน้าเดียวกัน
    return {"site_url": SITE_URL, "canonical_url": SITE_URL + path}


# 1. หน้าแรก (Home)
@app.route("/")
def index():
    return render_template("index.html")

# 2. หน้าเกี่ยวกับเรา (About)
@app.route("/about")
def about():
    return render_template("about.html")

@app.route("/success")
def success():
    return render_template("success.html")

@app.route("/advertise")
def advertise():
    return render_template("advertise.html")

@app.route("/contact")
def contact():
    return render_template("contact.html")

@app.route('/privacy-policy')
def privacy():
    return render_template('privacy_policy.html')


# --- รูปภาพ: ดึงจากลิงก์ใน Google Sheet ย่อขนาด แล้วส่งจาก server ของเรา ---
image_cache = ImageCache()

# จำกัดจำนวนรูปที่ "ยังไม่มีใน cache" ต่อ IP กันคนใช้ server เราไปดึงเว็บอื่นรัวๆ
# (หน้าผลงานมี ~75 ข่าว x รูปสำรอง 2 ลิงก์ หลัง deploy ใหม่ cache จะว่าง จึงต้องเผื่อไว้พอ)
IMAGE_MISS_LIMIT = 300  # ครั้ง / นาที / IP
_image_misses = defaultdict(deque)
_image_misses_lock = threading.Lock()


def client_ip():
    return (
        request.headers.get("CF-Connecting-IP")
        or request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or request.remote_addr
    )


def allow_image_miss(ip):
    now = time.time()
    with _image_misses_lock:
        hits = _image_misses[ip]
        while hits and now - hits[0] > 60:
            hits.popleft()
        if len(hits) >= IMAGE_MISS_LIMIT:
            return False
        hits.append(now)
        if len(_image_misses) > 10_000:
            _image_misses.clear()
        return True


@app.route("/img")
def image():
    src = request.args.get("src", "").strip()
    try:
        width = int(request.args.get("w", 600))
    except ValueError:
        abort(400)
    if width not in ALLOWED_WIDTHS or not src.startswith(("http://", "https://")):
        abort(400)

    fmt = "webp" if "image/webp" in request.headers.get("Accept", "") else "jpeg"
    data = image_cache.cached(src, width, fmt)
    if data is None:
        if image_cache.recently_failed(src) or not is_public_url(src):
            abort(404)
        if not allow_image_miss(client_ip()):
            abort(429)
        try:
            data = image_cache.create(src, width, fmt)
        except ImageError:
            abort(404)

    return Response(
        data,
        mimetype=f"image/{fmt}",
        headers={
            "Cache-Control": "public, max-age=604800",
            "Vary": "Accept",
            "X-Content-Type-Options": "nosniff",
        },
    )


# --- SEO / ไฟล์มาตรฐานของเว็บ ---
@app.route("/robots.txt")
def robots():
    body = f"User-agent: *\nAllow: /\nDisallow: /img\n\nSitemap: {SITE_URL}/sitemap.xml\n"
    return Response(body, mimetype="text/plain")


@app.route("/sitemap.xml")
def sitemap():
    urls = "".join(f"  <url><loc>{SITE_URL}{path}</loc></url>\n" for _, path in PAGES)
    body = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n'
    return Response(body, mimetype="application/xml")


@app.route("/favicon.ico")
def favicon():
    return send_from_directory(app.static_folder, "images/favicon.png", mimetype="image/png", max_age=7 * 24 * 60 * 60)


@app.errorhandler(404)
def not_found(error):
    return render_template("error.html", code=404, noindex=True, title="ไม่พบหน้าที่ต้องการ",
                           message="หน้าที่ท่านค้นหาอาจถูกย้าย ลบ หรือพิมพ์ที่อยู่ไม่ถูกต้อง"), 404


@app.errorhandler(405)
def method_not_allowed(error):
    return render_template("error.html", code=405, noindex=True, title="ไม่รองรับคำขอนี้",
                           message="หน้านี้เปิดดูได้อย่างเดียว กรุณากลับไปที่หน้าหลัก"), 405


@app.errorhandler(500)
def server_error(error):
    return render_template("error.html", code=500, noindex=True, title="ระบบขัดข้องชั่วคราว",
                           message="ขออภัยในความไม่สะดวก กรุณาลองใหม่อีกครั้งในภายหลัง"), 500


if __name__ == "__main__":
    # รันบนเครื่องตัวเอง: python app.py   (บน server ใช้ gunicorn ตาม gunicorn.conf.py)
    # เปิดโหมด debug เฉพาะเมื่อตั้ง FLASK_DEBUG=1 เท่านั้น ห้ามเปิดบน server จริง
    app.run(
        host="127.0.0.1",
        port=int(os.environ.get("PORT", 5000)),
        debug=os.environ.get("FLASK_DEBUG") == "1",
    )
