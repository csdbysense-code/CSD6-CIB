// advertise.js — หน้า "ประชาสัมพันธ์" (ดึงข้อมูลจาก Google Sheets, กรองตามหมวดหมู่, เรียงใหม่ล่าสุดก่อน)
(function () {
  const { el, toUrl, attachImage, parseThaiDate } = window.CSD6;

  const SHEET_ID = "1MssMgNiDmuRcGQNYi0pUylPMoUPjxMTu9f9Sslfe0mM";
  const GID = "0";

  // --- ตั้งค่าคอลัมน์ (Index เริ่มที่ 0) ---
  const COL_CATEGORY = 0; // Col A: ประเภทงาน
  const COL_DATE = 1; // Col B: วันที่
  const COL_TITLE = 2; // Col C: หัวข้อเรื่อง
  const COL_LINK = 3; // Col D: Link URL
  const COL_IMG = 4; // Col E: Image URL

  let allData = [];

  async function init() {
    try {
      const rows = await window.CSD6.fetchSheetCSV(SHEET_ID, GID);

      allData = rows
        .slice(1) // ข้าม Header
        .map((row, index) => {
          const title = (row[COL_TITLE] || "").trim();
          if (!title) return null; // กรองแถวว่าง
          return {
            order: index,
            sortDate: parseThaiDate(row[COL_DATE]),
            category: (row[COL_CATEGORY] || "").trim() || "ทั่วไป",
            date: (row[COL_DATE] || "").trim(),
            title,
            link: toUrl(row[COL_LINK]),
            images: [row[COL_IMG], row[COL_LINK]],
          };
        })
        .filter(Boolean)
        // เรียงใหม่ล่าสุดขึ้นก่อน (วันเดียวกัน: แถวที่เพิ่มทีหลังใน Sheet ขึ้นก่อน)
        .sort((a, b) => (b.sortDate || 0) - (a.sortDate || 0) || b.order - a.order);

      setupDropdown();
      renderCards(allData);

      document.getElementById("loading").style.display = "none";
      document.getElementById("pageTitle").innerText = "ประชาสัมพันธ์ข่าวสาร";
    } catch (error) {
      console.error(error);
      document.getElementById("loading").innerText = "เกิดข้อผิดพลาดในการดึงข้อมูล";
    }
  }

  function setupDropdown() {
    const select = document.getElementById("categoryFilter");
    const categories = [...new Set(allData.map((d) => d.category))];

    categories.forEach((cat) => {
      if (cat) select.appendChild(el("option", { value: cat, text: cat }));
    });

    select.addEventListener("change", (e) => {
      const filter = e.target.value;
      const titleElem = document.getElementById("pageTitle");
      if (filter === "all") {
        renderCards(allData);
        titleElem.innerText = "ประชาสัมพันธ์ข่าวสาร";
      } else {
        renderCards(allData.filter((item) => item.category === filter));
        titleElem.innerText = `หมวดหมู่: ${filter}`;
      }
    });
  }

  function renderCards(data) {
    const grid = document.getElementById("newsGrid");
    grid.replaceChildren();

    // Animation Reset
    grid.classList.remove("fade-in");
    void grid.offsetWidth;
    grid.classList.add("fade-in");

    if (data.length === 0) {
      grid.appendChild(el("p", { class: "news-empty", text: "ไม่พบข้อมูล" }));
      return;
    }

    data.forEach((item) => {
      const imageBox = el("div", { class: "card-image" });
      attachImage(imageBox, item.images, item.title);

      grid.appendChild(
        el(
          item.link ? "a" : "div",
          item.link ? { href: item.link, class: "news-card", target: "_blank", rel: "noopener" } : { class: "news-card" },
          [
            imageBox,
            el("div", { class: "card-content" }, [
              el("div", { class: "card-tag", text: item.category }),
              el("div", { class: "card-date", text: item.date }),
              el("h3", { class: "card-title", text: item.title }),
            ]),
          ],
        ),
      );
    });
  }

  init();
})();
