const fs = require("fs");
let h = fs.readFileSync("E:/AIMemory/DaoBao/offer-hui/_s_fjut_jobs.html", "utf8");
// form 结构
const forms = [...h.matchAll(/<form[^>]*action="([^"]*)"[^>]*method="([^"]*)"[^>]*>/g)];
console.log("forms:", forms.map((m) => m[1] + " [" + m[2] + "]"));
// 搜索表单区域
const si = h.indexOf("search");
let shown = 0;
for (let i = 0; i < h.length && shown < 6; i++) {
  const m = h.indexOf("id=\"searchForm\"", i) ;
  if (m >= 0) {
    console.log("searchForm:", h.slice(m, m + 800).replace(/\s+/g, " ").slice(0, 800));
    i = m + 1; shown++;
  } else break;
}
// 表单输入 name 汇总
const names = [...new Set([...h.matchAll(/name="([^"]+)"/g)].map((m) => m[1]))];
console.log("form names:", names.slice(0, 30));
// ajax 片段：j.core.js 可能有公共请求方法
const aj = h.match(/jQuery\.ajax|\.post\(|\.get\(|fetch\(/g);
console.log("ajax:", aj ? aj.slice(0, 8) : "none");
