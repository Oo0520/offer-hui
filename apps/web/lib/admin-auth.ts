import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

// 管理员邮箱白名单（逗号分隔，Vercel env: ADMIN_EMAILS）
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 从请求 Authorization: Bearer <access_token> 解析当前用户
// 返回 { email, userId } 若为管理员，否则 null
export async function getAdminUser(req: NextRequest): Promise<{ email: string; userId: string } | null> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  try {
    const supabase = createClient(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user || !data.user.email) return null;
    const email = data.user.email.toLowerCase();
    if (!ADMIN_EMAILS.includes(email)) return null;
    return { email, userId: data.user.id };
  } catch {
    return null;
  }
}
