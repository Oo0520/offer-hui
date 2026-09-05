const fs = require("fs");
const s = fs.readFileSync("E:/AIMemory/DaoBao/offer-hui/_fj99_app.js", "utf8");
// 找 sign 相关片段
const idxs = [];
let i = 0;
while ((i = s.indexOf('sign', i)) >= 0) { idxs.push(i); i += 4; }
console.log("sign 出现次数:", idxs.length);
// 找包含 md5/hexdigest/secret/encrypt 的片段
for (const kw of ["md5(", "hex_md5", "sign:", '"sign"', "requestSign", "signStr", "appSecret", "secret", "timestamp", "timeStamp"]) {
  let j = 0; let n = 0;
  while ((j = s.indexOf(kw, j)) >= 0 && n < 3) {
    const seg = s.slice(Math.max(0, j - 200), j + 200).replace(/\n/g, " ");
    console.log("---", kw, "@", j, "---");
    console.log(seg);
    console.log("");
    j += kw.length; n++;
  }
}
