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

// 来源类型 → 展示标签
const SOURCE_TAG: Record<string, string> = {
  企业官网: "来源:企业官网",
  企业公众号: "来源:企业公众号",
  高校就业网: "来源:高校就业网",
  国家24365: "来源:国家24365",
  社区数据: "来源:社区数据",
  其他: "来源:其他",
};

async function rest(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...HEADERS,
      ...(init?.headers || {}),
      // PostgREST upsert：冲突时合并更新 + 返回写入行
      Prefer: "resolution=merge-duplicates,return=representation",
    },
  });
}

type JobInput = {
  company_name: string;
  title: string;
  job_type: "campus" | "intern" | "fair";
  degree: string;
  cohort: string;
  city: string;
  location: string;
  industry: string;
  deadline_at: string;
  apply_url: string;
  source_url: string;
  source_type: string;
  tags: string;
  note: string;
};

// GET /api/offerp/jobs → 手动录入岗位列表
export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "未授权" }, { status: 401 });
  const url = `${URL}/rest/v1/jobs?source=eq.manual&select=id,title,external_id,city,industry,job_type,degree,cohort,deadline_at,posted_at,apply_url,source_url,status,tags,description,created_at,companies(name)&order=created_at.desc&limit=100`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return NextResponse.json({ error: `查询失败 ${res.status}` }, { status: 502 });
  const rows = await res.json();
  return NextResponse.json(rows);
}

// POST /api/offerp/jobs → 新增或更新（同公司同岗位覆盖）
export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "未授权" }, { status: 401 });
  let body: JobInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "参数格式错误" }, { status: 400 });
  }
  const company = (body.company_name || "").trim();
  const title = (body.title || "").trim();
  if (!company || !title) {
    return NextResponse.json({ error: "公司名和岗位名必填" }, { status: 400 });
  }
  if (!body.apply_url || !body.source_url) {
    return NextResponse.json({ error: "投递链接和来源链接必填" }, { status: 400 });
  }

  // 1) 公司 upsert（name 唯一）
  const cRes = await rest(
    `companies?on_conflict=name&select=id`,
    {
      method: "POST",
      body: JSON.stringify({ name: company, industry: body.industry || "" }),
    },
  );
  if (!cRes.ok) return NextResponse.json({ error: `公司写入失败 ${cRes.status}` }, { status: 502 });
  const cRows = (await cRes.json()) as { id: string }[];
  const companyId = cRows[0].id;

  // 2) tags：来源标签 + 工作地点 + 管理员标签
  const tags: string[] = [];
  const srcTag = SOURCE_TAG[body.source_type] || "来源:其他";
  tags.push(srcTag);
  const loc = (body.location || "").trim();
  if (loc) tags.push(loc);
  for (const t of (body.tags || "").split(/[,，]/)) {
    const v = t.trim();
    if (v && !tags.includes(v)) tags.push(v);
  }

  const externalId = `manual:${company}:${title}`;
  const payload = {
    id: randomUUID(),
    company_id: companyId,
    source: "manual",
    source_url: body.source_url.trim(),
    external_id: externalId,
    title,
    description: (body.note || "").trim() || null,
    city: (body.city || "").trim() || null,
    industry: (body.industry || "").trim() || null,
    job_type: body.job_type || "campus",
    degree: body.degree || "",
    cohort: (body.cohort || "").trim() || null,
    salary_min: 0,
    salary_max: 0,
    salary_text: "",
    deadline_at: body.deadline_at || null,
    posted_at: new Date().toISOString().slice(0, 10),
    apply_url: body.apply_url.trim(),
    status: "published",
    tags,
    content_hash: "",
  };

  // upsert：同 (source, external_id) 覆盖
  const jRes = await rest("jobs?on_conflict=source,external_id&select=id", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!jRes.ok) {
    const t = await jRes.text();
    return NextResponse.json({ error: `写入失败 ${jRes.status}: ${t.slice(0, 200)}` }, { status: 502 });
  }
  return NextResponse.json({ ok: true, external_id: externalId });
}

// DELETE /api/offerp/jobs?id=xxx
export async function DELETE(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "未授权" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  const res = await rest(`jobs?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) return NextResponse.json({ error: `删除失败 ${res.status}` }, { status: 502 });
  return NextResponse.json({ ok: true });
}
