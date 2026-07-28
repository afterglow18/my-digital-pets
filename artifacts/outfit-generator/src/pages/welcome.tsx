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

// ── Heart shape ───────────────────────────────────────────────────────────────
// Heart centered at (50%, 38%). Left half draws on load; right half on tap.
// Rotations follow the tangent direction so each print faces the way of travel.
// 0° = toes up, 90° = toes right, ±180° = toes down, −90° = toes left.

/** Left side — bottom tip → up the left lobe → top-centre notch */
const IDLE_PAWS: Paw[] = [
  { x: 50, y: 70, rot:  -40, flip: true,  delay: 0.20 },
  { x: 41, y: 63, rot:  -35, flip: false, delay: 0.46 },
  { x: 33, y: 55, rot:  -22, flip: true,  delay: 0.72 },
  { x: 29, y: 46, rot:   -5, flip: false, delay: 0.98 },
  { x: 30, y: 37, rot:   22, flip: true,  delay: 1.24 },
  { x: 37, y: 30, rot:   48, flip: false, delay: 1.50 },
  { x: 46, y: 27, rot:   72, flip: true,  delay: 1.76 },
];

/** Right side — top-centre notch → down the right lobe → bottom tip */
const WALK_PAWS: Paw[] = [
  { x: 54, y: 27, rot:  108, flip: false, delay: 0.00 },
  { x: 63, y: 30, rot:  132, flip: true,  delay: 0.12 },
  { x: 70, y: 37, rot:  152, flip: false, delay: 0.24 },
  { x: 71, y: 46, rot:  172, flip: true,  delay: 0.36 },
  { x: 67, y: 55, rot: -158, flip: false, delay: 0.48 },
  { x: 59, y: 63, rot: -143, flip: true,  delay: 0.60 },
  { x: 52, y: 70, rot: -128, flip: false, delay: 0.72 },
];

// Last WALK_PAW finishes at delay 1.72 + 0.28 ≈ 2.0 s after tap
// → hero fades in at 2.1 s, fully visible at ~3.0 s
// → exit fade starts at 3.3 s, onEnter at 4.1 s

// ── Paw mark component ────────────────────────────────────────────────────────

function PawMark({ paw, visible, hide }: { paw: Paw; visible: boolean; hide?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.3 }}
      animate={hide ? { opacity: 0 } : visible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.3 }}
      transition={hide
        ? { duration: 0.4, ease: "easeIn" }
        : { delay: visible ? paw.delay : 0, duration: 0.28, ease: "easeOut" }}
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
    setTimeout(() => setPhase("hero"),    1100);
    setTimeout(() => setPhase("exiting"), 3600);
    setTimeout(onEnter,                   4400);
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
        <PawMark key={`idle-${i}`} paw={paw} visible={true} hide={showHero} />
      ))}

      {/* ── Walking paw trail (top half, revealed on tap) ── */}
      {WALK_PAWS.map((paw, i) => (
        <PawMark key={`walk-${i}`} paw={paw} visible={showWalk} hide={showHero} />
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
