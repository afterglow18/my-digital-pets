/**
 * WelcomePage — static hero screen using the pets shelf image.
 * Tapping "Get Started" fades out and calls onEnter().
 */
import { useState, useCallback } from "react";
import { motion } from "framer-motion";

interface Props { onEnter: () => void; }

export default function WelcomePage({ onEnter }: Props) {
  const [exiting, setExiting] = useState(false);

  const handleEnter = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setTimeout(onEnter, 500);
  }, [exiting, onEnter]);

  return (
    <motion.div
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.5, ease: "easeIn" }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "flex-end",
        overflow: "hidden",
        background: "#f5efe6",
      }}
    >
      {/* Hero image — fills the screen, anchored to top */}
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
        }}
      />

      {/* Bottom fade so button sits on a readable surface */}
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        height: "22%",
        background: "linear-gradient(to top, rgba(245,239,230,0.98) 40%, transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* CTA + footer */}
      <div style={{
        position: "relative", zIndex: 4,
        width: "100%",
        display: "flex", flexDirection: "column", alignItems: "center",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 28px)",
        gap: 0,
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
            pointerEvents: exiting ? "none" : "auto",
          }}
        >
          Get Started ✨
        </motion.button>

        {/* Footer links */}
        <div style={{
          marginTop: 18,
          display: "flex", gap: 20,
        }}>
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
