"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/", label: "首页" },
  { href: "/calendar", label: "校招日历" },
  { href: "/board", label: "求职看板" },
  { href: "/match", label: "AI 匹配" },
  { href: "/community", label: "社区" },
  { href: "/favorites", label: "收藏" },
  { href: "/profile", label: "我的" },
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
          <Link href="/" className="brand">
            <img src="/logo.png" alt="Offer派" className="logo-img" />
          </Link>
          <nav className="nav-links">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={isOn(l.href) ? "on" : ""}>
                {l.label}
              </Link>
            ))}
          </nav>
          <Typewriter />
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
          <button className="hamburger" aria-label="菜单" onClick={() => setOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="#eeebe3" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
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
      </aside>
    </>
  );
}
