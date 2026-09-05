const fs = require("fs");
let h = fs.readFileSync("E:/AIMemory/DaoBao/offer-hui/_probe.html", "utf8");
h = h.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
const links = [...h.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
const uniq = [...new Set(links)].filter(
  (u) => !u.includes("job.hit.edu.cn") && !u.includes("hit.edu.cn") && !u.includes("gov.cn")
);
console.log("=== 外部链接 ===");
uniq.forEach((u) => console.log(u));
const kw = ["公众号", "微信公众号", "官方微信", "网申", "投递", "官网", "邮箱", "招聘公众号", "campus", "Campus", "简历投递"];
for (const k of kw) {
  const idx = h.indexOf(k);
  if (idx >= 0) {
    const seg = h
      .slice(Math.max(0, idx - 60), idx + 130)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
    console.log("---", k, "---");
    console.log(seg);
  }
}
// 打印正文纯文本前 1200 字看看结构
const text = h.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
console.log("=== 正文前 1200 字 ===");
console.log(text.slice(0, 1200));
