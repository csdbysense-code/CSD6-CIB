// ทดสอบฟังก์ชันใน static/js/common.js (อ่านวันที่ / CSV / ลิงก์ จาก Google Sheet)
// รัน: node tests/test_common.js   (GitHub Actions รันให้อัตโนมัติ)
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "static", "js", "common.js"), "utf8"), context);
const C = context.window.CSD6;

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    console.error(`✗ ${name}\n  ${error.message}`);
    process.exitCode = 1;
  }
}
const ymd = (d) => (d ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` : null);

test("วันที่รูปแบบต่างๆ ที่กรอกใน Sheet", () => {
  const cases = {
    "04/07/2569": "2026-7-4",
    "4/7/2026": "2026-7-4",
    "04-07-2026": "2026-7-4",
    "4.7.2569": "2026-7-4",
    " 04/07/2569 ": "2026-7-4",
    "4/7/69": "2026-7-4", // ปี 2 หลัก = พ.ศ.
    "2026-07-04": "2026-7-4",
    "2569-07-04": "2026-7-4",
    "4 ก.ค. 2569": "2026-7-4",
    "4 กค 2569": "2026-7-4",
    "4 กรกฎาคม 2569": "2026-7-4",
    "29/02/2028": "2028-2-29", // ปีอธิกสุรทิน
  };
  for (const [input, expected] of Object.entries(cases)) {
    assert.equal(ymd(C.parseThaiDate(input)), expected, input);
  }
});

test("วันที่ที่ไม่มีจริงหรืออ่านไม่ได้ ต้องได้ null (ไม่ปัดไปวันอื่น)", () => {
  for (const input of ["31/02/2026", "29/02/2026", "32/01/2569", "4/13/2569", "", "ไม่ระบุ", "4 xyz 2569", null, undefined]) {
    assert.equal(C.parseThaiDate(input), null, String(input));
  }
});

test("แสดงวันที่แบบไทย", () => {
  assert.equal(C.formatThaiDate(new Date(2026, 6, 4)), "4 ก.ค. 2569");
});

test("ชื่อเดือนในคอลัมน์เดือน", () => {
  assert.equal(ymd(C.parseMonthLabel("กันยายน 2569")), "2026-9-1");
  assert.equal(C.parseMonthLabel("อื่นๆ"), null);
});

test("CSV: จุลภาค ขึ้นบรรทัดใหม่ และเครื่องหมายคำพูดภายในข้อความ", () => {
  const rows = C.parseCSV('a,b,c\r\n"x, y","line1\nline2","say ""hi"""\r\n,,\n"last"\n');
  assert.deepEqual(JSON.parse(JSON.stringify(rows)), [
    ["a", "b", "c"],
    ["x, y", "line1\nline2", 'say "hi"'],
    ["", "", ""],
    ["last"],
  ]);
});

test("ลิงก์: รับเฉพาะ http(s) และเติม https:// ให้ลิงก์ที่ขึ้นต้นด้วย www.", () => {
  const cases = {
    "https://a.com/x?y=1": "https://a.com/x?y=1",
    "  http://b.com ": "http://b.com",
    "www.facebook.com/share/p/1": "https://www.facebook.com/share/p/1",
    "javascript:alert(1)": "",
    "JavaScript:alert(1)": "",
    "data:text/html,x": "",
    "//evil.com": "",
    "ftp://x.com": "",
    "บุกจับแก๊งควาย ! หลอกเหยื่อ": "",
    "https://a.com/ space": "",
  };
  for (const [input, expected] of Object.entries(cases)) {
    assert.equal(C.toUrl(input), expected, input);
  }
});

test("ลิงก์รูปผ่าน /img", () => {
  assert.equal(C.imageUrl("https://a.com/x.jpg?a=1&b=2", 400), "/img?src=https%3A%2F%2Fa.com%2Fx.jpg%3Fa%3D1%26b%3D2&w=400");
});

console.log(`${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
