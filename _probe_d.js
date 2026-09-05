const fs = require("fs");
let h = fs.readFileSync("E:/AIMemory/DaoBao/offer-hui/_s_fjut.html", "utf8");
// 板块标题
const h2 = [...h.matchAll(/<h2[^>]*>([^<]{2,40})<\/h2>/g)].map((m) => m[1]);
const h3 = [...h.matchAll(/<h3[^>]*>([^<]{2,40})<\/h3>/g)].map((m) => m[1]);
console.log("FJUT h2:", [...new Set(h2)].slice(0, 20));
console.log("FJUT h3:", [...new Set(h3)].slice(0, 20));
// 板块容器 class
const secs = [...new Set([...h.matchAll(/class="([^"]*(?:block|mod|sec|part|list|tab)[^"]*)"/g)].map((m) => m[1]))].slice(0, 20);
console.log("板块:", secs);
// 新闻/公告链接
const news = [...h.matchAll(/href="(\/news\/view\/id\/\d+)"[^>]*>([^<]{4,40})/g)].slice(0, 10);
console.log("新闻:", news.map((m) => m[1] + "|" + m[2].trim()));
console.log("");
let f = fs.readFileSync("E:/AIMemory/DaoBao/offer-hui/_s_fj99.html", "utf8");
console.log("========== FJ99 完整壳 ==========");
console.log(f.replace(/<style[\s\S]*?<\/style>/gi, "").slice(0, 2500));
