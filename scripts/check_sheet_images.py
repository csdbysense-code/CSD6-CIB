"""ตรวจลิงก์รูปภาพ / ลิงก์ข่าวใน Google Sheets ว่ายังใช้งานได้หรือไม่

ใช้ตรรกะเดียวกับ /img ของเว็บ (imageproxy.py) จึงเห็นผลเหมือนที่ผู้เข้าชมเห็น
รันบนเครื่อง:   python scripts/check_sheet_images.py
GitHub Actions จะรันทุกวัน และแสดงผลเป็นตารางในหน้า Summary ของ workflow

หมายเหตุ: คอลัมน์ด้านล่างต้องตรงกับ static/js/success.js และ static/js/advertise.js
"""

import csv
import io
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from imageproxy import ImageError, download_image  # noqa: E402

SHEETS = [
    {
        "name": "ผลงาน",
        "id": "1s9Px5lhvXmfGuogF8E-QFZiPq_hJk74Rn5gULDxTMl8",
        "title": 2, "date": 6, "link": 7, "image": 8,
    },
    {
        "name": "ประชาสัมพันธ์",
        "id": "1MssMgNiDmuRcGQNYi0pUylPMoUPjxMTu9f9Sslfe0mM",
        "title": 2, "date": 1, "link": 3, "image": 4,
    },
]


def read_sheet(sheet_id):
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid=0"
    with urllib.request.urlopen(url, timeout=30) as resp:
        return list(csv.reader(io.StringIO(resp.read().decode("utf-8"))))[1:]


def is_url(value):
    return value.strip().lower().startswith(("http://", "https://"))


def check_row(sheet, number, row):
    cell = lambda key: row[sheet[key]].strip() if len(row) > sheet[key] else ""  # noqa: E731
    title, image, link, date = cell("title"), cell("image"), cell("link"), cell("date")
    problems = []
    if not date:
        problems.append("ไม่มีวันที่")
    if link and not is_url(link):
        problems.append("ลิงก์ข่าวไม่ใช่ URL")

    working = None  # ช่องที่ใช้ได้: "image" หรือ "link"
    for name, source in (("image", image), ("link", link)):
        if not is_url(source):
            continue
        try:
            download_image(source)
            working = name
            break
        except (ImageError, Exception):
            continue
    if working is None:
        problems.append("ไม่มีรูปที่ใช้ได้ (ทั้งช่องรูปและลิงก์ข่าว)")
    elif working == "link":
        problems.append("ช่องรูปใช้ไม่ได้ (เว็บใช้รูปจากลิงก์ข่าวแทน)")
    return {"sheet": sheet["name"], "row": number, "title": title, "problems": problems, "has_image": working is not None}


def main():
    results = []
    for sheet in SHEETS:
        rows = read_sheet(sheet["id"])
        jobs = [(sheet, i + 2, row) for i, row in enumerate(rows) if len(row) > sheet["title"] and row[sheet["title"]].strip()]
        with ThreadPoolExecutor(max_workers=6) as pool:
            results += list(pool.map(lambda job: check_row(*job), jobs))

    broken = [r for r in results if r["problems"]]
    lines = [
        "## ตรวจรูปภาพใน Google Sheets",
        "",
        f"ตรวจทั้งหมด {len(results)} รายการ · มีรูปแสดงได้ {sum(r['has_image'] for r in results)} รายการ · ควรแก้ไข {len(broken)} รายการ",
        "",
    ]
    if broken:
        lines += ["| Sheet | แถว | หัวข้อ | ปัญหา |", "|---|---|---|---|"]
        for r in sorted(broken, key=lambda r: (r["sheet"], r["row"])):
            title = r["title"].replace("|", "/")[:60]
            lines.append(f"| {r['sheet']} | {r['row']} | {title} | {', '.join(r['problems'])} |")
    report = "\n".join(lines) + "\n"

    print(report)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write(report)


if __name__ == "__main__":
    main()
