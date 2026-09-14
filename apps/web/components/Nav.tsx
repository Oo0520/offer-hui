"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const LINKS = [
  { href: "/", label: "首页" },
  { href: "/calendar", label: "校招日历" },
  { href: "/board", label: "求职看板" },
  { href: "/match", label: "AI 匹配" },
  { href: "/community", label: "社区" },
  { href: "/favorites", label: "收藏" },
  { href: "/profile", label: "我的" },
  { href: "/agents", label: "Agent 接入" },
];

const SLOGANS = ["不错过每一个Offer", "陪你拿到第一个Offer", "别慌，Offer在路上"];

function Typewriter() {
  const [text, setText] = useState("");
  const [idx, setIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = SLOGANS[idx];
    let timeout: NodeJS.Timeout;

    if (!deleting && text === current) {
      // 打完停顿 2 秒
      timeout = setTimeout(() => setDeleting(true), 2000);
    } else if (deleting && text === "") {
      // 删完切下一句
      setDeleting(false);
      setIdx((i) => (i + 1) % SLOGANS.length);
    } else {
      // 打字或删字
      timeout = setTimeout(() => {
        setText((t) =>
          deleting ? current.slice(0, t.length - 1) : current.slice(0, t.length + 1)
        );
      }, deleting ? 50 : 100);
    }

    return () => clearTimeout(timeout);
  }, [text, deleting, idx]);

  return (
    <span className="slogan">
      <span className="slogan-brand">Offer派·</span>
      <span className="slogan-text">{text}</span>
      <span className="slogan-cursor">|</span>
    </span>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kw, setKw] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const isOn = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  function submitSearch() {
    router.push(kw.trim() ? `/?q=${encodeURIComponent(kw.trim())}` : "/");
    setOpen(false);
  }

  return (
    <>
      <header className="nav">
        <div className="nav-in">
          <button className="hamburger" aria-label="菜单" onClick={() => setOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="#eeebe3" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <nav className="nav-links">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={isOn(l.href) ? "on" : ""}>
                {l.label}
              </Link>
            ))}
          </nav>
          <Link href="/" className="brand">
            <img src="/logo.png" alt="Offer派" className="logo-img" />
            <Typewriter />
          </Link>
          <div className="nav-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="#b7c6c2" strokeWidth="2" />
              <path d="m20 20-3.5-3.5" stroke="#b7c6c2" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitSearch()}
              placeholder="搜索公司 / 岗位"
            />
          </div>
          {user ? (
            <div className="nav-user-desktop">
              <Link href="/profile" style={{
                width: "32px", height: "32px", borderRadius: "50%",
                background: "linear-gradient(135deg, #ca0013, #8b5cf6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 800, fontSize: "13px",
              }}>
                {user.email?.[0]?.toUpperCase()}
              </Link>
              <button onClick={handleLogout} style={{
                background: "none", border: "none", color: "rgba(238,235,227,0.5)",
                fontSize: "12px", cursor: "pointer",
              }}>退出</button>
            </div>
          ) : (
            <Link href="/login" className="nav-login-desktop" style={{
              padding: "8px 16px", background: "#ca0013", color: "#fff",
              borderRadius: "20px", fontSize: "13px", fontWeight: 700,
              textDecoration: "none",
            }}>
              登录
            </Link>
          )}
        </div>
      </header>

      <div className={"mask" + (open ? " open" : "")} onClick={() => setOpen(false)} />
      <aside className={"drawer" + (open ? " open" : "")}>
        <div className="d-brand">
          <img src="/logo.png" alt="Offer派" className="logo-img" />
        </div>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={isOn(l.href) ? "on" : ""}
            onClick={() => setOpen(false)}
          >
            {l.label}
          </Link>
        ))}
        <div style={{ marginTop: "auto", padding: "16px 0", borderTop: "1px solid rgba(183,198,194,0.15)" }}>
          {user ? (
            <>
              <div style={{ padding: "8px 24px", fontSize: "13px", color: "rgba(238,235,227,0.5)", marginBottom: "8px" }}>
                {user.email}
              </div>
              <button onClick={() => { handleLogout(); setOpen(false); }} style={{
                width: "100%", padding: "10px", background: "rgba(202,0,19,0.2)", color: "#ca0013",
                border: "1px solid rgba(202,0,19,0.3)", borderRadius: "12px",
                fontSize: "14px", fontWeight: 700, cursor: "pointer",
              }}>
                退出登录
              </button>
            </>
          ) : (
            <Link href="/login" onClick={() => setOpen(false)} style={{
              display: "block", width: "100%", padding: "10px", background: "#ca0013", color: "#fff",
              borderRadius: "12px", fontSize: "14px", fontWeight: 700, textAlign: "center",
              textDecoration: "none",
            }}>
              登录 / 注册
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
