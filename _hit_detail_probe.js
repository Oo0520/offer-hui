async function main() {
  const base = "https://job.hit.edu.cn/zhxy-xszyfzpt/zpxx";
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Referer: "https://job.hit.edu.cn/zhxy-xszyfzpt/zpxx?xxfl=1&ztlx=",
  };
  // 原始 hex id
  const hexId = "321b8227b82449c1aad1abc99d28540a";
  for (const [label, id] of [["hex", hexId], ["decoded-bytes", "\u00dfm[\u00f3m\u00bb\u006f\u00cd\u00b8\u00e3\u00d75i\u00a7ui\u00b7=\u00f5\u00dd\u00bc\u00e7\u008d\u001a"]]) {
    const r = await fetch(base + "/getZpxxXqAndSetLlcsById", {
      method: "POST", headers,
      body: "info=" + encodeURIComponent(JSON.stringify({ zpxxid: id })),
    });
    const t = await r.text();
    console.log(label, "=>", t.slice(0, 200));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
