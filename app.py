import html
import ipaddress
import os
import re
import socket
import time
import urllib.request
from urllib.parse import urlparse

from flask import Flask, Response, abort, redirect, render_template, request

app = Flask(__name__)

# --- ตัวช่วยดึงรูปภาพจากลิงก์หน้าเว็บ (Facebook / เว็บข่าว) ---
# ลิงก์รูปใน Sheet บางอันเป็น "ลิงก์หน้าโพสต์/หน้าข่าว" ไม่ใช่ไฟล์รูปโดยตรง
# endpoint นี้จะเปิดหน้านั้นแล้วหา og:image มาให้ (เก็บ cache ไว้ 6 ชั่วโมง)
OG_CACHE = {}
OG_CACHE_TTL = 6 * 60 * 60
OG_CACHE_FAIL_TTL = 10 * 60
OG_USER_AGENTS = [
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Twitterbot/1.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
]
OG_PATTERNS = [
    re.compile(r"""<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::src)?["'][^>]*content=["']([^"']+)""", re.I),
    re.compile(r"""<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']""", re.I),
]


def is_public_url(url):
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


def find_og_image(url):
    for ua in OG_USER_AGENTS:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept-Language": "th,en;q=0.8"})
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.headers.get_content_type().startswith("image/"):
                    return resp.geturl()
                page = resp.read(1_500_000).decode("utf-8", errors="ignore")
        except Exception:
            continue
        for pattern in OG_PATTERNS:
            match = pattern.search(page)
            if match:
                return html.unescape(match.group(1))
    return None

# 1. หน้าแรก (Home)
@app.route("/")
def index():
    # คำสั่งนี้จะไปเปิดไฟล์ templates/index.html 
    # และ index.html จะไปดึง layout.html มาประกอบร่างเองโดยอัตโนมัติ
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
    # จะไปเรียกไฟล์ templates/privacy_policy.html
    return render_template('privacy_policy.html')

@app.route("/api/image")
def resolve_image():
    url = request.args.get("url", "").strip()
    if not url or not is_public_url(url):
        abort(400)

    cached = OG_CACHE.get(url)
    # ถ้าครั้งก่อนหารูปไม่เจอ ให้ลองใหม่หลัง 10 นาที (กัน error ชั่วคราวค้างนาน)
    ttl = OG_CACHE_TTL if cached and cached[0] else OG_CACHE_FAIL_TTL
    if cached and time.time() - cached[1] < ttl:
        image = cached[0]
    else:
        image = find_og_image(url)
        OG_CACHE[url] = (image, time.time())

    if not image:
        abort(404)

    # รูปจาก lookaside.fbsbx.com เปิดได้เฉพาะ crawler จึงต้องดึงผ่าน server ให้
    if urlparse(image).hostname == "lookaside.fbsbx.com":
        try:
            req = urllib.request.Request(image, headers={"User-Agent": OG_USER_AGENTS[0]})
            with urllib.request.urlopen(req, timeout=10) as resp:
                content_type = resp.headers.get_content_type()
                if not content_type.startswith("image/"):
                    abort(404)
                data = resp.read(8_000_000)
        except Exception:
            abort(404)
        return Response(data, mimetype=content_type,
                        headers={"Cache-Control": "public, max-age=86400"})

    response = redirect(image)
    response.headers["Cache-Control"] = "public, max-age=3600"
    return response

if __name__ == "__main__":
    app.run(debug=True) # เปิดโหมด debug เพื่อให้เว็บอัปเดตอัตโนมัติเวลาเราแก้โค้ด

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)