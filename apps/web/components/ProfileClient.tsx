"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function Switch({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className={"sw" + (on ? " on" : "")}
      onClick={() => onChange(!on)}
      style={{ cursor: "pointer" }}
    />
  );
}

export default function ProfileClient() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [major, setMajor] = useState("");
  const [cohort, setCohort] = useState("");
  const [saved, setSaved] = useState(false);
  const [sw, setSw] = useState({ email: true, push: false, ics: true });
  // 简历
  const [resumes, setResumes] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (!u) {
        router.push("/login");
        return;
      }
      setUser(u);
      setName(u.user_metadata?.name || "");
      // 从 profiles 表读资料
      supabase
        .from("profiles")
        .select("username, university, major, cohort")
        .eq("id", u.id)
        .single()
        .then(({ data: p }) => {
          if (p) {
            setName(p.username || "");
            setSchool(p.university || "");
            setMajor(p.major || "");
            setCohort(p.cohort || "");
          }
          setLoading(false);
        });
      // 简历列表
      supabase
        .from("resumes")
        .select("id, file_name, status, version, created_at")
        .eq("user_id", u.id)
        .order("created_at", { ascending: false })
        .then(({ data: r }) => setResumes(r || []));
    });
  }, [router]);

  async function uploadResume(file: File) {
    if (!user) return;
    setUploading(true);
    setUploadMsg("");
    try {
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.\-\u4e00-\u9fa5]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("resumes")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) {
        setUploadMsg("上传失败：" + upErr.message);
        return;
      }
      const { data: row, error: insErr } = await supabase
        .from("resumes")
        .insert({
          user_id: user.id,
          file_name: file.name,
          storage_path: path,
          status: "parsing",
          version: (resumes[0]?.version || 0) + 1,
        })
        .select("id, file_name, status, version, created_at")
        .single();
      if (insErr) {
        setUploadMsg("记录失败：" + insErr.message);
        return;
      }
      setResumes((prev) => [row, ...prev]);
      setUploadMsg("✓ 上传成功，状态解析中");
    } catch (e) {
      setUploadMsg("上传异常：" + (e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile() {
    if (!user) return;
    await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        email: user.email,
        username: name, university: school, major, cohort,
        updated_at: new Date().toISOString(),
      });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(238,235,227,0.5)" }}>加载中...</div>;
  }

  return (
    <div className="wrap">
      <div className="page-hero" style={{ marginTop: 24 }}>
        <div>
          <h1 className="h-display">我的</h1>
          <p>{user?.email}</p>
        </div>
      </div>

      <div className="profile-grid">
        {/* 个人资料 */}
        <div className="profile-card glass" style={{ gridColumn: "1/-1" }}>
          <h4>个人资料</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "rgba(238,235,227,0.6)", display: "block", marginBottom: "4px" }}>昵称</label>
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="你的名字" />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "rgba(238,235,227,0.6)", display: "block", marginBottom: "4px" }}>学校</label>
              <input value={school} onChange={(e) => setSchool(e.target.value)} style={inputStyle} placeholder="如：福州大学" />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "rgba(238,235,227,0.6)", display: "block", marginBottom: "4px" }}>专业</label>
              <input value={major} onChange={(e) => setMajor(e.target.value)} style={inputStyle} placeholder="如：计算机科学与技术" />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "rgba(238,235,227,0.6)", display: "block", marginBottom: "4px" }}>届别</label>
              <input value={cohort} onChange={(e) => setCohort(e.target.value)} style={inputStyle} placeholder="如：2027届" />
            </div>
            <button onClick={saveProfile} style={saveBtnStyle}>
              {saved ? "✓ 已保存" : "保存资料"}
            </button>
          </div>
        </div>

        {/* 求职工具 */}
        <div className="profile-card glass" style={{ gridColumn: "1/-1" }}>
          <h4>
            <span className="gicon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" stroke="#8b5cf6" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </span>
            求职工具
          </h4>
          <div className="tool-grid">
            <Link className="tool-item glass" href="/board">
              <span className="t-ic">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path d="M3 5h18M3 12h18M3 19h18" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <div className="tt">求职看板</div>
                <div className="ts">已投 / 笔试 / 面试 / Offer</div>
              </div>
            </Link>
            <Link className="tool-item glass" href="/match">
              <span className="t-ic">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.2 2.2m8.4 8.4 2.2 2.2m0-12.8-2.2 2.2m-8.4 8.4-2.2 2.2" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <div className="tt">AI 匹配</div>
                <div className="ts">简历 → 高匹配岗位</div>
              </div>
            </Link>
            <Link className="tool-item glass" href="/community">
              <span className="t-ic">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <div className="tt">内推广场</div>
                <div className="ts">悬赏内推码 · 面经</div>
              </div>
            </Link>
          </div>
        </div>

        {/* 简历管理 */}
        <div className="profile-card glass" style={{ gridColumn: "1/-1" }}>
          <h4>
            <span className="gicon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" stroke="#8b5cf6" strokeWidth="2" strokeLinejoin="round" />
                <path d="M14 3v5h5M9 13h6M9 17h6" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            我的简历
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "14px",
                border: "1px dashed rgba(183,198,194,.4)",
                borderRadius: 10,
                cursor: "pointer",
                fontSize: 13,
                color: "rgba(238,235,227,.85)",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="#8b5cf6" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
              {uploading ? "上传中…" : "上传简历（PDF / Word，≤5MB）"}
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                style={{ display: "none" }}
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadResume(f);
                  e.target.value = "";
                }}
              />
            </label>
            {uploadMsg && (
              <p style={{ fontSize: 12, color: uploadMsg.startsWith("✓") ? "#4ade80" : "#fda4af" }}>{uploadMsg}</p>
            )}
            {resumes.length === 0 ? (
              <p style={{ fontSize: 12, color: "rgba(183,198,194,.6)" }}>
                还没有简历。上传后可用于 AI 匹配与投递记录。
              </p>
            ) : (
              resumes.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    background: "rgba(255,255,255,.04)",
                    border: "1px solid rgba(255,255,255,.08)",
                    borderRadius: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, color: "#eeebe3", fontWeight: 600 }}>{r.file_name}</div>
                    <div style={{ fontSize: 11, color: "rgba(183,198,194,.55)", marginTop: 2 }}>
                      v{r.version} · {r.created_at?.slice(0, 10)}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 10px",
                      borderRadius: 999,
                      background:
                        r.status === "ready"
                          ? "rgba(22,163,74,.15)"
                          : r.status === "failed"
                          ? "rgba(202,0,19,.15)"
                          : "rgba(250,204,21,.12)",
                      color:
                        r.status === "ready"
                          ? "#4ade80"
                          : r.status === "failed"
                          ? "#fda4af"
                          : "#facc15",
                    }}
                  >
                    {r.status === "ready" ? "解析完成" : r.status === "failed" ? "解析失败" : "解析中"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="profile-card glass">
          <h4>
            <span className="gicon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#06b6d4" strokeWidth="2" />
                <path d="M12 7v5l3 3" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            数据来源
          </h4>
          <p style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span className="badge">国家 24365 平台</span>
            <span className="badge">福建就业网</span>
            <span className="badge">福建人才联合网</span>
            <span className="badge">福建理工大学就业网</span>
          </p>
          <p style={{ fontSize: 12, color: "rgba(183,198,194,.6)", marginTop: 10 }}>
            所有岗位均标注来源并跳转官方投递入口，本站不截留简历、不做招聘闭环。
          </p>
        </div>

        <div className="profile-card glass">
          <h4>
            <span className="gicon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M12 2 3 7v6c0 5 3.8 8.2 9 9 5.2-.8 9-4 9-9V7l-9-5Z" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </span>
            关于
          </h4>
          <p style={{ fontSize: 12.5, lineHeight: 1.8, color: "rgba(183,198,194,.75)" }}>
            Offer派 —— 应届生求职信息聚合中台。聚合校招 / 实习信息，提供校招日历、DDL
            提醒、求职看板、AI 匹配与轻社区。聚焦材料 / 计算机 / 软件 / 电子等专业。
          </p>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "10px",
  color: "#eeebe3",
  fontSize: "14px",
  outline: "none",
};

const saveBtnStyle: React.CSSProperties = {
  padding: "12px",
  background: "#ca0013",
  color: "#fff",
  border: "none",
  borderRadius: "10px",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
  marginTop: "4px",
};
