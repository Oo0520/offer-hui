// 简单内存限流：按 IP 每分钟限额（MVP 公开只读防护）
const WINDOW_MS = 60_000;
const DEFAULT_MAX = 60;

const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  ip: string,
  max = DEFAULT_MAX,
  windowMs = WINDOW_MS,
): { ok: boolean; remaining: number; resetInSec: number } {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now >= rec.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, resetInSec: Math.ceil(windowMs / 1000) };
  }
  rec.count += 1;
  if (rec.count > max) {
    return { ok: false, remaining: 0, resetInSec: Math.ceil((rec.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: max - rec.count, resetInSec: Math.ceil((rec.resetAt - now) / 1000) };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
