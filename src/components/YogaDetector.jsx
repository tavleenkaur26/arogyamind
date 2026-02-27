import { useEffect, useRef, useState, useCallback } from "react";
import { Pose } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";
import { THEME, GLOBAL_STYLE, LABELS } from "./theme";

// ─── Geometry ─────────────────────────────────────────────────────────────
function angleBetween(A, B, C) {
  const ABx = A.x - B.x, ABy = A.y - B.y;
  const CBx = C.x - B.x, CBy = C.y - B.y;
  const dot = ABx * CBx + ABy * CBy;
  const mag = Math.sqrt(ABx**2+ABy**2) * Math.sqrt(CBx**2+CBy**2);
  if (mag === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * (180 / Math.PI);
}
function dist(A, B) { return Math.sqrt((A.x-B.x)**2 + (A.y-B.y)**2); }

// ─── Pose detectors ───────────────────────────────────────────────────────
function detectMountain(lm) {
  const lK = angleBetween(lm[23], lm[25], lm[27]);
  const rK = angleBetween(lm[24], lm[26], lm[28]);
  const sD = Math.abs(lm[11].y - lm[12].y);
  const hD = Math.abs(lm[23].y - lm[24].y);
  const legs  = lK > 160 && rK > 160;
  const level = sD < 0.04 && hD < 0.04;
  let score = 0, fb = [];
  if (legs)  score += 50; else fb.push(`Straighten legs (L:${Math.round(lK)}° R:${Math.round(rK)}°)`);
  if (level) score += 50; else fb.push("Level shoulders & hips");
  return { match: score >= 80, score, feedback: fb.length ? fb.join(" · ") : "Perfect Mountain Pose!" };
}
function detectChair(lm) {
  const lK = angleBetween(lm[23], lm[25], lm[27]);
  const rK = angleBetween(lm[24], lm[26], lm[28]);
  const lE = angleBetween(lm[11], lm[13], lm[15]);
  const rE = angleBetween(lm[12], lm[14], lm[16]);
  const knees = lK > 70 && lK < 120 && rK > 70 && rK < 120;
  const arms  = lm[15].y < lm[11].y && lm[16].y < lm[12].y;
  const str   = lE > 150 && rE > 150;
  let score = 0, fb = [];
  if (knees) score += 40; else fb.push(`Bend knees ~90° (L:${Math.round(lK)}° R:${Math.round(rK)}°)`);
  if (arms)  score += 30; else fb.push("Raise arms above shoulders");
  if (str)   score += 30; else fb.push("Straighten arms overhead");
  return { match: score >= 70, score, feedback: fb.length ? fb.join(" · ") : "Perfect Chair Pose!" };
}
function detectTree(lm) {
  const lK = angleBetween(lm[23], lm[25], lm[27]);
  const rK = angleBetween(lm[24], lm[26], lm[28]);
  const oneLegged = (lK > 150 && rK < 120) || (rK > 150 && lK < 120);
  const bentSide  = lK < rK ? "left" : "right";
  const bentKnee  = bentSide === "left" ? lm[25] : lm[26];
  const bentHip   = bentSide === "left" ? lm[23] : lm[24];
  const abducted  = Math.abs(bentKnee.x - bentHip.x) > 0.05;
  const handsOk   = dist(lm[15], lm[16]) < 0.08 || (lm[15].y < lm[11].y && lm[16].y < lm[12].y);
  let score = 0, fb = [];
  if (oneLegged) score += 40; else fb.push("Lift one foot — bend knee to side");
  if (abducted)  score += 30; else fb.push("Open bent knee outward");
  if (handsOk)   score += 30; else fb.push("Bring hands to heart or raise overhead");
  return { match: score >= 70, score, feedback: fb.length ? fb.join(" · ") : "Perfect Tree Pose!" };
}

const POSES = {
  mountain: { nameEn: "Mountain", nameSa: LABELS.mountain, sutra: "स्थिरता का आसन", emoji: "🏔", detect: detectMountain },
  chair:    { nameEn: "Chair",    nameSa: LABELS.chair,    sutra: "शक्ति का आसन",  emoji: "🪑", detect: detectChair    },
  tree:     { nameEn: "Tree",     nameSa: LABELS.tree,     sutra: "संतुलन का आसन", emoji: "🌳", detect: detectTree     },
};

// ─── Semicircle accuracy gauge ────────────────────────────────────────────
function AccuracyGauge({ score }) {
  const r = 40, circ = Math.PI * r;
  const color = score > 75 ? THEME.green : score > 40 ? THEME.amber : THEME.red;
  const brightColor = score > 75 ? THEME.greenBright : score > 40 ? THEME.goldBright : THEME.redBright;
  return (
    <svg width={96} height={58} style={{ display: "block" }}>
      {/* Decorative ticks */}
      {[0, 45, 90, 135, 180].map((deg) => {
        const rad = (deg + 180) * Math.PI / 180;
        const x1 = 48 + (r+4) * Math.cos(rad), y1 = 52 + (r+4) * Math.sin(rad);
        const x2 = 48 + (r+9) * Math.cos(rad), y2 = 52 + (r+9) * Math.sin(rad);
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={THEME.goldDim} strokeWidth={1} />;
      })}
      {/* Track */}
      <path d={`M8,52 A${r},${r} 0 0,1 88,52`} fill="none" stroke={THEME.bgCardAlt} strokeWidth={8} />
      {/* Fill */}
      <path d={`M8,52 A${r},${r} 0 0,1 88,52`} fill="none" stroke={color} strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * circ} ${circ}`}
        style={{ transition: "stroke-dasharray 0.5s ease, stroke 0.4s ease" }} />
      <text x={48} y={46} textAnchor="middle"
        style={{ fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 16, fill: brightColor }}>
        {score}
      </text>
      <text x={48} y={57} textAnchor="middle"
        style={{ fontFamily: "'Tiro Devanagari Sanskrit',serif", fontSize: 9, fill: THEME.goldDim, letterSpacing: 0.5 }}>
        {LABELS.accuracy}
      </text>
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────
export default function YogaDetector() {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);

  const [selectedPose, setSelectedPose] = useState("mountain");
  const [result, setResult] = useState({ match: false, score: 0, feedback: "Select an āsana and assume the position." });
  const [holdTime, setHoldTime] = useState(0);
  const [bestHold, setBestHold] = useState(0);

  const holdStart  = useRef(null);
  const holdTimer  = useRef(null);

  const drawSkeleton = useCallback((ctx, lm, W, H, color) => {
    const connections = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    connections.forEach(([a, b]) => {
      if (lm[a].visibility > 0.4 && lm[b].visibility > 0.4) {
        ctx.beginPath();
        ctx.moveTo(lm[a].x * W, lm[a].y * H);
        ctx.lineTo(lm[b].x * W, lm[b].y * H);
        ctx.stroke();
      }
    });
    [11,12,13,14,15,16,23,24,25,26,27,28].forEach((i) => {
      if (lm[i].visibility > 0.4) {
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(lm[i].x * W, lm[i].y * H, 4, 0, Math.PI * 2); ctx.fill();
      }
    });
  }, []);

  useEffect(() => {
    if (!document.getElementById("yoga-styles")) {
      const tag = document.createElement("style");
      tag.id = "yoga-styles"; tag.textContent = GLOBAL_STYLE; document.head.appendChild(tag);
    }
  }, []);

  useEffect(() => {
    if (!videoRef.current) return;

    const pose = new Pose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
    pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, enableSegmentation: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

    const ctx = canvasRef.current.getContext("2d");

    pose.onResults((results) => {
      if (!results.poseLandmarks) return;
      const lm = results.poseLandmarks;
      const res = POSES[selectedPose]?.detect(lm);
      if (!res) return;
      setResult(res);

      if (res.match) { if (!holdStart.current) holdStart.current = Date.now(); }
      else {
        if (holdStart.current) {
          setBestHold((b) => Math.max(b, (Date.now() - holdStart.current) / 1000));
          holdStart.current = null; setHoldTime(0);
        }
      }

      const W = canvasRef.current.width, H = canvasRef.current.height;
      ctx.save(); ctx.clearRect(0, 0, W, H); ctx.translate(W, 0); ctx.scale(-1, 1);
      drawSkeleton(ctx, lm, W, H, res.match ? "rgba(126,200,154,0.9)" : "rgba(196,135,58,0.85)");
      ctx.restore();
    });

    holdTimer.current = setInterval(() => {
      if (holdStart.current) setHoldTime(Math.floor((Date.now() - holdStart.current) / 1000));
    }, 500);

    const camera = new Camera(videoRef.current, {
      onFrame: async () => { await pose.send({ image: videoRef.current }); },
      width: 640, height: 480,
    });
    camera.start();
    return () => { camera.stop(); clearInterval(holdTimer.current); };
  }, [selectedPose, drawSkeleton]);

  const pose = POSES[selectedPose];

  return (
    <div style={S.page}>
      {/* Header */}
      <header style={S.header}>
        <div style={S.logoWrap}>
          <span style={S.omSymbol}>ॐ</span>
          <div>
            <div style={S.logoTitle}>ArogyaMind — Yoga</div>
            <div style={S.logoSub}>आरोग्यमन्द् — आसन साधना</div>
          </div>
        </div>
        <div style={{
          ...S.statusCapsule,
          borderColor: result.match ? THEME.green : THEME.amber,
          background: result.match ? `${THEME.green}18` : `${THEME.amber}14`,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", display: "inline-block", background: result.match ? THEME.greenBright : THEME.gold, boxShadow: `0 0 7px ${result.match ? THEME.greenBright : THEME.gold}` }} />
          <span style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: 1.5, color: result.match ? THEME.greenBright : THEME.goldBright }}>
            {result.match ? `${pose.nameSa} सिद्ध ✦` : "आसन ग्रहण करें"}
          </span>
        </div>
      </header>

      {/* Divider */}
      <div style={S.dividerRow}>
        <div style={S.dividerLine} />
        <span style={S.dividerText}>॥ आसन साधना ॥</span>
        <div style={S.dividerLine} />
      </div>

      <main style={S.main}>
        {/* Camera */}
        <div style={S.cameraCard}>
          {["topLeft","topRight","bottomLeft","bottomRight"].map((pos) => (
            <span key={pos} style={{ ...S.corner, ...S.corners[pos] }}>✦</span>
          ))}

          <div style={{ position: "relative", borderRadius: 2, overflow: "hidden" }}>
            <video ref={videoRef} autoPlay playsInline width={640} height={480} style={S.video} />
            <canvas ref={canvasRef} width={640} height={480} style={S.canvas} />
            <div style={S.vignette} />
            {result.match && (
              <div style={S.holdOverlay}>
                <span style={S.holdSec}>{holdTime}</span>
                <span style={S.holdUnit}>सेकंड</span>
                <span style={S.holdLabel}>धारण</span>
              </div>
            )}
          </div>

          {/* Feedback */}
          <div style={{ ...S.feedbackBar, borderColor: result.match ? `${THEME.green}50` : `${THEME.amber}40` }}>
            <span style={{ fontFamily: "'IM Fell English',serif", fontStyle: "italic", fontSize: 13, color: result.match ? THEME.greenBright : THEME.goldBright }}>
              {result.feedback}
            </span>
          </div>
        </div>

        {/* Panel */}
        <aside style={S.panel}>

          {/* Pose selector */}
          <div style={S.panelCard}>
            <p style={S.panelLabel}>॥ {LABELS.pose} चयन ॥</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {Object.entries(POSES).map(([key, p]) => (
                <button key={key}
                  onClick={() => { setSelectedPose(key); setHoldTime(0); holdStart.current = null; }}
                  style={{
                    ...S.poseBtn,
                    background: selectedPose === key ? `${THEME.green}14` : "transparent",
                    borderColor: selectedPose === key ? THEME.green : THEME.border,
                    color: selectedPose === key ? THEME.greenBright : THEME.creamDim,
                  }}>
                  <span style={{ fontSize: 16 }}>{p.emoji}</span>
                  <div>
                    <div style={{ fontFamily: "'Tiro Devanagari Sanskrit',serif", fontSize: 13 }}>{p.nameSa}</div>
                    <div style={{ fontFamily: "'IM Fell English',serif", fontStyle: "italic", fontSize: 10, opacity: 0.7 }}>{p.sutra}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Score gauge */}
          <div style={S.panelCard}>
            <p style={S.panelLabel}>॥ {LABELS.accuracy} ॥</p>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
              <AccuracyGauge score={result.score} />
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={S.barTrack}>
                <div style={{
                  ...S.barFill,
                  width: `${result.score}%`,
                  background: result.score > 75
                    ? `linear-gradient(90deg,${THEME.green},${THEME.greenBright})`
                    : result.score > 40
                    ? `linear-gradient(90deg,${THEME.goldDim},${THEME.gold})`
                    : `linear-gradient(90deg,${THEME.red},${THEME.redBright})`,
                }} />
              </div>
            </div>
          </div>

          {/* Hold stats */}
          <div style={S.panelCard}>
            <p style={S.panelLabel}>॥ {LABELS.holdTime} ॥</p>
            <div style={S.statRow}>
              <span style={S.statLabel}>वर्तमान धारण</span>
              <span style={{ ...S.statVal, color: result.match ? THEME.greenBright : THEME.creamFaint }}>
                {result.match ? `${holdTime}s` : "—"}
              </span>
            </div>
            <div style={S.statRow}>
              <span style={S.statLabel}>{LABELS.bestHold} धारण</span>
              <span style={{ ...S.statVal, color: THEME.goldBright }}>
                {bestHold > 0 ? `${Math.round(bestHold)}s` : "—"}
              </span>
            </div>
          </div>

        </aside>
      </main>

      <div style={S.dividerRow}>
        <div style={S.dividerLine} />
        <span style={S.dividerText}>॥ स्वस्ति ॥</span>
        <div style={S.dividerLine} />
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh", background: THEME.bg,
    backgroundImage: `radial-gradient(ellipse at 20% 20%, rgba(90,70,20,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(60,40,10,0.2) 0%, transparent 60%)`,
    color: THEME.cream, fontFamily: "'IM Fell English',serif", padding: "0 0 32px",
  },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", borderBottom: `1px solid ${THEME.border}`, background: `linear-gradient(180deg, rgba(40,28,8,0.8) 0%, transparent 100%)` },
  logoWrap: { display: "flex", alignItems: "center", gap: 14 },
  omSymbol: { fontSize: 38, color: THEME.gold, textShadow: `0 0 20px ${THEME.gold}88`, fontFamily: "'Tiro Devanagari Sanskrit',serif", lineHeight: 1 },
  logoTitle: { fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 22, color: THEME.goldBright, letterSpacing: 2, textShadow: `0 0 12px ${THEME.gold}44` },
  logoSub: { fontFamily: "'Tiro Devanagari Sanskrit',serif", fontSize: 12, color: THEME.goldDim, letterSpacing: 1, marginTop: 2 },
  statusCapsule: { display: "flex", alignItems: "center", gap: 8, padding: "7px 16px", borderRadius: 2, border: "1px solid", transition: "all 0.4s ease" },
  dividerRow: { display: "flex", alignItems: "center", gap: 12, padding: "6px 32px" },
  dividerLine: { flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${THEME.goldDim}, transparent)` },
  dividerText: { fontFamily: "'Tiro Devanagari Sanskrit',serif", fontSize: 13, color: THEME.goldDim, whiteSpace: "nowrap", letterSpacing: 3 },
  main: { display: "flex", gap: 24, padding: "20px 32px", alignItems: "flex-start", flexWrap: "wrap" },
  cameraCard: { flex: "1 1 520px", position: "relative", background: THEME.bgCard, borderRadius: 4, border: `1px solid ${THEME.border}`, boxShadow: `0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(201,151,42,0.1)`, overflow: "hidden", animation: "fadeUp 0.6s ease" },
  corner: { position: "absolute", zIndex: 20, color: THEME.gold, fontSize: 14, lineHeight: 1, pointerEvents: "none" },
  corners: { topLeft: { top: 6, left: 8 }, topRight: { top: 6, right: 8 }, bottomLeft: { bottom: 42, left: 8 }, bottomRight: { bottom: 42, right: 8 } },
  video: { width: "100%", height: 380, objectFit: "cover", display: "block", transform: "scaleX(-1)", filter: "sepia(0.12) contrast(1.05)" },
  canvas: { position: "absolute", top: 0, left: 0, width: "100%", height: 380 },
  vignette: { position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(ellipse at center, transparent 50%, rgba(10,8,2,0.7) 100%)`, mixBlendMode: "multiply" },
  holdOverlay: { position: "absolute", bottom: 50, right: 14, display: "flex", flexDirection: "column", alignItems: "center", background: "rgba(10,8,2,0.75)", padding: "8px 14px", borderRadius: 2, backdropFilter: "blur(6px)", border: `1px solid ${THEME.green}60` },
  holdSec: { fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 30, color: THEME.greenBright, lineHeight: 1 },
  holdUnit: { fontFamily: "'Tiro Devanagari Sanskrit',serif", fontSize: 10, color: THEME.green, marginTop: 2 },
  holdLabel: { fontFamily: "'Cinzel',serif", fontSize: 9, color: THEME.greenBright, letterSpacing: 2, marginTop: 1 },
  feedbackBar: { padding: "12px 16px", borderTop: `1px solid`, transition: "border-color 0.4s" },
  panel: { flex: "0 0 220px", display: "flex", flexDirection: "column", gap: 14 },
  panelCard: { background: THEME.bgCard, border: `1px solid ${THEME.border}`, borderRadius: 2, padding: "14px 16px", boxShadow: `0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(201,151,42,0.06)` },
  panelLabel: { fontFamily: "'Tiro Devanagari Sanskrit',serif", fontSize: 12, color: THEME.gold, letterSpacing: 1, textAlign: "center", marginBottom: 2 },
  poseBtn: { padding: "10px 12px", borderRadius: 2, border: "1px solid", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 10, transition: "all 0.2s", textAlign: "left" },
  statRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  statLabel: { fontFamily: "'Tiro Devanagari Sanskrit',serif", fontSize: 11, color: THEME.creamDim },
  statVal: { fontFamily: "'Cinzel',serif", fontSize: 12, fontWeight: 600 },
  barTrack: { height: 4, background: THEME.bgCardAlt, borderRadius: 0, overflow: "hidden", border: `1px solid ${THEME.goldDim}44` },
  barFill: { height: "100%", borderRadius: 0, transition: "width 0.5s ease, background 0.4s ease" },
};