// script.js — ใช้ร่วมกันทุกหน้า (วันที่ด้านบน + เมนูมือถือ)

document.addEventListener("DOMContentLoaded", () => {
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
