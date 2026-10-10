// 复合搜索解析器：把一串自由输入解析为结构化筛选条件 + 剩余关键词
//
// 纯函数、无副作用、不引用 next/*，可在 server / client / 脚本中复用。
// 词表唯一来源：lib/taxonomy.ts（招聘类型/学历/公司性质/截止档/批次/薪资规则）
//               + lib/cityTree.ts（城市）
//
// 设计取舍：
// 1. 只对「库里真实存在字段」的条件产出结构化筛选
//    （招聘类型 / 城市 / 学历 / 截止 / 届别 / 行业 / 公司性质 / 薪资 / 学校）；
// 2. 职能、批次等暂无独立字段的词，降级为关键词全文匹配（标题里本就含「后端」「秋招」）；
// 3. 无法识别的词一律不丢弃，进 keyword；
// 4. 每次识别都产出 token 供 UI 回显并可删除——不静默猜测。

import { CITY_PROVINCES } from "./cityTree";
import { INDUSTRY_LIST } from "./industryList";
import {
  COMPANY_TYPE_ALIASES,
  COHORT_RE,
  DEADLINE_ALIASES,
  DEGREE_ALIASES,
  INDUSTRY_ALIASES,
  JOB_TYPE_ALIASES,
  SALARY_ABOVE_RE,
  SALARY_RANGE_RE,
  SEASON_KEYWORDS,
} from "./taxonomy";

export type ParsedFilters = {
  jobType: string[];
  city: string[];
  degree: string[];
  deadline: string[];
  cohort: string[];
  industry: string[];
  companyType: string[];
  school: string[];
  salaryMin?: number;
  salaryMax?: number;
};

export type ParsedField = keyof ParsedFilters | "keyword";

export type ParsedToken = {
  raw: string;
  field: ParsedField;
  value: string;
  label: string;
};

export type ParsedQuery = {
  filters: ParsedFilters;
  keyword: string;
  tokens: ParsedToken[];
};

/** 解析结果中「可合并进筛选面板」的字段（salary 为数值，单独处理） */
export const MERGEABLE_FIELDS = [
  "jobType",
  "city",
  "degree",
  "deadline",
  "cohort",
  "industry",
  "companyType",
  "school",
] as const;

export function emptyFilters(): ParsedFilters {
  return {
    jobType: [],
    city: [],
    degree: [],
    deadline: [],
    cohort: [],
    industry: [],
    companyType: [],
    school: [],
  };
}

// 城市词表：标准城市 + 省级 + 全国（来自 cityTree，勿手改）
const CITY_SET: Set<string> = (() => {
  const s = new Set<string>(["全国"]);
  for (const [prov, cities] of Object.entries(CITY_PROVINCES)) {
    s.add(prov);
    for (const c of cities) s.add(c);
  }
  return s;
})();

const INDUSTRY_SET = new Set<string>(INDUSTRY_LIST);
const SCHOOL_RE = /(大学|学院|学校)$/;

// 空格（含全角）与常见分隔符
const SPLIT_RE = /[\s\u3000、,，;；]+/;

/** 别名表查找：先按原样，ASCII 词再按大写兜底（如 it → IT） */
function aliasLookup<T>(map: Record<string, T>, key: string): T | undefined {
  return map[key] ?? (/^[A-Za-z]+$/.test(key) ? map[key.toUpperCase()] : undefined);
}

export function parseQuery(input: string): ParsedQuery {
  const filters = emptyFilters();
  const tokens: ParsedToken[] = [];
  const leftovers: string[] = [];
  if (!input) return { filters, keyword: "", tokens };

  for (const raw of input.split(SPLIT_RE)) {
    const t = raw.trim();
    if (!t) continue;
    const push = (field: ParsedField, value: string, label: string) =>
      tokens.push({ raw: t, field, value, label });

    // 1) 薪资：最无歧义，优先
    let m = SALARY_ABOVE_RE.exec(t);
    if (m) {
      const v = Number(m[1]);
      filters.salaryMin = v;
      push("salaryMin", String(v), `薪资 ${v}K 以上`);
      continue;
    }
    m = SALARY_RANGE_RE.exec(t);
    if (m) {
      const lo = Number(m[1]);
      const hi = Number(m[2]);
      filters.salaryMin = lo;
      filters.salaryMax = hi;
      push("salaryMin", `${lo}-${hi}`, `薪资 ${lo}-${hi}K`);
      continue;
    }

    // 2) 届别（2027届 / 27届）
    m = COHORT_RE.exec(t);
    if (m) {
      const y = m[1].length === 2 ? `20${m[1]}` : m[1];
      const v = `${y}届`;
      if (!filters.cohort.includes(v)) filters.cohort.push(v);
      push("cohort", v, v);
      continue;
    }

    // 3) 截止时间档
    const dl = DEADLINE_ALIASES[t];
    if (dl) {
      if (!filters.deadline.includes(dl)) filters.deadline.push(dl);
      push("deadline", dl, t);
      continue;
    }

    // 4) 学历
    const dg = aliasLookup(DEGREE_ALIASES, t);
    if (dg) {
      if (!filters.degree.includes(dg)) filters.degree.push(dg);
      push("degree", dg, dg);
      continue;
    }

    // 5) 公司性质
    const ct = aliasLookup(COMPANY_TYPE_ALIASES, t);
    if (ct) {
      if (!filters.companyType.includes(ct)) filters.companyType.push(ct);
      push("companyType", ct, ct);
      continue;
    }

    // 6) 招聘类型
    const jt = aliasLookup(JOB_TYPE_ALIASES, t);
    if (jt) {
      if (!filters.jobType.includes(jt)) filters.jobType.push(jt);
      push("jobType", jt, jt);
      continue;
    }

    // 7) 行业（标准值精确命中，或表层别名）
    if (INDUSTRY_SET.has(t)) {
      if (!filters.industry.includes(t)) filters.industry.push(t);
      push("industry", t, t);
      continue;
    }
    const ind = aliasLookup(INDUSTRY_ALIASES, t);
    if (ind) {
      if (!filters.industry.includes(ind)) filters.industry.push(ind);
      push("industry", ind, ind);
      continue;
    }

    // 8) 城市（精确命中，避免子串误判）
    if (CITY_SET.has(t)) {
      if (!filters.city.includes(t)) filters.city.push(t);
      push("city", t, t);
      continue;
    }

    // 9) 学校（按后缀识别，无需维护校名表）
    if (SCHOOL_RE.test(t)) {
      if (!filters.school.includes(t)) filters.school.push(t);
      push("school", t, t);
      continue;
    }

    // 10) 批次词：标注为批次，但仍按全文匹配（库里无 season 字段）
    if (SEASON_KEYWORDS.includes(t)) {
      push("keyword", t, `批次 ${t}`);
      leftovers.push(t);
      continue;
    }

    leftovers.push(t);
  }

  return { filters, keyword: leftovers.join(" "), tokens };
}

/** 把解析出的条件并入筛选面板状态（union，去重；salary 由调用方单独处理） */
export function mergeParsed<T extends object>(base: T, parsed: ParsedFilters): T {
  const next = { ...base } as Record<string, unknown>;
  for (const f of MERGEABLE_FIELDS) {
    const add = parsed[f];
    if (!add || add.length === 0) continue;
    const cur = (next[f] as string[] | undefined) ?? [];
    next[f] = [...cur, ...add.filter((v) => !cur.includes(v))];
  }
  return next as T;
}
