// 抽样统计 hit 详情字段填充率
const fs = require("fs");
const dotenv = require("fs").readFileSync("E:/AIMemory/DaoBao/offer-hui/apps/web/.env.local", "utf8");
const get = (k) => dotenv.split("\n").find((l) => l.startsWith(k))?.split("=").slice(1).join("=").trim();
const KEY = get("SUPABASE_SERVICE_KEY");
const URL = get("SUPABASE_URL");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // 拉 hit 岗位
  const r = await fetch(`${URL}/rest/v1/jobs?select=id,external_id,title,company_id,companies(name)&source=eq.hit&limit=90`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const jj0 = await r.json();
  const jobs = jj0.value || jj0;
  console.log("hit 岗位数:", jobs.length);

  let dwwzC = 0, wxgzhC = 0, jltdfsC = 0, zwC = 0, dwjjC = 0;
  const samples = [];
  const details = [];
  for (const j of jobs) {
    const resp = await fetch("https://job.hit.edu.cn/zhxy-xszyfzpt/zpxx/getZpxxXqAndSetLlcsById", {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 Chrome/120.0",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Referer: "https://job.hit.edu.cn/zhxy-xszyfzpt/zpxx?xxfl=1&ztlx=",
      },
      body: "info=" + encodeURIComponent(JSON.stringify({ zpxxid: j.external_id })),
    });
    let ok = false;
    try {
      const jj = JSON.parse(await resp.text());
      const xq = jj.module?.zpxx_xq || {};
      const zw = jj.module?.zpxx_zpzw || "";
      const zwText = String(zw).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (xq.dwwz) dwwzC++;
      if (xq.wxgzh) wxgzhC++;
      if (xq.jltdfs) jltdfsC++;
      if (xq.dwjj) dwjjC++;
      if (zwText) zwC++;
      details.push({ id: j.id, company_id: j.company_id, dwmc: xq.dwmc, dwwz: xq.dwwz || "", wxgzh: xq.wxgzh || "", jltdfs: xq.jltdfs || "", dwxz: xq.dwxz || "", dwgm: xq.dwgm || "", dwdz: xq.dwdz || "", dwhy: xq.dwhy || "", dwjj: String(xq.dwjj || "").slice(0, 300), zwText: zwText.slice(0, 300) });
      if (samples.length < 4 && zwText) samples.push({ title: j.title, zwText: zwText.slice(0, 400) });
      ok = true;
    } catch (e) {
      console.log("ERR", j.external_id, e.message);
    }
    await sleep(250);
  }
  const n = jobs.length;
  console.log(`填充率: 官网=${dwwzC}/${n} 公众号=${wxgzhC}/${n} 投递方式=${jltdfsC}/${n} 公司简介=${dwjjC}/${n} 招聘详情=${zwC}/${n}`);
  console.log("=== 招聘详情正文样例（前4条含内容） ===");
  for (const s of samples) console.log("·", s.title, "=>", s.zwText);
  fs.writeFileSync("E:/AIMemory/DaoBao/offer-hui/_hit_details.json", JSON.stringify(details, null, 0), "utf8");
  console.log("已保存 _hit_details.json", details.length, "条");
}
main().catch((e) => { console.error(e); process.exit(1); });
