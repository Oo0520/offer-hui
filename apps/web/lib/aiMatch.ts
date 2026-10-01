// 用户自定义 AI 大模型 API 匹配（OpenAI 兼容）
// 设计原则：API Key 只存 localStorage、只从浏览器直连用户自己的 API，
// 不落数据库、不经我方服务器；简历解析全部在本机完成。
import type { JobView } from "@/lib/jobs";

export type AIConfig = {
  baseUrl: string; // 如 https://api.deepseek.com/v1
  apiKey: string;
  model: string; // 如 deepseek-chat
};

export type AIMatchItem = {
  id: string;
  score: number; // 0-100
  reasons: string[];
};

const CONFIG_KEY = "offerp.ai.config.v1";

export function loadConfig(): AIConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as AIConfig;
    if (!c.apiKey || !c.baseUrl || !c.model) return null;
    return c;
  } catch {
    return null;
  }
}

export function saveConfig(c: AIConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
}

export function clearConfig() {
  localStorage.removeItem(CONFIG_KEY);
}

export function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

// ---------- 简历解析（本机完成，不上传） ----------

export async function parseResumeFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return parsePdf(file);
  if (name.endsWith(".docx")) return parseDocx(file);
  if (name.endsWith(".doc"))
    throw new Error("老版 .doc 无法在浏览器解析，请另存为 .docx 或 PDF 后重新上传");
  throw new Error("仅支持 PDF / DOCX 格式");
}

async function parsePdf(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdfjs: typeof import("pdfjs-dist") = await import("pdfjs-dist");
  const workerUrl: string = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: buf });
  const doc = await task.promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const line = tc.items
      .map((it) => {
        const s = (it as { str?: unknown }).str;
        return typeof s === "string" ? s : "";
      })
      .join(" ")
      .replace(/\s+/g, " ");
    if (line) pages.push(line);
  }
  await task.destroy();
  const text = pages.join("\n");
  if (text.trim().length < 10) throw new Error("未能从 PDF 中提取到文本（可能是扫描件），请改用可复制文本的 PDF");
  return text.trim();
}

async function parseDocx(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  const text = (result.value || "").trim();
  if (text.length < 10) throw new Error("未能从 DOCX 中提取到文本，请确认文件内容可编辑");
  return text;
}

// ---------- 规则引擎初筛（降级 + 候选池） ----------

const PROFILE = {
  cohort: "2027届",
  degree: "本科及以上",
  industries: [
    "信息传输、软件和信息技术服务业",
    "互联网/电子商务",
    "计算机软件",
    "计算机服务（系统/数据/维护/安全）",
    "电子技术/半导体/集成电路",
  ],
  cities: ["北京", "上海", "深圳", "杭州", "广州", "南京", "全国"],
  keywords: ["软件", "算法", "研发", "开发", "工程师", "数据分析", "IC", "嵌入式", "AI", "前端", "后端", "测试"],
};

export function ruleScore(job: JobView): { score: number; reasons: string[] } {
  let s = 0;
  const reasons: string[] = [];
  if (job.cohort && job.cohort === PROFILE.cohort) {
    s += 35;
    reasons.push(`届别匹配（${job.cohort}）`);
  }
  if (job.degree && (job.degree.includes("本科") || job.degree.includes("不限"))) {
    s += 20;
    reasons.push(`学历要求符合（${job.degree}）`);
  }
  if (PROFILE.industries.some((i) => job.industry.includes(i) || i.includes(job.industry))) {
    s += 25;
    reasons.push(`行业方向契合（${job.industry}）`);
  }
  if (PROFILE.cities.includes(job.city)) {
    s += 15;
    reasons.push(`意向城市匹配（${job.city}）`);
  }
  const kwHit = PROFILE.keywords.filter((k) => job.title.includes(k));
  if (kwHit.length) {
    s += 10 * Math.min(kwHit.length, 2);
    reasons.push(`岗位方向命中（${kwHit.join("/")}）`);
  }
  return { score: Math.min(s, 100), reasons };
}

export function ruleEngine(jobs: JobView[], topN = 6): { job: JobView; score: number; reasons: string[] }[] {
  return jobs
    .map((j) => ({ job: j, ...ruleScore(j) }))
    .filter((r) => r.score >= 30)
    .sort((a, b) => b.score - a.score || (a.job.deadlineDays ?? 999) - (b.job.deadlineDays ?? 999))
    .slice(0, topN);
}

// ---------- LLM 调用（一次批量匹配） ----------

const SYSTEM_PROMPT =
  "你是专业的应届生求职匹配助手。根据求职者简历与岗位列表，评估每个岗位的匹配程度。" +
  "严格只输出 JSON 数组，格式：[{\"id\":\"<岗位id>\",\"score\":<0-100整数>,\"reasons\":[\"理由1\",\"理由2\"]}]。" +
  "score 越大越匹配；reasons 用 1-3 条简短理由说明匹配点或不匹配点。不要输出任何其它文字。";

export function buildMatchPrompt(resumeText: string, jobs: JobView[]): string {
  const list = jobs
    .map(
      (j) =>
        `{\"id\":\"${j.id}\",\"title\":\"${j.title}\",\"company\":\"${j.company}\",\"city\":\"${j.city}\",` +
        `\"industry\":\"${j.industry}\",\"degree\":\"${j.degree}\",\"cohort\":\"${j.cohort}\",` +
        `\"salary\":\"${j.salaryText || ""}\",\"deadlineDays\":${j.deadlineDays ?? -1}}`
    )
    .join(",\n");
  return `求职者简历：\n${resumeText}\n\n岗位列表：\n[${list}]\n\n请评估每个岗位的匹配度。`;
}

export type AICallError = { kind: "cors" | "auth" | "timeout" | "network" | "parse" | "http"; message: string };

export async function callAI(
  config: AIConfig,
  resumeText: string,
  jobs: JobView[]
): Promise<AIMatchItem[]> {
  const prompt = buildMatchPrompt(resumeText, jobs);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  let resp: Response;
  try {
    resp = await fetch(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const err = e as Error;
    if (err.name === "AbortError") throw { kind: "timeout", message: "请求超时（45s），请检查网络或改用更快的模型" } as AICallError;
    throw { kind: "cors", message: "请求被拦截（CORS）。部分 API 不允许浏览器直连，可改用 DeepSeek / 硅基流动 / Kimi 等支持 CORS 的服务，或检查 BaseURL 是否正确" } as AICallError;
  }
  clearTimeout(timer);

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    if (resp.status === 401 || resp.status === 403)
      throw { kind: "auth", message: `鉴权失败（HTTP ${resp.status}）：API Key 无效或无权限。${body.slice(0, 120)}` } as AICallError;
    throw { kind: "http", message: `API 返回错误（HTTP ${resp.status}）：${body.slice(0, 150)}` } as AICallError;
  }

  let data: unknown;
  try {
    data = await resp.json();
  } catch {
    throw { kind: "parse", message: "API 响应不是合法 JSON" } as AICallError;
  }

  const content: unknown =
    (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim())
    throw { kind: "parse", message: "API 响应缺少 content 字段" } as AICallError;

  let raw: unknown;
  try {
    const cleaned = content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "");
    raw = JSON.parse(cleaned);
    if (!Array.isArray(raw) && raw && typeof raw === "object" && Array.isArray((raw as { results?: unknown }).results)) {
      raw = (raw as { results: unknown }).results;
    }
  } catch {
    throw { kind: "parse", message: "模型未按约定输出 JSON，请换用支持 JSON 输出的模型（如 deepseek-chat / gpt-4o-mini）" } as AICallError;
  }

  if (!Array.isArray(raw)) throw { kind: "parse", message: "模型输出结构异常（应为 JSON 数组）" } as AICallError;

  return raw
    .filter((it): it is AIMatchItem => {
      const o = it as { id?: unknown; score?: unknown; reasons?: unknown };
      return typeof o?.id === "string" && typeof o?.score === "number";
    })
    .map((it) => ({
      id: it.id,
      score: Math.max(0, Math.min(100, Math.round(it.score))),
      reasons: Array.isArray(it.reasons)
        ? (it.reasons as unknown[]).filter((r): r is string => typeof r === "string").slice(0, 3)
        : ["AI 匹配"],
    }));
}

// 示例简历（无文件时体验用）
export const SAMPLE_RESUME = `求职者：张同学\n届别：2027届本科\n院校专业：某理工大学 · 软件工程\n意向城市：北京 / 上海 / 深圳 / 杭州\n技能：Python / Java / React / 数据分析 / SQL\n项目经历：校园招聘信息聚合平台（全栈开发）；参与实验室数据分析项目\n实习：某互联网公司数据分析实习（2026 暑期）\n求职方向：软件开发、算法、数据研发、前端/后端工程师`;

export const SAMPLE_CONFIG_HINT = {
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
};
