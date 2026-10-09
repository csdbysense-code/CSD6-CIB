// success.js — หน้า "ผลงาน" (ดึงข่าวจาก Google Sheets, ตัวกรองช่วงเวลา, ค้นหา, เรียงลำดับ)
(function () {
  const { el, toUrl, attachImage, parseThaiDate, parseMonthLabel, formatThaiDate, THAI_MONTHS, THAI_MONTHS_SHORT } = window.CSD6;

  const SHEET_ID = "1s9Px5lhvXmfGuogF8E-QFZiPq_hJk74Rn5gULDxTMl8";
  const GID = "0";

  // --- การตั้งค่าคอลัมน์ (Index เริ่มที่ 0) ---
  const COL_MONTH = 0; // Col A: ตัวกรองเดือน
  const COL_TITLE = 2; // Col C: ชื่อเรื่อง
  const COL_DATE = 6; // Col G: วันที่
  const COL_LINK = 7; // Col H: ลิ้งค์ข่าว
  const COL_IMG = 8; // Col I: รูปภาพ

  const NEW_BADGE_DAYS = 14; // ข่าวที่ลงไม่เกินกี่วัน จะมีป้าย "ใหม่"

  const state = { month: "all", query: "", newestFirst: true };
  let allNewsData = [];
  let months = [];

  async function fetchData() {
    try {
      const rows = (await window.CSD6.fetchSheetCSV(SHEET_ID, GID)).slice(1); // ตัด Header

      allNewsData = rows
        .map((row, index) => {
          const title = (row[COL_TITLE] || "").trim();
          if (!title) return null;
          const filterMonth = (row[COL_MONTH] || "").trim() || "อื่นๆ";
          const date = parseThaiDate(row[COL_DATE]) || parseMonthLabel(filterMonth);
          return {
            order: index,
            filterMonth,
            title,
            date,
            displayDate: date ? formatThaiDate(date) : (row[COL_DATE] || "").trim(),
            link: toUrl(row[COL_LINK]),
            // รูปจาก Col I ถ้าใช้ไม่ได้ ใช้รูปปกของลิงก์ข่าว (Col H) แทน
            images: [row[COL_IMG], row[COL_LINK]],
          };
        })
        .filter(Boolean);

      months = buildMonths();
      state.month = readMonthFromHash();
      document.getElementById("loading").hidden = true;
      document.getElementById("filterContainer").hidden = false;

      initControls();
      render();
    } catch (error) {
      console.error("Error:", error);
      document.getElementById("loading").innerText = "ไม่สามารถดึงข้อมูลได้";
    }
  }

  function shortMonthLabel(label) {
    const monthIndex = THAI_MONTHS.findIndex((name) => label.includes(name));
    const yearMatch = label.match(/\d{4}/);
    if (monthIndex < 0) return label;
    return `${THAI_MONTHS_SHORT[monthIndex]}${yearMatch ? " " + yearMatch[0].slice(-2) : ""}`;
  }

  function isRecent(date) {
    if (!date) return false;
    const days = (Date.now() - date.getTime()) / 86400000;
    return days >= -1 && days <= NEW_BADGE_DAYS;
  }

  // ---------- ตัวกรอง ----------
  function buildMonths() {
    const map = new Map();
    allNewsData.forEach((item) => {
      const entry = map.get(item.filterMonth) || {
        key: item.filterMonth,
        count: 0,
        sortDate: parseMonthLabel(item.filterMonth),
        latest: null,
      };
      entry.count++;
      if (item.date && (!entry.latest || item.date > entry.latest)) entry.latest = item.date;
      map.set(item.filterMonth, entry);
    });
    return [...map.values()].sort(
      (a, b) => (b.sortDate || b.latest || 0) - (a.sortDate || a.latest || 0),
    );
  }

  function initControls() {
    const chips = document.getElementById("periodChips");
    const options = [{ key: "all", label: "ทั้งหมด", title: "ทั้งหมด", count: allNewsData.length }].concat(
      months.map((m) => ({ key: m.key, label: shortMonthLabel(m.key), title: m.key, count: m.count })),
    );

    options.forEach((opt) => {
      const chip = el("button", { type: "button", class: "period-chip", title: opt.title, role: "tab", "data-key": opt.key }, [
        el("span", { text: opt.label }),
        el("span", { class: "chip-count", text: opt.count }),
      ]);
      chip.addEventListener("click", () => selectMonth(opt.key));
      chips.appendChild(chip);
    });

    let searchTimer;
    document.getElementById("newsSearch").addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.query = e.target.value.trim().toLowerCase();
        render();
      }, 200);
    });

    document.getElementById("sortToggle").addEventListener("click", (e) => {
      state.newestFirst = !state.newestFirst;
      const btn = e.currentTarget;
      btn.querySelector("span").textContent = state.newestFirst ? "ใหม่ล่าสุดก่อน" : "เก่าสุดก่อน";
      btn.querySelector("i").className = state.newestFirst
        ? "fa-solid fa-arrow-down-wide-short"
        : "fa-solid fa-arrow-up-short-wide";
      render();
    });

    window.addEventListener("hashchange", () => {
      state.month = readMonthFromHash();
      render();
    });
  }

  // จำเดือนที่เลือกไว้ใน URL (#กันยายน 2569) เพื่อแชร์ลิงก์ได้
  function selectMonth(key) {
    state.month = key;
    const hash = key === "all" ? "" : "#" + encodeURIComponent(key);
    history.replaceState(null, "", location.pathname + location.search + hash);
    render();
  }

  function readMonthFromHash() {
    const key = decodeURIComponent(location.hash.slice(1));
    return months.some((m) => m.key === key) ? key : "all";
  }

  function updateChips() {
    document.querySelectorAll(".period-chip").forEach((chip) => {
      const active = chip.dataset.key === state.month;
      chip.classList.toggle("active", active);
      chip.setAttribute("aria-selected", active);
      // มือถือ: เลื่อนแถบชิปให้เห็นเดือนที่เลือก
      if (active) {
        const row = chip.parentElement;
        row.scrollLeft = chip.offsetLeft - row.offsetLeft - 8;
      }
    });
  }

  function compareNews(a, b) {
    const diff = (b.date || 0) - (a.date || 0) || b.order - a.order;
    return state.newestFirst ? diff : -diff;
  }

  // ---------- แสดงผล ----------
  function render() {
    updateChips();

    const items = allNewsData
      .filter((item) => state.month === "all" || item.filterMonth === state.month)
      .filter((item) => !state.query || item.title.toLowerCase().includes(state.query))
      .sort(compareNews);

    const periodText = state.month === "all" ? "ทุกช่วงเวลา" : `ประจำเดือน ${state.month}`;
    document.getElementById("newsResult").textContent =
      `${periodText} · พบ ${items.length} รายการ` + (state.query ? ` จากคำค้น “${state.query}”` : "");

    const list = document.getElementById("newsGrid");
    list.replaceChildren();
    list.classList.remove("fade-in");
    void list.offsetWidth;
    list.classList.add("fade-in");

    if (items.length === 0) {
      list.appendChild(el("p", { class: "news-empty", text: "ไม่พบข้อมูลข่าวในช่วงเวลานี้" }));
      return;
    }

    // แบ่งกลุ่มตามเดือน (เรียงตามลำดับที่ sort ไว้แล้ว)
    const groups = new Map();
    items.forEach((item) => {
      if (!groups.has(item.filterMonth)) groups.set(item.filterMonth, []);
      groups.get(item.filterMonth).push(item);
    });

    groups.forEach((groupItems, month) => {
      list.appendChild(
        el("section", { class: "month-group" }, [
          el("h2", { class: "month-title" }, [el("span", { text: month }), el("small", { text: `${groupItems.length} รายการ` })]),
          el("div", { class: "cards-grid" }, groupItems.map(createCard)),
        ]),
      );
    });
  }

  function createCard(item) {
    const imageBox = el("div", { class: "card-image" }, isRecent(item.date) ? el("span", { class: "card-new", text: "ใหม่" }) : null);
    attachImage(imageBox, item.images, item.title);

    return el(
      item.link ? "a" : "div",
      item.link ? { class: "news-card", href: item.link, target: "_blank", rel: "noopener" } : { class: "news-card" },
      [
        imageBox,
        el("div", { class: "card-content" }, [
          el("span", { class: "card-date", text: item.displayDate }),
          el("h3", { class: "card-title", text: item.title }),
        ]),
      ],
    );
  }

  fetchData();
})();
