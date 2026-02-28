import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { THEME, GLOBAL_STYLE } from "./theme.js";

const FEATURES = [
  {
    route: "/posture",
    icon: "🧍",
    title: "Posture Detector",
    sanskrit: "Āsana Rakṣaṇa",
    desc: "Real-time posture analysis using your camera. Get instant feedback and correct your alignment before fatigue sets in.",
    color: THEME.green,
    colorBright: THEME.greenBright,
    tag: "Live Camera",
  },
  {
    route: "/yoga",
    icon: "🙏",
    title: "Yoga Detector",
    sanskrit: "Yoga Abhyāsa",
    desc: "Follow guided yoga poses with live accuracy scoring. Hold your pose and earn streaks as your form improves.",
    color: THEME.blue,
    colorBright: "#7aafc8",
    tag: "Guided Practice",
  },
  {
    route: "/ddf",
    icon: "⚖️",
    title: "Dharmic Decision",
    sanskrit: "Dharma Vicāra",
    desc: "Navigate high-stakes decisions through an ethical reasoning framework rooted in ancient dharmic principles.",
    color: THEME.amber,
    colorBright: "#e0a860",
    tag: "Decision Tool",
  },
  {
    route: "/planner",
    icon: "🌿",
    title: "Dinacharya Planner",
    sanskrit: "Dinacharya Niyojana",
    desc: "Energy-aware daily scheduling built on Ayurvedic dosha phases. Work with your biology, not against it.",
    color: THEME.goldDim,
    colorBright: THEME.gold,
    tag: "Daily Planner",
  },
];

function FeatureCard({ feature, index }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => navigate(feature.route)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? feature.color + "12" : THEME.bgCard,
        border: `1.5px solid ${hovered ? feature.color : THEME.border}`,
        borderRadius: "16px",
        padding: "32px 28px",
        cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.34,1.2,0.64,1)",
        transform: hovered ? "translateY(-6px)" : "translateY(0)",
        boxShadow: hovered
          ? `0 16px 40px ${feature.color}25, 0 2px 8px rgba(0,0,0,0.06)`
          : "0 2px 12px rgba(74,63,47,0.07)",
        animation: `fadeUp 0.5s ease forwards`,
        animationDelay: `${index * 0.1}s`,
        opacity: 0,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative corner */}
      <div style={{
        position: "absolute", top: 0, right: 0,
        width: "80px", height: "80px",
        background: `radial-gradient(circle at top right, ${feature.color}18, transparent 70%)`,
        borderRadius: "0 16px 0 80px",
      }} />

      {/* Tag */}
      <div style={{
        display: "inline-block", marginBottom: "16px",
        padding: "3px 10px", borderRadius: "20px",
        background: feature.color + "18",
        border: `1px solid ${feature.color}40`,
        fontSize: "10px", fontFamily: "'Cinzel', serif",
        fontWeight: "600", letterSpacing: "0.12em",
        color: feature.color, textTransform: "uppercase",
      }}>
        {feature.tag}
      </div>

      {/* Icon */}
      <div style={{
        fontSize: "36px", marginBottom: "14px",
        filter: hovered ? "none" : "grayscale(20%)",
        transition: "filter 0.3s",
      }}>
        {feature.icon}
      </div>

      {/* Title */}
      <h3 style={{
        fontFamily: "'Cinzel', serif", fontWeight: "700",
        fontSize: "18px", color: THEME.cream,
        marginBottom: "4px", letterSpacing: "0.04em",
      }}>
        {feature.title}
      </h3>

      {/* Sanskrit */}
      <p style={{
        fontFamily: "'IM Fell English', serif", fontStyle: "italic",
        fontSize: "13px", color: feature.color,
        marginBottom: "14px", letterSpacing: "0.02em",
      }}>
        {feature.sanskrit}
      </p>

      {/* Divider */}
      <div style={{
        width: hovered ? "48px" : "32px", height: "1.5px",
        background: `linear-gradient(90deg, ${feature.color}, transparent)`,
        marginBottom: "14px", transition: "width 0.3s",
      }} />

      {/* Description */}
      <p style={{
        fontFamily: "'IM Fell English', serif",
        fontSize: "14.5px", lineHeight: "1.7",
        color: THEME.creamDim,
      }}>
        {feature.desc}
      </p>

      {/* Arrow */}
      <div style={{
        marginTop: "20px", display: "flex", alignItems: "center", gap: "6px",
        color: feature.color, fontSize: "13px",
        fontFamily: "'Cinzel', serif", fontWeight: "600",
        letterSpacing: "0.08em",
        opacity: hovered ? 1 : 0.5,
        transition: "opacity 0.3s, transform 0.3s",
        transform: hovered ? "translateX(4px)" : "translateX(0)",
      }}>
        Enter <span style={{ fontSize: "16px" }}>→</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 50);
  }, []);

  return (
    <>
      <style>{`
        ${GLOBAL_STYLE}
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-8px); }
        }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: THEME.bg,
        backgroundImage: `
          radial-gradient(ellipse at 15% 20%, ${THEME.gold}18 0%, transparent 45%),
          radial-gradient(ellipse at 85% 80%, ${THEME.green}12 0%, transparent 40%),
          radial-gradient(ellipse at 50% 50%, ${THEME.blue}08 0%, transparent 60%)
        `,
      }}>

        {/* ── Hero ── */}
        <div style={{
          maxWidth: "900px", margin: "0 auto",
          padding: "80px 32px 60px",
          textAlign: "center",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.8s cubic-bezier(0.34,1.2,0.64,1)",
        }}>

          {/* Emblem */}
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "72px", height: "72px", borderRadius: "50%",
            background: `radial-gradient(circle, ${THEME.gold}30, ${THEME.gold}08)`,
            border: `2px solid ${THEME.border}`,
            marginBottom: "28px",
            animation: "float 4s ease-in-out infinite",
            boxShadow: `0 0 32px ${THEME.gold}30`,
            fontSize: "28px",
          }}>
            ☀️
          </div>

          {/* Eyebrow */}
          <div style={{
            fontFamily: "'Cinzel', serif", fontSize: "11px",
            letterSpacing: "0.22em", textTransform: "uppercase",
            color: THEME.goldDim, marginBottom: "16px",
          }}>
            Ancient Wisdom · Modern Practice
          </div>

          {/* Main title */}
          <h1 style={{
            fontFamily: "'Cinzel', serif", fontWeight: "700",
            fontSize: "clamp(42px, 7vw, 72px)",
            letterSpacing: "0.06em",
            background: `linear-gradient(135deg, ${THEME.cream} 30%, ${THEME.gold} 60%, ${THEME.cream} 80%)`,
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            animation: "shimmer 4s linear infinite",
            marginBottom: "12px", lineHeight: 1.1,
          }}>
            ArogyaMind
          </h1>

          {/* Sanskrit tagline */}
          <p style={{
            fontFamily: "'IM Fell English', serif", fontStyle: "italic",
            fontSize: "18px", color: THEME.gold,
            marginBottom: "20px", letterSpacing: "0.04em",
          }}>
            "Ārogya · Manas · Dharma"
          </p>

          {/* Subtitle */}
          <p style={{
            fontFamily: "'IM Fell English', serif",
            fontSize: "17px", lineHeight: "1.8",
            color: THEME.creamDim, maxWidth: "560px",
            margin: "0 auto 20px",
          }}>
            A unified platform for mindful living — aligning your posture, movement,
            decisions, and daily rhythm through the lens of Ayurvedic wisdom.
          </p>

          {/* Decorative rule */}
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "center", gap: "16px",
            margin: "32px auto", maxWidth: "300px",
          }}>
            <div style={{ flex: 1, height: "1px", background: `linear-gradient(90deg, transparent, ${THEME.border})` }} />
            <span style={{ color: THEME.gold, fontSize: "18px" }}>✦</span>
            <div style={{ flex: 1, height: "1px", background: `linear-gradient(90deg, ${THEME.border}, transparent)` }} />
          </div>
        </div>

        {/* ── Feature Cards ── */}
        <div style={{
          maxWidth: "1100px", margin: "0 auto",
          padding: "0 32px 100px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "24px",
        }}>
          {FEATURES.map((feature, i) => (
            <FeatureCard key={feature.route} feature={feature} index={i} />
          ))}
        </div>

        {/* ── Footer quote ── */}
        <div style={{
          textAlign: "center", padding: "0 32px 60px",
          borderTop: `1px solid ${THEME.borderLight}40`,
          paddingTop: "40px",
        }}>
          <p style={{
            fontFamily: "'IM Fell English', serif", fontStyle: "italic",
            fontSize: "15px", color: THEME.creamFaint,
            letterSpacing: "0.04em",
          }}>
            "Swastha — rooted in oneself, whole in body and mind."
          </p>
        </div>

      </div>
    </>
  );
}



