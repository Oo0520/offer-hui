const fs = require("fs");
let h = fs.readFileSync("E:/AIMemory/DaoBao/offer-hui/_probe.html", "utf8");
const srcs = [...h.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
console.log("JS:", srcs);
const apis = [...h.matchAll(/["'](\/[a-z0-9_/.-]*(?:zpxx|detail|info|job|unit)[a-z0-9_/.-]*)["']/gi)].map((m) => m[1]);
console.log("API-like:", [...new Set(apis)].slice(0, 25));
const frag = [...h.matchAll(/url\s*[:=]\s*["']([^"']+)["']/g)].map((m) => m[1]);
console.log("url=", frag.slice(0, 10));
// 看有没有内联 JSON 或 vue 数据源
const jsonKeys = h.match(/v-model|axios|\.get\(|\.post\(|fetch\(/g);
console.log("ajax hints:", jsonKeys ? [...new Set(jsonKeys)].slice(0, 10) : null);
// 页面上所有 id 为 company_ / zpxx_ 开头的元素（数据填充点）
const ids = [...h.matchAll(/id="(company_[a-z0-9_]+|zpxx_[a-z0-9_]+)"/g)].map((m) => m[1]);
console.log("data ids:", [...new Set(ids)]);
