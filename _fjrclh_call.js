const fs = require("fs");
let h = fs.readFileSync("E:/AIMemory/DaoBao/offer-hui/_s_fjrclh.html", "utf8");
for (const api of ["getCmsList", "getZpxxList"]) {
  let i = 0;
  let found = 0;
  while ((i = h.indexOf(api, i)) >= 0 && found < 3) {
    const seg = h.slice(Math.max(0, i - 350), i + 450).replace(/\s+/g, " ");
    console.log("=====", api, "@", i, "=====");
    console.log(seg);
    console.log("");
    i += api.length;
    found++;
  }
}
