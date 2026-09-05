const fs = require("fs");
let h = fs.readFileSync("E:/AIMemory/DaoBao/offer-hui/_probe.html", "utf8");
// 找 getZpxxXqAndSetLlcsById 调用上下文（含参数构造）
for (const api of ["getZpxxXqAndSetLlcsById", "getZpgwXqAndSetLlcsById"]) {
  let i = h.indexOf(api);
  console.log("=== ", api, " @ ", i, " ===");
  while (i >= 0 && i < h.length) {
    const seg = h.slice(Math.max(0, i - 500), i + 800).replace(/\n/g, " ");
    if (seg.includes("url") || seg.includes("id") || seg.includes("data")) {
      console.log(seg.slice(0, 1200));
      console.log("----");
      break;
    }
    i = h.indexOf(api, i + 1);
  }
}
// 页面参数：URL query id 是如何使用的
const m = h.match(/location\.search|getParam|queryString|request\.param|GetQueryString/gi);
console.log("param hints:", m ? [...new Set(m)] : null);
