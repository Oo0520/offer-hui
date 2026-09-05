"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "首页" },
  { href: "/calendar", label: "校招日历" },
  { href: "/board", label: "求职看板" },
  { href: "/match", label: "AI 匹配" },
  { href: "/community", label: "社区" },
  { href: "/favorites", label: "收藏" },
  { href: "/profile", label: "我的" },
];

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
