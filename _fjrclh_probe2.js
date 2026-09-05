async function post(url, data) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0", "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", Referer: "http://fjrclh.fzu.edu.cn/" },
    body: new URLSearchParams(data).toString(),
  });
  return r.text();
}
async function main() {
  console.log("===== zwxx 职位信息 =====");
  let t = await post("http://fjrclh.fzu.edu.cn/CmsInterface/getCmsList", { typeid: "1", typedir: "zwxx", pageSize: 50 });
  let j = JSON.parse(t);
  console.log("keys:", Object.keys(j).join(","), "| total:", j.total, "| list:", j.list?.length);
  if (j.list?.[0]) {
    const k = j.list[0];
    console.log("字段:", Object.keys(k).join(","));
    console.log("样例:", JSON.stringify(k).slice(0, 400));
  }
  console.log("===== zpxx 招聘信息栏目 =====");
  for (const td of ["zpxx", "xjh", "zph"]) {
    t = await post("http://fjrclh.fzu.edu.cn/CmsInterface/getCmsList", { typeid: "1", typedir: td, pageSize: 5 });
    try {
      j = JSON.parse(t);
      console.log(td, "-> total:", j.total, "list:", j.list?.length, j.list?.[0] ? JSON.stringify(j.list[0]).slice(0, 300) : "");
    } catch (e) { console.log(td, "ERR", t.slice(0, 100)); }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
