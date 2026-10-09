# ตั้งค่า gunicorn (Render จะอ่านไฟล์นี้อัตโนมัติเมื่อสั่ง `gunicorn app:app`)
# เดิมใช้ค่าเริ่มต้น 1 worker / 1 thread ทำให้ระหว่างดึงรูป ผู้ใช้คนอื่นต้องรอคิว
import os

workers = int(os.environ.get("WEB_CONCURRENCY", 2))
# งานส่วนใหญ่คือรอเครือข่าย (ดึงรูป) จึงใช้ thread จำนวนมากได้โดยไม่กินแรมเพิ่มมาก
threads = int(os.environ.get("GUNICORN_THREADS", 16))
timeout = 30
graceful_timeout = 20
keepalive = 5
accesslog = "-"
