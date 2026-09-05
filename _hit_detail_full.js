async function main() {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Referer: "https://job.hit.edu.cn/zhxy-xszyfzpt/zpxx?xxfl=1&ztlx=",
  };
  const hexId = "81184cb09a1947ec814cc8df01281641"; // 中国电信福建
  const r = await fetch("https://job.hit.edu.cn/zhxy-xszyfzpt/zpxx/getZpxxXqAndSetLlcsById", {
    method: "POST", headers,
    body: "info=" + encodeURIComponent(JSON.stringify({ zpxxid: hexId })),
  });
  const j = JSON.parse(await r.text());
  const mod = j.module || {};
  const xq = mod.zpxx_xq || {};
  console.log("module keys:", Object.keys(mod).join(","));
  console.log("zpxx_xq keys:", Object.keys(xq).join(","));
  for (const k of Object.keys(xq)) {
    let v = xq[k];
    if (typeof v === "string") v = v.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    console.log(" -", k, "=", String(v).slice(0, 160));
  }
  console.log("zpgw:", JSON.stringify(mod.zpgw || mod.zpgwList || []).slice(0, 400));
}
main().catch((e) => { console.error(e); process.exit(1); });
