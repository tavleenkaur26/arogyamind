import { useEffect, useRef, useState, useCallback } from "react";
import { Pose } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";

// ─── Scoring constants ────────────────────────────────────────────────────
const SCORE_DECAY_NORMAL   = 0.04;  // per frame when slouching
const SCORE_DECAY_EXTENDED = 0.10;  // per frame after 15s continuous slouch
const SCORE_GAIN_NORMAL    = 0.02;  // per frame when good
const SCORE_GAIN_BONUS     = 0.04;  // per frame after 30s continuous good posture
const EXTENDED_SLOUCH_MS   = 15000;
const BONUS_GOOD_MS        = 30000;

const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
  @keyframes slideIn {
    from { transform: translateY(-24px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateY(0);    opacity: 1; }
    to   { transform: translateY(-24px); opacity: 0; }
  }
  @keyframes pulse-ring {
    0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
    70%  { box-shadow: 0 0 0 14px rgba(239,68,68,0); }
    100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
  }
  @keyframes fadeUp {
    from { opacity:0; transform:translateY(12px); }
    to   { opacity:1; transform:translateY(0); }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #080c12; }
`;

function Toast({ message, type, dying }) {
  return (
    <div style={{
      position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)",
      background: type === "warn" ? "#b45309" : type === "bonus" ? "#1d4ed8" : "#15803d",
      color: "#fff", padding: "12px 24px", borderRadius: 999,
      fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500,
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)", zIndex: 9999,
      animation: `${dying ? "slideOut" : "slideIn"} 0.3s ease forwards`,
      display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
    }}>
      {type === "warn" ? "⚠" : type === "bonus" ? "🔥" : "✓"} {message}
    </div>
  );
}

function ScoreRing({ score, isBonus }) {
  const r = 54, circ = 2 * Math.PI * r;
  const color = isBonus ? "#60a5fa" : score > 75 ? "#34d399" : score > 40 ? "#fbbf24" : "#f87171";
  return (
    <svg width={128} height={128} style={{ display: "block" }}>
      <circle cx={64} cy={64} r={r} fill="none" stroke="#1e293b" strokeWidth={10} />
      <circle cx={64} cy={64} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * circ} ${circ}`}
        transform="rotate(-90 64 64)"
        style={{ transition: "stroke-dasharray 0.6s ease, stroke 0.4s ease" }} />
      <text x={64} y={58} textAnchor="middle"
        style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 800, fill: color, transition: "fill 0.4s" }}>
        {score}
      </text>
      <text x={64} y={76} textAnchor="middle"
        style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, fill: "#64748b", letterSpacing: 1 }}>
        {isBonus ? "BONUS ★" : "SCORE"}
      </text>
    </svg>
  );
}

export default function PostureDetector() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [postureStatus, setPostureStatus] = useState("idle");
  const [score, setScore] = useState(100);
  const [isBonus, setIsBonus] = useState(false);
  const [calibCountdown, setCalibCountdown] = useState(3);
  const [calibProgress, setCalibProgress] = useState(0);
  const [toast, setToast] = useState(null);
  const [sessionStats, setSessionStats] = useState({ goodTime: 0, slouchTime: 0 });

  const baselineRef      = useRef(null);
  const calibSamples     = useRef([]);
  const calibDone        = useRef(false);
  const postureHistory   = useRef([]);
  const scoreRef         = useRef(100);
  const lastFlush        = useRef(0);
  const slouchStart      = useRef(null);
  const goodStart        = useRef(null);
  const lastNudge        = useRef(0);
  const countdownRef     = useRef(3);
  const countdownTimer   = useRef(null);
  const statsRef         = useRef({ goodTime: 0, slouchTime: 0, lastTick: Date.now() });
  const toastTimer       = useRef(null);
  const prevSample       = useRef(null);

  const showToast = useCallback((message, type = "warn") => {
    clearTimeout(toastTimer.current);
    setToast({ message, type, dying: false });
    toastTimer.current = setTimeout(() => {
      setToast((t) => t ? { ...t, dying: true } : null);
      setTimeout(() => setToast(null), 320);
    }, 4000);
  }, []);

  const flushScore = useCallback(() => {
    const now = Date.now();
    if (now - lastFlush.current > 400) {
      setScore(Math.round(scoreRef.current));
      lastFlush.current = now;
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setSessionStats({ ...statsRef.current }), 2000);
    return () => clearInterval(id);
  }, []);

  const startCountdown = useCallback(() => {
    clearInterval(countdownTimer.current);
    countdownRef.current = 3;
    setCalibCountdown(3);
    countdownTimer.current = setInterval(() => {
      countdownRef.current -= 1;
      setCalibCountdown(countdownRef.current);
      if (countdownRef.current <= 0) clearInterval(countdownTimer.current);
    }, 1000);
  }, []);

  const recalibrate = useCallback(() => {
    calibDone.current      = false;
    calibSamples.current   = [];
    baselineRef.current    = null;
    postureHistory.current = [];
    prevSample.current     = null;
    scoreRef.current       = 100;
    slouchStart.current    = null;
    goodStart.current      = null;
    setScore(100);
    setIsBonus(false);
    setPostureStatus("idle");
    setCalibProgress(0);
    startCountdown();
  }, [startCountdown]);

  useEffect(() => {
    if (!videoRef.current) return;

    if (!document.getElementById("arogyamind-styles")) {
      const tag = document.createElement("style");
      tag.id = "arogyamind-styles";
      tag.textContent = GLOBAL_STYLE;
      document.head.appendChild(tag);
    }

    const pose = new Pose({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`,
    });
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    const ctx = canvasRef.current.getContext("2d");
    let emaOffset = null, emaVRatio = null;
    const EMA = 0.15;
    const CALIB_NEEDED = 60;

    pose.onResults((results) => {
      if (!results.poseLandmarks) return;
      const lm = results.poseLandmarks;

      const nose = lm[0];
      const lSho = lm[11];
      const rSho = lm[12];
      if (nose.visibility < 0.5 || lSho.visibility < 0.5 || rSho.visibility < 0.5) return;

      const sho = { x: (lSho.x + rSho.x) / 2, y: (lSho.y + rSho.y) / 2 };
      const sw  = Math.abs(lSho.x - rSho.x) + 1e-6;

      const rawOffset = (nose.x - sho.x) / sw;
      const rawVRatio = (sho.y - nose.y) / sw;

      emaOffset = emaOffset === null ? rawOffset : emaOffset * (1 - EMA) + rawOffset * EMA;
      emaVRatio = emaVRatio === null ? rawVRatio : emaVRatio * (1 - EMA) + rawVRatio * EMA;

      /* Calibration */
      if (!calibDone.current) {
        if (countdownRef.current > 0) { setPostureStatus("idle"); return; }
        setPostureStatus("calibrating");
        const prev = prevSample.current;
        const stable = !prev
          || (Math.abs(rawOffset - prev.offset) < 0.03 && Math.abs(rawVRatio - prev.vRatio) < 0.03);
        prevSample.current = { offset: rawOffset, vRatio: rawVRatio };
        if (stable) {
          calibSamples.current.push({ offset: emaOffset, vRatio: emaVRatio });
          setCalibProgress(Math.min(100, Math.round((calibSamples.current.length / CALIB_NEEDED) * 100)));
        }
        if (calibSamples.current.length >= CALIB_NEEDED) {
          const n = calibSamples.current.length;
          const avgOffset = calibSamples.current.reduce((s, x) => s + x.offset, 0) / n;
          const avgVRatio = calibSamples.current.reduce((s, x) => s + x.vRatio, 0) / n;
          const stdOffset = Math.sqrt(calibSamples.current.reduce((s, x) => s + (x.offset - avgOffset) ** 2, 0) / n);
          const stdVRatio = Math.sqrt(calibSamples.current.reduce((s, x) => s + (x.vRatio - avgVRatio) ** 2, 0) / n);
          baselineRef.current = { offset: avgOffset, vRatio: avgVRatio, stdOffset, stdVRatio };
          calibDone.current = true;
          showToast("Calibrated! Monitoring your posture.", "ok");
        }
        return;
      }

      const b = baselineRef.current;
      const dOffset = emaOffset - b.offset;
      const dVRatio = emaVRatio - b.vRatio;
      const offsetTol = Math.max(0.20, b.stdOffset * 4);
      const vRatioTol = Math.max(0.15, b.stdVRatio * 4);
      const isSlouching = dOffset > offsetTol || dVRatio < -vRatioTol;

      const hist = postureHistory.current;
      hist.push(isSlouching ? 1 : 0);
      if (hist.length > 20) hist.shift();
      const stableSlough = hist.length >= 10 && hist.reduce((a, b) => a + b, 0) / hist.length > 0.65;

      setPostureStatus(stableSlough ? "slouch" : "good");

      const now = Date.now();
      const dt  = (now - statsRef.current.lastTick) / 1000;
      statsRef.current.lastTick = now;

      if (stableSlough) {
        statsRef.current.slouchTime += dt;
        goodStart.current = null;
        setIsBonus(false);
        if (!slouchStart.current) slouchStart.current = now;

        // Extended slouch → faster decay + nudge
        const slouchDuration = now - slouchStart.current;
        const decay = slouchDuration > EXTENDED_SLOUCH_MS ? SCORE_DECAY_EXTENDED : SCORE_DECAY_NORMAL;
        scoreRef.current = Math.max(0, scoreRef.current - decay);

        if (slouchDuration > EXTENDED_SLOUCH_MS && now - lastNudge.current > 12000) {
          lastNudge.current = now;
          showToast("You've been slouching too long — sit up!", "warn");
        }
      } else {
        statsRef.current.goodTime += dt;
        slouchStart.current = null;
        if (!goodStart.current) goodStart.current = now;

        // Bonus gain after sustained good posture
        const goodDuration = now - goodStart.current;
        const gain = goodDuration > BONUS_GOOD_MS ? SCORE_GAIN_BONUS : SCORE_GAIN_NORMAL;
        scoreRef.current = Math.min(100, scoreRef.current + gain);

        const bonus = goodDuration > BONUS_GOOD_MS;
        setIsBonus(bonus);
        if (bonus && goodDuration > BONUS_GOOD_MS && goodDuration < BONUS_GOOD_MS + 1000) {
          showToast("🔥 Bonus mode! Great posture streak!", "bonus");
        }
      }
      flushScore();

      // Canvas
      const W = canvasRef.current.width;
      const H = canvasRef.current.height;
      ctx.save();
      ctx.clearRect(0, 0, W, H);
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
      const col = stableSlough ? "rgba(248,113,113,0.95)" : "rgba(52,211,153,0.95)";
      ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(nose.x * W, nose.y * H); ctx.lineTo(sho.x * W, sho.y * H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(lSho.x * W, lSho.y * H); ctx.lineTo(rSho.x * W, rSho.y * H); ctx.stroke();
      [{ x: nose.x, y: nose.y }, sho, { x: lSho.x, y: lSho.y }, { x: rSho.x, y: rSho.y }].forEach((pt) => {
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(pt.x * W, pt.y * H, 5, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
    });

    const camera = new Camera(videoRef.current, {
      onFrame: async () => { await pose.send({ image: videoRef.current }); },
      width: 640, height: 480,
    });
    camera.start();
    startCountdown();
    return () => camera.stop();
  }, [flushScore, showToast, startCountdown]);

  const isSlouching   = postureStatus === "slouch";
  const isCalibrating = postureStatus === "calibrating" || postureStatus === "idle";
  const totalTime = sessionStats.goodTime + sessionStats.slouchTime;
  const goodPct   = totalTime > 0 ? Math.round((sessionStats.goodTime / totalTime) * 100) : 100;
  const fmt = (s) => `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`;

  return (
    <div style={S.page}>
      {toast && <Toast {...toast} />}
      <header style={S.header}>
        <div style={S.logo}>
          <span style={S.logoMark}>A</span>
          <span style={S.logoText}>ArogyaMind</span>
        </div>
        <div style={{
          ...S.statusPill,
          background: isCalibrating ? "#1e293b" : isSlouching ? "rgba(239,68,68,0.15)" : isBonus ? "rgba(96,165,250,0.12)" : "rgba(52,211,153,0.12)",
          borderColor: isCalibrating ? "#334155" : isSlouching ? "rgba(239,68,68,0.4)" : isBonus ? "rgba(96,165,250,0.5)" : "rgba(52,211,153,0.4)",
          animation: isSlouching ? "pulse-ring 1.8s infinite" : "none",
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", display: "inline-block",
            background: isCalibrating ? "#475569" : isSlouching ? "#ef4444" : isBonus ? "#60a5fa" : "#34d399",
            boxShadow: isCalibrating ? "none" : isSlouching ? "0 0 6px #ef4444" : isBonus ? "0 0 6px #60a5fa" : "0 0 6px #34d399",
          }} />
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12,
            color: isCalibrating ? "#64748b" : isSlouching ? "#fca5a5" : isBonus ? "#bfdbfe" : "#6ee7b7" }}>
            {isCalibrating
              ? (calibCountdown > 0 ? `Calibrating in ${calibCountdown}…` : `Capturing… ${calibProgress}%`)
              : isSlouching ? "SLOUCHING" : isBonus ? "GREAT POSTURE 🔥" : "GOOD POSTURE"}
          </span>
        </div>
      </header>

      <main style={S.main}>
        <div style={S.cameraCard}>
          {isCalibrating && (
            <div style={S.calibOverlay}>
              <p style={S.calibTitle}>{calibCountdown > 0 ? "Sit up straight" : "Hold still…"}</p>
              <p style={S.calibSub}>{calibCountdown > 0 ? `Starting in ${calibCountdown}` : "Stay still — only counting stable frames"}</p>
              {calibCountdown > 0 ? (
                <div style={S.countdownRing}><span style={S.countdownNum}>{calibCountdown}</span></div>
              ) : (
                <>
                  <div style={S.progressWrap}><div style={{ ...S.progressFill, width: `${calibProgress}%` }} /></div>
                  <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#475569", marginTop: 6 }}>{calibProgress}%</p>
                </>
              )}
            </div>
          )}
          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden" }}>
            <video ref={videoRef} autoPlay playsInline width={640} height={480} style={S.video} />
            <canvas ref={canvasRef} width={640} height={480} style={S.canvas} />
            <div style={S.vignette} />
          </div>
          <div style={S.cameraBar}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#475569" }}>POSTURE MONITOR</span>
            <button style={S.recalibBtn} onClick={recalibrate}>↺ Recalibrate</button>
          </div>
        </div>

        <aside style={S.panel}>
          <div style={S.panelCard}>
            <p style={S.panelLabel}>POSTURE SCORE</p>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
              <ScoreRing score={score} isBonus={isBonus} />
            </div>
            {isBonus && <p style={{ textAlign: "center", fontSize: 11, color: "#60a5fa", fontFamily: "'DM Mono',monospace", marginTop: 6 }}>+2x gain active</p>}
          </div>
          <div style={S.panelCard}>
            <p style={S.panelLabel}>SESSION</p>
            <div style={S.statRow}>
              <span style={S.statLabel}>Good time</span>
              <span style={{ ...S.statVal, color: "#34d399" }}>{fmt(sessionStats.goodTime)}</span>
            </div>
            <div style={S.statRow}>
              <span style={S.statLabel}>Slouch time</span>
              <span style={{ ...S.statVal, color: "#f87171" }}>{fmt(sessionStats.slouchTime)}</span>
            </div>
            <div style={S.barTrack}><div style={{ ...S.barFill, width: `${goodPct}%` }} /></div>
            <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#475569", marginTop: 6 }}>{goodPct}% good posture</p>
          </div>
          <div style={{ ...S.panelCard, borderColor: isSlouching ? "rgba(239,68,68,0.25)" : "#1e293b" }}>
            <p style={S.panelLabel}>TIP</p>
            <p style={S.tipText}>
              {isSlouching
                ? "Head drifting forward. Tuck chin slightly, lift chest, relax shoulders."
                : isBonus
                ? "Excellent! Keep it up — you're in bonus streak mode."
                : "Good posture! Hold for 30s to enter bonus streak mode."}
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}

const S = {
  page: { minHeight: "100vh", background: "#080c12", color: "#e2e8f0", fontFamily: "'DM Mono', monospace", padding: "0 0 48px" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", borderBottom: "1px solid #0f172a" },
  logo: { display: "flex", alignItems: "center", gap: 10 },
  logoMark: { width: 32, height: 32, background: "linear-gradient(135deg, #34d399, #0ea5e9)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: "#080c12", lineHeight: "32px", textAlign: "center" },
  logoText: { fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, color: "#f1f5f9" },
  statusPill: { display: "flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 999, border: "1px solid", transition: "all 0.4s ease" },
  main: { display: "flex", gap: 24, padding: "28px 32px", alignItems: "flex-start", flexWrap: "wrap" },
  cameraCard: { flex: "1 1 520px", background: "#0d1117", borderRadius: 20, border: "1px solid #1e293b", overflow: "hidden", position: "relative", animation: "fadeUp 0.5s ease" },
  calibOverlay: { position: "absolute", inset: 0, zIndex: 10, background: "rgba(8,12,18,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)", borderRadius: 20, gap: 10 },
  calibTitle: { fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 26, color: "#f1f5f9" },
  calibSub: { fontFamily: "'DM Mono',monospace", fontSize: 13, color: "#64748b", textAlign: "center", maxWidth: 280 },
  countdownRing: { marginTop: 16, width: 72, height: 72, borderRadius: "50%", border: "3px solid #34d399", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 24px rgba(52,211,153,0.3)" },
  countdownNum: { fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 30, color: "#34d399" },
  progressWrap: { marginTop: 20, width: 220, height: 6, background: "#1e293b", borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", background: "linear-gradient(90deg, #34d399, #0ea5e9)", borderRadius: 999, transition: "width 0.3s ease" },
  video: { width: "100%", height: 380, objectFit: "cover", display: "block", transform: "scaleX(-1)" },
  canvas: { position: "absolute", top: 0, left: 0, width: "100%", height: 380 },
  vignette: { position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 55%, rgba(8,12,18,0.6) 100%)", pointerEvents: "none" },
  cameraBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid #1e293b" },
  recalibBtn: { background: "transparent", border: "1px solid #1e293b", color: "#64748b", padding: "5px 14px", borderRadius: 999, cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono',monospace" },
  panel: { flex: "0 0 220px", display: "flex", flexDirection: "column", gap: 16, animation: "fadeUp 0.6s ease" },
  panelCard: { background: "#0d1117", border: "1px solid #1e293b", borderRadius: 16, padding: "16px 18px", transition: "border-color 0.4s" },
  panelLabel: { fontSize: 10, letterSpacing: 2, color: "#475569", fontFamily: "'DM Mono',monospace", marginBottom: 4 },
  statRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  statLabel: { fontSize: 12, color: "#64748b" },
  statVal: { fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 500 },
  barTrack: { marginTop: 12, height: 5, background: "#1e293b", borderRadius: 999, overflow: "hidden" },
  barFill: { height: "100%", background: "linear-gradient(90deg, #34d399, #0ea5e9)", borderRadius: 999, transition: "width 1s ease" },
  tipText: { fontSize: 12, color: "#94a3b8", lineHeight: 1.6, marginTop: 8, fontFamily: "'DM Mono',monospace" },
};