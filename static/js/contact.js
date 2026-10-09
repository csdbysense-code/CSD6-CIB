// contact.js — หน้า "ติดต่อเรา" (คัดลอกอีเมล + แผนที่ Google Maps)
(function () {
  const EMAIL = "saraban_csd.cib@police.go.th";

  const copyButton = document.getElementById("copyEmail");
  copyButton.addEventListener("click", () => {
    navigator.clipboard
      .writeText(EMAIL)
      .then(() => {
        copyButton.textContent = "(คัดลอกอีเมลแล้ว ✓)";
        setTimeout(() => (copyButton.textContent = "(คลิกเพื่อคัดลอกอีเมล)"), 2500);
      })
      .catch((err) => console.error("ไม่สามารถคัดลอกได้", err));
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
