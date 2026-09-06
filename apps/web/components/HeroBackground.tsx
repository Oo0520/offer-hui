"use client";

import { useEffect, useRef, useState } from "react";

/**
 * HeroBackground - 桌面端首页最底层动态背景（fixed 全屏宽）
 * 液体光斑 + 互动网格 + 粒子Logo + 鼠标光晕
 * 只在 >=992px 桌面端渲染，覆盖页面顶部 650px 全宽区域
 */
export default function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

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

    type Blob = { x: number; y: number; r: number; color: string; alpha: number; phase: number; speed: number };
    const blobs: Blob[] = [
      { x: 0.2, y: 0.3, r: 340, color: "202,0,19", alpha: 0.10, phase: 0, speed: 0.003 },
      { x: 0.7, y: 0.5, r: 400, color: "139,92,246", alpha: 0.12, phase: 2, speed: 0.0025 },
      { x: 0.5, y: 0.8, r: 300, color: "6,182,212", alpha: 0.08, phase: 4, speed: 0.0035 },
    ];

    type Particle = { tx: number; ty: number; x: number; y: number; vx: number; vy: number; size: number; color: string };
    let particles: Particle[] = [];

    function generateLogoPoints(w: number) {
      const size = Math.min(w, H) * 0.38;
      const points: { x: number; y: number }[] = [];
      const lineWidth = size * 0.16;

      const cx = size * 0.42, cy = size * 0.5, r = size * 0.32;
      for (let i = 0; i < 500; i++) {
        const t = (i / 500) * Math.PI * 2;
        const wr = (Math.random() - 0.5) * lineWidth;
        points.push({ x: cx + (r + wr) * Math.cos(t), y: cy + (r + wr) * Math.sin(t) });
      }
      function addLine(x1: number, y1: number, x2: number, y2: number, count: number) {
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = -dy / len, ny = dx / len;
        for (let i = 0; i < count; i++) {
          const t = i / count;
          const offset = (Math.random() - 0.5) * lineWidth;
          points.push({ x: x1 + dx * t + nx * offset, y: y1 + dy * t + ny * offset });
        }
      }
      addLine(size * 0.28, size * 0.52, size * 0.42, size * 0.66, 200);
      addLine(size * 0.42, size * 0.66, size * 0.72, size * 0.34, 300);

      for (let i = points.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [points[i], points[j]] = [points[j], points[i]];
      }

      // Logo 固定在 hero 卡片内部右上角
      const hero = document.querySelector(".hero");
      const rect = hero ? hero.getBoundingClientRect() : null;
      const heroRight = rect ? rect.right : w - 60;
      const heroTop = rect ? rect.top + window.scrollY : 80;
      const logoX = heroRight - 42 - size - 10; // hero padding-right 42 + 间距
      const logoY = heroTop + 44 + 10; // hero padding-top 44 + 间距

      particles = points.slice(0, 1000).map((p) => ({
        tx: logoX + p.x, ty: logoY + p.y,
        x: logoX + p.x, y: logoY + p.y,
        vx: 0, vy: 0,
        size: Math.random() * 1.5 + 1.8,
        color: Math.random() < 0.6 ? "202,0,19" : "239,68,68",
      }));
    }

    function resize() {
      const w = window.innerWidth;
      canvas.width = w * dpr;
      canvas.height = H * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      generateLogoPoints(w);
    }
    resize();
    requestAnimationFrame(resize);
    setTimeout(resize, 100);
    window.addEventListener("resize", resize);

    function onMove(e: MouseEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = mouse.y < H;
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

      if (glowRef.current && mouse.active) {
        glowRef.current.style.opacity = "1";
        glowRef.current.style.transform = `translate(${smoothMouse.x - 200}px, ${smoothMouse.y - 200}px)`;
      } else if (glowRef.current) {
        glowRef.current.style.opacity = "0";
      }

      // 粒子 Logo（最底层）
      ctx.globalCompositeOperation = "source-over";
      particles.forEach((p) => {
        if (mouse.active) {
          const dx = p.x - smoothMouse.x;
          const dy = p.y - smoothMouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 180 && dist > 0) {
            const force = (180 - dist) / 180 * 3;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }
        p.vx += (p.tx - p.x) * 0.02;
        p.vy += (p.ty - p.y) * 0.02;
        p.vx *= 0.88;
        p.vy *= 0.88;
        p.x += p.vx;
        p.y += p.vy;
        ctx.fillStyle = `rgba(${p.color},0.45)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

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
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <canvas ref={canvasRef} className="hero-bg-canvas" aria-hidden="true" />
      <div ref={glowRef} className="hero-bg-glow" aria-hidden="true" />
    </>
  );
}
