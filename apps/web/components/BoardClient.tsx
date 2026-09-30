"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { JobView } from "@/lib/jobs";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { INDUSTRY_LIST } from "@/lib/industryList";
import { CITY_PROVINCES, PROVINCE_ORDER, HOT_CITIES } from "@/lib/cityTree";

const STAGES = ["待投", "已投", "笔试", "面试", "已挂", "Offer"] as const;
type Stage = (typeof STAGES)[number];
// 统计条窄格用两字短标签，列头/下拉保持 Offer
const STAT_LABEL: Record<Stage, string> = { "待投": "待投", "已投": "已投", "笔试": "笔试", "面试": "面试", "已挂": "已挂", "Offer": "录用" };
const KEY = "offer_board";

const STAGE_TO_STATUS: Record<string, string> = {
  "待投": "pending", "已投": "applied", "笔试": "written",
  "面试": "interview", "已挂": "failed", "Offer": "offer",
};
const STATUS_TO_STAGE: Record<string, string> = Object.fromEntries(
  Object.entries(STAGE_TO_STATUS).map(([k, v]) => [v, k])
);

const COMPANY_TYPES = ["外企/合资", "国企/央企", "民企/私企", "上市公司/500强"];
const RECRUIT_TYPES = ["校招", "实习", "宣讲会", "招聘会"];
const COHORTS = ["2027届", "2028届", "2026届", "不限"];
const DEGREE_OPTIONS = ["不限", "专科", "本科", "硕士", "博士"];

const SUBMIT_LABEL: Record<string, string> = {
  private: "未投稿",
  pending: "待审核",
  published: "已上架",
  rejected: "被驳回",
};

type CustomJob = {
  id: string;
  company: string;
  title: string;
  company_type: string | null;
  recruit_type: string | null;
  cohort: string | null;
  city: string | null;
  deadline_at: string | null;
  apply_url: string;
  note: string | null;
  stage: string;
  submit_status: string;
  published_job_id: string | null;
  industry: string | null;
  degree: string | null;
  created_at: string;
};

type BoardCard =
  | { key: string; isCustom: false; job: JobView }
  | { key: string; isCustom: true; custom: CustomJob };

// 自绘深色日历（原生日历弹层白底无法适配深色主题）
function CalendarPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const now = new Date();
  const [viewY, setViewY] = useState(now.getFullYear());
  const [viewM, setViewM] = useState(now.getMonth());
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // 每次打开定位到「已选日期所在月」；未选则定位「今天所在月」
  const openPicker = () => {
    const base = value ? new Date(value + "T00:00:00") : new Date();
    if (!isNaN(base.getTime())) { setViewY(base.getFullYear()); setViewM(base.getMonth()); }
    setOpen(true);
  };

  const firstDow = new Date(viewY, viewM, 1).getDay();
  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const wd = ["日", "一", "二", "三", "四", "五", "六"];
  const iso = (d: number) => `${viewY}-${String(viewM + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const prevM = () => { if (viewM === 0) { setViewY(viewY - 1); setViewM(11); } else setViewM(viewM - 1); };
  const nextM = () => { if (viewM === 11) { setViewY(viewY + 1); setViewM(0); } else setViewM(viewM + 1); };

  return (
    <div className="cal" ref={ref}>
      <div className="cal-head" onClick={open ? () => setOpen(false) : openPicker}>
        <span className={value ? "" : "ph"}>{value || "招满为止"}</span>
        <span className="fancy-caret">▾</span>
      </div>
      {open && (
        <div className="cal-panel">
          <div className="cal-nav">
            <button type="button" onClick={prevM}>‹</button>
            <span>{viewY}年{viewM + 1}月</span>
            <button type="button" onClick={nextM}>›</button>
          </div>
          <div className="cal-grid">
            {wd.map((w) => <div key={w} className="cal-wd">{w}</div>)}
            {cells.map((d, i) =>
              d === null ? <div key={i} /> : (
                <div
                  key={i}
                  className={"cal-day" + (value === iso(d) ? " sel" : "")}
                  onClick={() => { onChange(iso(d)); setOpen(false); }}
                >{d}</div>
              )
            )}
          </div>
          <div className="cal-foot">
            <button type="button" onClick={() => { onChange(""); setOpen(false); }}>清除</button>
            <button type="button" onClick={() => { const t = new Date(); onChange(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`); setOpen(false); }}>今天</button>
          </div>
        </div>
      )}
    </div>
  );
}

// 自绘深色下拉（替代原生 select，对齐网站风格）
function FancySelect({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const display = value || placeholder || "";
  return (
    <div className="fancy" ref={ref}>
      <div className={"fancy-head" + (open ? " open" : "")} onClick={() => setOpen((o) => !o)}>
        <span className={value ? "" : "ph"}>{display}</span>
        <span className="fancy-caret">▾</span>
      </div>
      {open && (
        <div className="fancy-menu">
          {options.map((o) => (
            <div
              key={o || "__empty"}
              className={"fancy-item" + (value === o ? " sel" : "")}
              onClick={() => { onChange(o); setOpen(false); }}
            >{o === "" ? (placeholder || "未分类") : o}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// 城市两级：一级=全国/热门/省份（可选项），二级=对应城市列表（联动）
const PROVINCE_OPTIONS: string[] = [
  "全国",
  "热门",
  ...PROVINCE_ORDER.filter((p) => p !== "全国" && p !== "热门" && p !== "海外" && CITY_PROVINCES[p]),
];
function citiesOfProvince(prov: string): string[] {
  if (prov === "全国") return ["全国"];
  if (prov === "热门") return HOT_CITIES;
  return CITY_PROVINCES[prov] || [];
}

function readBoard(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}

const emptyForm = {
  company: "",
  title: "",
  company_type: COMPANY_TYPES[1],
  recruit_type: "校招",
  cohort: COHORTS[0],
  cityProvince: "全国",
  city: "全国",
  deadline_at: "",
  apply_url: "",
  note: "",
  stage: "待投" as Stage,
  submit: true,
  industry: "",
  degree: "不限",
};

export default function BoardClient({ jobs }: { jobs: JobView[] }) {
  const router = useRouter();
  const [stages, setStages] = useState<Record<string, string>>({});
  const [customJobs, setCustomJobs] = useState<CustomJob[]>([]);
  const [sheet, setSheet] = useState<BoardCard | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropCol, setDropCol] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [showEntry, setShowEntry] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1600);
  }

  // 手动岗位：登录后从云端拉取
  async function loadCustom(userId: string) {
    const { data } = await supabase
      .from("user_custom_jobs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (data) {
      setCustomJobs(data as CustomJob[]);
      setStages((prev) => {
        const next = { ...prev };
        for (const c of data) next["c:" + c.id] = STATUS_TO_STAGE[c.stage] || "待投";
        return next;
      });
    }
  }

  useEffect(() => {
    setStages(readBoard());
    if (!localStorage.getItem("offer_board_guide_seen")) setShowGuide(true);
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user;
      if (!u) return;
      await loadCustom(u.id);
      const local = readBoard();
      const existing = await supabase.from("user_jobs").select("job_id, status").eq("user_id", u.id);
      const existingMap: Record<string, string> = {};
      if (existing.data) for (const r of existing.data) {
        const st = STATUS_TO_STAGE[r.status];
        if (st) existingMap["j:" + r.job_id] = st;
      }
      for (const [rawKey, stage] of Object.entries(local)) {
        if (!rawKey.startsWith("j:")) continue;
        const jobId = rawKey.slice(2);
        if (!existingMap[rawKey]) await supabase.from("user_jobs").upsert(
          { user_id: u.id, job_id: jobId, status: STAGE_TO_STATUS[stage] },
          { onConflict: "user_id,job_id,status" });
      }
      supabase.from("user_jobs").select("job_id, status").eq("user_id", u.id).then(({ data: rows }) => {
        if (!rows) return;
        setStages((prev) => {
          const b = { ...prev };
          for (const r of rows) { const st = STATUS_TO_STAGE[r.status]; if (st) b["j:" + r.job_id] = st; }
          return b;
        });
      });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) return;
      loadCustom(session.user.id);
      supabase.from("user_jobs").select("job_id, status").eq("user_id", session.user.id).then(({ data: rows }) => {
        if (!rows) return;
        setStages((prev) => {
          const b = { ...prev };
          for (const r of rows) { const st = STATUS_TO_STAGE[r.status]; if (st) b["j:" + r.job_id] = st; }
          return b;
        });
      });
    });
    return () => subscription.unsubscribe();
  }, []);

  async function setStage(id: string, st: Stage) {
    const next = { ...stages, [id]: st };
    localStorage.setItem(KEY, JSON.stringify(next));
    setStages(next);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    if (id.startsWith("c:")) {
      const customId = id.slice(2);
      await supabase.from("user_custom_jobs")
        .update({ stage: STAGE_TO_STATUS[st] })
        .eq("user_id", session.user.id)
        .eq("id", customId);
    } else {
      const jobId = id.slice(2);
      await supabase.from("user_jobs").delete().eq("user_id", session.user.id).eq("job_id", jobId);
      await supabase.from("user_jobs").upsert(
        { user_id: session.user.id, job_id: jobId, status: STAGE_TO_STATUS[st] },
        { onConflict: "user_id,job_id,status" });
    }
  }

  async function doRemove(id: string) {
    const rest = { ...stages };
    delete rest[id];
    setStages(rest);
    localStorage.setItem(KEY, JSON.stringify(rest));
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      if (id.startsWith("c:")) {
        await supabase.from("user_custom_jobs")
          .delete().eq("user_id", session.user.id).eq("id", id.slice(2));
        setCustomJobs((cs) => cs.filter((c) => "c:" + c.id !== id));
      } else {
        await supabase.from("user_jobs").delete().eq("user_id", session.user.id).eq("job_id", id.slice(2));
      }
    }
    showToast("已移除");
  }

  // 手动录入提交
  async function submitEntry() {
    if (!form.company.trim() || !form.title.trim()) {
      showToast("企业名称和岗位名称必填");
      return;
    }
    if (!form.apply_url.trim()) {
      showToast("投递链接必填");
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      showToast("请先登录");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("user_custom_jobs")
      .insert({
        user_id: session.user.id,
        company: form.company.trim(),
        title: form.title.trim(),
        company_type: form.company_type,
        recruit_type: form.recruit_type,
        cohort: form.cohort,
        city: form.city === "全国" ? "全国" : (form.city.trim() || null),
        deadline_at: form.deadline_at || null,
        apply_url: form.apply_url.trim(),
        note: form.note.trim() || null,
        industry: form.industry || null,
        degree: form.degree || "",
        stage: STAGE_TO_STATUS[form.stage],
        submit_status: form.submit ? "pending" : "private",
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      showToast("保存失败：" + error.message);
      return;
    }
    const c = data as CustomJob;
    setCustomJobs((cs) => [c, ...cs]);
    setStages((prev) => ({ ...prev, ["c:" + c.id]: form.stage }));
    localStorage.setItem(KEY, JSON.stringify({ ...stages, ["c:" + c.id]: form.stage }));
    setShowEntry(false);
    setForm(emptyForm);
    showToast(form.submit ? "已加入看板，投稿待审核" : "已加入看板");
  }

  // 投稿动作：private/rejected → pending
  async function doSubmit(c: CustomJob) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { showToast("请先登录"); return; }
    setSubmitting(c.id);
    const { error } = await supabase
      .from("user_custom_jobs")
      .update({ submit_status: "pending" })
      .eq("user_id", session.user.id)
      .eq("id", c.id);
    setSubmitting(null);
    if (error) { showToast("投稿失败：" + error.message); return; }
    setCustomJobs((cs) => cs.map((x) => (x.id === c.id ? { ...x, submit_status: "pending" } : x)));
    showToast("已提交审核，通过后将在网站展示");
  }

  const cards = useMemo<BoardCard[]>(() => {
    const out: BoardCard[] = [];
    for (const j of jobs) out.push({ key: "j:" + j.id, isCustom: false, job: j });
    for (const c of customJobs) out.push({ key: "c:" + c.id, isCustom: true, custom: c });
    return out;
  }, [jobs, customJobs]);

  const cols = useMemo(() => STAGES.map((st) => ({ st, list: cards.filter((c) => stages[c.key] === st) })), [cards, stages]);
  const stats = useMemo(() => STAGES.map((st) => ({ st, n: cards.filter((c) => stages[c.key] === st).length })), [cards, stages]);

  const sheetKey = sheet?.key;

  return (
    <div className="wrap">
      <div className="page-hero">
        <div>
          <h1 className="h-display">求职看板</h1>
          <p>待投 / 已投 / 笔试 / 面试 / 已挂 / Offer 全流程进度管理，桌面拖拽、移动端点选改状态。</p>
          <div className="tags-row">
            <span>拖拽卡片到目标阶段</span>
            <span>拖到看板外移除</span>
            <span>登录后自动云端同步</span>
          </div>
        </div>
        <div className="orbital-actions">
          <div className="orbital">
            <button className="inner" onClick={() => router.push("/")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
              从首页添加岗位
            </button>
          </div>
          <div className="orbital">
            <button className="inner entry" onClick={() => setShowEntry(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
              手动录入
            </button>
          </div>
        </div>
      </div>

      {/* 拖拽时显示的删除条 */}
      <div
        className={"drop-trash" + (dragId ? " show" : "")}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dragId) { doRemove(dragId); setDragId(null); }
        }}
      >
        🗑 拖到这里移除
      </div>

      <div className="board-stats">
        {stats.map((s) => (
          <div key={s.st} className={"st glass" + (s.st === "已挂" ? " failed" : "")}>
            <b>{s.n}</b><span>{STAT_LABEL[s.st]}</span>
          </div>
        ))}
      </div>

      <div className="board">
        {cols.map(({ st, list }) => (
          <div key={st} className={"board-col glass" + (st === "已挂" ? " failed" : "") + (dropCol === st ? " drop" : "")}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropCol(st); }}
            onDragLeave={() => setDropCol(null)}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDropCol(null); if (dragId) { setStage(dragId, st as Stage); setDragId(null); } }}>
            <h5>{st}<span className="cnt">{list.length}</span></h5>
            {list.length === 0 ? (
              <div style={{ fontSize: 11, color: "rgba(183,198,194,.4)", textAlign: "center", padding: "22px 0", lineHeight: 1.6 }}>
                {st === "待投" ? "去首页点「+ 待投」或「＋手动录入」添加" : "📥 把岗位拖到这里"}
              </div>
            ) : (
              list.map((c) => {
                const isCustom = c.isCustom;
                const title = isCustom ? c.custom.title : c.job.title;
                const company = isCustom ? c.custom.company : c.job.company;
                const city = isCustom ? (c.custom.city || "全国") : c.job.city;
                const deadline = isCustom ? (c.custom.deadline_at || "招满为止") : (c.job.deadlineAt || "未标截止");
                const submitStatus = isCustom ? c.custom.submit_status : null;
                return (
                  <div key={c.key} className={"bd-card" + (st === "已挂" ? " dim" : "") + (dragId === c.key ? " dragging" : "")}
                    draggable onDragStart={() => setDragId(c.key)} onDragEnd={() => setDragId(null)}
                    onClick={() => setSheet(c)}>
                    <div className="bt">
                      {title}
                      {isCustom && <span className="mini-tag">手动</span>}
                      {submitStatus === "published" && <span className="mini-tag ok">已上架</span>}
                      {submitStatus === "pending" && <span className="mini-tag warn">待审核</span>}
                      {submitStatus === "rejected" && <span className="mini-tag bad">被驳回</span>}
                    </div>
                    <div className="bc">{company} · {city}</div>
                    <div className="bd-row">
                      <span>{deadline}</span>
                      <span className="chg" onClick={(e) => { e.stopPropagation(); setSheet(c); }}>改状态 ›</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ))}
      </div>

      {/* 改状态 / 详情弹层 */}
      <div className={"stage-mask" + (sheet ? " open" : "")} onClick={() => setSheet(null)} />
      <div className={"stage-sheet" + (sheet ? " open" : "")}>
        {sheet && (
          <>
            <h5>{sheet.isCustom ? `${sheet.custom.company} · ${sheet.custom.title}` : `${sheet.job.company} · ${sheet.job.title}`}</h5>
            {sheet.isCustom && (
              <div className="sheet-meta">
                {[sheet.custom.company_type, sheet.custom.recruit_type, sheet.custom.cohort, sheet.custom.city]
                  .filter(Boolean).join(" · ") || "未填类型/届别"}
                {sheet.custom.note && <div className="sheet-note">{sheet.custom.note}</div>}
              </div>
            )}
            <div>
              {STAGES.map((st) => (
                <button key={st} className={(stages[sheetKey!] || "待投") === st ? "on" : ""}
                  onClick={() => { if (sheetKey) setStage(sheetKey, st); setSheet(null); }}>
                  {st}{(stages[sheetKey!] || "待投") === st ? " · 当前" : ""}
                </button>
              ))}
            </div>
            <div className="sheet-actions">
              {sheet.isCustom && (sheet.custom.submit_status === "private" || sheet.custom.submit_status === "rejected") && (
                <button className="up" disabled={submitting === sheet.custom.id}
                  onClick={() => doSubmit(sheet.custom)}>
                  {sheet.custom.submit_status === "rejected" ? "重新投稿到网站" : "投稿到网站"}
                </button>
              )}
              {sheet.isCustom && sheet.custom.submit_status === "published" && (
                <div className="up done">已上架到网站列表 ✅</div>
              )}
              <a className="up" href={sheet.isCustom ? sheet.custom.apply_url : sheet.job.applyUrl} target="_blank" rel="noreferrer">
                投递页 ↗
              </a>
              <button className="rm" onClick={() => { if (sheetKey) doRemove(sheetKey); setSheet(null); }}>移除该岗位</button>
            </div>
          </>
        )}
      </div>

      {/* 手动录入弹窗 */}
      <div className={"entry-mask" + (showEntry ? " open" : "")} onClick={() => setShowEntry(false)} />
      <div className={"entry-modal" + (showEntry ? " open" : "")}>
        <h5>＋ 手动录入岗位</h5>
        <p className="entry-tip">录入选投递的公司和岗位，保存后立即进入你的看板管理</p>
        <div className="entry-grid">
          <label>
            <span>企业名称 *</span>
            <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="如：某某科技" />
          </label>
          <label>
            <span>岗位名称 *</span>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="如：后端开发工程师" />
          </label>
          <label>
            <span>企业类型</span>
            <FancySelect value={form.company_type} onChange={(v) => setForm({ ...form, company_type: v })} options={COMPANY_TYPES} />
          </label>
          <label>
            <span>招聘类型</span>
            <FancySelect value={form.recruit_type} onChange={(v) => setForm({ ...form, recruit_type: v })} options={RECRUIT_TYPES} />
          </label>
          <label>
            <span>招聘对象</span>
            <FancySelect value={form.cohort} onChange={(v) => setForm({ ...form, cohort: v })} options={COHORTS} />
          </label>
          <label>
            <span>行业（未分类可不选）</span>
            <FancySelect value={form.industry} onChange={(v) => setForm({ ...form, industry: v })} options={["", ...INDUSTRY_LIST]} placeholder="未分类" />
          </label>
          <label>
            <span>学历要求</span>
            <FancySelect value={form.degree} onChange={(v) => setForm({ ...form, degree: v })} options={DEGREE_OPTIONS} />
          </label>
          <label>
            <span>所在地区</span>
            <FancySelect
              value={form.cityProvince}
              onChange={(v) => {
                const next = { ...form, cityProvince: v };
                next.city = v === "全国" ? "全国" : (citiesOfProvince(v)[0] || "");
                setForm(next);
              }}
              options={PROVINCE_OPTIONS}
            />
          </label>
          <label>
            <span>城市</span>
            <FancySelect
              value={form.city}
              onChange={(v) => setForm({ ...form, city: v })}
              options={form.cityProvince === "全国" ? ["全国"] : citiesOfProvince(form.cityProvince)}
            />
          </label>
          <label>
            <span>投递截止时间（空=招满为止）</span>
            <CalendarPicker value={form.deadline_at} onChange={(v) => setForm({ ...form, deadline_at: v })} />
          </label>
          <label>
            <span>投递链接 *</span>
            <input value={form.apply_url} onChange={(e) => setForm({ ...form, apply_url: e.target.value })} placeholder="https://…" />
          </label>
          <label className="full">
            <span>备注（可空）</span>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="如：官网投递后暂无回音" />
          </label>
          <label>
            <span>我的进度</span>
            <FancySelect value={form.stage} onChange={(v) => setForm({ ...form, stage: v as Stage })} options={[...STAGES]} />
          </label>
        </div>
        <label className="entry-submit">
          <input type="checkbox" checked={form.submit} onChange={(e) => setForm({ ...form, submit: e.target.checked })} />
          <span>投稿到网站（审核通过后展示给所有人，不勾选则仅自己可见）</span>
        </label>
        <div className="entry-actions">
          <button className="cancel" onClick={() => setShowEntry(false)}>取消</button>
          <button className="go" disabled={saving} onClick={submitEntry}>
            {saving ? "保存中…" : form.submit ? "保存并投稿" : "保存"}
          </button>
        </div>
      </div>

      {/* 首次访问引导 */}
      {showGuide && (
        <div className="guide-mask" onClick={() => { localStorage.setItem("offer_board_guide_seen", "1"); setShowGuide(false); }}>
          <div className="guide-box" onClick={(e) => e.stopPropagation()}>
            <h5>💡 怎么用求职看板？</h5>
            <div className="guide-item"><b>拖拽卡片</b>到下方 6 列，自动改阶段（待投/已投/笔试/面试/已挂/Offer）</div>
            <div className="guide-item"><b>拖到顶部垃圾桶</b>可移除该岗位</div>
            <div className="guide-item">点卡片可手动选阶段，登录后自动云端同步</div>
            <div className="guide-item">投的公司网站没收录？点<b>「＋手动录入」</b>自己添加，保存后立即进入看板管理</div>
            <button className="guide-ok" onClick={() => { localStorage.setItem("offer_board_guide_seen", "1"); setShowGuide(false); }}>我知道了</button>
          </div>
        </div>
      )}

      <div className={"toast" + (toast ? " show" : "")}>{toast}</div>
    </div>
  );
}
