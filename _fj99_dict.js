const crypto = require("crypto");
async function main() {
  const base = "https://www.fj99.org.cn/bys/pc/service";
  async function post(path, body) {
    const sign = crypto.createHash("md5").update(JSON.stringify(body) + "&" + path.split("/").pop()).digest("hex");
    const r = await fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=UTF-8", sign, "User-Agent": "Mozilla/5.0 Chrome/120.0", Referer: "https://www.fj99.org.cn/bys/" },
      body: JSON.stringify(body),
    });
    return r.json();
  }
  // 学历字典 AAB019 / CEB001 / 薪资单位 SALARY_UNIT
  const r1 = await post("/sys/common/getCodeTypes", { "JOB_SOURCES": [], "SALARY_UNIT": [], "SALARY_TOTAL": [], "SALARY_TYPE": [], "AAB019": [], "AAB022": [], "CEB001": [], "AAC011": [] });
  const d = r1.data || {};
  for (const k of Object.keys(d)) {
    const s = JSON.stringify(d[k]).slice(0, 300);
    if (/10|11|12|13|本科|硕士|博士|专科|学历/.test(s)) {
      console.log("== " + k + " ==");
      console.log(s);
    }
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
