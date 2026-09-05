const fs = require("fs");
let h = fs.readFileSync("E:/AIMemory/DaoBao/offer-hui/_s_fjut_job.html", "utf8");
const txt = h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, "|").replace(/\s+/g, " ").trim();
// 找岗位详情区的结构化文本
const start = txt.indexOf("首页 职位 详情");
console.log("详情区:", txt.slice(start, start + 900));
// 找公司信息区
const ci = txt.indexOf("公司信息");
console.log("公司信息:", txt.slice(ci > 0 ? ci : 0, ci > 0 ? ci + 500 : 500));
