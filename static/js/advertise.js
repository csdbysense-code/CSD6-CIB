// advertise.js — หน้า "ประชาสัมพันธ์" (รายการจาก Google Sheets กรองตามประเภท แบ่งกลุ่มตามเดือน)
(function () {
  const { toUrl, parseThaiDate, formatThaiDate } = window.CSD6;

  // --- ตั้งค่าคอลัมน์ (Index เริ่มที่ 0) ---
  const COL_CATEGORY = 0; // Col A: ประเภทงาน
  const COL_DATE = 1; // Col B: วันที่
  const COL_TITLE = 2; // Col C: หัวข้อเรื่อง
  const COL_LINK = 3; // Col D: Link URL
  const COL_IMG = 4; // Col E: Image URL

  window.CSD6.createNewsBoard({
    sheetId: "1MssMgNiDmuRcGQNYi0pUylPMoUPjxMTu9f9Sslfe0mM",
    parseRow(row) {
      const date = parseThaiDate(row[COL_DATE]);
      const category = (row[COL_CATEGORY] || "").trim() || "ทั่วไป";
      return {
        title: (row[COL_TITLE] || "").trim(),
        date,
        displayDate: date ? formatThaiDate(date) : (row[COL_DATE] || "").trim(),
        link: toUrl(row[COL_LINK]),
        images: [row[COL_IMG], row[COL_LINK]],
        filter: category,
        tag: category,
      };
    },
    filterLabel: (key) => key,
    filterTitle: (key) => `ประเภท: ${key}`,
    // ประเภทที่มีรายการมากก่อน
    sortFilters: (a, b) => b.count - a.count || a.key.localeCompare(b.key, "th"),
    allResultText: "ทุกประเภท",
    resultText: (key) => `ประเภท ${key}`,
    emptyText: "ไม่พบข้อมูลในประเภทนี้",
  });
})();
