"use client";

import { useState } from "react";

type Post = {
  tab: "salary" | "interview" | "referral";
  av: string;
  title: string;
  badges: { t: string; c: string }[];
  tags: string[];
  sum: string;
  like: number;
  cmt: number;
  reward?: number;
};

const POSTS: Post[] = [
  {
    tab: "salary",
    av: "C",
    title: "【薪资爆料】互联网大厂算法岗 2027 届总包",
    badges: [
      { t: "华中科大·CS", c: "gd" },
      { t: "2027届", c: "" },
      { t: "北京", c: "" },
    ],
    tags: ["算法", "校招"],
    sum: "双一流硕士，算法岗总包 35w+，含签字费与股票。已核实 offer 截图，供参考。",
    like: 132,
    cmt: 47,
  },
  {
    tab: "interview",
    av: "Z",
    title: "【面经】国企科研院所一面面经分享",
    badges: [
      { t: "北航·航天", c: "gd" },
      { t: "2027届", c: "" },
      { t: "贵阳", c: "" },
    ],
    tags: ["央企", "科研"],
    sum: "一面技术面 40 分钟：项目深挖 + 专业基础 + 保密协议说明。二面 HR 面，整体氛围轻松。",
    like: 98,
    cmt: 33,
  },
  {
    tab: "referral",
    av: "L",
    title: "【内推】软件大厂内推码 · 免简历筛选",
    badges: [
      { t: "北邮·软工", c: "gd" },
      { t: "2027届", c: "" },
      { t: "北京", c: "" },
    ],
    tags: ["内推码"],
    sum: "内推码直达 HR 免简历筛选，附官方内推链接。投递后评论区留言返内推截图。",
    like: 216,
    cmt: 90,
    reward: 50,
  },
  {
    tab: "salary",
    av: "W",
    title: "【薪资爆料】银行总行管培 base 披露",
    badges: [
      { t: "央财·金融", c: "gd" },
      { t: "2027届", c: "" },
      { t: "北京", c: "" },
    ],
    tags: ["银行", "管培"],
    sum: "总行管培 base 约 25w，另加年终与房补。轮岗两年后定岗。信息来源：在职员工。",
    like: 158,
    cmt: 54,
  },
  {
    tab: "interview",
    av: "M",
    title: "【面经】船舶研究所面试流程复盘",
    badges: [
      { t: "上交·船舶", c: "gd" },
      { t: "硕士", c: "rd" },
      { t: "上海", c: "" },
    ],
    tags: ["央企", "科研"],
    sum: "专业面 30 分钟：设计规范 + 项目细节，后 1v1 谈话。整体看重科研经历与稳定性。",
    like: 87,
    cmt: 26,
  },
  {
    tab: "referral",
    av: "Q",
    title: "【内推】芯片公司内推 · IC 岗位优先",
    badges: [
      { t: "东南·微电子", c: "gd" },
      { t: "2027届", c: "" },
      { t: "南京", c: "" },
    ],
    tags: ["内推码"],
    sum: "IC 岗位优先处理，48h 内反馈。私信联系获取内推码，附岗位清单。",
    like: 175,
    cmt: 66,
    reward: 30,
  },
];

const TABS = [
  { key: "all", label: "全部" },
  { key: "salary", label: "薪资爆料" },
  { key: "interview", label: "面经" },
  { key: "referral", label: "内推码" },
];

export default function Community() {
  const [tab, setTab] = useState("all");
  const list = tab === "all" ? POSTS : POSTS.filter((p) => p.tab === tab);

  return (
    <div className="wrap">
      <div className="page-hero">
        <div>
          <h1 className="h-display">求职社区</h1>
          <p>
            薪资爆料 · 面经分享 · 内推码互助，身份标签（大学/专业/届别）严格审核。
            MVP 为演示内容，正式版接入账号体系与内容审核。
          </p>
        </div>
        <div className="orbital">
          <button
            className="inner"
            onClick={() => alert("发布需先完成身份核验（大学/专业/届别），正式版开放。")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            发布帖子
          </button>
        </div>
      </div>

      <div className="comm-main">
        <div className="promo-banner glass">
          <div className="p-ic">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" stroke="#8b5cf6" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h4>内推广场 · 悬赏招募</h4>
            <p>发内推码 / 面经被采纳，最高可得 ¥50 悬赏 · 发布需通过身份审核</p>
          </div>
          <span className="go">
            查看规则
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M7 17 17 7M9 7h8v8" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>

        <div className="comm-tabs">
          {TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? "on" : ""} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        <div>
          {list.map((p, i) => (
            <div key={i} className="post-card glass">
              <div className="p-av">{p.av}</div>
              <div className="p-main">
                <div className="p-title">{p.title}</div>
                <div className="p-meta">
                  {p.badges.map((b, j) => (
                    <span key={j} className={"id-badge " + b.c}>
                      {b.t}
                    </span>
                  ))}
                  {p.tags.map((t, j) => (
                    <span
                      key={j}
                      style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        padding: "2px 9px",
                        borderRadius: 7,
                        background: "rgba(183,198,194,.1)",
                        border: "1px solid rgba(183,198,194,.24)",
                        color: "var(--graygreen)",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                  {p.reward ? (
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        padding: "2px 9px",
                        borderRadius: 7,
                        background: "rgba(202,0,19,.14)",
                        border: "1px solid rgba(202,0,19,.35)",
                        color: "#fda4af",
                      }}
                    >
                      悬赏 ¥{p.reward}
                    </span>
                  ) : null}
                </div>
                <div className="p-sum">{p.sum}</div>
                <div className="p-foot">
                  <span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                      <path d="M12 21s-7-6.1-7-11a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 5.5 2c0 4.9-7 11-7 11Z" stroke="#b7c6c2" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                    {p.like}
                  </span>
                  <span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                      <path d="M21 12a8 8 0 0 1-8 8H4l2-4a8 8 0 1 1 15-4Z" stroke="#b7c6c2" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                    {p.cmt}
                  </span>
                  <span>身份已核验</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
