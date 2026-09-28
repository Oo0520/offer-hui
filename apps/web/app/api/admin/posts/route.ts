import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_KEY!;
const admin = createClient(URL, KEY, { auth: { persistSession: false } });

function checkAdmin(req: NextRequest): boolean {
  const secret = req.nextUrl.searchParams.get("secret");
  const token = process.env.ADMIN_TOKEN || "";
  return !!token && secret === token;
}

// GET /api/admin/posts?secret=<ADMIN_TOKEN>&status=pending|approved|rejected
//   返回帖子列表（默认 pending，即待审队列）
export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "invalid secret" }, { status: 401 });
  }
  const status = req.nextUrl.searchParams.get("status") || "pending";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 50), 200);
  const { data: rows, error } = await admin
    .from("posts")
    .select("id, title, content, tag, company, reward, status, author_id, created_at")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ posts: rows });
}

// POST /api/admin/posts?secret=<ADMIN_TOKEN>
// body: { id, action: "approve" | "reject" }
export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "invalid secret" }, { status: 401 });
  }
  let body: { id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const id = body.id;
  const action = body.action;
  if (!id || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "id + action(approve|reject) required" }, { status: 400 });
  }
  const next = action === "approve" ? "approved" : "rejected";
  const { data, error } = await admin
    .from("posts")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending") // 只能审待审帖子
    .select("id, status")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message || "not found or not pending" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, post: data });
}
