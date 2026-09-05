const fs = require("fs");
const h = fs.readFileSync("E:/AIMemory/DaoBao/offer-hui/_probe.html", "utf8");
// Base64 定义位置
let i = h.indexOf("var Base64");
if (i < 0) i = h.indexOf("Base64 =");
if (i < 0) i = h.indexOf("function Base64");
console.log("def idx:", i);
if (i >= 0) console.log(h.slice(i - 100, i + 2500).replace(/\n/g, " ").slice(0, 2600));
// 也许在引入的 js 文件里
const srcs = [...h.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
console.log("all js:", srcs);
