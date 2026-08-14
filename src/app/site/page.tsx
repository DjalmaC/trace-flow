"use client";
import { useEffect, useRef, useState } from "react";
import { GlassPanel, SilkBackdrop } from "@/flow-tool/components/Glass";
import { ASSETS, TRACE_LOGO_AR } from "@/flow-tool/components/tokens";

// ─────────────────────────────────────────────────────────────────────────────
// tracefinance.com, recreated one-for-one in the BRLT glass family
// (design-ref/STYLE.md): every section, heading and line of copy mirrors the
// live site; only the aesthetic changes — silk backdrop, liquid-glass panels,
// mono eyebrows, mint-as-meaning. The one sanctioned content change: the
// hero globe's dots are soft WHITE (with sparse cyan accents) instead of the
// original's background-green, so they no longer clash.
// ─────────────────────────────────────────────────────────────────────────────

const EASE = "cubic-bezier(.4,0,.2,1)";
const MINT = "#00f2b1";
const CYAN = "#2be8d6";

// ── shared atoms ─────────────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 font-jbmono text-[11px] font-medium uppercase tracking-[0.34em] text-[#6f8a7f]">
      <span aria-hidden className="h-px w-6 bg-mint/70" />
      {children}
    </p>
  );
}

function ArrowIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function PrimaryBtn({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-[12px] bg-mint px-5 py-3 text-[14px] font-semibold text-mint-on transition duration-200 hover:bg-mint-hover"
      style={{ boxShadow: "0 12px 32px rgba(0,242,177,.22)" }}
    >
      {children}
      <ArrowIcon />
    </a>
  );
}

function GhostBtn({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-[12px] border border-white/[.16] px-5 py-3 text-[14px] font-semibold text-title transition duration-200 hover:border-white/30 hover:bg-white/[.05]"
      style={{
        background: "linear-gradient(160deg, rgba(10,15,19,.42), rgba(10,15,19,.28) 45%, rgba(10,15,19,.38))",
        backdropFilter: "blur(18px) saturate(1.3)",
        WebkitBackdropFilter: "blur(18px) saturate(1.3)",
      }}
    >
      {children}
    </a>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={MINT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ── the dotted globe: the mapa-mundi (recolored: white land, cyan accents) ───
// 240x120 equirectangular land bitmask (1 bit per 1.5° cell), packed row-major
// from public-domain world GeoJSON. Dots on land render bright; ocean dots stay
// faint so the sphere keeps its volume while the continents read clearly.
const LAND_W = 240;
const LAND_H = 120;
const LAND_B64 =
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAID+fwD//wcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP////////8AAAAAAAAAAMAAAAAAAAAAAAAAAAAAgP///////z8AwP8H4AcAAPAHAAAAAAAAAAAAAABw/v///////w8AgP8AAAAAAMB/AAAAAAAAAAAAAID34Pcf/////w8AAP4BAAAwAAD8BwAAAAAAAAAAAMD/+/8H/v///wcAAAAAAOA/APz/HwD4HwAAAAAAAPB34/8PAP7//w8AAAAAAHgA4P///xzwDQAAAAAAAPD///8/APj//wcAAAAAADzA/////3/wDwAAA+AXAPD/5/f/B/z//wMAAAAHAHzw/////////wOAAPj/7///////D/j//wMAAPD/AQD////////////+A//////////zH/D/PwAAAP7/9///////////////P//////////zf/D/A2sAAP7////////////////////////////5P+D/gH8AAH//////////////////8Pz////////3H+AfAH8A4P//////////////////QP7//////w//H8APAAAA+M//////////////////AP///////wPwE4APAAAA+N////////////////0HAP8//f///wP4PwAAAAAw+I///////////////3wCAOAH8P///w/wfwAAAABw8N////////////8fAB8AAPADgP///3/w/wAAAAB44Nf///////////8PgB8AABwAgP///////wMAAAD84P//////////////gB8AAAAAgP7////7/wcAAAD++///////////////gAcAAAAAAP3//////w8AAAD+////////////////AAMAAAAAAPz//////w4AAADw////////////////AAAAAAAAAPD/////fx8AAADw////////////////AQAAAAAAAOD/////vx8AAADg///////////////fAAAAAAAAAOD//////wEAAACA//////3////////fAAAAAAAAAOD/////PwAAAACc///P/v7////////HAQAAAAAAAPD/////AwAAAAD+//vH/Pz////////jAwAAAAAAAOD/////AwAAAAD+Z/////v//////3/gAAAAAAAAAOD///9/AAAAAAD+Yf7///v//////39gAAAAAAAAAOD///9/AAAAAAD+Ie////n//////zkwAAAAAAAAAMD///8/AAAAAAD8/8b8/////////3M4AAAAAAAAAID///8/AAAAAAD4/4Lj//////////A/AAAAAAAAAID///8PAAAAAAD8/wCA/////////9EHAAAAAAAAAAD+//8HEAAAAAD+/+fT/////////8MBAAAAAAAAAAD8//8DAAAAAAD+/////////////8MAAAAAAAAAAAD8/58HAAAAAAD//////////////wMAAAAAAAAAAAD4/wAXAAAAAID///////3//////wMAAAAAAAAAAADw/wAeAAAAAMD///9//////////wAAAAAAAAAAAADgfwAeAAAAAOD//////7///////wMAAAAAAAAAAADAf4AfAAAAAOD//////v/w////fwEAAAAAAOAAAAAA/vA/AAAAAPD//////f/A////HwEAAAAAAIABAAAA/nj4AwAAAPD//////X/A/+f/BwAAAAAAAAABAAAA/D/4HwAAAOD/////+38A/8F/AwMAAAAAAAAAAAAA+D8wGQAAAPD/////+z8A/4D/AAMAAAAAAAAAAAAAwP8BAAAAAPD/////9wcAfsD/gQMAAAAAAAAAAAAAAPwBAAAAAPD//////wMAPgD+AQcAAAAAAAAAAAAAAPABAwAAAPD//////wYAPgD+AQ8AAAAAAAAAAAAAAMDh7wAAAOD//////wcAPAD2gQ4AAAAAAAAAAAAAAMDv/wAAAMD//////wMAPADmwB4AAAAAAAAAAAAAAAD//wEAAID//////wMAeABGQB4AAAAAAAAAAAAAAAD0/wsAAID//////wEAYAAcYB4AAAAAAAAAAAAAAADw/z8AAAD++f///wEAIIAd8AgAAAAAAAAAAAAAAADw/z8AAAAE+P///wAAAAAf+AAAAAAAAAAAAAAAAAD4/38AAAAAwP///wAAAAA+figAAAAAAAAAAAAAAAD8/38AAAAAwP//PwAAAAA+/z8AAAAAAAAAAAAAAAD8//8BAAAA4P//HwAAAAA8/6cDAAAAAAAAAAAAAAD8//8/AAAAwP//DwAAAAB4vuN/MAAAAAAAAAAAAAD+//9/AAAAgP//BwAAAABwvPv/cQAAAAAAAAAAAAD+////AQAAgP//BwAAAADggAf+vwAAAAAAAAAAAAD+////AQAAAP//BwAAAADADwDynwMAAAAAAAAAAAD4////AQAAAP//BwAAAAAA/xv4Bw4AAAAAAAAAAAD4////AQAAAP//BwAAAAAA4A3AHBwAAAAAAAAAAADw////AAAAAP7/BwAAAAAAAIDHEBgAAAAAAAAAAADw//9/AAAAAP//DwMAAAAAAMDPAAAAAAAAAAAAAADg//9/AAAAAP//jwMAAAAAAPjHAYAAAQAAAAAAAADg//9/AAAAgP//5wMAAAAAAPzPAYCAAQAAAAAAAAAA//8/AAAAgP//5wMAAAAAAP7/A4DAAAAAAAAAAAAA/v8/AAAAgP//4QEAAAAAAP//BwDAAAAAAAAAAAAA/v8/AAAAAP//4AEAAAAA4P//D2AAAAAAAAAAAAAA/v8fAAAAAP7/8AAAAAAA+P//H+AAAAAAAAAAAAAA/v8fAAAAAP7/8AAAAAAA+P//HwAAAAAAAAAAAAAA/v8DAAAAAP7/4AAAAAAA+P//PwAAAAAAAAAAAAAA//8AAAAAAP4/QAAAAAAA+P//fwAAAAAAAAAAAAAA//8AAAAAAPw/AAAAAAAA8P//fwAAAAAAAAAAAAAA//8AAAAAAPwxAAAAAAAA8P//fwAAAAAAAAAAAAAA/38AAAAAAPgTAAAAAAAA8P//fwAAAAAAAAAAAAAA/z8AAAAAAPgPAAAAAAAA4H//PwAAAAAAAAAAAAAA/x8AAAAAAPAHAAAAAAAA8Af+PwAIAAAAAAAAAACA/w8AAAAAACAAAAAAAAAA4AD8HwAYAAAAAAAAAADA/wcAAAAAAAAAAAAAAAAAAADgHwA4AAAAAAAAAADA/wMAAAAAAAAAAAAAAAAAAADgDwDwAAAAAAAAAADAfwAAAAAAAAAAAAAAAAAAAAAAAgB4AAAAAAAAAADAfwAAAAAAAAAAAAAAAAAAAAAABwA8AAAAAAAAAADAPwAAAAAAAAAAAAAAAAAAAAAABwAOAAAAAAAAAADAHwAAAAAAAAAAAAAAAAAAAAAAAgAPAAAAAAAAAADAHwAAAAAAAAAAAAAAAAAAAAAAAIADAAAAAAAAAADgHwAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAADgHwAAAAAAAAAAAADgAAAAAAAAAAAAAAAAAAAAAADgBwAAAAAAAAAAAABgAAAAAAAAAAAAAAAAAAAAAADghwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAHwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8AAAAAAAAAAAADgAAAAwCAAEAAAAAAAAAAAAAAAAfAAAAAAAAAAAAP8EwP//////AwAAAAAAAAAAAAAAPgAAAAAAAADA+P9/8P///////wAAAAAAAAAAAAAAfwAAAAAAcH////9//////////w8AAAAAAAAA+ADgfwAAAAD///////////////////8HAAAAAFgB/P/U/wAAAOD///////////////////8HAAAA+P///P///wAAAPD///////////////////8BAADA////////PwAA4P///////////////////z8AAMD/////////AQAB/v///////////////////z8AAPz///////9/AMAP//////////////////////8AABDg////////+fkP/v///////////////////w8AAID///////////H//////////////////////z8AQAD+//////////////////////////////////8B////////////////////////////////////////AAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
let _landBits: Uint8Array | null = null;
function landAt(latDeg: number, lonDeg: number): boolean {
  if (!_landBits) {
    const bin = atob(LAND_B64);
    _landBits = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) _landBits[i] = bin.charCodeAt(i);
  }
  const u = Math.min(LAND_W - 1, Math.max(0, Math.floor(((lonDeg + 180) / 360) * LAND_W)));
  const v = Math.min(LAND_H - 1, Math.max(0, Math.floor(((90 - latDeg) / 180) * LAND_H)));
  const i = v * LAND_W + u;
  return (_landBits[i >> 3] & (1 << (i & 7))) !== 0;
}


function DottedGlobe() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const SIZE = 720;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    // fibonacci sphere — stable, even coverage; each dot knows whether it sits
    // on LAND (lat/lon are fixed to the sphere, so the flag survives rotation)
    const N = 2600;
    const pts: { x: number; y: number; z: number; land: boolean; accent: boolean }[] = [];
    const GA = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = GA * i;
      const x = Math.cos(t) * r;
      const z = Math.sin(t) * r;
      const lat = (Math.asin(-y) * 180) / Math.PI; // canvas y points down
      const lon = (Math.atan2(x, z) * 180) / Math.PI;
      const land = landAt(lat, lon);
      pts.push({ x, y, z, land, accent: land && i % 23 === 0 });
    }
    const R = SIZE * 0.42;
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    const draw = (ms: number) => {
      const rot = reduced ? 0.6 : ms * 0.00012;
      ctx.clearRect(0, 0, SIZE, SIZE);
      for (const p of pts) {
        const x = p.x * Math.cos(rot) + p.z * Math.sin(rot);
        const z = -p.x * Math.sin(rot) + p.z * Math.cos(rot);
        const depth = (z + 1) / 2; // 0 back → 1 front
        const px = cx + x * R;
        const py = cy + p.y * R;
        // The mapa-mundi: land dots are the bright ones (white, cyan accents);
        // ocean dots are barely-there, keeping the sphere's volume readable.
        const size = p.land ? 1.05 + depth * 1.75 : 0.65 + depth * 0.85;
        const alpha = p.land ? 0.1 + depth * 0.62 : (0.03 + depth * 0.12);
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fillStyle = p.accent ? `rgba(43,232,214,${(alpha * 0.95).toFixed(3)})` : `rgba(255,255,255,${alpha.toFixed(3)})`;
        ctx.fill();
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        width: 720,
        height: 720,
        right: -180,
        top: -80,
        maskImage: "radial-gradient(circle at 50% 50%, black 55%, transparent 74%)",
        WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 55%, transparent 74%)",
        opacity: 0.85,
      }}
    />
  );
}

// ── hero conversion widget ───────────────────────────────────────────────────

function ConversionWidget() {
  const [secs, setSecs] = useState(42);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => (s <= 1 ? 42 : s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <GlassPanel className="w-full max-w-[460px] px-6 py-6" style={{ borderRadius: 20 }}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-title">
          Conversion · BRL <span className="text-mint">→</span> USD
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-white/12 bg-[#0a0f0d]/70 px-2.5 py-1 text-[11px] text-subtitle">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" />
          Processing
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-[14px] border border-white/10 bg-[#0a0f0d]/60 px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-[#101613] font-jbmono text-[12px] font-bold text-title">R$</span>
          <div className="leading-tight">
            <div className="text-[11px] text-muted">You send</div>
            <div className="text-[12.5px] text-subtitle">Brazilian Real</div>
          </div>
        </div>
        <div className="text-right leading-tight">
          <div className="font-jbmono text-[15px] font-bold text-title">BRL 250,000.00</div>
          <small className="font-jbmono text-[10.5px] text-muted">via PIX</small>
        </div>
      </div>

      <div className="relative mx-2 my-3 flex items-center justify-center gap-16">
        <span aria-hidden className="absolute left-0 right-0 top-1/2 h-px bg-white/12" />
        <span className="relative flex items-center gap-1.5 rounded-full border border-mint/40 bg-[#0e1410] px-3 py-1 font-jbmono text-[10.5px] font-semibold text-mint">
          <span className="h-1 w-1 rounded-full bg-mint" /> PIX
        </span>
        <span className="relative flex items-center gap-1.5 rounded-full border border-cyan2/40 bg-[#0e1410] px-3 py-1 font-jbmono text-[10.5px] font-semibold text-cyan2">
          <span className="h-1 w-1 rounded-full bg-cyan2" /> FedNow
        </span>
      </div>

      <div className="flex items-center justify-between rounded-[14px] border border-mint/25 bg-[#0c1410]/70 px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-mint/40 bg-[#0e1a14] font-jbmono text-[12px] font-bold text-mint">$</span>
          <div className="leading-tight">
            <div className="text-[11px] text-muted">You receive</div>
            <div className="text-[12.5px] text-subtitle">USD</div>
          </div>
        </div>
        <div className="text-right leading-tight">
          <div className="font-jbmono text-[15px] font-bold text-mint">USD 49,151.64</div>
          <small className="font-jbmono text-[10.5px] text-muted">via FedNow</small>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3.5 text-[11.5px] text-muted">
        <span>
          Rate locked · <span className="font-jbmono text-subtitle">1 USD = 5.0863 BRL</span>
        </span>
        <span className="font-jbmono text-mint">00:{String(secs).padStart(2, "0")}</span>
      </div>
    </GlassPanel>
  );
}

// ── hero rotating country ────────────────────────────────────────────────────

const COUNTRIES = ["Mexico", "Colombia", "Brazil", "Argentina"];

function RotatingCountry() {
  const [i, setI] = useState(0);
  const [on, setOn] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setOn(false);
      setTimeout(() => {
        setI((v) => (v + 1) % COUNTRIES.length);
        setOn(true);
      }, 260);
    }, 2600);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      className="inline-block"
      style={{ opacity: on ? 1 : 0, transform: on ? "none" : "translateY(8px)", transition: `opacity .26s ${EASE}, transform .26s ${EASE}` }}
    >
      {COUNTRIES[i]}
    </span>
  );
}


// ── sectioning: scenes + chapter rules ───────────────────────────────────────
// Chapters open with a numbered mono chip on a fading hairline; alternate
// chapters sit in full-bleed darker bands; content rises in on arrival.

/** Rises in on first viewport entry (reduced-motion: shown immediately). */
function Reveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOn(true);
      return;
    }
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }),
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ opacity: on ? 1 : 0, transform: on ? "none" : "translateY(28px)", transition: `opacity .75s ${EASE}, transform .75s ${EASE}` }}>
      {children}
    </div>
  );
}

/** A chapter: numbered rule on top, optional full-bleed darker band. */
function Scene({ id, n, label, band = false, children }: { id: string; n: string; label: string; band?: boolean; children: React.ReactNode }) {
  return (
    <section
      id={id}
      className={`relative z-10 scroll-mt-28 ${band ? "border-y border-white/[.08]" : ""}`}
      style={band ? { background: "linear-gradient(rgba(3,6,5,.6), rgba(3,6,5,.42))" } : undefined}
    >
      <div className="mx-auto max-w-[1200px] px-5 pt-14">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2.5 rounded-full border border-white/12 bg-[#0a0f0d]/70 px-3.5 py-1.5 font-jbmono text-[10px] font-medium uppercase tracking-[0.3em]">
            <span className="text-mint">{n}</span>
            <span className="text-[#6f8a7f]">{label}</span>
          </span>
          <span aria-hidden className="h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(255,255,255,.16), transparent)" }} />
        </div>
      </div>
      <Reveal>{children}</Reveal>
    </section>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function SitePage() {
  const [banner, setBanner] = useState(true);
  const [waitlist, setWaitlist] = useState<"idle" | "done">("idle");

  return (
    <main className="relative min-h-screen text-title" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
      <SilkBackdrop />
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px]" style={{ background: `linear-gradient(90deg,${CYAN},${MINT})` }} />

      {/* ── announcement banner + nav: one sticky unit, like the original ── */}
      <div className="sticky top-0 z-30">
      {banner && (
        <div className="relative border-b border-white/10 bg-[#0a120e]/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1200px] items-center justify-center gap-3 px-5 py-2.5 text-[12.5px]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" />
            <span className="text-subtitle">
              <strong className="font-semibold text-mint">New</strong> — Trace raises a $32M Series A led by CoinFund.
            </span>
            <a href="https://www.tracefinance.com/series-a" className="font-semibold text-mint hover:text-mint-hover">
              Read the announcement →
            </a>
            <button onClick={() => setBanner(false)} aria-label="Dismiss" className="absolute right-4 text-muted transition hover:text-title">
              ×
            </button>
          </div>
        </div>
      )}

      {/* ── nav ── */}
      <header className="border-b border-white/10 bg-[#07090b]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-3.5">
          <a href="#" className="flex items-center">
            {/* the official lockup (mark + wordmark in the brand font) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/site-trace-logo.svg" alt="Trace" className="h-[24px] w-auto" />
          </a>
          <nav className="hidden items-center gap-7 text-[13.5px] text-subtitle md:flex">
            <a href="#product" className="font-semibold text-title">Product</a>
            <a href="#use-cases" className="transition hover:text-title">Use cases</a>
            <a href="#developers" className="transition hover:text-title">Developers</a>
            <a href="#contact" className="transition hover:text-title">Contact</a>
          </nav>
          <div className="flex items-center gap-4">
            <div className="hidden items-center overflow-hidden rounded-[9px] border border-white/12 font-jbmono text-[11px] md:flex">
              <button className="bg-white/10 px-2.5 py-1.5 font-semibold text-title">EN</button>
              <button className="px-2.5 py-1.5 text-muted transition hover:text-subtitle">PT</button>
            </div>
            <PrimaryBtn href="#contact">Request a demo</PrimaryBtn>
          </div>
        </div>
      </header>
      </div>

      {/* ── hero ── */}
      <section id="top" className="relative z-10 scroll-mt-28 overflow-hidden">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 pb-24 pt-16 md:grid-cols-[1.05fr_1fr] md:pt-24">
          <div className="tf-rise">
            <Eyebrow>Payments &amp; stablecoin infrastructure</Eyebrow>
            <h1 className="mt-5 font-display text-[44px] font-semibold leading-[1.06] tracking-[-0.02em] text-title md:text-[60px]">
              Money moves slow.
              <br />
              <RotatingCountry /> doesn&apos;t.
              <br />
              <em className="not-italic text-mint">Neither do we.</em>
            </h1>
            <p className="mt-6 max-w-[480px] text-[15.5px] leading-relaxed text-subtitle">
              Convert BRL to stablecoins in under a minute through PIX. Hold BRL, USD and EUR accounts, and settle
              cross-border payments 24/7 — all through one compliant API.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <PrimaryBtn href="#contact">Request a demo</PrimaryBtn>
              <GhostBtn href="#developers">Read the docs</GhostBtn>
            </div>
            <div className="mt-7 flex flex-wrap gap-6 text-[12.5px] text-subtitle">
              <span className="flex items-center gap-2"><CheckIcon /> No local entity required</span>
              <span className="flex items-center gap-2"><CheckIcon /> Bank-grade compliance built in</span>
            </div>
          </div>

          <div className="relative flex justify-center md:justify-end">
            <DottedGlobe />
            <div className="tf-rise relative" style={{ animationDelay: ".12s" }}>
              <ConversionWidget />
            </div>
          </div>
        </div>
      </section>

      {/* ── proof band: trusted-by + the stats, one full-bleed shelf ── */}
      <section className="relative z-10 border-y border-white/[.08]" style={{ background: "linear-gradient(rgba(3,6,5,.6), rgba(3,6,5,.42))" }}>
        <Reveal>
        <div className="mx-auto max-w-[1200px] px-5 pt-10 text-center">
          <p className="font-jbmono text-[10.5px] font-medium uppercase tracking-[0.34em] text-[#6f8a7f]">
            Trusted by exchanges, fintechs and global businesses
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-11 gap-y-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/site-customers/dlocal.png" alt="dLocal" className="h-6 w-auto max-w-[150px] object-contain opacity-65 md:h-7" />
            {/* Mercado Bitcoin: knockout shield mark (letters see through) + name */}
            <span className="flex items-center gap-2.5 opacity-65">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/site-customers/mercado-mark.png" alt="" className="h-6 w-auto md:h-7" />
              <span className="whitespace-nowrap text-[14.5px] font-semibold text-[#c3c3c3] md:text-[15.5px]">Mercado Bitcoin</span>
            </span>
            {[
              ["enigma.png", "Enigma"],
              ["bcb.png", "BCB Group"],
              ["BVNK.png", "BVNK"],
              ["ARQ.png", "Arq"],
            ].map(([f, alt]) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={f} src={`/assets/site-customers/${f}`} alt={alt} className="h-6 w-auto max-w-[150px] object-contain opacity-65 md:h-7" />
            ))}
          </div>
        </div>
        <div className="mx-auto grid max-w-[1200px] gap-5 px-5 pb-12 pt-9 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { big: <>US$<em className="not-italic text-mint">12</em>B</>, sub: "transacted" },
            { big: <>&lt; 60<em className="not-italic text-mint">s</em></>, sub: "PIX → stablecoin settlement" },
            { big: <>24<em className="not-italic text-mint">/</em>7</>, sub: "operation — weekends and holidays" },
            { big: <>99.9<em className="not-italic text-mint">%</em></>, sub: "API uptime" },
          ].map((s, i) => (
            <div key={i} className="glass-card rounded-2xl px-6 py-7">
              <div className="font-jbmono text-[30px] font-bold tracking-tight text-title">{s.big}</div>
              <div className="mt-1.5 text-[12.5px] text-subtitle">{s.sub}</div>
            </div>
          ))}
        </div>
        </Reveal>
      </section>

      {/* ── product ── */}
      <Scene id="product" n="01" label="Product">
        <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-9">
          <GlassPanel className="px-8 py-10 md:px-12">
            <div className="flex flex-wrap items-end justify-between gap-8">
              <div className="max-w-[560px]">
                <h2 className="mt-4 font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.015em] text-title md:text-[40px]">
                  Everything you need to operate in LatAm
                </h2>
                <p className="mt-4 text-[14.5px] leading-relaxed text-subtitle">
                  Accounts, conversion and payments — three primitives that compose into complete payment infrastructure.
                </p>
              </div>
              <PrimaryBtn href="https://www.tracefinance.com/product">Explore the product</PrimaryBtn>
            </div>
            <div className="mt-9 grid gap-5 md:grid-cols-3">
              {[
                { t: "Multi-currency accounts", d: "Hold BRL, USD and EUR side by side — one balance sheet, every corridor." },
                { t: "Stablecoin on/off-ramp", d: "PIX in, USDC/USDT out — and back — settled in under a minute." },
                { t: "Cross-border payments", d: "Pay in and pay out across rails: PIX, SWIFT, FedNow, on-chain." },
              ].map((c) => (
                <div key={c.t} className="glass-card rounded-2xl px-6 py-6">
                  <h3 className="text-[15.5px] font-semibold text-title">{c.t}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-subtitle">{c.d}</p>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>
      </Scene>

      {/* ── why trace ── */}
      <Scene id="why" n="02" label="Why Trace" band>
        <div className="mx-auto max-w-[1200px] px-5 pb-14 pt-9">
          <h2 className="mt-4 max-w-[620px] font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.015em] text-title md:text-[40px]">
            We&apos;re removing the barriers
          </h2>
          <p className="mt-4 max-w-[520px] text-[14.5px] leading-relaxed text-subtitle">
            While others talk about bridging traditional finance and digital assets, we ship infrastructure that already does.
          </p>
          <div className="mt-10">
            {[
              { n: "01", t: "Deep liquidity", d: "Institutional volumes with consistent pricing. Multi-source routing finds optimal execution for every conversion — from small trades to large settlements." },
              { n: "02", t: "Real-time settlement", d: "Conversions complete in under a minute via PIX. No banking hours, no cut-off times — BRL moves on weekends and holidays like any other day." },
              { n: "03", t: "Regulated and audited", d: "Operating in strict alignment with global AML/CFT standards. Automated KYC and transaction monitoring on every operation, with full audit trails." },
            ].map((r) => (
              <div key={r.n} className="grid gap-3 border-t border-white/10 py-8 last:border-b md:grid-cols-[80px_1fr_1.2fr] md:gap-8">
                <span className="font-jbmono text-[13px] font-bold text-mint">{r.n}</span>
                <h3 className="font-display text-[22px] font-semibold text-title">{r.t}</h3>
                <p className="text-[13.5px] leading-relaxed text-subtitle">{r.d}</p>
              </div>
            ))}
          </div>
        </div>
      </Scene>

      {/* ── use cases ── */}
      <Scene id="use-cases" n="03" label="Use cases">
        <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-9">
          <GlassPanel className="flex flex-wrap items-end justify-between gap-8 px-8 py-10 md:px-12">
            <div className="max-w-[600px]">
              <h2 className="mt-4 font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.015em] text-title md:text-[40px]">
                Built for the companies moving money into LatAm
              </h2>
              <p className="mt-4 text-[14.5px] leading-relaxed text-subtitle">
                From exchanges processing millions in daily volume to fintechs launching in new markets.
              </p>
            </div>
            <PrimaryBtn href="https://www.tracefinance.com/use-cases">See use cases</PrimaryBtn>
          </GlassPanel>
        </div>
      </Scene>

      {/* ── api ── */}
      <Scene id="developers" n="04" label="Trace API" band>
        <div className="mx-auto grid max-w-[1200px] items-start gap-12 px-5 pb-16 pt-9 md:grid-cols-[1fr_1.1fr]">
          <div>
            <h2 className="mt-4 font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.015em] text-title md:text-[40px]">
              One integration. Every rail.
            </h2>
            <ul className="mt-7 flex flex-col gap-4 text-[13.5px] leading-relaxed text-subtitle">
              {[
                ["Beneficiaries", "register payout destinations: PIX, bank accounts, crypto wallets"],
                ["Quotes", "lock an FX rate for a short window, bound to one account"],
                ["Operations", "deposits, swaps and withdrawals across every rail"],
                ["Webhooks", "signed events for every approval and terminal state"],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-2.5">
                  <span className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-mint" />
                  <span>
                    <strong className="font-semibold text-title">{t}</strong> — {d}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3.5">
              <PrimaryBtn href="https://tracefinance.mintlify.app/">Explore the API</PrimaryBtn>
              <GhostBtn href="https://tracefinance.mintlify.app/journeys/withdrawal">Withdrawal guide</GhostBtn>
            </div>
          </div>

          <GlassPanel className="overflow-hidden" style={{ borderRadius: 18 }}>
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <span className="font-jbmono text-[11.5px] text-subtitle">withdrawal.sh</span>
              <span className="flex items-center gap-1.5 rounded-full border border-mint/30 bg-[#0c1410] px-2.5 py-1 font-jbmono text-[10.5px] text-mint">
                <span className="h-1 w-1 rounded-full bg-mint" /> 201 Created · 412 ms
              </span>
            </div>
            <pre className="overflow-x-auto px-5 py-4 font-jbmono text-[12px] leading-[1.75] text-subtitle">
              <span className="text-muted"># 1 — lock the rate</span>{"\n"}
              <span className="text-title">POST /api/quotes</span>{"\n"}
              {"{ "}<span className="text-cyan2">&quot;sourceAsset&quot;</span>: <span className="text-mint">&quot;BRL&quot;</span>, <span className="text-cyan2">&quot;targetAsset&quot;</span>: <span className="text-mint">&quot;USDC&quot;</span>,{"\n"}
              {"  "}<span className="text-cyan2">&quot;sourceAmount&quot;</span>: <span className="text-mint">&quot;250000.00&quot;</span>{" }"}{"\n"}
              <span className="text-muted"># =&gt; {"{"} &quot;effectiveRate&quot;: &quot;5.0863&quot;, &quot;expiresAt&quot;: … {"}"}</span>{"\n"}
              {"\n"}
              <span className="text-muted"># 2 — send the withdrawal</span>{"\n"}
              <span className="text-title">POST /api/operations/withdrawal</span>{"\n"}
              {"{ "}<span className="text-cyan2">&quot;quoteId&quot;</span>: <span className="text-mint">&quot;&lt;quote-id&gt;&quot;</span>,{"\n"}
              {"  "}<span className="text-cyan2">&quot;beneficiary&quot;</span>: {"{ "}<span className="text-cyan2">&quot;mode&quot;</span>: <span className="text-mint">&quot;REFERENCE&quot;</span>, <span className="text-cyan2">&quot;id&quot;</span>: <span className="text-mint">&quot;&lt;beneficiary-id&gt;&quot;</span> {"} }"}{"\n"}
              <span className="text-muted"># =&gt; 201 · REQUESTED — OPERATION_COMPLETED webhook follows</span>
            </pre>
          </GlassPanel>
        </div>
      </Scene>

      {/* ── dashboard ── */}
      <Scene id="dashboard" n="05" label="Dashboard">
        <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-9">
          <h2 className="mt-4 max-w-[560px] font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.015em] text-title md:text-[40px]">
            Manage everything from one place
          </h2>
          <p className="mt-4 max-w-[520px] text-[14.5px] leading-relaxed text-subtitle">
            Balances, conversions, payouts and approvals — visible to your whole team, exportable for your auditors.
          </p>

          <GlassPanel className="mt-10 overflow-hidden" style={{ borderRadius: 20 }}>
            <div className="grid md:grid-cols-[210px_1fr]">
              <aside className="hidden border-r border-white/10 px-4 py-5 md:block">
                <div className="flex items-center gap-2 px-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ASSETS.traceLogo} alt="" style={{ height: 16, width: 16 * TRACE_LOGO_AR }} />
                  <span className="text-[12.5px] font-semibold text-title">Trace Finance</span>
                </div>
                <nav className="mt-5 flex flex-col gap-1 text-[12.5px] text-subtitle">
                  <span className="rounded-lg bg-white/[.07] px-3 py-2 font-semibold text-title">Home</span>
                  <span className="px-3 py-2">Dashboard</span>
                  <span className="px-3 py-2">Operations</span>
                  <span className="px-3 py-2">Beneficiaries</span>
                </nav>
              </aside>
              <div className="px-6 py-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[16px] font-semibold text-title">Welcome, Caroline.</div>
                    <div className="mt-0.5 font-jbmono text-[10px] uppercase tracking-[0.22em] text-muted">Thursday, November 25 · 2:32 PM</div>
                  </div>
                  <span className="rounded-[10px] bg-mint px-3.5 py-2 text-[12px] font-semibold text-mint-on">New transaction</span>
                </div>
                <div className="mt-5 rounded-2xl border border-white/10 bg-[#0a0f0d]/60 px-5 py-4">
                  <div className="text-[11px] text-muted">Total balance · converted to USD</div>
                  <div className="mt-1 font-jbmono text-[26px] font-bold text-title">US$ 5,480,828.25</div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[.06]">
                    <div className="flex h-full">
                      <span style={{ width: "43.7%", background: MINT }} />
                      <span style={{ width: "33.6%", background: CYAN }} />
                      <span style={{ width: "16.8%", background: "#26A17B" }} />
                      <span style={{ width: "5.9%", background: "#2775CA" }} />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 font-jbmono text-[11px] text-subtitle sm:grid-cols-4">
                    <span><span className="text-mint">●</span> BRL R$ 12,410.88</span>
                    <span><span className="text-cyan2">●</span> USD $1,842,330.89</span>
                    <span><span style={{ color: "#26A17B" }}>●</span> USDT $920,105.93</span>
                    <span><span style={{ color: "#2775CA" }}>●</span> USDC $318,440.34</span>
                  </div>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-[12px]">
                    <thead>
                      <tr className="font-jbmono text-[9.5px] uppercase tracking-[0.18em] text-muted">
                        <th className="py-2 font-medium">Beneficiary</th>
                        <th className="py-2 font-medium">Operation</th>
                        <th className="py-2 font-medium">Type</th>
                        <th className="py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-subtitle">
                      {[
                        ["Acme S.A", "100.00 BRL → 900.00 USD", "Exchange"],
                        ["Trace Finance LLC", "100.00 BRL", "PIX"],
                        ["Pix Inc", "- 100.00 BRL", "PIX"],
                        ["Trace Finance LLC", "100.00 BRL → 900.00 USDC", "Exchange"],
                      ].map((r, i) => (
                        <tr key={i} className="border-t border-white/[.07]">
                          <td className="py-2.5 text-title">{r[0]}</td>
                          <td className="py-2.5 font-jbmono text-[11px]">{r[1]}</td>
                          <td className="py-2.5">{r[2]}</td>
                          <td className="py-2.5">
                            <span className="rounded-full border border-mint/30 px-2 py-0.5 font-jbmono text-[10px] text-mint">Completed</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </GlassPanel>
        </div>
      </Scene>

      {/* ── coming soon / waitlist ── */}
      <Scene id="coming-soon" n="06" label="Coming soon">
        <div className="mx-auto max-w-[1200px] px-5 pb-10 pt-9">
          <GlassPanel className="flex flex-wrap items-center justify-between gap-8 px-8 py-10 md:px-12">
            <div className="max-w-[560px]">
              <h2 className="mt-4 font-display text-[26px] font-semibold leading-[1.15] tracking-[-0.015em] text-title md:text-[32px]">
                We&apos;re building the future of cross-border settlement
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-subtitle">
                Something new is on the way. Join the waitlist to be first in line when it launches.
              </p>
            </div>
            {waitlist === "done" ? (
              <span className="flex items-center gap-2 text-[13.5px] text-mint"><CheckIcon /> You&apos;re on the list — we&apos;ll be in touch.</span>
            ) : (
              <form
                className="flex w-full max-w-[420px] gap-2.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  setWaitlist("done");
                }}
              >
                <input
                  type="email"
                  required
                  placeholder="you@company.com"
                  className="min-w-0 flex-1 rounded-[12px] border border-white/12 bg-[#0a0f0d]/70 px-4 py-3 text-[13.5px] text-title outline-none transition placeholder:text-muted focus:border-mint/50"
                />
                <button type="submit" className="rounded-[12px] bg-mint px-4 py-3 text-[13.5px] font-semibold text-mint-on transition hover:bg-mint-hover">
                  Join the waitlist
                </button>
              </form>
            )}
          </GlassPanel>
        </div>
      </Scene>

      {/* ── closing cta ── */}
      <Scene id="contact" n="07" label="Contact">
        <div className="mx-auto max-w-[760px] px-5 pb-24 pt-16 text-center">
          <h2 className="font-display text-[36px] font-semibold leading-[1.08] tracking-[-0.02em] text-title md:text-[48px]">
            Ready to remove the barriers?
          </h2>
          <p className="mx-auto mt-5 max-w-[480px] text-[15px] leading-relaxed text-subtitle">
            Talk to our team about volumes, corridors and integration. Most clients go live in days, not months.
          </p>
          <div className="mt-9 flex justify-center gap-3.5">
            <PrimaryBtn href="https://www.tracefinance.com/contact">Request a demo</PrimaryBtn>
            <GhostBtn href="https://tracefinance.mintlify.app/">Read the docs</GhostBtn>
          </div>
        </div>
      </Scene>

      {/* ── footer ── */}
      <footer className="relative z-10 border-t border-white/10 bg-[#07090b]/60 backdrop-blur-xl">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-14 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/site-trace-logo.svg" alt="Trace" className="h-[20px] w-auto" />
            <p className="mt-3 max-w-[260px] text-[12.5px] leading-relaxed text-subtitle">
              Payments and stablecoin infrastructure for Brazil and Latin America.
            </p>
          </div>
          {[
            {
              h: "Product",
              links: [
                ["Multi-currency accounts", "https://www.tracefinance.com/product"],
                ["Stablecoin on/off-ramp", "https://www.tracefinance.com/product"],
                ["Cross-border payments", "https://www.tracefinance.com/product"],
                ["Use cases", "https://www.tracefinance.com/use-cases"],
              ],
            },
            {
              h: "Developers",
              links: [
                ["Documentation", "https://tracefinance.mintlify.app/"],
                ["API reference", "https://tracefinance.mintlify.app/api-reference"],
                ["API status", "https://status.tracefinance.com/"],
              ],
            },
            {
              h: "Company",
              links: [
                ["Contact", "https://www.tracefinance.com/contact"],
                ["Terms of service", "https://www.tracefinance.com/terms-of-service"],
                ["Privacy policy", "https://www.tracefinance.com/privacy-policy"],
                ["Ethics channel", "https://tracefinance.becompliance.com/canal-etica/canal-denuncias"],
                ["Code of ethics and conduct", "https://www.tracefinance.com/code-of-conduct"],
              ],
            },
          ].map((col) => (
            <div key={col.h}>
              <h4 className="font-jbmono text-[10px] font-semibold uppercase tracking-[0.28em] text-[#6f8a7f]">{col.h}</h4>
              <ul className="mt-4 flex flex-col gap-2.5 text-[13px] text-subtitle">
                {col.links.map(([t, href]) => (
                  <li key={t}>
                    <a href={href} className="transition hover:text-title">{t}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/[.07]">
          <div className="mx-auto max-w-[1200px] px-5 py-6 text-[11.5px] leading-relaxed text-muted">
            © 2026 Trace Finance. All rights reserved. Trace Finance acts as a banking correspondent in partnership with
            financial institutions duly authorized by the Central Bank of Brazil, providing intermediation between clients
            and authorized institutions for foreign exchange and PIX operations.
          </div>
        </div>
      </footer>
    </main>
  );
}
