/**
 * WelcomePage — three-act animated welcome.
 *
 * Act 1 (idle)    White screen. Paw prints walk in from the bottom, settling
 *                 around the mid-point of the screen.
 * Act 2 (walking) Tapping "Get Started" continues the trail all the way to the
 *                 top of the screen. Button fades out.
 * Act 3 (hero)    The hero image fades in over the white background.
 * Act 4 (exit)    Everything fades to black, then the wardrobe appears.
 */
import { useState, useCallback } from "react";
import { motion } from "framer-motion";

interface Props { onEnter: () => void; }

// ── Paw print SVG ─────────────────────────────────────────────────────────────

function PawSVG({ size = 30, color = "rgba(101,67,33,0.55)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <ellipse cx="16" cy="22" rx="6"   ry="5"   fill={color} />
      <ellipse cx="8"  cy="14" rx="3.2" ry="2.6" fill={color} />
      <ellipse cx="24" cy="14" rx="3.2" ry="2.6" fill={color} />
      <ellipse cx="11" cy="9"  rx="3"   ry="2.4" fill={color} />
      <ellipse cx="21" cy="9"  rx="3"   ry="2.4" fill={color} />
    </svg>
  );
}

// ── Walk trail positions (% of screen height) ─────────────────────────────────

type Paw = { x: number; y: number; rot: number; flip: boolean; delay: number };

/** Bottom-half trail — appears on mount, settles around the middle */
const IDLE_PAWS: Paw[] = [
  { x: 46, y: 90, rot: -10, flip: false, delay: 0.20 },
  { x: 55, y: 86, rot:  10, flip: true,  delay: 0.42 },
  { x: 44, y: 82, rot:  -8, flip: false, delay: 0.64 },
  { x: 54, y: 78, rot:   8, flip: true,  delay: 0.86 },
  { x: 45, y: 74, rot:  -6, flip: false, delay: 1.08 },
  { x: 53, y: 70, rot:   6, flip: true,  delay: 1.30 },
  { x: 44, y: 66, rot:  -4, flip: false, delay: 1.52 },
  { x: 52, y: 62, rot:   4, flip: true,  delay: 1.74 },
  { x: 45, y: 58, rot:  -2, flip: false, delay: 1.96 },
  { x: 51, y: 54, rot:   2, flip: true,  delay: 2.18 },
];

/** Top-half trail — appears after the button is tapped */
const WALK_PAWS: Paw[] = [
  { x: 44, y: 50, rot:  -2, flip: false, delay: 0.00 },
  { x: 50, y: 46, rot:   2, flip: true,  delay: 0.10 },
  { x: 45, y: 42, rot:  -1, flip: false, delay: 0.20 },
  { x: 49, y: 38, rot:   1, flip: true,  delay: 0.30 },
  { x: 46, y: 34, rot:  -1, flip: false, delay: 0.40 },
  { x: 48, y: 30, rot:   1, flip: true,  delay: 0.50 },
  { x: 47, y: 26, rot:   0, flip: false, delay: 0.60 },
  { x: 48, y: 22, rot:   0, flip: true,  delay: 0.70 },
  { x: 47, y: 18, rot:   0, flip: false, delay: 0.80 },
  { x: 48, y: 14, rot:   0, flip: true,  delay: 0.90 },
  { x: 47, y: 10, rot:   0, flip: false, delay: 1.00 },
];

// Last WALK_PAW finishes at delay 1.72 + 0.28 ≈ 2.0 s after tap
// → hero fades in at 2.1 s, fully visible at ~3.0 s
// → exit fade starts at 3.3 s, onEnter at 4.1 s

// ── Paw mark component ────────────────────────────────────────────────────────

function PawMark({ paw, visible }: { paw: Paw; visible: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.3 }}
      animate={visible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.3 }}
      transition={{ delay: visible ? paw.delay : 0, duration: 0.28, ease: "easeOut" }}
      style={{
        position: "absolute",
        left: `${paw.x}%`,
        top:  `${paw.y}%`,
        transform: `translate(-50%, -50%) rotate(${paw.rot}deg)${paw.flip ? " scaleX(-1)" : ""}`,
        zIndex: 4,
        pointerEvents: "none",
      }}
    >
      <PawSVG />
    </motion.div>
  );
}

// ── Page component ────────────────────────────────────────────────────────────

type Phase = "idle" | "walking" | "hero" | "exiting";

export default function WelcomePage({ onEnter }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");

  const handleEnter = useCallback(() => {
    if (phase !== "idle") return;
    setPhase("walking");
    setTimeout(() => setPhase("hero"),    1400);
    setTimeout(() => setPhase("exiting"), 4400);
    setTimeout(onEnter,                   5200);
  }, [phase, onEnter]);

  const showWalk   = phase === "walking" || phase === "hero" || phase === "exiting";
  const showHero   = phase === "hero"    || phase === "exiting";
  const showButton = phase === "idle";

  return (
    /* Outer wrapper — always white, fades to black on exit */
    <motion.div
      animate={{ opacity: phase === "exiting" ? 0 : 1 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "#ffffff",
        overflow: "hidden",
      }}
    >
      {/* ── Hero image — fades in during act 3 ── */}
      <motion.img
        src="/hero-pets.png"
        alt="My Digital Pets"
        draggable={false}
        initial={{ opacity: 0 }}
        animate={{ opacity: showHero ? 1 : 0 }}
        transition={{ duration: 0.9, ease: "easeInOut" }}
        style={{
          position: "absolute",
          top: "env(safe-area-inset-top)",
          bottom: 0, left: 0, right: 0,
          width: "100%",
          height: "calc(100% - env(safe-area-inset-top))",
          objectFit: "cover",
          objectPosition: "top center",
          userSelect: "none",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* ── Idle paw trail (bottom half) ── */}
      {IDLE_PAWS.map((paw, i) => (
        <PawMark key={`idle-${i}`} paw={paw} visible={true} />
      ))}

      {/* ── Walking paw trail (top half, revealed on tap) ── */}
      {WALK_PAWS.map((paw, i) => (
        <PawMark key={`walk-${i}`} paw={paw} visible={showWalk} />
      ))}

      {/* ── CTA button (white phase only) ── */}
      <motion.div
        animate={{ opacity: showButton ? 1 : 0, y: showButton ? 0 : 12 }}
        transition={{ duration: 0.35, ease: "easeIn" }}
        style={{
          position: "absolute",
          bottom: "calc(env(safe-area-inset-bottom) + 52px)",
          left: 0, right: 0,
          display: "flex", flexDirection: "column", alignItems: "center",
          zIndex: 10,
          pointerEvents: showButton ? "auto" : "none",
        }}
      >
        <motion.button
          onClick={handleEnter}
          whileTap={{ scale: 0.96 }}
          style={{
            fontFamily: "var(--font-display, sans-serif)",
            fontWeight: 800, fontSize: 16,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "#fff",
            background: "linear-gradient(135deg, #6B8E6B, #4A6741)",
            border: "none",
            borderRadius: 100,
            padding: "16px 52px",
            cursor: "pointer",
            boxShadow: "0 4px 18px rgba(74,103,65,0.45), 0 2px 0 rgba(0,0,0,0.18)",
          }}
        >
          Get Started ✨
        </motion.button>

        <div style={{ marginTop: 18, display: "flex", gap: 20 }}>
          <a
            href="https://classy-alpaca-441.notion.site/Privacy-Policy-39682db6065380b19dedcb108d4a0ef4"
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, fontWeight: 500, color: "rgba(80,60,40,0.35)", textDecoration: "none", letterSpacing: "0.02em" }}
          >Privacy Policy</a>
          <a
            href="https://app.notion.com/p/My-Digital-Closet-Support-39782db60653802a9088dcbae84c0527?source=copy_link"
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, fontWeight: 500, color: "rgba(80,60,40,0.35)", textDecoration: "none", letterSpacing: "0.02em" }}
          >Support</a>
        </div>
      </motion.div>
    </motion.div>
  );
}
