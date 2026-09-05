const fs = require("fs");
let h = fs.readFileSync("E:/AIMemory/DaoBao/offer-hui/_s_fjut_jobs.html", "utf8");
console.log("=== FJUT: 页面内 script src ===");
console.log([...new Set([...h.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]))].join("\n"));
console.log("=== FJUT: ajax/url 线索 ===");
const urls = [...new Set([...h.matchAll(/url\s*:\s*["']([^"']+)["']/g)].map((m) => m[1]))];
console.log(urls.slice(0, 15));
console.log("=== FJUT: window 数据 / json ===");
const embeds = [...h.matchAll(/window\.([A-Za-z0-9_]+)\s*=\s*(\[[^\]]{10,300}|"[^"]{20,})/g)].slice(0, 5);
console.log(embeds.map((m) => m[1] + "=" + m[2].slice(0, 100)).join("\n"));

let f = fs.readFileSync("E:/AIMemory/DaoBao/offer-hui/_s_fj99.html", "utf8");
console.log("=== FJ99: script src ===");
console.log([...new Set([...f.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]))].join("\n"));
console.log("=== FJ99: 外链 ===");
console.log([...new Set([...f.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]))].slice(0, 20).join("\n"));
