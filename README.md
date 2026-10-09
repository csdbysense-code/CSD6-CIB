#ฝึกทำเว็บไซร์ ของกองกำกับครั้งแรก
เว็บของ กก.6 บก.ป. ใช้ git pull ดึงลง VSCode
และบรรทัดนี้ ใช้ git pull เพื่อดึงขึ้น Server โดย ใช้ git add. ก่อน จากนั้น git commit -m "add อะไรแล้วแต่ที่เราตั้งชื่อเพื่อเพิ่มเติมเข้าไป " แล้วจบด้วย git push เป็นอันเสร็จสิ้น

## โครงสร้างโปรเจกต์

| ไฟล์ / โฟลเดอร์ | หน้าที่ |
|---|---|
| `app.py` | เส้นทางหน้าเว็บ, `/img`, `robots.txt`, `sitemap.xml`, หน้า 404/500 |
| `imageproxy.py` | ดึงรูปจากลิงก์ใน Google Sheet (Drive / Facebook / YouTube / เว็บข่าว) ย่อขนาด และเก็บ cache |
| `gunicorn.conf.py` | ตั้งค่า server บน Render (จำนวน worker / thread) |
| `templates/` | หน้าเว็บ (ทุกหน้าใช้ `layout.html` เป็นโครงหลัก) |
| `static/js/` | JavaScript แยกตามหน้า (`common.js` = ฟังก์ชันที่ใช้ร่วมกัน) |
| `tests/` | ทดสอบอัตโนมัติ |
| `scripts/check_sheet_images.py` | ตรวจลิงก์รูปใน Google Sheet ว่าแถวไหนควรแก้ |

## รันบนเครื่องตัวเอง

```bash
pip install -r requirements.txt
flask --app app run --debug
```

เปิด http://localhost:5000

## ทดสอบก่อน push

```bash
python -m unittest -v
```

GitHub Actions จะรันทดสอบให้อัตโนมัติทุกครั้งที่ push และตรวจรูปใน Google Sheet ทุกวัน (ดูผลได้ที่แท็บ Actions → CI → Summary)
