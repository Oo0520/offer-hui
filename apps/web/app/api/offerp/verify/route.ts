import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";

// 管理员校验：Authorization: Bearer <access_token> → { ok, email } / 401
export async function GET(req: NextRequest) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ ok: false, error: "无权限：非管理员账号" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, email: admin.email });
}
