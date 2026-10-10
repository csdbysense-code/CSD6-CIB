// contact.js — หน้า "ติดต่อเรา" (คัดลอกอีเมล + แผนที่ Google Maps)
(function () {
  const EMAIL = "saraban_csd.cib@police.go.th";

  const copyButton = document.getElementById("copyEmail");

  // เบราว์เซอร์ในแอป (เช่น LINE) หรือหน้าที่ไม่ใช่ https อาจไม่มี navigator.clipboard จึงมีวิธีสำรอง
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.cssText = "position:fixed;top:-1000px;opacity:0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand && document.execCommand("copy");
      area.remove();
      ok ? resolve() : reject(new Error("copy not supported"));
    });
  }

  function showStatus(message) {
    copyButton.textContent = message;
    setTimeout(() => (copyButton.textContent = "(คลิกเพื่อคัดลอกอีเมล)"), 2500);
  }

  copyButton.addEventListener("click", () => {
    copyText(EMAIL)
      .then(() => showStatus("(คัดลอกอีเมลแล้ว ✓)"))
      .catch(() => {
        // คัดลอกไม่ได้: เลือกข้อความอีเมลไว้ให้ผู้ใช้กดคัดลอกเอง
        const range = document.createRange();
        range.selectNodeContents(document.getElementById("email-link"));
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        showStatus("(เลือกอีเมลไว้แล้ว กดคัดลอกได้เลย)");
      });
  });

  // Google Maps จะตั้งคุกกี้ของ Google จึงโหลดเมื่อผู้ใช้ยอมรับคุกกี้ทั้งหมด หรือกดปุ่ม "แสดงแผนที่" เท่านั้น
  const placeholder = document.getElementById("mapPlaceholder");

  function loadMap() {
    if (!placeholder.isConnected) return;
    const iframe = document.createElement("iframe");
    iframe.src = placeholder.dataset.src;
    iframe.width = "600";
    iframe.height = "450";
    iframe.style.border = "0";
    iframe.allowFullscreen = true;
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    iframe.title = "แผนที่กองบังคับการปราบปราม";
    placeholder.replaceWith(iframe);
  }

  document.getElementById("loadMap").addEventListener("click", loadMap);
  if (window.CSD6Consent && window.CSD6Consent.get() === "all") loadMap();
  document.addEventListener("csd6:consent", (e) => {
    if (e.detail === "all") loadMap();
  });
})();
