const fs = require("fs");
let h = fs.readFileSync("E:/AIMemory/DaoBao/offer-hui/_s_fjut_job.html", "utf8");
// 找详情区 class 容器
const classes = [...new Set([...h.matchAll(/class="([^"]*(?:job|position|detail|info|company)[^"]*)"/g)].map((m) => m[1]))];
console.log("容器:", classes.slice(0, 30));
// 岗位标题区域
const i = h.indexOf("管理/技术培训生");
console.log("标题上下文:", h.slice(Math.max(0, i - 400), i + 100).replace(/\n/g, " ").slice(-600));
// 找“职能类别/招聘人数/工作经验”等字段行的 HTML
for (const k of ["职能类别", "招聘人数", "工作经验", "需求专业", "职位收藏", "发布时间"]) {
  const j = h.indexOf(k);
  if (j >= 0) console.log("---", k, ":", h.slice(Math.max(0, j - 150), j + 150).replace(/\n/g, " ").replace(/\s+/g, " ").slice(-320));
}
