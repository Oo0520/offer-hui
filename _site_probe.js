const fs = require("fs");
function probe(file, name) {
  let h = fs.readFileSync(file, "utf8");
  console.log("==========", name, "==========");
  // 标题
  const t = h.match(/<title>([^<]*)<\/title>/i);
  console.log("title:", t ? t[1] : "?");
  // 生成器/平台特征
  const gen = h.match(/generator[^>]*content="([^"]*)"/i);
  console.log("generator:", gen ? gen[1] : "-");
  // 找 API 路径
  const apis = [...new Set([...h.matchAll(/["'](\/[a-zA-Z0-9_/.-]*(?:list|api|job|zpxx|recruit|query|data)[a-zA-Z0-9_/.-]*)["']/gi)].map((m) => m[1]))];
  console.log("API-like:", apis.slice(0, 15));
  // 内嵌 JS 中的接口线索
  const urls = [...new Set([...h.matchAll(/["'](https?:\/\/[^"']+)["']/g)].map((m) => m[1]).filter((u) => !u.includes("baidu") && !u.includes("w3.org") && !u.includes("iconfont") && !u.includes("gov.cn")))] ;
  console.log("urls:", urls.slice(0, 15));
  // 正文链接
  const links = [...new Set([...h.matchAll(/href="(?!javascript|#)([^"]+)"/g)].map((m) => m[1]))].filter((u) => !u.startsWith("/css") && !u.startsWith("/js") && !u.startsWith("/images") && !u.includes("."));
  console.log("hrefs:", links.slice(0, 25));
}
probe("E:/AIMemory/DaoBao/offer-hui/_s_fjut.html", "FJUT");
probe("E:/AIMemory/DaoBao/offer-hui/_s_fjrclh.html", "FJRCLH");
