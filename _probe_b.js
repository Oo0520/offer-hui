const fs = require("fs");
function probe(file, name) {
  let h = fs.readFileSync(file, "utf8");
  console.log("==========", name, "==========");
  // 岗位列表项
  const items = [...h.matchAll(/<a[^>]+href="(\/job\/view\/id\/\d+)"[^>]*>([^<]{2,80})<\/a>/g)].slice(0, 6);
  console.log("job links:", items.map((m) => m[1] + " | " + m[2].trim()));
  // 列表区域文本特征
  const jl = h.indexOf("job-list");
  if (jl >= 0) console.log("job-list 区域:", h.slice(jl, jl + 300).replace(/\s+/g, " ").slice(0, 300));
  // 分页信息
  const pg = h.match(/共\s*<[^>]*>(\d+)<[^>]*>\s*条/);
  console.log("总数:", pg ? pg[1] : "-");
  // 找列表渲染的数据接口（script 里的 ajax）
  const apis = [...new Set([...h.matchAll(/["'](\/[a-zA-Z0-9_/.-]*(?:getjob|joblist|search|list)[a-zA-Z0-9_/.-]*)["']/gi)].map((m) => m[1]))];
  console.log("apis:", apis.slice(0, 12));
  // 列表项 li 结构
  const li = h.match(/<li[^>]*>[\s\S]{0,500}?<\/li>/g);
  console.log("li 样例:", li ? li[0].replace(/\s+/g, " ").slice(0, 400) : "-");
}
probe("E:/AIMemory/DaoBao/offer-hui/_s_fjut_jobs.html", "FJUT-JOBS");
probe("E:/AIMemory/DaoBao/offer-hui/_s_fj99.html", "FJ99");
