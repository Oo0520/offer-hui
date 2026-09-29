import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import type { SubFilters } from "../calendar.ics/route";

export const dynamic = "force-dynamic";

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_KEY!;
const admin = createClient(URL, KEY, { auth: { persistSession: false } });

// 校验并规整 filters：只保留已知键，值必须是字符串数组或字符串
function sanitizeFilters(raw: unknown): SubFilters {
  const f = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = (key: string): string[] | undefined => {
    const v = f[key];
    if (Array.isArray(v)) {
      const arr = v.filter((x) => typeof x === "string" && x.trim());
      return arr.length ? arr : undefined;
    }
    return undefined;
  };
  const cohort = typeof f.cohort === "string" && f.cohort.trim() ? f.cohort.trim() : undefined;
  return {
    cities: pick("cities"),
    industries: pick("industries"),
    company_types: pick("company_types"),
    job_types: pick("job_types"),
    cohort,
  };
}

// POST：登录用户创建/更新自己的个性化订阅（一个用户一条，upsert 逻辑）
// body: { filters: { cities?, industries?, job_types?, cohort? } }
// 返回: { token, url }
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { filters?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const filters = sanitizeFilters(body.filters);

  // 已有订阅则复用 token（URL 不变），否则生成新 token
  const { data: existing, error: qErr } = await admin
    .from("subscriptions")
    .select("id, ics_token")
    .eq("user_id", user.id)
    .limit(1);
  if (qErr) {
    return NextResponse.json({ error: "db query failed" }, { status: 500 });
  }
  const row = existing?.[0];
  const icsToken = row?.ics_token || randomBytes(16).toString("hex");

  if (row) {
    await admin
      .from("subscriptions")
      .update({ filters, ics_enabled: true, next_check_at: new Date().toISOString() })
      .eq("id", row.id);
  } else {
    await admin.from("subscriptions").insert({
      user_id: user.id,
      filters,
      ics_token: icsToken,
      ics_enabled: true,
      next_check_at: new Date().toISOString(),
    });
  }

  const origin = req.nextUrl.origin;
  return NextResponse.json({
    token: icsToken,
    url: `${origin}/api/calendar.ics?token=${icsToken}`,
    filters,
  });
}

// GET：查询当前登录用户的订阅 token 与筛选条件（无则 404）
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: rows, error: qErr } = await admin
    .from("subscriptions")
    .select("filters, ics_token, ics_enabled")
    .eq("user_id", user.id)
    .limit(1);
  if (qErr) {
    return NextResponse.json({ error: "db query failed" }, { status: 500 });
  }
  const row = rows?.[0];
  if (!row || row.ics_enabled !== true || !row.ics_token) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const origin = req.nextUrl.origin;
  return NextResponse.json({
    token: row.ics_token,
    url: `${origin}/api/calendar.ics?token=${row.ics_token}`,
    filters: row.filters as SubFilters,
  });
}
