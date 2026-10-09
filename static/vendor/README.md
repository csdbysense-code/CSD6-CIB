# ไฟล์ฟอนต์ที่เก็บไว้ในเว็บเอง

เดิมโหลดจาก CDN ภายนอก (Google Fonts / cdnjs) ซึ่งทำให้ IP ของผู้เข้าชมถูกส่งไปยังบริการเหล่านั้นทุกครั้งที่เปิดเว็บ
จึงย้ายมาเก็บไว้ที่ server ของเราเอง (PDPA)

| โฟลเดอร์ | ที่มา | License |
|---|---|---|
| `fontawesome/` | Font Awesome Free 6.5.1 (cdnjs) — ใช้เฉพาะไฟล์ .woff2 | Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT (https://fontawesome.com/license/free) |
| `sarabun/` | Sarabun จาก Google Fonts น้ำหนัก 300/400/500/700 | SIL Open Font License 1.1 (`sarabun/OFL.txt`) |

ถ้าต้องการน้ำหนักฟอนต์เพิ่ม (เช่น 600) ให้ดาวน์โหลดจาก Google Fonts แล้วเพิ่ม `@font-face` ใน `sarabun/css/sarabun.css`
