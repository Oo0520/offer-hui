const crypto = require("crypto");
async function main() {
  const body = {"page":2,"size":50,"keyword":"","defaultFlag":"1","postWorkType":[],"area":[],"publishZone":[],"educationRequire":[],"companyIndustry":[],"workEducation":[],"graduationRequire":[],"economicType":[],"companyScale":[],"jobKeywords":[],"majorRequire":"","postWelfare":[],"positionQueryType":"RECOMMEND","salaryOrder":"","monthSalaryMin":"","monthSalaryMax":"","positionSearchLimit":"POST","isMustKeyword":true,"isMustWorkArea":true,"isMustCompanyIndustry":true,"isMustPostWorkType":true,"isMustSalaryRange":true,"postType":[],"settleType":[],"isA":"","postEconomyType":"","isUrgentNeed":"","isSpecializedNew":"","isTop100Private":"","isWorkStudyProgram":"","channelName":"","isFrontLine":"","isBysFlag":"1","expectationSalary":"","intentionId":""};
  const sign = crypto.createHash("md5").update(JSON.stringify(body) + "&queryPost").digest("hex");
  const r = await fetch("https://www.fj99.org.cn/bys/pc/service/business/ecosystem/job/Cb01/queryPost", {
    method: "POST",
    headers: { "Content-Type": "application/json;charset=UTF-8", sign, "User-Agent": "Mozilla/5.0 Chrome/120.0", Referer: "https://www.fj99.org.cn/bys/" },
    body: JSON.stringify(body),
  });
  const j = JSON.parse(await r.text());
  const d = j.data || {};
  console.log("data keys:", Object.keys(d).join(","));
  console.log("total:", d.total, "| pages:", d.pages, "| size:", d.size, "| records:", d.records?.length);
  const rec = d.records?.[0];
  if (rec) {
    console.log("字段数:", Object.keys(rec).length);
    console.log("样例:", JSON.stringify({postName: rec.postName, unitName: rec.unitName, educationRequire: rec.educationRequire, workEducation: rec.workEducation, monthSalary: rec.monthSalary, salaryUnit: rec.salaryUnit, salaryType: rec.salaryType, workAreaName: rec.workAreaName, recruitEndtime: rec.recruitEndtime, releaseTime: rec.releaseTime, postType: rec.postType, settleType: rec.settleType, channelName: rec.channelName, postWorkType: rec.postWorkType, recruitCrowd: rec.recruitCrowd, linkEmail: rec.linkEmail}));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
