async function main() {
  const id = "SLaDB8f5H72xoPf8Xxek6Q";
  const ua = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36" };
  const tries = [
    ["POST /student/api/jobs/{id}", "https://job.ncss.cn/student/api/jobs/" + id + "/", "POST"],
    ["POST /student/api/jobs/{id} no slash", "https://job.ncss.cn/student/api/jobs/" + id, "POST"],
    ["GET /student/api/jobdetail", "https://job.ncss.cn/student/api/jobdetail/?jobId=" + id, "GET"],
    ["GET /student/api/jobs/detail", "https://job.ncss.cn/student/api/jobs/" + id + "/detail/", "GET"],
  ];
  for (const [label, url, method] of tries) {
    try {
      const r = await fetch(url, { method, headers: { ...ua, Referer: "https://job.ncss.cn/" }, body: method === "POST" ? "jobId=" + id : undefined });
      const t = await r.text();
      const isJson = t.trim().startsWith("{") || t.trim().startsWith("[") || t.trim().startsWith("cb1");
      console.log("===", label, r.status, isJson ? "JSON" : "HTML", "===");
      if (isJson) console.log(t.slice(0, 600));
      else console.log(t.slice(0, 120).replace(/\s+/g, " "));
    } catch (e) {
      console.log(label, "ERR", e.message);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
