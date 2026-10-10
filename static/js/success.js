// success.js — หน้า "ผลงาน" (รายการข่าวจาก Google Sheets กรองตามเดือน)
(function () {
  const { toUrl, parseThaiDate, parseMonthLabel, formatThaiDate, THAI_MONTHS, THAI_MONTHS_SHORT } = window.CSD6;

  // --- การตั้งค่าคอลัมน์ (Index เริ่มที่ 0) ---
  const COL_MONTH = 0; // Col A: ตัวกรองเดือน
  const COL_TITLE = 2; // Col C: ชื่อเรื่อง
  const COL_DATE = 6; // Col G: วันที่
  const COL_LINK = 7; // Col H: ลิ้งค์ข่าว
  const COL_IMG = 8; // Col I: รูปภาพ

  // "กันยายน 2569" → "ก.ย. 69"
  function shortMonthLabel(label) {
    const monthIndex = THAI_MONTHS.findIndex((name) => label.includes(name));
    const yearMatch = label.match(/\d{4}/);
    if (monthIndex < 0) return label;
    return `${THAI_MONTHS_SHORT[monthIndex]}${yearMatch ? " " + yearMatch[0].slice(-2) : ""}`;
  }

  window.CSD6.createNewsBoard({
    sheetId: "1s9Px5lhvXmfGuogF8E-QFZiPq_hJk74Rn5gULDxTMl8",
    parseRow(row) {
      const month = (row[COL_MONTH] || "").trim() || "อื่นๆ";
      const date = parseThaiDate(row[COL_DATE]) || parseMonthLabel(month);
      return {
        title: (row[COL_TITLE] || "").trim(),
        date,
        displayDate: date ? formatThaiDate(date) : (row[COL_DATE] || "").trim(),
        link: toUrl(row[COL_LINK]),
        // รูปจาก Col I ถ้าใช้ไม่ได้ ใช้รูปปกของลิงก์ข่าว (Col H) แทน
        images: [row[COL_IMG], row[COL_LINK]],
        filter: month,
      };
    },
    groupBy: (item) => item.filter,
    filterLabel: shortMonthLabel,
    filterTitle: (key) => key,
    sortFilters: (a, b) => (parseMonthLabel(b.key) || b.latest || 0) - (parseMonthLabel(a.key) || a.latest || 0),
    allResultText: "ทุกช่วงเวลา",
    resultText: (key) => `ประจำเดือน ${key}`,
    emptyText: "ไม่พบข้อมูลข่าวในช่วงเวลานี้",
  });
})();
