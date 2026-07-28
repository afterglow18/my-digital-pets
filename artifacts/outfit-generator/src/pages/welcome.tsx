/**
 * WelcomePage — hero screen with animated paw print trail.
 *
 * Idle:    paw prints walk in from the bottom and settle.
 * On tap:  paws continue walking up toward the hero image, then the screen
 *          fades out into the wardrobe.
 */
import { useState, useCallback } from "react";
import { motion } from "framer-motion";

interface Props { onEnter: () => void; }

// ── Paw print SVG ─────────────────────────────────────────────────────────────

function PawSVG({ size = 28, color = "rgba(101,67,33,0.50)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Main central pad */}
      <ellipse cx="16" cy="22" rx="6"   ry="5"   fill={color} />
      {/* Four toe pads */}
      <ellipse cx="8"  cy="14" rx="3.2" ry="2.6" fill={color} />
      <ellipse cx="24" cy="14" rx="3.2" ry="2.6" fill={color} />
      <ellipse cx="11" cy="9"  rx="3"   ry="2.4" fill={color} />
      <ellipse cx="21" cy="9"  rx="3"   ry="2.4" fill={color} />
    </svg>
  );
}

// ── Walk trail positions (% of screen) ───────────────────────────────────────
// flip mirrors the paw horizontally for the opposite foot.

type Paw = { x: number; y: number; rot: number; flip: boolean; delay: number };

/** Floor trail — appears on mount */
const IDLE_PAWS: Paw[] = [
  { x: 46, y: 87, rot: -10, flip: false, delay: 0.30 },
  { x: 55, y: 83, rot:  10, flip: true,  delay: 0.55 },
  { x: 44, y: 79, rot:  -8, flip: false, delay: 0.80 },
  { x: 54, y: 75, rot:   8, flip: true,  delay: 1.05 },
  { x: 45, y: 71, rot:  -6, flip: false, delay: 1.30 },
  { x: 53, y: 67, rot:   6, flip: true,  delay: 1.55 },
];

/** Walking-up trail — appears after the button is tapped */
const WALK_PAWS: Paw[] = [
  { x: 44, y: 63, rot:  -4, flip: false, delay: 0.00 },
  { x: 52, y: 59, rot:   4, flip: true,  delay: 0.18 },
  { x: 43, y: 55, rot:  -3, flip: false, delay: 0.36 },
  { x: 51, y: 51, rot:   3, flip: true,  delay: 0.54 },
  { x: 44, y: 47, rot:  -2, flip: false, delay: 0.72 },
  { x: 50, y: 43, rot:   2, flip: true,  delay: 0.90 },
  { x: 45, y: 39, rot:  -1, flip: false, delay: 1.08 },
  { x: 49, y: 35, rot:   1, flip: true,  delay: 1.26 },
  { x: 46, y: 31, rot:   0, flip: false, delay: 1.44 },
  { x: 48, y: 27, rot:   0, flip: true,  delay: 1.60 },
];

// Last walk-paw finishes at ~1.60 + 0.25 = 1.85 s → start exit fade at 2.0 s

// ── Component ─────────────────────────────────────────────────────────────────

export default function WelcomePage({ onEnter }: Props) {
  const [phase, setPhase] = useState<"idle" | "walking" | "exiting">("idle");

  const handleEnter = useCallback(() => {
    if (phase !== "idle") return;
    setPhase("walking");
    setTimeout(() => setPhase("exiting"), 2000);   // start fade-out
    setTimeout(onEnter,                   2700);   // hand off to app
  }, [phase, onEnter]);

  const walking = phase === "walking" || phase === "exiting";

  return (
    <motion.div
      animate={{ opacity: phase === "exiting" ? 0 : 1 }}
      transition={{ duration: 0.7, ease: "easeIn" }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "flex-end",
        overflow: "hidden",
        background: "#f5efe6",
      }}
    >
      {/* Hero image — sits below the Dynamic Island */}
      <img
        src="/hero-pets.png"
        alt="My Digital Pets"
        draggable={false}
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
          zIndex: 0,
        }}
      />

      {/* Bottom gradient so the button reads clearly over the image */}
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        height: "28%",
        background: "linear-gradient(to top, rgba(245,239,230,1) 30%, transparent 100%)",
        pointerEvents: "none",
        zIndex: 2,
      }} />

      {/* ── Idle paw trail ── */}
      {IDLE_PAWS.map((paw, i) => (
        <motion.div
          key={`idle-${i}`}
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: 0.55, scale: 1 }}
          transition={{ delay: paw.delay, duration: 0.28, ease: "easeOut" }}
          style={{
            position: "absolute",
            left: `${paw.x}%`, top: `${paw.y}%`,
            transform: `translate(-50%, -50%) rotate(${paw.rot}deg)${paw.flip ? " scaleX(-1)" : ""}`,
            zIndex: 3,
            pointerEvents: "none",
          }}
        >
          <PawSVG />
        </motion.div>
      ))}

      {/* ── Walking-up paw trail (revealed on tap) ── */}
      {WALK_PAWS.map((paw, i) => (
        <motion.div
          key={`walk-${i}`}
          initial={{ opacity: 0, scale: 0.3 }}
          animate={walking
            ? { opacity: 0.55, scale: 1 }
            : { opacity: 0,    scale: 0.3 }}
          transition={{ delay: walking ? paw.delay : 0, duration: 0.28, ease: "easeOut" }}
          style={{
            position: "absolute",
            left: `${paw.x}%`, top: `${paw.y}%`,
            transform: `translate(-50%, -50%) rotate(${paw.rot}deg)${paw.flip ? " scaleX(-1)" : ""}`,
            zIndex: 3,
            pointerEvents: "none",
          }}
        >
          <PawSVG />
        </motion.div>
      ))}

      {/* ── CTA + footer ── */}
      <div style={{
        position: "relative", zIndex: 10,
        width: "100%",
        display: "flex", flexDirection: "column", alignItems: "center",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 28px)",
      }}>
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
            pointerEvents: phase === "idle" ? "auto" : "none",
          }}
        >
          Get Started ✨
        </motion.button>

        <div style={{ marginTop: 18, display: "flex", gap: 20 }}>
          <a
            href="https://classy-alpaca-441.notion.site/Privacy-Policy-39682db6065380b19dedcb108d4a0ef4"
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, fontWeight: 500, color: "rgba(80,60,40,0.45)", textDecoration: "none", letterSpacing: "0.02em" }}
          >Privacy Policy</a>
          <a
            href="https://app.notion.com/p/My-Digital-Closet-Support-39782db60653802a9088dcbae84c0527?source=copy_link"
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, fontWeight: 500, color: "rgba(80,60,40,0.45)", textDecoration: "none", letterSpacing: "0.02em" }}
          >Support</a>
        </div>
      </div>
    </motion.div>
  );
}
