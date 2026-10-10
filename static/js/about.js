// about.js — หน้า "เกี่ยวกับเรา" (แท็บเนื้อหา + โครงสร้างผู้บังคับบัญชาจาก Google Sheets)
(function () {
  const { el, attachImage } = window.CSD6;

  // ---------- แท็บ (กดลูกศรซ้าย/ขวา, Home, End เพื่อเปลี่ยนแท็บด้วยคีย์บอร์ดได้) ----------
  const tabButtons = [...document.querySelectorAll(".tab-btn[data-tab]")];
  tabButtons.forEach((button, index) => {
    button.addEventListener("click", () => openTab(button.dataset.tab));
    button.addEventListener("keydown", (e) => {
      const keys = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabButtons.length - 1 };
      if (!(e.key in keys)) return;
      e.preventDefault();
      const next = tabButtons[(keys[e.key] + tabButtons.length) % tabButtons.length];
      openTab(next.dataset.tab);
      next.focus();
    });
  });

  function openTab(tabName) {
    document.querySelectorAll(".content-section").forEach((section) => {
      section.classList.toggle("active", section.id === tabName);
    });
    tabButtons.forEach((button) => {
      const active = button.dataset.tab === tabName;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active);
      button.tabIndex = active ? 0 : -1;
    });
  }

  // ---------- ผู้บังคับบัญชา ----------
  const SHEET_ID = "1XW51ZiRuXKo15D1rXYNjViCqsf_InhlFZJ0oTvWKFrw";
  const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

  const GROUPS = [
    { key: "chief", title: "ผู้กำกับการ 6 บก.ป.", isChief: true },
    { key: "deputy", title: "รองผู้กำกับการ 6 บก.ป." },
    { key: "inspector", title: "สารวัตร กก.6 บก.ป." },
  ];

  async function fetchCommanders() {
    const container = document.getElementById("commander-container");
    try {
      const text = await (await fetch(SHEET_URL)).text();
      // Google ส่งข้อมูลมาในรูปแบบ google.visualization.Query.setResponse({...}); ต้องตัดส่วนหัวท้ายออก
      const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));

      const commanders = { chief: [], deputy: [], inspector: [] };
      json.table.rows.forEach((row) => {
        // c[0] = group, c[1] = rank, c[2] = name, c[3] = position, c[4] = image
        const cell = (i) => String(row.c[i]?.v ?? "").trim();
        const group = cell(0);
        if (commanders[group]) {
          commanders[group].push({ rank: cell(1), name: cell(2), position: cell(3), image: cell(4) });
        }
      });

      container.replaceChildren(
        ...GROUPS.filter((g) => commanders[g.key].length > 0).map((g) =>
          el("div", { class: "rank-section" }, [
            el("div", { class: "rank-title", text: g.title }),
            el("div", { class: "commander-row" }, commanders[g.key].map((person) => createCard(person, g.isChief))),
          ]),
        ),
      );
    } catch (error) {
      console.error("Error fetching data:", error);
      container.replaceChildren(
        el("p", { style: "text-align:center; color:red;", text: "เกิดข้อผิดพลาดในการโหลดข้อมูล" }),
      );
    }
  }

  function createCard(person, isChief) {
    const photo = el("div", { class: "img-placeholder" });
    const img = attachImage(photo, [person.image], `รูป ${person.position}`, 400);
    if (img) {
      img.style.cssText = "width: 150px; height: 200px; object-fit: cover;";
    } else {
      photo.style.cssText = "display: flex; align-items: center; justify-content: center;";
      photo.append(el("span", { text: "(รูปภาพ)" }));
    }

    return el("div", { class: isChief ? "commander-card chief-card" : "commander-card" }, [
      photo,
      el("span", { class: "rank", text: person.rank }),
      el("div", { class: "name", text: person.name }),
      el("div", { class: "position", text: person.position }),
    ]);
  }

  fetchCommanders();
})();
