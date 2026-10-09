// 筛选词表唯一权威（纯数据 + 纯函数，不引用 next/*，可被 server / client / parser 共用）
//
// 规矩：一套枚举只在这里定义一次，其它模块 import，不得各自硬编码。
// 词表出处与匹配语义见 design-doc/filter-spec.md：
//   - 招聘类型：本站内容形态（岗位 / 活动 / 公告）
//   - 学历：《中华人民共和国高等教育法》第十六条、第二十二条
//     （高等学历教育分专科教育、本科教育、研究生教育；学位分学士、硕士、博士）
//   - 公司性质：省级就业协议书「单位性质」栏口径（含「三资企业」等价「外商投资企业」）

// ── 招聘类型 ─────────────────────────────────────────────
export const JOB_TYPES = ["校招", "实习", "宣讲会", "招聘会", "招聘公告"] as const;
export type JobType = (typeof JOB_TYPES)[number];

// 解析别名 → 标准值（供复合搜索与入库归一化共用）
// 注意：秋招/春招/提前批 这类「批次」词不在此映射——它们出现在标题里，
// 强行映射成 job_type=校招 会错误收窄结果，故交由 SEASON_KEYWORDS 走全文匹配。
export const JOB_TYPE_ALIASES: Record<string, JobType> = {
  校招: "校招",
  校园招聘: "校招",
  实习: "实习",
  实习生: "实习",
  实习招聘: "实习",
  宣讲会: "宣讲会",
  宣讲: "宣讲会",
  招聘会: "招聘会",
  双选会: "招聘会",
  招聘公告: "招聘公告",
  公告: "招聘公告",
};

// ── 学历（层级包含语义：岗位要求档位 ≤ 用户档位）──────────────
// 展示顺序 = 由低到高；用户选中某档 = 该学历及以上
export const DEGREE_LADDER = ["学历不限", "专科及以上", "本科及以上", "硕士及以上", "博士"] as const;

// 供筛选面板使用的「我的学历」三档
export const DEGREE_FILTER_LEVEL: Record<string, number> = {
  专科: 1,
  本科: 2,
  硕士: 3,
};

// 岗位原始学历文本 → 层级（不限=0 专科=1 本科=2 硕士=3 博士=4）
export function degreeLevel(degree: string | null | undefined): number {
  const d = (degree || "").trim();
  if (!d || d.includes("不限")) return 0;
  if (d.includes("博士")) return 4;
  if (d.includes("硕士")) return 3;
  if (d.includes("本科")) return 2;
  if (d.includes("专科") || d.includes("大专")) return 1;
  return 0;
}

// 解析别名 → 标准档位
export const DEGREE_ALIASES: Record<string, string> = {
  不限: "学历不限",
  学历不限: "学历不限",
  大专: "专科及以上",
  专科: "专科及以上",
  本科: "本科及以上",
  学士: "本科及以上",
  硕士: "硕士及以上",
  研究生: "硕士及以上",
  博士: "博士",
};

// ── 公司性质（教育部就业系统「单位性质」口径，非互斥）──────────
export const COMPANY_TYPE_LIST = ["外企/合资", "国企/央企", "民企/私企", "上市公司/500强"];

export const COMPANY_TYPE_ALIASES: Record<string, string> = {
  国企: "国企/央企",
  央企: "国企/央企",
  国有: "国企/央企",
  外企: "外企/合资",
  外资: "外企/合资",
  合资: "外企/合资",
  三资: "外企/合资",
  民企: "民企/私企",
  私企: "民企/私企",
  民营: "民企/私企",
  上市公司: "上市公司/500强",
  上市: "上市公司/500强",
  "500强": "上市公司/500强",
};

// ── 截止时间档（Handshake 以申请截止驱动排序，校招核心动机）────
export type DeadlineBucket = { key: string; label: string; min: number; max: number };

export const DEADLINE_BUCKETS: DeadlineBucket[] = [
  { key: "today", label: "今天截止", min: 0, max: 0 },
  { key: "d3", label: "3天内截止", min: 0, max: 3 },
  { key: "d7", label: "7天内截止", min: 0, max: 7 },
  { key: "d30", label: "30天内截止", min: 0, max: 30 },
  { key: "past", label: "已截止", min: -99999, max: -1 },
  { key: "none", label: "未标注截止", min: NaN, max: NaN },
];

export const DEADLINE_ALIASES: Record<string, string> = {
  今天: "today",
  今日: "today",
  今天截止: "today",
  "3天内": "d3",
  三天内: "d3",
  本周: "d7",
  "7天内": "d7",
  七天内: "d7",
  本月: "d30",
  "30天内": "d30",
  已截止: "past",
  过期: "past",
  未标注: "none",
  无截止: "none",
};

// 截止天数是否命中某档（deadlineDays: 正=未到期 0=今天 负=已过期 null=无截止）
export function matchDeadlineBucket(days: number | null, key: string): boolean {
  if (key === "none") return days === null;
  if (days === null) return false;
  const b = DEADLINE_BUCKETS.find((x) => x.key === key);
  if (!b) return false;
  return days >= b.min && days <= b.max;
}

// ── 行业（GB/T 4754—2017 门类骨架裁剪，标准数据见 infra/classify/industries.json）
// 表层词 → 标准类目；只做输入解析用，不改动标准词表本身。
export const INDUSTRY_ALIASES: Record<string, string> = {
  互联网: "互联网/AI/IT",
  计算机: "互联网/AI/IT",
  IT: "互联网/AI/IT",
  软件: "互联网/AI/IT",
  人工智能: "互联网/AI/IT",
  电子: "电子/半导体/硬件",
  半导体: "电子/半导体/硬件",
  芯片: "电子/半导体/硬件",
  通信: "通信/网络",
  汽车: "汽车/新能源",
  新能源: "汽车/新能源",
  机械: "机械/制造/重工",
  制造: "机械/制造/重工",
  能源: "能源/化工/材料",
  化工: "能源/化工/材料",
  医药: "医药/生物/医疗",
  医疗: "医药/生物/医疗",
  金融: "金融/银行/保险",
  银行: "金融/银行/保险",
  保险: "金融/银行/保险",
  地产: "地产/建筑/工程",
  建筑: "地产/建筑/工程",
  消费: "消费/零售/贸易",
  零售: "消费/零售/贸易",
  教育: "教育/培训/科研",
  科研: "教育/培训/科研",
  咨询: "专业服务/咨询",
  销售: "销售/市场/商务",
  市场: "销售/市场/商务",
  采购: "采购/供应链/物流",
  供应链: "采购/供应链/物流",
  物流: "采购/供应链/物流",
  人力: "人力资源/行政/运营",
  行政: "人力资源/行政/运营",
  运营: "人力资源/行政/运营",
  政府: "政府/公共事业/非营利",
  传媒: "传媒/文化/体育",
  酒店: "酒店/餐饮/旅游",
  旅游: "酒店/餐饮/旅游",
  农业: "农/林/牧/渔",
};

// ── 招聘批次（无独立字段，按关键词参与全文匹配）──────────────
export const SEASON_KEYWORDS = ["秋招", "春招", "暑期", "提前批", "补录", "日常实习", "寒假"];

// ── 校招届别 ────────────────────────────────────────────
// 接受 "2027届" 与 "27届" 两种写法
export const COHORT_RE = /^(20\d{2}|\d{2})届$/;

// ── 薪资（"15K以上" / "10-20K" / "面议"）──────────────────
export const SALARY_ABOVE_RE = /^(\d+(?:\.\d+)?)\s*[kK千]以上$/;
export const SALARY_RANGE_RE = /^(\d+(?:\.\d+)?)\s*[-~至]\s*(\d+(?:\.\d+)?)\s*[kK千]$/;
