async function main() {
  // 先拿一条 ncss jobId
  const list = await fetch("https://job.ncss.cn/student/api/zeyuanhome/uptodatejobs/?callback=cb1");
  const lt = await list.text();
  const lj = JSON.parse(lt.trim().replace(/^cb1\(/, "").replace(/\)$/, ""));
  const first = (lj.data?.list || [])[0];
  console.log("jobId:", first.jobId, "| corpName:", first.corpName);
  const did = first.jobId;
  for (const [label, url] of [
    ["jobs-detail", `https://job.ncss.cn/student/api/jobs/${did}/`],
    ["zpxx-detail", `https://job.ncss.cn/student/api/job/${did}/`],
  ]) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0" } });
      const t = await r.text();
      console.log("===", label, r.status, "===");
      console.log(t.slice(0, 800));
    } catch (e) {
      console.log(label, "err", e.message);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
