const fs = require("fs");
const s = fs.readFileSync("E:/AIMemory/DaoBao/offer-hui/_fj99_app.js", "utf8");
const i = s.indexOf("md5(");
// 打印 md5( 前 1200 字符（含拦截器开头）
console.log(s.slice(i - 1400, i + 300));
