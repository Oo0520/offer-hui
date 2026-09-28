import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_KEY!;
const admin = createClient(URL, KEY, { auth: { persistSession: false } });

// POST /api/community/posts — 登录用户发帖，服务端强制 status='pending'（先审后发）
// body: { title, content, tag?, company?, reward? }
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!title || !content) {
    return NextResponse.json({ error: "title and content required" }, { status: 400 });
  }
  if (title.length > 80 || content.length > 2000) {
    return NextResponse.json({ error: "title<=80, content<=2000" }, { status: 400 });
  }

  const { data: row, error: insErr } = await admin
    .from("posts")
    .insert({
      author_id: user.id,
      title,
      content,
      tag: typeof body.tag === "string" ? body.tag.trim().slice(0, 30) : null,
      company: typeof body.company === "string" ? body.company.trim().slice(0, 60) : null,
      reward: body.reward === true,
      status: "pending", // 服务端强制，忽略客户端传入
    })
    .select("id, status, created_at")
    .single();
  if (insErr) {
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, post: row }, { status: 201 });
}
