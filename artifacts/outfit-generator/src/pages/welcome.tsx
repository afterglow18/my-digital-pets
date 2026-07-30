/**
 * WelcomePage — three-phase splash shown once per cold session.
 *
 * Phase 1 (splash)   Full-screen hero image with branding. Auto-advances
 *                    after 2.5 s with no user interaction.
 * Phase 2 (idle)     White screen. Paw prints walk in from the bottom.
 *                    Branding + "Get Started" button shown near the bottom.
 * Phase 3 (walking)  Tap triggers the rest of the paw trail; button fades.
 *                    After ~750 ms everything fades out and the app opens.
 *
 * Session-once: App.tsx guards this with sessionStorage so it never remounts
 * after the first cold launch within a session.
 */
import { useState, useEffect, useCallback } from "react";
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

// ── Walk trail positions ───────────────────────────────────────────────────────

type Paw = { x: number; y: number; rot: number; flip: boolean; delay: number };

/** Appears on mount — bottom-left toward centre */
const IDLE_PAWS: Paw[] = [
  { x:  8, y: 90, rot: 44, flip: false, delay: 0.20 },
  { x: 18, y: 80, rot: 44, flip: true,  delay: 0.46 },
  { x: 28, y: 70, rot: 44, flip: false, delay: 0.72 },
  { x: 38, y: 60, rot: 44, flip: true,  delay: 0.98 },
  { x: 48, y: 50, rot: 44, flip: false, delay: 1.24 },
  { x: 58, y: 40, rot: 44, flip: true,  delay: 1.50 },
];

/** Continues on tap — centre toward top-right */
const WALK_PAWS: Paw[] = [
  { x: 63, y: 33, rot: 44, flip: false, delay: 0.00 },
  { x: 71, y: 25, rot: 44, flip: true,  delay: 0.12 },
  { x: 79, y: 17, rot: 44, flip: false, delay: 0.24 },
  { x: 87, y:  9, rot: 44, flip: true,  delay: 0.36 },
  { x: 95, y:  2, rot: 44, flip: false, delay: 0.48 },
];

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

// ── Branding block ────────────────────────────────────────────────────────────

function Branding({ light }: { light?: boolean }) {
  const sub = light ? "rgba(255,255,255,0.75)" : "rgba(80,60,40,0.45)";
  const main = light ? "#ffffff" : "#1a1008";
  return (
    <div style={{ textAlign: "center", pointerEvents: "none" }}>
      <p style={{
        fontFamily: "var(--font-display, sans-serif)",
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: sub,
        marginBottom: 4,
      }}>
        Welcome to
      </p>
      <p style={{
        fontFamily: "var(--font-display, sans-serif)",
        fontWeight: 900,
        fontSize: 32,
        letterSpacing: "0.01em",
        textTransform: "uppercase",
        lineHeight: 1,
        color: main,
      }}>
        My Digital Pets
      </p>
    </div>
  );
}

// ── Page component ────────────────────────────────────────────────────────────

type Phase = "splash" | "idle" | "walking" | "exiting";

export default function WelcomePage({ onEnter }: Props) {
  const [phase, setPhase] = useState<Phase>("splash");

  // Auto-advance from hero splash → paw animation after 2.5 s
  useEffect(() => {
    if (phase !== "splash") return;
    const t = setTimeout(() => setPhase("idle"), 2500);
    return () => clearTimeout(t);
  }, [phase]);

  const handleEnter = useCallback(() => {
    if (phase !== "idle") return;
    setPhase("walking");
    setTimeout(() => setPhase("exiting"), 750);
    setTimeout(onEnter, 1400);
  }, [phase, onEnter]);

  const showWalk   = phase === "walking" || phase === "exiting";
  const showButton = phase === "idle";
  const isSplash   = phase === "splash";

  return (
    <motion.div
      animate={{ opacity: phase === "exiting" ? 0 : 1 }}
      transition={{ duration: 0.65, ease: "easeInOut" }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: isSplash ? "#000" : "#ffffff",
        overflow: "hidden",
      }}
    >

      {/* ── Phase 1: Hero image ── */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: isSplash ? 1 : 0 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        style={{ position: "absolute", inset: 0, zIndex: 1 }}
      >
        <img
          src="/hero-pets.png"
          alt="My Digital Pets"
          draggable={false}
          style={{
            width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "top center",
            display: "block",
          }}
        />
        {/* Gradient for text legibility */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.18) 40%, transparent 65%)",
        }} />
        {/* Branding over hero */}
        <div style={{
          position: "absolute",
          bottom: "calc(env(safe-area-inset-bottom) + 72px)",
          left: 0, right: 0,
          display: "flex", justifyContent: "center",
        }}>
          <Branding light />
        </div>
      </motion.div>

      {/* ── Phase 2: Paw trail ── */}
      {IDLE_PAWS.map((paw, i) => (
        <PawMark key={`idle-${i}`} paw={paw} visible={!isSplash} />
      ))}
      {WALK_PAWS.map((paw, i) => (
        <PawMark key={`walk-${i}`} paw={paw} visible={showWalk} />
      ))}

      {/* ── Phase 2: Branding + button (white screen) ── */}
      <motion.div
        animate={{ opacity: isSplash ? 0 : 1 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        style={{
          position: "absolute",
          bottom: "calc(env(safe-area-inset-bottom) + 44px)",
          left: 0, right: 0,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
          zIndex: 10,
          pointerEvents: isSplash ? "none" : "auto",
        }}
      >
        <Branding />

        {/* Button */}
        <motion.div
          animate={{ opacity: showButton ? 1 : 0, y: showButton ? 0 : 10 }}
          transition={{ duration: 0.3, ease: "easeIn" }}
          style={{ pointerEvents: showButton ? "auto" : "none" }}
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
        </motion.div>

        {/* Links */}
        <motion.div
          animate={{ opacity: showButton ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          style={{ display: "flex", gap: 20 }}
        >
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
        </motion.div>
      </motion.div>

    </motion.div>
  );
}
