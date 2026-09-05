const crypto = require("crypto");
async function main() {
  // === FJ99 queryPost ===
  const body = {"page":1,"size":3,"keyword":"","defaultFlag":"1","postWorkType":[],"area":[],"publishZone":[],"educationRequire":[],"companyIndustry":[],"workEducation":[],"graduationRequire":[],"economicType":[],"companyScale":[],"jobKeywords":[],"majorRequire":"","postWelfare":[],"positionQueryType":"RECOMMEND","salaryOrder":"","monthSalaryMin":"","monthSalaryMax":"","positionSearchLimit":"POST","isMustKeyword":true,"isMustWorkArea":true,"isMustCompanyIndustry":true,"isMustPostWorkType":true,"isMustSalaryRange":true,"postType":[],"settleType":[],"isA":"","postEconomyType":"","isUrgentNeed":"","isSpecializedNew":"","isTop100Private":"","isWorkStudyProgram":"","channelName":"","isFrontLine":"","isBysFlag":"1","expectationSalary":"","intentionId":""};
  const sign = crypto.createHash("md5").update(JSON.stringify(body) + "&queryPost").digest("hex");
  const r = await fetch("https://www.fj99.org.cn/bys/pc/service/business/ecosystem/job/Cb01/queryPost", {
    method: "POST",
    headers: { "Content-Type": "application/json;charset=UTF-8", sign, "User-Agent": "Mozilla/5.0 Chrome/120.0", Referer: "https://www.fj99.org.cn/bys/" },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  console.log("=== FJ99 queryPost 响应 ===");
  console.log(t.slice(0, 2500));
}
main().catch((e) => { console.error(e); process.exit(1); });
