const fs = require("fs");
let h = fs.readFileSync("E:/AIMemory/DaoBao/offer-hui/_s_fjut_job.html", "utf8");
const i = h.indexOf("unit-info");
console.log("unit-info区:", h.slice(i - 100, i + 1200).replace(/\n/g, " ").replace(/\s+/g, " "));
