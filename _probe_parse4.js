const fs = require("fs");
const h = fs.readFileSync("E:/AIMemory/DaoBao/offer-hui/_probe.html", "utf8");
// 找 Base64 的实现（可能自定义 alphabet）
const i = h.indexOf("new Base64");
console.log("=== Base64 实现上下文 ===");
console.log(h.slice(Math.max(0, i - 1500), i + 200).replace(/\n/g, " ").slice(0, 1800));
