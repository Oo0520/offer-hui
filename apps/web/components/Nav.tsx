"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const LINKS = [
  { href: "/", label: "首页" },
  { href: "/calendar", label: "校招日历" },
  { href: "/board", label: "求职看板" },
  { href: "/match", label: "AI 匹配" },
  { href: "/community", label: "社区" },
  { href: "/favorites", label: "收藏" },
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
      timeout = setTimeout(() => setDeleting(true), 2000);
    } else if (deleting && text === "") {
      setDeleting(false);
      setIdx((i) => (i + 1) % SLOGANS.length);
    } else {
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
  const [userMenu, setUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // 点击外部关闭用户下拉
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenu(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUserMenu(false);
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

          {/* 我的下拉 */}
          <div ref={userMenuRef} style={{ position: "relative" }}>
            {user ? (
              <button
                onClick={() => setUserMenu(!userMenu)}
                style={{
                  width: "32px", height: "32px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #ca0013, #8b5cf6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 800, fontSize: "13px",
                  border: "none", cursor: "pointer",
                }}
              >
                {user.email?.[0]?.toUpperCase()}
              </button>
            ) : (
              <button
                onClick={() => setUserMenu(!userMenu)}
                style={{
                  background: "none", border: "none", color: "rgba(238,235,227,0.8)",
                  fontSize: "14px", cursor: "pointer", fontWeight: 600, padding: "8px 4px",
                }}
              >
                我的
              </button>
            )}

            {userMenu && (
              <div style={{
                position: "absolute", top: "calc(100% + 10px)", right: 0,
                background: "rgba(23,30,25,0.95)", backdropFilter: "blur(20px)",
                border: "1px solid rgba(183,198,194,0.2)", borderRadius: "16px",
                padding: "8px", minWidth: "180px", zIndex: 100,
                boxShadow: "0 20px 50px -12px rgba(0,0,0,0.5)",
              }}>
                {user && (
                  <div style={{
                    padding: "8px 12px", fontSize: "12px",
                    color: "rgba(238,235,227,0.5)", borderBottom: "1px solid rgba(183,198,194,0.15)",
                    marginBottom: "4px",
                  }}>
                    {user.email}
                  </div>
                )}
                {!user && (
                  <Link
                    href="/login"
                    onClick={() => setUserMenu(false)}
                    style={{
                      display: "block", padding: "10px 12px", color: "#fff",
                      background: "#ca0013", borderRadius: "10px", marginBottom: "4px",
                      textDecoration: "none", fontWeight: 700, fontSize: "13px", textAlign: "center",
                    }}
                  >
                    登录 / 注册
                  </Link>
                )}
                {user && (
                  <Link
                    href="/profile"
                    onClick={() => setUserMenu(false)}
                    style={{
                      display: "block", padding: "10px 12px", color: "#eeebe3",
                      textDecoration: "none", fontSize: "14px", borderRadius: "10px",
                    }}
                  >
                    👤 个人中心
                  </Link>
                )}
                <Link
                  href="/about"
                  onClick={() => setUserMenu(false)}
                  style={{
                    display: "block", padding: "10px 12px", color: "#eeebe3",
                    textDecoration: "none", fontSize: "14px", borderRadius: "10px",
                  }}
                >
                  ℹ️ 关于我们
                </Link>
                <Link
                  href="/agents"
                  onClick={() => setUserMenu(false)}
                  style={{
                    display: "block", padding: "10px 12px", color: "#eeebe3",
                    textDecoration: "none", fontSize: "14px", borderRadius: "10px",
                  }}
                >
                  🤖 Agent 接入
                </Link>
                {user && (
                  <button
                    onClick={() => { handleLogout(); setUserMenu(false); }}
                    style={{
                      display: "block", width: "100%", padding: "10px 12px",
                      background: "rgba(202,0,19,0.15)", color: "#ca0013",
                      border: "1px solid rgba(202,0,19,0.25)", borderRadius: "10px",
                      fontSize: "14px", fontWeight: 700, cursor: "pointer", marginTop: "4px",
                    }}
                  >
                    退出登录
                  </button>
                )}
              </div>
            )}
          </div>
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
        {/* 移动端抽屉补充入口 */}
        <Link href="/profile" className={isOn("/profile") ? "on" : ""} onClick={() => setOpen(false)}>
          我的
        </Link>
        <Link href="/agents" className={isOn("/agents") ? "on" : ""} onClick={() => setOpen(false)}>
          Agent 接入
        </Link>
        <Link href="/about" className={isOn("/about") ? "on" : ""} onClick={() => setOpen(false)}>
          关于
        </Link>
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
