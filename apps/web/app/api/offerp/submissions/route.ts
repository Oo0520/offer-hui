import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_KEY!;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

const HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

function authed(req: NextRequest): boolean {
  return req.headers.get("x-admin-token") === ADMIN_TOKEN;
}

async function rest(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...HEADERS,
      ...(init?.headers || {}),
      Prefer: "resolution=merge-duplicates,return=representation",
    },
  });
}

type CustomRow = {
  id: string;
  user_id: string;
  company: string;
  title: string;
  company_type: string | null;
  recruit_type: string | null;
  cohort: string | null;
  city: string | null;
  deadline_at: string | null;
  apply_url: string;
  note: string | null;
  stage: string;
  submit_status: string;
  published_job_id: string | null;
  created_at: string;
};

// 邮箱映射：service key 调 admin API 全量拉一次（用户量级小，够用）
let _emailCache: Record<string, string> | null = null;
async function emailOf(userId: string): Promise<string> {
  if (!_emailCache) {
    _emailCache = {};
    try {
      const r = await fetch(`${URL}/auth/v1/admin/users?per_page=1000`, { headers: HEADERS });
      if (r.ok) {
        const j = (await r.json()) as { users?: { id: string; email: string }[] };
        for (const u of j.users || []) _emailCache[u.id] = u.email;
      }
    } catch { /* 忽略，降级显示 user_id */ }
  }
  return _emailCache[userId] || userId.slice(0, 8);
}

// GET /api/offerp/submissions → 待审核投稿列表（含已处理，便于核对）
export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "未授权" }, { status: 401 });
  const status = req.nextUrl.searchParams.get("status") || "pending";
  const res = await rest(
    `user_custom_jobs?submit_status=eq.${status}&order=created_at.desc&limit=200`
  );
  if (!res.ok) return NextResponse.json({ error: `查询失败 ${res.status}` }, { status: 502 });
  const rows = (await res.json()) as CustomRow[];
  const out = await Promise.all(rows.map(async (r) => ({ ...r, email: await emailOf(r.user_id) })));
  return NextResponse.json(out);
}

// POST /api/offerp/submissions  { action: "approve" | "reject", id }
export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "未授权" }, { status: 401 });
  let body: { action?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "参数格式错误" }, { status: 400 });
  }
  const { action, id } = body;
  if (!action || !id) return NextResponse.json({ error: "缺少 action 或 id" }, { status: 400 });

  const q = await rest(`user_custom_jobs?id=eq.${id}&select=*`);
  if (!q.ok) return NextResponse.json({ error: "投稿不存在" }, { status: 404 });
  const rows = (await q.json()) as CustomRow[];
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "投稿不存在" }, { status: 404 });
  if (row.submit_status !== "pending")
    return NextResponse.json({ error: `该投稿已处理（${row.submit_status}）` }, { status: 400 });

  if (action === "reject") {
    const up = await rest(`user_custom_jobs?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ submit_status: "rejected" }),
    });
    if (!up.ok) return NextResponse.json({ error: `驳回失败 ${up.status}` }, { status: 502 });
    return NextResponse.json({ ok: true, action: "rejected" });
  }

  if (action !== "approve") return NextResponse.json({ error: "action 仅支持 approve/reject" }, { status: 400 });

  // 1) 公司 upsert
  const cRes = await rest("companies?on_conflict=name&select=id", {
    method: "POST",
    body: JSON.stringify({ name: row.company }),
  });
  if (!cRes.ok) return NextResponse.json({ error: `公司写入失败 ${cRes.status}` }, { status: 502 });
  const companyId = (await cRes.json() as { id: string }[])[0].id;

  // 2) 招聘类型 → job_type（实习=intern，其余=校招 campus）
  const jobType = row.recruit_type === "实习" ? "intern" : "campus";
  const tags: string[] = ["来源:用户投稿"];
  if (row.company_type) tags.push(row.company_type);
  if (row.recruit_type) tags.push(row.recruit_type);

  const externalId = `user_submit:${row.id}`;
  const payload = {
    id: randomUUID(),
    company_id: companyId,
    source: "user_submit",
    source_url: row.apply_url,
    external_id: externalId,
    title: row.title,
    description: row.note || null,
    city: row.city || null,
    industry: null,
    company_type: row.company_type || null,
    job_type: jobType,
    degree: "",
    cohort: row.cohort || null,
    salary_min: 0,
    salary_max: 0,
    salary_text: "",
    deadline_at: row.deadline_at || null,
    posted_at: new Date().toISOString().slice(0, 10),
    apply_url: row.apply_url,
    status: "published",
    submitted_by: row.user_id,
    tags,
    content_hash: "",
  };

  const jRes = await rest("jobs?on_conflict=source,external_id&select=id", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!jRes.ok) {
    const t = await jRes.text();
    return NextResponse.json({ error: `上架失败 ${jRes.status}: ${t.slice(0, 200)}` }, { status: 502 });
  }
  const jobId = (await jRes.json() as { id: string }[])[0].id;

  // 3) 回写投稿状态
  const up = await rest(`user_custom_jobs?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ submit_status: "published", published_job_id: jobId }),
  });
  if (!up.ok) return NextResponse.json({ error: `状态回写失败 ${up.status}` }, { status: 502 });

  return NextResponse.json({ ok: true, action: "approved", job_id: jobId });
}
