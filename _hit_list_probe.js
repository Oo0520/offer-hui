const KEY = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789`~-";
function decodeRaw(input) {
  let output = "";
  let i = 0;
  const clean = input.replace(/[^A-Za-z0-9`~-]/g, "");
  while (i < clean.length) {
    const e1 = KEY.indexOf(clean.charAt(i++));
    const e2 = KEY.indexOf(clean.charAt(i++));
    const e3 = KEY.indexOf(clean.charAt(i++));
    const e4 = KEY.indexOf(clean.charAt(i++));
    output += String.fromCharCode((e1 << 2) | (e2 >> 4));
    if (e3 !== 64) output += String.fromCharCode(((e2 & 15) << 4) | (e3 >> 2));
    if (e4 !== 64) output += String.fromCharCode(((e3 & 3) << 6) | e4);
  }
  return output;
}
async function main() {
  const param = {
    zpxxmc: "", dwmc: "", xz: "", dwxz: "", dwhy: "", sheng: "", shi: "", qu: "",
    fbsj: "", bkxlyq: "", ssxlyq: "", bsxlyq: "", zplx: "", dwgm: "",
    sfcxcy: "", sfwbqqy: "", sfgzwssyq: "", sfgfdw: "",
    lm1: "", lm2: "", lm3: "", lm4: "", lm5: "", lm6: "",
    lx: 1, page: 1, pageSize: 5, take: 5, skip: 0, sort: "",
  };
  const resp = await fetch("https://job.hit.edu.cn/zhxy-xszyfzpt/zpxx/getZpxxList?r=0.1", {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Referer: "https://job.hit.edu.cn/zhxy-xszyfzpt/zpxx?xxfl=1&ztlx=",
    },
    body: "info=" + encodeURIComponent(JSON.stringify(param)),
  });
  const t = await resp.text();
  const j = JSON.parse(t);
  const items = (j.module?.data || []).slice(0, 5);
  for (const it of items) {
    console.log("zpxxid:", it.zpxxid);
    console.log("  decode:", JSON.stringify(decodeRaw(it.zpxxid)));
    console.log("  title:", it.zpxxmc);
    console.log("  dwmc:", it.dwmc, "| dwhy:", it.dwhy, "| gzdd:", it.gzdd);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
