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
// 原版 _utf8_decode
function utf8_decode(utftext) {
  let string = "";
  let i = 0, c = 0, c1 = 0, c2 = 0;
  while (i < utftext.length) {
    c = utftext.charCodeAt(i);
    if (c < 128) { string += String.fromCharCode(c); i++; }
    else if (c > 191 && c < 224) {
      c2 = utftext.charCodeAt(i + 1);
      string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
      i += 2;
    } else {
      c2 = utftext.charCodeAt(i + 1);
      c3 = utftext.charCodeAt(i + 2);
      string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
      i += 3;
    }
  }
  return string;
}
const b64 = process.argv[2];
const raw = decodeRaw(b64);
console.log("raw len:", raw.length);
console.log("raw hex:", Buffer.from(raw, "latin1").toString("hex").slice(0, 200));
console.log("utf8dec:", utf8_decode(raw));
console.log("buffer utf8:", Buffer.from(raw, "latin1").toString("utf8"));
