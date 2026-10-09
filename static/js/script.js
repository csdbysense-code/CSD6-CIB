// script.js — ใช้ร่วมกันทุกหน้า (วันที่ด้านบน + เมนูมือถือ + การยินยอมคุกกี้)

// ---------- การยินยอมคุกกี้ (PDPA) ----------
// "all" = ยอมรับทั้งหมด (โหลดเนื้อหาภายนอก เช่น Google Maps ได้ทันที)
// "necessary" = เฉพาะที่จำเป็น (เนื้อหาภายนอกจะโหลดเมื่อผู้ใช้กดเองเท่านั้น)
window.CSD6Consent = (function () {
  const KEY = "cookieConsent";
  const read = () => {
    try {
      const value = localStorage.getItem(KEY);
      return value === "all" || value === "necessary" ? value : null;
    } catch (e) {
      return null;
    }
  };
  return {
    get: read,
    set(value) {
      try {
        localStorage.setItem(KEY, value);
      } catch (e) {
        // โหมดส่วนตัวบางเบราว์เซอร์บันทึกไม่ได้ ใช้งานต่อได้ตามปกติ
      }
      document.dispatchEvent(new CustomEvent("csd6:consent", { detail: value }));
    },
  };
})();

document.addEventListener("DOMContentLoaded", () => {
  const banner = document.getElementById("cookie-banner");
  if (banner) {
    if (!window.CSD6Consent.get()) banner.hidden = false;
    banner.querySelectorAll("[data-consent]").forEach((button) => {
      button.addEventListener("click", () => {
        window.CSD6Consent.set(button.dataset.consent);
        banner.hidden = true;
      });
    });
  }

  // แสดงวันที่ปัจจุบันที่แถบด้านบน
  const dateElement = document.getElementById("current-date");
  if (dateElement) {
    dateElement.innerText = new Date().toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  }

  // Hamburger Menu Toggle
  const hamburger = document.getElementById("hamburger");
  const mainMenu = document.getElementById("mainMenu");
  if (hamburger && mainMenu) {
    const setOpen = (open) => {
      mainMenu.classList.toggle("open", open);
      hamburger.classList.toggle("active", open);
      hamburger.setAttribute("aria-expanded", open);
      hamburger.setAttribute("aria-label", open ? "ปิดเมนู" : "เปิดเมนู");
    };

    hamburger.addEventListener("click", () => setOpen(!mainMenu.classList.contains("open")));

    // ปิดเมนูเมื่อคลิกที่ลิงก์ในเมนู หรือกด Esc
    mainMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setOpen(false));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && mainMenu.classList.contains("open")) {
        setOpen(false);
        hamburger.focus();
      }
    });
  }
});
