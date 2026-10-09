// common.js — ฟังก์ชันที่ใช้ร่วมกันในหน้าที่ดึงข้อมูลจาก Google Sheets (ผลงาน / ประชาสัมพันธ์ / เกี่ยวกับเรา)
// ทุกฟังก์ชันอยู่ใต้ window.CSD6 เพื่อไม่ให้ชนกับตัวแปรอื่น
(function () {
  const THAI_MONTHS = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];
  const THAI_MONTHS_SHORT = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ];

  // ---------- Google Sheets ----------
  async function fetchSheetCSV(sheetId, gid = "0") {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Sheet ${response.status}`);
    return parseCSV(await response.text());
  }

  // แปลง CSV เป็น Array (รองรับเครื่องหมายจุลภาค / ขึ้นบรรทัดใหม่ / "" ภายในข้อความ)
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let col = "";
    let quote = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];
      if (c === '"') {
        if (quote && next === '"') {
          col += '"';
          i++;
        } else {
          quote = !quote;
        }
      } else if (c === "," && !quote) {
        row.push(col);
        col = "";
      } else if ((c === "\n" || c === "\r") && !quote) {
        if (c === "\r" && next === "\n") i++;
        row.push(col);
        rows.push(row);
        row = [];
        col = "";
      } else {
        col += c;
      }
    }
    if (col !== "" || row.length > 0) {
      row.push(col);
      rows.push(row);
    }
    return rows;
  }

  // ---------- วันที่ ----------
  // รองรับ d/m/yyyy ทั้ง พ.ศ. (2569) และ ค.ศ. (2026)
  function parseThaiDate(text) {
    const m = (text || "").trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (!m) return null;
    let year = parseInt(m[3], 10);
    if (year > 2400) year -= 543;
    const date = new Date(year, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    return isNaN(date) ? null : date;
  }

  // แปลงชื่อเดือน เช่น "กันยายน 2569" เป็นวันที่ 1 ของเดือนนั้น
  function parseMonthLabel(label) {
    const monthIndex = THAI_MONTHS.findIndex((name) => label.includes(name));
    const yearMatch = label.match(/\d{4}/);
    if (monthIndex < 0 || !yearMatch) return null;
    let year = parseInt(yearMatch[0], 10);
    if (year > 2400) year -= 543;
    return new Date(year, monthIndex, 1);
  }

  function formatThaiDate(date) {
    return `${date.getDate()} ${THAI_MONTHS_SHORT[date.getMonth()]} ${date.getFullYear() + 543}`;
  }

  // ---------- ลิงก์ / รูปภาพ ----------
  // รับเฉพาะลิงก์ http(s) กันลิงก์แปลกๆ เช่น javascript: จาก Sheet
  function toUrl(value) {
    const url = (value || "").trim();
    return /^https?:\/\//i.test(url) ? url : "";
  }

  // รูปทุกรูปโหลดผ่าน server ของเรา (/img) ซึ่งหารูปจริง ย่อขนาด และเก็บ cache ให้
  function imageUrl(src, width = 600) {
    return `/img?src=${encodeURIComponent(src)}&w=${width}`;
  }

  // ใส่รูปลงใน container ถ้ารูปแรกเสียจะลองลิงก์ถัดไป ถ้าเสียหมดจะใส่ class "no-image"
  function attachImage(container, links, alt, width = 600) {
    const sources = [...new Set(links.map(toUrl).filter(Boolean))].map((link) => imageUrl(link, width));
    if (sources.length === 0) {
      container.classList.add("no-image");
      return null;
    }
    const img = document.createElement("img");
    img.alt = alt;
    img.loading = "lazy";
    img.decoding = "async";
    img.addEventListener("load", () => container.classList.add("loaded"));
    img.addEventListener("error", () => {
      const next = sources.shift();
      if (next) {
        img.src = next;
      } else {
        img.remove();
        container.classList.add("no-image");
      }
    });
    img.src = sources.shift();
    container.appendChild(img);
    return img;
  }

  // ---------- สร้าง element (ใส่ข้อความด้วย textContent เสมอ กันการฝังสคริปต์จาก Sheet) ----------
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else node.setAttribute(key, value);
    }
    for (const child of [].concat(children)) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  window.CSD6 = {
    THAI_MONTHS,
    THAI_MONTHS_SHORT,
    fetchSheetCSV,
    parseCSV,
    parseThaiDate,
    parseMonthLabel,
    formatThaiDate,
    toUrl,
    imageUrl,
    attachImage,
    el,
  };
})();
