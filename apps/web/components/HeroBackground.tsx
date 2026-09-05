"use client";

import { useEffect, useRef } from "react";

/**
 * HeroBackground - 桌面端首屏液体背景 + 粒子Logo + 鼠标光晕
 * 只在 >991px 桌面端渲染，只在 hero 区域内
 */
export default function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 只桌面端启用
    if (window.innerWidth < 992) return;

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const hero = canvas.parentElement!;
    if (!canvas || !ctx || !hero) return;

    let raf = 0;
    let running = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // 鼠标位置
    const mouse = { x: -9999, y: -9999, active: false };
    const smoothMouse = { x: -9999, y: -9999 };

    // 光斑定义：红/紫/青
    type Blob = {
      x: number; y: number; r: number;
      color: string; alpha: number;
      vx: number; vy: number;
      phase: number; speed: number;
    };
    const blobs: Blob[] = [
      { x: 0.2, y: 0.3, r: 320, color: "202,0,19", alpha: 0.10, vx: 0.15, vy: 0.1, phase: 0, speed: 0.003 },
      { x: 0.7, y: 0.5, r: 380, color: "139,92,246", alpha: 0.12, vx: -0.12, vy: 0.08, phase: 2, speed: 0.0025 },
      { x: 0.5, y: 0.8, r: 280, color: "6,182,212", alpha: 0.08, vx: 0.1, vy: -0.12, phase: 4, speed: 0.0035 },
    ];

    // 粒子 Logo
    type Particle = {
      tx: number; ty: number;  // 目标位置
      x: number; y: number;    // 当前位置
      vx: number; vy: number;  // 速度
      size: number;
      color: string;
    };
    let particles: Particle[] = [];

    // 生成 O+对勾 图形的粒子目标位置
    function generateLogoPoints(w: number, h: number) {
      const off = document.createElement("canvas");
      const size = Math.min(w, h) * 0.35;
      off.width = size;
      off.height = size;
      const octx = off.getContext("2d");
      if (!octx) return;

      octx.clearRect(0, 0, size, size);
      octx.strokeStyle = "#fff";
      octx.lineWidth = size * 0.14;
      octx.lineCap = "round";
      octx.lineJoin = "round";

      // O 圆
      octx.beginPath();
      octx.arc(size * 0.42, size * 0.5, size * 0.32, 0, Math.PI * 2);
      octx.stroke();

      // 对勾
      octx.beginPath();
      octx.moveTo(size * 0.28, size * 0.52);
      octx.lineTo(size * 0.42, size * 0.66);
      octx.lineTo(size * 0.72, size * 0.34);
      octx.stroke();

      // 采样像素
      const img = octx.getImageData(0, 0, size, size).data;
      const points: { x: number; y: number }[] = [];
      const step = Math.max(2, Math.floor(size / 60));
      for (let y = 0; y < size; y += step) {
        for (let x = 0; x < size; x += step) {
          const idx = (y * size + x) * 4 + 3;
          if (img[idx] > 128) {
            points.push({ x, y });
          }
        }
      }

      // 随机选 250 个
      const count = Math.min(250, points.length);
      const selected: { x: number; y: number }[] = [];
      for (let i = 0; i < count; i++) {
        selected.push(points[Math.floor(Math.random() * points.length)]);
      }

      // Logo 放在右上角
      const logoX = w - size - 40;
      const logoY = 30;

      particles = selected.map((p) => ({
        tx: logoX + p.x,
        ty: logoY + p.y,
        x: logoX + p.x + (Math.random() - 0.5) * 200,
        y: logoY + p.y + (Math.random() - 0.5) * 200,
        vx: 0, vy: 0,
        size: Math.random() * 2 + 1.2,
        color: Math.random() < 0.7 ? "238,235,227" : "202,0,19",
      }));
    }

    function resize() {
      const rect = hero.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      generateLogoPoints(rect.width, rect.height);
    }
    resize();
    requestAnimationFrame(resize);
    setTimeout(resize, 100);
    window.addEventListener("resize", resize);

    // 鼠标事件
    function onMove(e: MouseEvent) {
      const rect = hero.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    }
    function onLeave() {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
    }
    hero.addEventListener("mousemove", onMove);
    hero.addEventListener("mouseleave", onLeave);

    // 视口可见性检测
    let visible = true;
    const io = new IntersectionObserver(
      ([entry]) => { visible = entry.isIntersecting; },
      { threshold: 0.01 }
    );
    io.observe(hero);

    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * t;
    }

    function draw() {
      if (!running) return;
      if (!visible) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const rect = hero.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);

      // 平滑鼠标
      smoothMouse.x = lerp(smoothMouse.x, mouse.x, 0.08);
      smoothMouse.y = lerp(smoothMouse.y, mouse.y, 0.08);

      // 鼠标光晕 CSS 层
      if (glowRef.current && mouse.active) {
        glowRef.current.style.opacity = "1";
        glowRef.current.style.transform = `translate(${smoothMouse.x - 200}px, ${smoothMouse.y - 200}px)`;
      } else if (glowRef.current) {
        glowRef.current.style.opacity = "0";
      }

      // 画光斑
      ctx.globalCompositeOperation = "lighter";
      blobs.forEach((b) => {
        b.phase += b.speed;
        // 基础位置 + 正弦运动
        let bx = (b.x + Math.sin(b.phase) * 0.08) * w;
        let by = (b.y + Math.cos(b.phase * 0.8) * 0.06) * h;

        // 鼠标排斥
        if (mouse.active) {
          const dx = bx - smoothMouse.x;
          const dy = by - smoothMouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 300) {
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

      // 画粒子 Logo
      ctx.globalCompositeOperation = "source-over";
      particles.forEach((p) => {
        // 鼠标排斥
        if (mouse.active) {
          const dx = p.x - smoothMouse.x;
          const dy = p.y - smoothMouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 180) {
            const force = (180 - dist) / 180 * 3;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }
        // 回归目标
        p.vx += (p.tx - p.x) * 0.02;
        p.vy += (p.ty - p.y) * 0.02;
        // 阻尼
        p.vx *= 0.88;
        p.vy *= 0.88;
        p.x += p.vx;
        p.y += p.vy;

        ctx.fillStyle = `rgba(${p.color},0.9)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      hero.removeEventListener("mousemove", onMove);
      hero.removeEventListener("mouseleave", onLeave);
      io.disconnect();
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="hero-canvas"
        aria-hidden="true"
      />
      <div ref={glowRef} className="hero-glow" aria-hidden="true" />
    </>
  );
}
