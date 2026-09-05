async function postJSON(url, params) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0", "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", Referer: "http://fjrclh.fzu.edu.cn/" },
    body: new URLSearchParams(params).toString(),
  });
  const t = await r.text();
  console.log(">>>", url, params, "->", r.status, t.slice(0, 500));
  return t;
}
async function main() {
  console.log("===== FJRCLH getZpxxList =====");
  await postJSON("http://fjrclh.fzu.edu.cn/CmsInterface/getZpxxList", {});
  await postJSON("http://fjrclh.fzu.edu.cn/CmsInterface/getZpxxList", { page: 1, limit: 5 });
  await postJSON("http://fjrclh.fzu.edu.cn/CmsInterface/getZpxxList", { page: "1", rows: "5", type: "1" });
  console.log("===== FJRCLH getCmsList =====");
  await postJSON("http://fjrclh.fzu.edu.cn/CmsInterface/getCmsList", { page: 1, limit: 3 });
}
main().catch((e) => { console.error(e); process.exit(1); });
