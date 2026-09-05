const fs = require("fs");
const env = fs.readFileSync("E:/AIMemory/DaoBao/offer-hui/apps/worker/.env", "utf8");
const url = env.match(/SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_KEY=(.+)/)[1].trim();
console.log("URL:", url);
const base = url + "/rest/v1";

async function q(path) {
  const r = await fetch(base + path, {
    headers: { apikey: key, Authorization: "Bearer " + key },
  });
  if (!r.ok) throw new Error(r.status + " " + (await r.text()).slice(0, 300));
  return r.json();
}

(async () => {
  const rows = await q("jobs?select=source");
  const bySrc = {};
  rows.forEach((r) => (bySrc[r.source] = (bySrc[r.source] || 0) + 1));
  console.log("按来源:", bySrc, "总:", rows.length);
  const sample = await q("jobs?source=eq.fj99&select=title,company_name,city,job_type,deadline_at,apply_url,tags&limit=3");
  sample.forEach((j) => console.log(" ", j.title.slice(0, 26), "|", (j.company_name || "").slice(0, 16), "|", j.city, "|", j.job_type, "|", (j.deadline_at || "-").slice(0, 10), "|", JSON.stringify(j.tags).slice(0, 70)));
})();
