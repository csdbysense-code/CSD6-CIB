// newsboard.js — รายการข่าวแบบการ์ด ใช้ร่วมกันในหน้า "ผลงาน" และ "ประชาสัมพันธ์"
// (ค้นหา, เรียงใหม่/เก่า, ปุ่มตัวกรองพร้อมจำนวน, แบ่งกลุ่มตามเดือน, ป้าย "ใหม่", แชร์ลิงก์ตัวกรองผ่าน #)
//
// แต่ละหน้าเรียก CSD6.createNewsBoard({...}) พร้อมบอกว่า Sheet ไหน คอลัมน์ไหน และกรองด้วยอะไร
(function () {
  const { el, attachImage, THAI_MONTHS } = window.CSD6;

  const NEW_BADGE_DAYS = 14; // ข่าวที่ลงไม่เกินกี่วัน จะมีป้าย "ใหม่"

  function monthLabel(date) {
    return date ? `${THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}` : "ไม่ระบุวันที่";
  }

  function isRecent(date) {
    if (!date) return false;
    const days = (Date.now() - date.getTime()) / 86400000;
    return days >= -1 && days <= NEW_BADGE_DAYS;
  }

  /**
   * config:
   *   sheetId, gid
   *   parseRow(row) → { title, date, displayDate, link, images, filter, tag? } หรือ null ถ้าข้ามแถวนี้
   *   filterLabel(key), filterTitle(key)   ข้อความบนปุ่มตัวกรอง (สั้น) / ข้อความเต็ม
   *   sortFilters(a, b)                   ลำดับปุ่ม (a, b = { key, count, latest })
   *   allResultText, resultText(key)      ข้อความสรุปผลด้านล่างตัวกรอง
   *   groupBy(item)                       ชื่อกลุ่ม (ค่าเริ่มต้น = เดือนของวันที่)
   *   emptyText
   */
  function createNewsBoard(config) {
    const $ = (id) => document.getElementById(id);
    const state = { filter: "all", query: "", newestFirst: true };
    const groupBy = config.groupBy || ((item) => monthLabel(item.date));
    let items = [];
    let filters = [];

    async function start() {
      try {
        const rows = (await window.CSD6.fetchSheetCSV(config.sheetId, config.gid || "0")).slice(1); // ตัด Header
        items = rows
          .map((row, index) => {
            const item = config.parseRow(row);
            return item && item.title ? { ...item, order: index } : null;
          })
          .filter(Boolean);

        filters = buildFilters();
        state.filter = readFilterFromHash();
        $("loading").hidden = true;
        $("filterContainer").hidden = false;
        initControls();
        render();
      } catch (error) {
        console.error("Error:", error);
        $("loading").textContent = "ไม่สามารถดึงข้อมูลได้ กรุณาลองใหม่อีกครั้ง";
      }
    }

    // ---------- ตัวกรอง ----------
    function buildFilters() {
      const map = new Map();
      items.forEach((item) => {
        const entry = map.get(item.filter) || { key: item.filter, count: 0, latest: null };
        entry.count++;
        if (item.date && (!entry.latest || item.date > entry.latest)) entry.latest = item.date;
        map.set(item.filter, entry);
      });
      return [...map.values()].sort(config.sortFilters || ((a, b) => (b.latest || 0) - (a.latest || 0)));
    }

    function initControls() {
      const chips = $("periodChips");
      const options = [{ key: "all", label: "ทั้งหมด", title: "ทั้งหมด", count: items.length }].concat(
        filters.map((f) => ({ key: f.key, label: config.filterLabel(f.key), title: config.filterTitle(f.key), count: f.count })),
      );
      options.forEach((opt) => {
        const chip = el("button", { type: "button", class: "period-chip", title: opt.title, "data-key": opt.key, "aria-pressed": "false" }, [
          el("span", { text: opt.label }),
          el("span", { class: "chip-count", text: opt.count, "aria-label": `${opt.count} รายการ` }),
        ]);
        chip.addEventListener("click", () => selectFilter(opt.key));
        chips.appendChild(chip);
      });

      let searchTimer;
      $("newsSearch").addEventListener("input", (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          state.query = e.target.value.trim().toLowerCase();
          render();
        }, 200);
      });

      $("sortToggle").addEventListener("click", (e) => {
        state.newestFirst = !state.newestFirst;
        const btn = e.currentTarget;
        btn.querySelector("span").textContent = state.newestFirst ? "ใหม่ล่าสุดก่อน" : "เก่าสุดก่อน";
        btn.querySelector("i").className = state.newestFirst
          ? "fa-solid fa-arrow-down-wide-short"
          : "fa-solid fa-arrow-up-short-wide";
        render();
      });

      window.addEventListener("hashchange", () => {
        state.filter = readFilterFromHash();
        render();
      });
    }

    // จำตัวกรองที่เลือกไว้ใน URL (เช่น #กันยายน 2569) เพื่อแชร์ลิงก์ได้
    function selectFilter(key) {
      state.filter = key;
      const hash = key === "all" ? "" : "#" + encodeURIComponent(key);
      history.replaceState(null, "", location.pathname + location.search + hash);
      render();
    }

    function readFilterFromHash() {
      let key = "";
      try {
        key = decodeURIComponent(location.hash.slice(1));
      } catch (e) {
        // hash ที่เข้ารหัสผิดรูปแบบ ให้แสดงทั้งหมด
      }
      return filters.some((f) => f.key === key) ? key : "all";
    }

    function updateChips() {
      document.querySelectorAll(".period-chip").forEach((chip) => {
        const active = chip.dataset.key === state.filter;
        chip.classList.toggle("active", active);
        chip.setAttribute("aria-pressed", active);
        // มือถือ: เลื่อนแถบปุ่มให้เห็นตัวที่เลือก
        if (active) {
          const row = chip.parentElement;
          row.scrollLeft = chip.offsetLeft - row.offsetLeft - 8;
        }
      });
    }

    function compare(a, b) {
      const diff = (b.date || 0) - (a.date || 0) || b.order - a.order;
      return state.newestFirst ? diff : -diff;
    }

    // ---------- แสดงผล ----------
    function render() {
      updateChips();

      const visible = items
        .filter((item) => state.filter === "all" || item.filter === state.filter)
        .filter((item) => !state.query || item.title.toLowerCase().includes(state.query))
        .sort(compare);

      const scope = state.filter === "all" ? config.allResultText : config.resultText(state.filter);
      $("newsResult").textContent =
        `${scope} · พบ ${visible.length} รายการ` + (state.query ? ` จากคำค้น “${state.query}”` : "");

      const list = $("newsGrid");
      list.replaceChildren();
      list.classList.remove("fade-in");
      void list.offsetWidth;
      list.classList.add("fade-in");

      if (visible.length === 0) {
        if (state.query) {
          // ไม่พบเพราะคำค้น: บอกให้ชัดและมีปุ่มล้างคำค้น
          const clear = el("button", { type: "button", class: "news-clear", text: "ล้างคำค้น" });
          clear.addEventListener("click", () => {
            $("newsSearch").value = "";
            state.query = "";
            render();
            $("newsSearch").focus();
          });
          list.appendChild(el("div", { class: "news-empty" }, [el("p", { text: `ไม่พบรายการที่ตรงกับคำค้น “${state.query}”` }), clear]));
        } else {
          list.appendChild(el("p", { class: "news-empty", text: config.emptyText || "ไม่พบข้อมูล" }));
        }
        return;
      }

      // แบ่งกลุ่ม (เรียงตามลำดับที่ sort ไว้แล้ว)
      const groups = new Map();
      visible.forEach((item) => {
        const key = groupBy(item);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
      });

      groups.forEach((groupItems, name) => {
        list.appendChild(
          el("section", { class: "month-group" }, [
            el("h2", { class: "month-title" }, [el("span", { text: name }), el("small", { text: `${groupItems.length} รายการ` })]),
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
            item.tag ? el("span", { class: "card-tag", text: item.tag }) : null,
            el("span", { class: "card-date", text: item.displayDate }),
            el("h3", { class: "card-title", text: item.title }),
          ]),
        ],
      );
    }

    start();
  }

  window.CSD6.monthLabel = monthLabel;
  window.CSD6.createNewsBoard = createNewsBoard;
})();
