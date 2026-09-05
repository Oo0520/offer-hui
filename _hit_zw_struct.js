const fs = require("fs");
const details = JSON.parse(fs.readFileSync("E:/AIMemory/DaoBao/offer-hui/_hit_details.json", "utf8"));
// 重新调一条看 zpxx_zpzw 原始类型
async function main() {
  const hexId = "a9e31a260c6845f09516ff1d1e80ba9e"; // 广东新宝电器
  const r = await fetch("https://job.hit.edu.cn/zhxy-xszyfzpt/zpxx/getZpxxXqAndSetLlcsById", {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 Chrome/120.0",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Referer: "https://job.hit.edu.cn/zhxy-xszyfzpt/zpxx?xxfl=1&ztlx=",
    },
    body: "info=" + encodeURIComponent(JSON.stringify({ zpxxid: hexId })),
  });
  const j = JSON.parse(await r.text());
  const zw = j.module?.zpxx_zpzw;
  console.log("zpxx_zpzw type:", Array.isArray(zw) ? "array[" + zw.length + "]" : typeof zw);
  console.log("样例:", JSON.stringify(zw).slice(0, 1500));
  console.log("=== 附件 zpxx_fj ===");
  console.log(JSON.stringify(j.module?.zpxx_fj).slice(0, 800));
  // jltdfs 样例
  console.log("=== 第一条 details 里 jltdfs ===");
  const withJ = details.filter((d) => d.jltdfs);
  console.log("有投递方式条数:", withJ.length);
  for (const d of withJ.slice(0, 5)) console.log("·", d.dwmc, "=>", d.jltdfs.slice(0, 150));
}
main().catch((e) => { console.error(e); process.exit(1); });
