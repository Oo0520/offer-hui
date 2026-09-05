// 自定义 Base64（哈工大就业网）：_keyStr = ABC...XYZabc...xyz0123456789`~-
const KEY = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789`~-";
function decode(input) {
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
  // utf8 -> string
  const bytes = [];
  for (let n = 0; n < output.length; n++) bytes.push(output.charCodeAt(n));
  return Buffer.from(bytes).toString("utf8");
}

async function main() {
  const b64id = process.argv[2] || "a9e31a260c6845f09516ff1d1e80ba9e";
  const realId = decode(b64id);
  console.log("decoded id:", realId);

  const base = "https://job.hit.edu.cn/zhxy-xszyfzpt/zpxx";
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  };

  // 1. 单位/招聘信息详情
  const r1 = await fetch(base + "/getZpxxXqAndSetLlcsById", {
    method: "POST",
    headers,
    body: "info=" + encodeURIComponent(JSON.stringify({ zpxxid: realId })),
  });
  const t1 = await r1.text();
  const j1 = JSON.parse(t1);
  const xq = j1.module?.zpxx_xq || {};
  console.log("=== 单位信息 ===");
  for (const k of ["zpxxmc", "dwmc", "dwxz", "dwgm", "dwhy", "dwdz", "dwwz", "wxgzh", "jltdfs", "zpxx_jltdyx", "fbsj", "clnf", "zpsj"]) {
    if (xq[k] !== undefined) console.log(k, "=>", String(xq[k]).slice(0, 120));
  }

  // 2. 岗位列表（拿 gwid）
  const gw = j1.module?.zpgw;
  console.log("=== 岗位数 ===", Array.isArray(gw) ? gw.length : JSON.stringify(gw).slice(0, 200));
  if (Array.isArray(gw) && gw.length) {
    const g0 = gw[0];
    console.log("岗位0 keys:", Object.keys(g0).join(","));
    console.log("岗位0 样例:", JSON.stringify(g0).slice(0, 300));
    const r2 = await fetch(base + "/getZpgwXqAndSetLlcsById", {
      method: "POST",
      headers,
      body: "info=" + encodeURIComponent(JSON.stringify({ gwid: g0.id })),
    });
    const t2 = await r2.text();
    const j2 = JSON.parse(t2);
    const d2 = j2.module?.zpxx_xq || {};
    console.log("=== 岗位详情字段 ===");
    for (const k of Object.keys(d2)) {
      const v = String(d2[k]);
      if (v && v.length < 200) console.log(k, "=>", v.slice(0, 150));
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
