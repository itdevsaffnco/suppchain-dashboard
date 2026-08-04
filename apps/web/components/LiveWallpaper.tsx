"use client";

import { useEffect, useRef } from "react";

// Animated "logistics network" background: drifting nodes joined by faint
// links, with bright packets traveling along them — a supply-chain network
// metaphor. Colors are read from the active theme's CSS variables and
// refreshed when the body theme class changes.
//
// variant "hero"   — login/reset overlay: brighter, denser, light particles.
// variant "subtle" — behind the dashboard: sparse and low-alpha.

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface Packet {
  from: number; // node index
  to: number;
  t: number; // 0..1 progress
  speed: number;
}

const LINK_DIST = 150;

function cssColor(name: string, fallback: string): string {
  const v = getComputedStyle(document.body).getPropertyValue(name).trim();
  return v || fallback;
}

export default function LiveWallpaper({ variant }: { variant: "hero" | "subtle" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hero = variant === "hero";

    // Palette — re-read on theme switch (body class changes).
    let nodeColor = "";
    let linkColor = "";
    let packetColor = "";
    const readPalette = () => {
      if (hero) {
        // The login overlay sits on the brand gradient — light particles.
        nodeColor = "255, 255, 255";
        linkColor = "255, 255, 255";
        packetColor = cssColor("--brand-orange", "#F59E0B");
      } else {
        const hex = cssColor("--brand-primary", "#1E3A8A");
        const r = parseInt(hex.slice(1, 3), 16) || 30;
        const g = parseInt(hex.slice(3, 5), 16) || 58;
        const b = parseInt(hex.slice(5, 7), 16) || 138;
        nodeColor = `${r}, ${g}, ${b}`;
        linkColor = `${r}, ${g}, ${b}`;
        packetColor = cssColor("--brand-secondary", "#0EA5E9");
      }
    };
    readPalette();
    const observer = new MutationObserver(readPalette);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    let packets: Packet[] = [];

    const seed = () => {
      const per = hero ? 22000 : 34000; // px² per node
      const count = Math.min(hero ? 90 : 55, Math.round((width * height) / per));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: 1.2 + Math.random() * 1.8,
      }));
      packets = Array.from({ length: hero ? 6 : 3 }, () => spawnPacket()).filter(
        (p): p is Packet => p !== null
      );
    };

    const spawnPacket = (): Packet | null => {
      if (nodes.length < 2) return null;
      const from = Math.floor(Math.random() * nodes.length);
      // Find a random neighbor within link distance.
      const neighbors: number[] = [];
      for (let i = 0; i < nodes.length; i++) {
        if (i === from) continue;
        const dx = nodes[i].x - nodes[from].x;
        const dy = nodes[i].y - nodes[from].y;
        if (dx * dx + dy * dy < LINK_DIST * LINK_DIST * 2) neighbors.push(i);
      }
      if (!neighbors.length) return null;
      const to = neighbors[Math.floor(Math.random() * neighbors.length)];
      return { from, to, t: 0, speed: 0.004 + Math.random() * 0.006 };
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      if (reducedMotion) draw(); // static frame only
    };

    const maxLinkAlpha = hero ? 0.16 : 0.13;
    const nodeAlpha = hero ? 0.5 : 0.34;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Links
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 > LINK_DIST * LINK_DIST) continue;
          const alpha = (1 - Math.sqrt(d2) / LINK_DIST) * maxLinkAlpha;
          ctx.strokeStyle = `rgba(${linkColor}, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }

      // Nodes
      for (const n of nodes) {
        ctx.fillStyle = `rgba(${nodeColor}, ${nodeAlpha})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Packets — bright dots traveling between nodes
      for (const p of packets) {
        const a = nodes[p.from];
        const b = nodes[p.to];
        if (!a || !b) continue;
        const x = a.x + (b.x - a.x) * p.t;
        const y = a.y + (b.y - a.y) * p.t;
        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = packetColor;
        ctx.fillStyle = packetColor;
        ctx.globalAlpha = hero ? 0.9 : 0.65;
        ctx.beginPath();
        ctx.arc(x, y, hero ? 2.2 : 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    let raf = 0;
    const tick = () => {
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -10) n.x = width + 10;
        if (n.x > width + 10) n.x = -10;
        if (n.y < -10) n.y = height + 10;
        if (n.y > height + 10) n.y = -10;
      }
      for (let i = 0; i < packets.length; i++) {
        packets[i].t += packets[i].speed;
        if (packets[i].t >= 1) {
          const next = spawnPacket();
          if (next) packets[i] = next;
        }
      }
      draw();
      raf = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize);
    if (!reducedMotion) raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      observer.disconnect();
    };
  }, [variant]);

  return <canvas ref={canvasRef} className={`live-wallpaper ${variant}`} aria-hidden="true" />;
}
