import { NextRequest, NextResponse } from "next/server";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

// 口令校验：POST { token } → { ok: true } / 401
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body?.token && body.token === ADMIN_TOKEN) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: "口令错误" }, { status: 401 });
  } catch {
    return NextResponse.json({ ok: false, error: "参数错误" }, { status: 400 });
  }
}
