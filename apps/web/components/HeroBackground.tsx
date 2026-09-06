"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * HeroBackground - 桌面端首页动态背景
 * 图片采样粒子Logo + 液体光斑 + 网格线 + 鼠标排斥
 */
export default function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  // 只桌面端
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 992px)");
    setEnabled(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setEnabled(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current!;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let raf = 0;
    let running = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const H = 650;

    const mouse = { x: -9999, y: -9999, active: false };
    const smoothMouse = { x: -9999, y: -9999 };

    // 光斑
    type Blob = { x: number; y: number; r: number; color: string; alpha: number; phase: number; speed: number };
    const blobs: Blob[] = [
      { x: 0.2, y: 0.3, r: 340, color: "202,0,19", alpha: 0.10, phase: 0, speed: 0.003 },
      { x: 0.7, y: 0.5, r: 400, color: "139,92,246", alpha: 0.12, phase: 2, speed: 0.0025 },
      { x: 0.5, y: 0.8, r: 300, color: "6,182,212", alpha: 0.08, phase: 4, speed: 0.0035 },
    ];

    // 粒子
    type Particle = { tx: number; ty: number; x: number; y: number; vx: number; vy: number; size: number; color: string };
    let particles: Particle[] = [];
    let particlesReady = false;

    // 加载 logo 图片并采样红色像素
    function loadLogoParticles(w: number) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (!running) return;
        const off = document.createElement("canvas");
        const octx = off.getContext("2d")!;
        const sampleSize = 200; // 采样尺寸
        off.width = sampleSize;
        off.height = sampleSize;
        octx.drawImage(img, 0, 0, sampleSize, sampleSize);
        const data = octx.getImageData(0, 0, sampleSize, sampleSize).data;

        const pts: { x: number; y: number }[] = [];
        for (let y = 0; y < sampleSize; y += 2) {
          for (let x = 0; x < sampleSize; x += 2) {
            const i = (y * sampleSize + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            // 采样红色像素（logo图形部分）
            if (a > 100 && r > 140 && g < 110 && b < 110) {
              pts.push({ x, y });
            }
          }
        }

        // 打乱并取前 1500 个
        for (let i = pts.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pts[i], pts[j]] = [pts[j], pts[i]];
        }
        const selected = pts.slice(0, 1500);

        // 计算 logo 显示尺寸和位置
        const hero = document.querySelector(".hero");
        const rect = hero ? hero.getBoundingClientRect() : null;
        const heroRight = rect ? rect.right : w - 60;
        const heroTop = rect ? rect.top + window.scrollY : 80;
        const logoSize = Math.min(w, H) * 0.36;
        const logoX = heroRight - 42 - logoSize - 10;
        const logoY = heroTop + 50;
        const scale = logoSize / sampleSize;

        particles = selected.map((p) => ({
          tx: logoX + p.x * scale,
          ty: logoY + p.y * scale,
          x: logoX + p.x * scale,
          y: logoY + p.y * scale,
          vx: 0, vy: 0,
          size: Math.random() * 1.2 + 1.5,
          color: Math.random() < 0.5 ? "202,0,19" : "239,68,68",
        }));
        particlesReady = true;
      };
      img.onerror = () => { particlesReady = true; };
      img.src = "/logo.png";
    }

    function resize() {
      const w = window.innerWidth;
      canvas.width = w * dpr;
      canvas.height = H * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (isHome) loadLogoParticles(w);
    }
    resize();
    requestAnimationFrame(() => resize());
    setTimeout(() => resize(), 150);
    window.addEventListener("resize", resize);

    function onMove(e: MouseEvent) {
      mouse.x = e.clientX + window.scrollX;
      mouse.y = e.clientY + window.scrollY;
      mouse.active = mouse.y < H && mouse.y > 0;
    }
    function onLeave() {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
    }
    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);

    let visible = true;
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0.01 });
    io.observe(canvas);

    function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

    function draw() {
      if (!running) return;
      if (!visible) { raf = requestAnimationFrame(draw); return; }

      const w = window.innerWidth;
      const h = H;
      ctx.clearRect(0, 0, w, h);

      smoothMouse.x = lerp(smoothMouse.x, mouse.x, 0.08);
      smoothMouse.y = lerp(smoothMouse.y, mouse.y, 0.08);

      // 鼠标光晕
      if (glowRef.current && mouse.active) {
        glowRef.current.style.opacity = "1";
        glowRef.current.style.transform = `translate(${smoothMouse.x - 200}px, ${smoothMouse.y - 200}px)`;
      } else if (glowRef.current) {
        glowRef.current.style.opacity = "0";
      }

      // 粒子 Logo（仅首页）
      if (isHome && particlesReady) {
        ctx.globalCompositeOperation = "source-over";
        ctx.shadowBlur = 6;
        ctx.shadowColor = "rgba(202,0,19,0.5)";
        particles.forEach((p) => {
          if (mouse.active) {
            const dx = p.x - smoothMouse.x;
            const dy = p.y - smoothMouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 160 && dist > 0) {
              const force = (160 - dist) / 160 * 4;
              p.vx += (dx / dist) * force;
              p.vy += (dy / dist) * force;
            }
          }
          p.vx += (p.tx - p.x) * 0.025;
          p.vy += (p.ty - p.y) * 0.025;
          p.vx *= 0.86;
          p.vy *= 0.86;
          p.x += p.vx;
          p.y += p.vy;
          ctx.fillStyle = `rgba(${p.color},0.7)`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.shadowBlur = 0;
      }

      // 网格（鼠标靠近时线条弯曲躲避）
      const gridSize = 44;
      const segLen = 25;
      const pushRadius = 150;
      const pushForce = 28;
      ctx.strokeStyle = "rgba(183,198,194,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = 0; gx <= w; gx += gridSize) {
        let first = true;
        for (let py = 0; py <= h; py += segLen) {
          let px = gx;
          if (mouse.active) {
            const dx = px - smoothMouse.x;
            const dy = py - smoothMouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < pushRadius && dist > 0) {
              px += (dx / dist) * (1 - dist / pushRadius) * pushForce;
            }
          }
          if (first) { ctx.moveTo(px, py); first = false; }
          else ctx.lineTo(px, py);
        }
      }
      for (let gy = 0; gy <= h; gy += gridSize) {
        let first = true;
        for (let px = 0; px <= w; px += segLen) {
          let py = gy;
          if (mouse.active) {
            const dx = px - smoothMouse.x;
            const dy = py - smoothMouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < pushRadius && dist > 0) {
              py += (dy / dist) * (1 - dist / pushRadius) * pushForce;
            }
          }
          if (first) { ctx.moveTo(px, py); first = false; }
          else ctx.lineTo(px, py);
        }
      }
      ctx.stroke();

      // 光斑
      ctx.globalCompositeOperation = "lighter";
      blobs.forEach((b) => {
        b.phase += b.speed;
        let bx = (b.x + Math.sin(b.phase) * 0.08) * w;
        let by = (b.y + Math.cos(b.phase * 0.8) * 0.06) * h;
        if (mouse.active) {
          const dx = bx - smoothMouse.x;
          const dy = by - smoothMouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 300 && dist > 0) {
            const force = (300 - dist) / 300 * 60;
            bx += (dx / dist) * force;
            by += (dy / dist) * force;
          }
        }
        const grad = ctx.createRadialGradient(bx, by, 0, bx, by, b.r);
        grad.addColorStop(0, `rgba(${b.color},${b.alpha})`);
        grad.addColorStop(1, `rgba(${b.color},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(bx, by, b.r, 0, Math.PI * 2);
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      io.disconnect();
    };
  }, [enabled, isHome]);

  if (!enabled) return null;

  return (
    <>
      <canvas ref={canvasRef} className="hero-bg-canvas" aria-hidden="true" />
      <div ref={glowRef} className="hero-bg-glow" aria-hidden="true" />
    </>
  );
}
