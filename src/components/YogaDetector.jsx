import { useEffect, useRef, useState, useCallback } from "react";
import { Pose } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";

// ─── Geometry helpers ─────────────────────────────────────────────────────

/** Angle at point B in the A-B-C triangle, in degrees */
function angleBetween(A, B, C) {
  const ABx = A.x - B.x, ABy = A.y - B.y;
  const CBx = C.x - B.x, CBy = C.y - B.y;
  const dot  = ABx * CBx + ABy * CBy;
  const magAB = Math.sqrt(ABx ** 2 + ABy ** 2);
  const magCB = Math.sqrt(CBx ** 2 + CBy ** 2);
  if (magAB === 0 || magCB === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / (magAB * magCB)))) * (180 / Math.PI);
}

/** Straight-line distance between two normalised landmarks */
function dist(A, B) {
  return Math.sqrt((A.x - B.x) ** 2 + (A.y - B.y) ** 2);
}

// ─── Pose definitions ─────────────────────────────────────────────────────
//
// Each pose returns { match: bool, feedback: string, score: 0-100 }
// lm = results.poseLandmarks array
//
// MediaPipe landmark indices used:
//  11/12 = shoulders  13/14 = elbows  15/16 = wrists
//  23/24 = hips       25/26 = knees   27/28 = ankles

function detectMountain(lm) {
  // Both legs straight (knee angle ~170°), shoulders level, arms at sides
  const leftKnee  = angleBetween(lm[23], lm[25], lm[27]);
  const rightKnee = angleBetween(lm[24], lm[26], lm[28]);
  const shoulderDiff = Math.abs(lm[11].y - lm[12].y);
  const hipDiff      = Math.abs(lm[23].y - lm[24].y);

  const legsStr  = leftKnee > 160 && rightKnee > 160;
  const levelBody = shoulderDiff < 0.04 && hipDiff < 0.04;

  let score = 0;
  let feedback = [];

  if (legsStr)  score += 50; else feedback.push("Straighten both legs");
  if (levelBody) score += 50; else feedback.push("Level your shoulders and hips");

  return {
    match: score >= 80,
    score,
    feedback: feedback.length ? feedback.join(" · ") : "Perfect Mountain Pose!",
  };
}

function detectChair(lm) {
  // Knees bent ~90°, torso leaning forward, arms raised
  const leftKnee  = angleBetween(lm[23], lm[25], lm[27]);
  const rightKnee = angleBetween(lm[24], lm[26], lm[28]);
  const leftElbow  = angleBetween(lm[11], lm[13], lm[15]);
  const rightElbow = angleBetween(lm[12], lm[14], lm[16]);

  const kneesGood  = leftKnee > 70  && leftKnee < 120  && rightKnee > 70  && rightKnee < 120;
  const armsRaised = lm[15].y < lm[11].y && lm[16].y < lm[12].y; // wrists above shoulders
  const armsStr    = leftElbow > 150 && rightElbow > 150;

  let score = 0;
  let feedback = [];

  if (kneesGood)  score += 40; else feedback.push(`Bend knees to ~90° (L:${Math.round(leftKnee)}° R:${Math.round(rightKnee)}°)`);
  if (armsRaised) score += 30; else feedback.push("Raise arms above shoulders");
  if (armsStr)    score += 30; else feedback.push("Straighten arms overhead");

  return {
    match: score >= 70,
    score,
    feedback: feedback.length ? feedback.join(" · ") : "Perfect Chair Pose!",
  };
}

function detectTree(lm) {
  // One leg straight, other knee bent outward (hip abducted)
  // Standing foot flat, raised knee points to side
  const leftKnee  = angleBetween(lm[23], lm[25], lm[27]);
  const rightKnee = angleBetween(lm[24], lm[26], lm[28]);

  // One leg near straight (>150°), other bent (<120°)
  const leftStanding  = leftKnee  > 150 && rightKnee < 120;
  const rightStanding = rightKnee > 150 && leftKnee  < 120;
  const oneLegged = leftStanding || rightStanding;

  // Raised knee should be wider than hip (knee.x outside hip.x)
  const bentSide = leftKnee < rightKnee ? "left" : "right";
  const bentKnee = bentSide === "left" ? lm[25] : lm[26];
  const bentHip  = bentSide === "left" ? lm[23] : lm[24];
  const kneeAbducted = Math.abs(bentKnee.x - bentHip.x) > 0.05;

  // Arms: either at heart centre or raised
  const handsClose = dist(lm[15], lm[16]) < 0.08;
  const handsRaised = lm[15].y < lm[11].y && lm[16].y < lm[12].y;
  const armsOk = handsClose || handsRaised;

  let score = 0;
  let feedback = [];

  if (oneLegged)    score += 40; else feedback.push("Lift one foot — bend knee to the side");
  if (kneeAbducted) score += 30; else feedback.push("Open the bent knee outward");
  if (armsOk)       score += 30; else feedback.push("Bring hands to heart or raise overhead");

  return {
    match: score >= 70,
    score,
    feedback: feedback.length ? feedback.join(" · ") : "Perfect Tree Pose!",
  };
}

const POSES = {
  mountain: { name: "Mountain",  emoji: "🏔", detect: detectMountain },
  chair:    { name: "Chair",     emoji: "🪑", detect: detectChair    },
  tree:     { name: "Tree",      emoji: "🌳", detect: detectTree     },
};

// ─── Component ───────────────────────────────────────────────────────────

const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
  @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes scoreFlash { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:#080c12; }
`;

function AngleArc({ score, label }) {
  const r = 36, circ = Math.PI * r; // half circle
  const fill = (score / 100) * circ;
  const color = score > 75 ? "#34d399" : score > 40 ? "#fbbf24" : "#f87171";
  return (
    <svg width={88} height={52} style={{ display: "block" }}>
      <path d={`M8,44 A${r},${r} 0 0,1 80,44`} fill="none" stroke="#1e293b" strokeWidth={8} />
      <path d={`M8,44 A${r},${r} 0 0,1 80,44`} fill="none" stroke={color} strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={`${fill} ${circ}`}
        style={{ transition: "stroke-dasharray 0.5s ease, stroke 0.3s ease" }} />
      <text x={44} y={42} textAnchor="middle"
        style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 800, fill: color }}>
        {score}
      </text>
      <text x={44} y={52} textAnchor="middle"
        style={{ fontFamily: "'DM Mono',monospace", fontSize: 8, fill: "#475569", letterSpacing: 0.5 }}>
        {label}
      </text>
    </svg>
  );
}

export default function YogaDetector() {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);

  const [selectedPose, setSelectedPose] = useState("mountain");
  const [result, setResult] = useState({ match: false, score: 0, feedback: "Select a pose and get into position." });
  const [holdTime, setHoldTime] = useState(0);
  const [bestHold, setBestHold] = useState(0);

  const holdStart  = useRef(null);
  const holdTimer  = useRef(null);
  const lastResult = useRef(null);

  // Draw skeleton lines on canvas
  const drawSkeleton = useCallback((ctx, lm, W, H, color) => {
    const connections = [
      [11,12],[11,13],[13,15],[12,14],[14,16],
      [11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],
    ];
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    connections.forEach(([a, b]) => {
      if (lm[a].visibility > 0.4 && lm[b].visibility > 0.4) {
        ctx.beginPath();
        ctx.moveTo(lm[a].x * W, lm[a].y * H);
        ctx.lineTo(lm[b].x * W, lm[b].y * H);
        ctx.stroke();
      }
    });
    // Dots on key joints
    [11,12,13,14,15,16,23,24,25,26,27,28].forEach((i) => {
      if (lm[i].visibility > 0.4) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(lm[i].x * W, lm[i].y * H, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, []);

  useEffect(() => {
    if (!document.getElementById("yoga-styles")) {
      const tag = document.createElement("style");
      tag.id = "yoga-styles";
      tag.textContent = GLOBAL_STYLE;
      document.head.appendChild(tag);
    }
  }, []);

  useEffect(() => {
    if (!videoRef.current) return;

    const pose = new Pose({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`,
    });
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    const ctx = canvasRef.current.getContext("2d");

    pose.onResults((results) => {
      if (!results.poseLandmarks) return;
      const lm = results.poseLandmarks;

      const detector = POSES[selectedPose]?.detect;
      if (!detector) return;

      const res = detector(lm);
      setResult(res);
      lastResult.current = res;

      // Hold timer
      if (res.match) {
        if (!holdStart.current) holdStart.current = Date.now();
      } else {
        if (holdStart.current) {
          const held = (Date.now() - holdStart.current) / 1000;
          setBestHold((b) => Math.max(b, held));
          holdStart.current = null;
          setHoldTime(0);
        }
      }

      // Canvas
      const W = canvasRef.current.width;
      const H = canvasRef.current.height;
      ctx.save();
      ctx.clearRect(0, 0, W, H);
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
      const col = res.match ? "rgba(52,211,153,0.9)" : "rgba(251,191,36,0.85)";
      drawSkeleton(ctx, lm, W, H, col);
      ctx.restore();
    });

    // Hold time tick
    holdTimer.current = setInterval(() => {
      if (holdStart.current) {
        setHoldTime(Math.floor((Date.now() - holdStart.current) / 1000));
      }
    }, 500);

    const camera = new Camera(videoRef.current, {
      onFrame: async () => { await pose.send({ image: videoRef.current }); },
      width: 640, height: 480,
    });
    camera.start();

    return () => {
      camera.stop();
      clearInterval(holdTimer.current);
    };
  }, [selectedPose, drawSkeleton]);

  const pose = POSES[selectedPose];

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.logo}>
          <span style={S.logoMark}>A</span>
          <span style={S.logoText}>ArogyaMind — Yoga</span>
        </div>
        <div style={{
          ...S.statusPill,
          background: result.match ? "rgba(52,211,153,0.12)" : "rgba(251,191,36,0.1)",
          borderColor: result.match ? "rgba(52,211,153,0.4)" : "rgba(251,191,36,0.3)",
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", display: "inline-block", background: result.match ? "#34d399" : "#fbbf24", boxShadow: result.match ? "0 0 6px #34d399" : "0 0 6px #fbbf24" }} />
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: result.match ? "#6ee7b7" : "#fde68a" }}>
            {result.match ? `${pose.emoji} POSE MATCHED` : "GET INTO POSITION"}
          </span>
        </div>
      </header>

      <main style={S.main}>
        {/* Camera */}
        <div style={S.cameraCard}>
          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden" }}>
            <video ref={videoRef} autoPlay playsInline width={640} height={480} style={S.video} />
            <canvas ref={canvasRef} width={640} height={480} style={S.canvas} />
            <div style={S.vignette} />
            {/* Hold timer overlay */}
            {result.match && (
              <div style={S.holdOverlay}>
                <span style={S.holdSec}>{holdTime}s</span>
                <span style={S.holdLabel}>HOLDING</span>
              </div>
            )}
          </div>
          {/* Feedback bar */}
          <div style={{ ...S.feedbackBar, borderColor: result.match ? "rgba(52,211,153,0.2)" : "rgba(251,191,36,0.2)" }}>
            <span style={{ fontSize: 13, color: result.match ? "#6ee7b7" : "#fde68a", fontFamily: "'DM Mono',monospace" }}>
              {result.feedback}
            </span>
          </div>
        </div>

        {/* Side panel */}
        <aside style={S.panel}>
          {/* Pose selector */}
          <div style={S.panelCard}>
            <p style={S.panelLabel}>SELECT POSE</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {Object.entries(POSES).map(([key, p]) => (
                <button key={key}
                  onClick={() => { setSelectedPose(key); setHoldTime(0); holdStart.current = null; }}
                  style={{
                    ...S.poseBtn,
                    background: selectedPose === key ? "rgba(52,211,153,0.1)" : "transparent",
                    borderColor: selectedPose === key ? "rgba(52,211,153,0.5)" : "#1e293b",
                    color: selectedPose === key ? "#34d399" : "#64748b",
                  }}>
                  {p.emoji} {p.name} Pose
                </button>
              ))}
            </div>
          </div>

          {/* Score */}
          <div style={S.panelCard}>
            <p style={S.panelLabel}>POSE SCORE</p>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
              <AngleArc score={result.score} label="ACCURACY" />
            </div>
            {/* Score bar */}
            <div style={{ marginTop: 12 }}>
              <div style={S.barTrack}>
                <div style={{ ...S.barFill, width: `${result.score}%`, background: result.score > 75 ? "linear-gradient(90deg,#34d399,#0ea5e9)" : result.score > 40 ? "linear-gradient(90deg,#fbbf24,#f59e0b)" : "linear-gradient(90deg,#f87171,#ef4444)" }} />
              </div>
            </div>
          </div>

          {/* Hold stats */}
          <div style={S.panelCard}>
            <p style={S.panelLabel}>HOLD TIME</p>
            <div style={S.statRow}>
              <span style={S.statLabel}>Current hold</span>
              <span style={{ ...S.statVal, color: result.match ? "#34d399" : "#475569" }}>{result.match ? `${holdTime}s` : "—"}</span>
            </div>
            <div style={S.statRow}>
              <span style={S.statLabel}>Best hold</span>
              <span style={{ ...S.statVal, color: "#60a5fa" }}>{bestHold > 0 ? `${Math.round(bestHold)}s` : "—"}</span>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

const S = {
  page: { minHeight: "100vh", background: "#080c12", color: "#e2e8f0", fontFamily: "'DM Mono',monospace", padding: "0 0 48px" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", borderBottom: "1px solid #0f172a" },
  logo: { display: "flex", alignItems: "center", gap: 10 },
  logoMark: { width: 32, height: 32, background: "linear-gradient(135deg, #34d399, #0ea5e9)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: "#080c12", lineHeight: "32px", textAlign: "center" },
  logoText: { fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, color: "#f1f5f9" },
  statusPill: { display: "flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 999, border: "1px solid", transition: "all 0.4s ease" },
  main: { display: "flex", gap: 24, padding: "28px 32px", alignItems: "flex-start", flexWrap: "wrap" },
  cameraCard: { flex: "1 1 520px", background: "#0d1117", borderRadius: 20, border: "1px solid #1e293b", overflow: "hidden", animation: "fadeUp 0.5s ease" },
  video: { width: "100%", height: 380, objectFit: "cover", display: "block", transform: "scaleX(-1)" },
  canvas: { position: "absolute", top: 0, left: 0, width: "100%", height: 380 },
  vignette: { position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 55%, rgba(8,12,18,0.6) 100%)", pointerEvents: "none" },
  holdOverlay: { position: "absolute", bottom: 12, right: 16, display: "flex", flexDirection: "column", alignItems: "center", background: "rgba(8,12,18,0.7)", padding: "8px 14px", borderRadius: 12, backdropFilter: "blur(6px)", border: "1px solid rgba(52,211,153,0.3)" },
  holdSec: { fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 28, color: "#34d399" },
  holdLabel: { fontFamily: "'DM Mono',monospace", fontSize: 9, color: "#34d399", letterSpacing: 2 },
  feedbackBar: { padding: "14px 18px", borderTop: "1px solid", transition: "border-color 0.4s" },
  panel: { flex: "0 0 220px", display: "flex", flexDirection: "column", gap: 16 },
  panelCard: { background: "#0d1117", border: "1px solid #1e293b", borderRadius: 16, padding: "16px 18px" },
  panelLabel: { fontSize: 10, letterSpacing: 2, color: "#475569", fontFamily: "'DM Mono',monospace", marginBottom: 4 },
  poseBtn: { padding: "10px 14px", borderRadius: 10, border: "1px solid", cursor: "pointer", fontSize: 13, fontFamily: "'DM Mono',monospace", textAlign: "left", transition: "all 0.2s" },
  statRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  statLabel: { fontSize: 12, color: "#64748b" },
  statVal: { fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 500 },
  barTrack: { height: 5, background: "#1e293b", borderRadius: 999, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 999, transition: "width 0.5s ease, background 0.4s ease" },
};