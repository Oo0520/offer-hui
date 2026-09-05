async function post(url, data) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0", "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", Referer: "http://fjrclh.fzu.edu.cn/" },
    body: new URLSearchParams(data).toString(),
  });
  return r.text();
}
async function main() {
  console.log("===== FJRCLH 分页测试 =====");
  for (const extra of [{ page: 2 }, { offset: 50 }, { pageNo: 2 }, { p: 2 }]) {
    const t = await post("http://fjrclh.fzu.edu.cn/CmsInterface/getCmsList", { typeid: "1", typedir: "zwxx", pageSize: 10, ...extra });
    try {
      const j = JSON.parse(t);
      const first = j.list?.[0]?.no ?? "-";
      console.log(JSON.stringify(extra), "-> list:", j.list?.length, "首条no:", first, "首条:", j.list?.[0]?.jobname?.slice(0, 20));
    } catch (e) { console.log(JSON.stringify(extra), "ERR"); }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
