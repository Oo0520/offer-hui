"use client";

import { useState } from "react";
import Link from "next/link";

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
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [sw, setSw] = useState({ email: true, push: false, ics: true });

  return (
    <div className="wrap">
      <div className="page-hero" style={{ marginTop: 24 }}>
        <div>
          <h1 className="h-display">我的</h1>
          <p>求职工具 · 截止提醒与订阅设置。</p>
        </div>
      </div>

      <div className="profile-grid">
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

        <div className="profile-card glass">
          <h4>
            <span className="gicon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" stroke="#8b5cf6" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </span>
            截止提醒
          </h4>
          <div className="switch-row">
            <div>
              <div className="t">邮件提醒</div>
              <div className="s">截止前 3 天发送邮件</div>
            </div>
            <Switch on={sw.email} onChange={(v) => setSw({ ...sw, email: v })} />
          </div>
          <div className="switch-row">
            <div>
              <div className="t">Web 推送</div>
              <div className="s">浏览器通知提醒</div>
            </div>
            <Switch on={sw.push} onChange={(v) => setSw({ ...sw, push: v })} />
          </div>
          <div className="switch-row">
            <div>
              <div className="t">日历订阅</div>
              <div className="s">ICS 同步到手机日历</div>
            </div>
            <Switch on={sw.ics} onChange={(v) => setSw({ ...sw, ics: v })} />
          </div>
          <div className="sub-status">✓ 日历订阅已启用 · 可在校招日历页导出 ICS 文件</div>
          <div className="email-row">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="输入接收提醒的邮箱"
            />
            <button
              onClick={() => {
                if (!email.trim()) {
                  alert("请输入邮箱地址");
                  return;
                }
                setSaved(email.trim());
              }}
            >
              保存
            </button>
          </div>
          {saved && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#67e8f9" }}>
              ✓ 已保存提醒邮箱：{saved}（正式版生效）
            </div>
          )}
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
            Offer汇 —— 应届生求职信息聚合中台。聚合校招 / 实习信息，提供校招日历、DDL
            提醒、求职看板、AI 匹配与轻社区。聚焦材料 / 计算机 / 软件 / 电子等专业。
          </p>
        </div>

        <div className="profile-card glass">
          <h4>
            <span className="gicon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#8b5cf6" strokeWidth="2" />
                <path d="M12 8v5M12 16.5v.5" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            帮助
          </h4>
          <p style={{ fontSize: 12.5, lineHeight: 1.8, color: "rgba(183,198,194,.75)" }}>
            有任何问题或建议，欢迎反馈。数据每周自动增量更新，岗位信息以官方页面为准。
          </p>
        </div>
      </div>
    </div>
  );
}
