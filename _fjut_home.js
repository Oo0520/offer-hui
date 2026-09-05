const fs = require("fs");
let h = fs.readFileSync("E:/AIMemory/DaoBao/offer-hui/_s_fjut.html", "utf8");
// 首页岗位列表区域
const idx = h.indexOf("jobslist-container");
console.log("首页 jobslist-container @", idx);
// 找 job/view 链接（首页岗位区）
const jobs = [...h.matchAll(/href="(\/job\/view\/id\/\d+)"/g)].slice(0, 8);
console.log("首页岗位链接:", jobs.map((m) => m[1]));
// 找 teachin/jobfair 链接
const teachins = [...h.matchAll(/href="(\/teachin\/view\/id\/\d+)"/g)].slice(0, 4);
const fairs = [...h.matchAll(/href="(\/jobfair\/view\/id\/\d+)"/g)].slice(0, 4);
console.log("宣讲会:", teachins.map((m) => m[1]));
console.log("招聘会:", fairs.map((m) => m[1]));
// 首页"全职岗位"tab 内容
const zw = h.indexOf("全职岗位");
console.log("全职岗位 @", zw);
if (zw >= 0) console.log(h.slice(zw, zw + 200).replace(/\s+/g, " ").slice(0, 200));
// 岗位标题文本样例
const tts = [...h.matchAll(/<a[^>]*>(.{2,40})<\/a>/g)].map((m) => m[1].trim()).filter((t) => t.includes("招聘") || t.includes("工程师") || t.includes("实习生") || t.includes("培训生") || t.includes("管培")).slice(0, 10);
console.log("标题特征:", tts);
