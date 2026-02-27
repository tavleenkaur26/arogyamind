import { useEffect, useRef, useState, useCallback } from "react";
import { Pose } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";
import { THEME, GLOBAL_STYLE, LABELS } from "./theme";

const SCORE_DECAY_NORMAL   = 0.04;
const SCORE_DECAY_EXTENDED = 0.10;
const SCORE_GAIN_NORMAL    = 0.02;
const SCORE_GAIN_BONUS     = 0.04;
const EXTENDED_SLOUCH_MS   = 15000;
const BONUS_GOOD_MS        = 30000;

// ─── Toast ────────────────────────────────────────────────────────────────
function Toast({ message, type, dying }) {
  const bg = type === "warn"
    ? `linear-gradient(135deg, #3a1a08, #5a2a10)`
    : type === "bonus"
    ? `linear-gradient(135deg, #0a1a2a, #1a3a5a)`
    : `linear-gradient(135deg, #0a1a0a, #1a3a1a)`;
  const border = type === "warn" ? THEME.red : type === "bonus" ? THEME.blue : THEME.green;
  return (
    <div style={{
      position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
      background: bg, border: `1px solid ${border}`,
      color: THEME.cream, padding: "10px 22px", borderRadius: 4,
      fontFamily: "'IM Fell English', serif", fontSize: 13, fontStyle: "italic",
      boxShadow: `0 4px 24px rgba(0,0,0,0.7), inset 0 1px 0 rgba(201,151,42,0.1)`,
      zIndex: 9999,
      animation: `${dying ? "slideOut" : "slideIn"} 0.3s ease forwards`,
      display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap",
    }}>
      <span style={{ color: border, fontStyle: "normal" }}>
        {type === "warn" ? "⚠" : type === "bonus" ? "✦" : "✓"}
      </span>
      {message}
    </div>
  );
}

// ─── Mandala Score Ring ───────────────────────────────────────────────────
function MandalaSring({ score, isBonus }) {
  const r = 52, circ = 2 * Math.PI * r;
  const color = isBonus ? THEME.blue : score > 75 ? THEME.green : score > 40 ? THEME.amber : THEME.red;
  const brightColor = isBonus ? "#7ab0d4" : score > 75 ? THEME.greenBright : score > 40 ? THEME.goldBright : THEME.redBright;

  return (
    <svg width={130} height={130} style={{ display: "block" }}>
      {/* Outer decorative ring */}
      <circle cx={65} cy={65} r={60} fill="none" stroke={THEME.goldDim} strokeWidth={1} strokeDasharray="3 6" />
      {/* Background arc */}
      <circle cx={65} cy={65} r={r} fill="none" stroke={THEME.bgCardAlt} strokeWidth={10} />
      {/* Score arc */}
      <circle cx={65} cy={65} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * circ} ${circ}`}
        transform="rotate(-90 65 65)"
        style={{ transition: "stroke-dasharray 0.7s ease, stroke 0.5s ease" }} />
      {/* Inner decorative dots at cardinal points */}
      {[0,90,180,270].map((deg) => {
        const rad = (deg - 90) * Math.PI / 180;
        return <circle key={deg} cx={65 + 60 * Math.cos(rad)} cy={65 + 60 * Math.sin(rad)} r={2} fill={THEME.goldDim} />;
      })}
      {/* Score number */}
      <text x={65} y={60} textAnchor="middle"
        style={{ fontFamily: "'Cinzel',serif", fontSize: 28, fontWeight: 700, fill: brightColor, transition: "fill 0.5s" }}>
        {score}
      </text>
      {/* Sanskrit label */}
      <text x={65} y={78} textAnchor="middle"
        style={{ fontFamily: "'Tiro Devanagari Sanskrit',serif", fontSize: 12, fill: THEME.goldDim, letterSpacing: 1 }}>
        {isBonus ? LABELS.bonus : LABELS.score}
      </text>
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────
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
    calibDone.current = false; calibSamples.current = []; baselineRef.current = null;
    postureHistory.current = []; prevSample.current = null; scoreRef.current = 100;
    slouchStart.current = null; goodStart.current = null;
    setScore(100); setIsBonus(false); setPostureStatus("idle"); setCalibProgress(0);
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

    const pose = new Pose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
    pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, enableSegmentation: false, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });

    const ctx = canvasRef.current.getContext("2d");
    let emaOffset = null, emaVRatio = null;
    const EMA = 0.15, CALIB_NEEDED = 60;

    pose.onResults((results) => {
      if (!results.poseLandmarks) return;
      const lm = results.poseLandmarks;
      const nose = lm[0], lSho = lm[11], rSho = lm[12];
      if (nose.visibility < 0.5 || lSho.visibility < 0.5 || rSho.visibility < 0.5) return;

      const sho = { x: (lSho.x + rSho.x) / 2, y: (lSho.y + rSho.y) / 2 };
      const sw  = Math.abs(lSho.x - rSho.x) + 1e-6;
      const rawOffset = (nose.x - sho.x) / sw;
      const rawVRatio = (sho.y - nose.y) / sw;
      emaOffset = emaOffset === null ? rawOffset : emaOffset * (1 - EMA) + rawOffset * EMA;
      emaVRatio = emaVRatio === null ? rawVRatio : emaVRatio * (1 - EMA) + rawVRatio * EMA;

      if (!calibDone.current) {
        if (countdownRef.current > 0) { setPostureStatus("idle"); return; }
        setPostureStatus("calibrating");
        const prev = prevSample.current;
        const stable = !prev || (Math.abs(rawOffset - prev.offset) < 0.03 && Math.abs(rawVRatio - prev.vRatio) < 0.03);
        prevSample.current = { offset: rawOffset, vRatio: rawVRatio };
        if (stable) {
          calibSamples.current.push({ offset: emaOffset, vRatio: emaVRatio });
          setCalibProgress(Math.min(100, Math.round((calibSamples.current.length / CALIB_NEEDED) * 100)));
        }
        if (calibSamples.current.length >= CALIB_NEEDED) {
          const n = calibSamples.current.length;
          const avgO = calibSamples.current.reduce((s, x) => s + x.offset, 0) / n;
          const avgV = calibSamples.current.reduce((s, x) => s + x.vRatio, 0) / n;
          const stdO = Math.sqrt(calibSamples.current.reduce((s, x) => s + (x.offset - avgO) ** 2, 0) / n);
          const stdV = Math.sqrt(calibSamples.current.reduce((s, x) => s + (x.vRatio - avgV) ** 2, 0) / n);
          baselineRef.current = { offset: avgO, vRatio: avgV, stdO, stdV };
          calibDone.current = true;
          showToast("साधना पूर्ण — Calibration complete", "ok");
        }
        return;
      }

      const b = baselineRef.current;
      const dO = emaOffset - b.offset, dV = emaVRatio - b.vRatio;
      const oTol = Math.max(0.20, b.stdO * 4), vTol = Math.max(0.15, b.stdV * 4);
      const isSlouching = dO > oTol || dV < -vTol;

      const hist = postureHistory.current;
      hist.push(isSlouching ? 1 : 0);
      if (hist.length > 20) hist.shift();
      const stableS = hist.length >= 10 && hist.reduce((a, b) => a + b, 0) / hist.length > 0.65;

      setPostureStatus(stableS ? "slouch" : "good");

      const now = Date.now();
      const dt  = (now - statsRef.current.lastTick) / 1000;
      statsRef.current.lastTick = now;

      if (stableS) {
        statsRef.current.slouchTime += dt;
        goodStart.current = null; setIsBonus(false);
        if (!slouchStart.current) slouchStart.current = now;
        const dur = now - slouchStart.current;
        scoreRef.current = Math.max(0, scoreRef.current - (dur > EXTENDED_SLOUCH_MS ? SCORE_DECAY_EXTENDED : SCORE_DECAY_NORMAL));
        if (dur > EXTENDED_SLOUCH_MS && now - lastNudge.current > 12000) {
          lastNudge.current = now;
          showToast("अवनत — Correct your posture now", "warn");
        }
      } else {
        statsRef.current.goodTime += dt;
        slouchStart.current = null;
        if (!goodStart.current) goodStart.current = now;
        const dur = now - goodStart.current;
        scoreRef.current = Math.min(100, scoreRef.current + (dur > BONUS_GOOD_MS ? SCORE_GAIN_BONUS : SCORE_GAIN_NORMAL));
        const bonus = dur > BONUS_GOOD_MS;
        setIsBonus(bonus);
        if (bonus && dur > BONUS_GOOD_MS && dur < BONUS_GOOD_MS + 1000)
          showToast("विशेष — Bonus streak active!", "bonus");
      }
      flushScore();

      // Canvas overlay — gold/terracotta ink strokes
      const W = canvasRef.current.width, H = canvasRef.current.height;
      ctx.save();
      ctx.clearRect(0, 0, W, H);
      ctx.translate(W, 0); ctx.scale(-1, 1);
      const col = stableS ? "rgba(224,112,96,0.9)" : "rgba(126,200,154,0.9)";
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = "round";
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
    camera.start(); startCountdown();
    return () => camera.stop();
  }, [flushScore, showToast, startCountdown]);

  const isSlouching   = postureStatus === "slouch";
  const isCalibrating = postureStatus === "calibrating" || postureStatus === "idle";
  const totalTime = sessionStats.goodTime + sessionStats.slouchTime;
  const goodPct   = totalTime > 0 ? Math.round((sessionStats.goodTime / totalTime) * 100) : 100;
  const fmt = (s) => `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`;

  const statusColor = isCalibrating ? THEME.goldDim : isSlouching ? THEME.red : isBonus ? THEME.blue : THEME.green;
  const statusBright = isCalibrating ? THEME.gold : isSlouching ? THEME.redBright : isBonus ? "#7ab0d4" : THEME.greenBright;

  return (
    <div style={S.page}>
      {toast && <Toast {...toast} />}

      {/* ── Header ── */}
      <header style={S.header}>
        <div style={S.logoWrap}>
          {/* OM symbol as logo */}
          <span style={S.omSymbol}>ॐ</span>
          <div>
            <div style={S.logoTitle}>ArogyaMind</div>
            <div style={S.logoSub}>आरोग्यमन्द् — Body Intelligence</div>
          </div>
        </div>

        <div style={{ ...S.statusCapsule, borderColor: statusColor, background: `${statusColor}18` }}>
          <span style={{ ...S.statusDot, background: statusBright, boxShadow: `0 0 7px ${statusBright}` }} />
          <span style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: 1.5, color: statusBright }}>
            {isCalibrating
              ? (calibCountdown > 0 ? `साधना ${calibCountdown}…` : `${LABELS.calibrating} ${calibProgress}%`)
              : isSlouching ? LABELS.slouching.toUpperCase()
              : isBonus ? `${LABELS.bonus} ✦`
              : LABELS.goodPosture.toUpperCase()}
          </span>
        </div>
      </header>

      {/* ── Decorative rule ── */}
      <div style={S.dividerRow}>
        <div style={S.dividerLine} />
        <span style={S.dividerText}>॥ देहसाधना ॥</span>
        <div style={S.dividerLine} />
      </div>

      <main style={S.main}>

        {/* ── Camera card ── */}
        <div style={S.cameraCard}>
          {/* Corner ornaments */}
          {["topLeft","topRight","bottomLeft","bottomRight"].map((pos) => (
            <span key={pos} style={{ ...S.corner, ...S.corners[pos] }}>✦</span>
          ))}

          {isCalibrating && (
            <div style={S.calibOverlay}>
              <p style={S.calibOm}>ॐ</p>
              <p style={S.calibTitle}>
                {calibCountdown > 0 ? "सीधे बैठिए" : "स्थिर रहिए…"}
              </p>
              <p style={S.calibSub}>
                {calibCountdown > 0
                  ? `Sit upright — beginning in ${calibCountdown}`
                  : "Hold still — recording your baseline"}
              </p>
              {calibCountdown > 0 ? (
                <div style={S.countdownRing}>
                  <span style={S.countdownNum}>{calibCountdown}</span>
                </div>
              ) : (
                <div style={{ width: 200, marginTop: 16 }}>
                  <div style={S.progressTrack}>
                    <div style={{ ...S.progressFill, width: `${calibProgress}%` }} />
                  </div>
                  <p style={{ textAlign: "center", fontFamily: "'Cinzel',serif", fontSize: 11, color: THEME.goldDim, marginTop: 6 }}>
                    {calibProgress}%
                  </p>
                </div>
              )}
            </div>
          )}

          <div style={{ position: "relative", borderRadius: 2, overflow: "hidden" }}>
            <video ref={videoRef} autoPlay playsInline width={640} height={480} style={S.video} />
            <canvas ref={canvasRef} width={640} height={480} style={S.canvas} />
            {/* Parchment vignette */}
            <div style={S.vignette} />
          </div>

          <div style={S.cameraFooter}>
            <span style={S.cameraFooterText}>देह निरीक्षण — POSTURE MONITOR</span>
            <button style={S.recalibBtn} onClick={recalibrate}>
              ↺ {LABELS.recalibrate}
            </button>
          </div>
        </div>

        {/* ── Side panel ── */}
        <aside style={S.panel}>

          {/* Score */}
          <div style={S.panelCard}>
            <p style={S.panelLabel}>॥ {LABELS.score} ॥</p>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
              <MandalaSring score={score} isBonus={isBonus} />
            </div>
            {isBonus && (
              <p style={{ textAlign: "center", fontFamily: "'Tiro Devanagari Sanskrit',serif", fontSize: 12, color: THEME.blue, marginTop: 6 }}>
                द्विगुण लाभ सक्रिय
              </p>
            )}
          </div>

          {/* Session */}
          <div style={S.panelCard}>
            <p style={S.panelLabel}>॥ {LABELS.session} ॥</p>
            <div style={S.statRow}>
              <span style={S.statLabel}>{LABELS.goodTime}</span>
              <span style={{ ...S.statVal, color: THEME.greenBright }}>{fmt(sessionStats.goodTime)}</span>
            </div>
            <div style={S.statRow}>
              <span style={S.statLabel}>{LABELS.slouchTime}</span>
              <span style={{ ...S.statVal, color: THEME.redBright }}>{fmt(sessionStats.slouchTime)}</span>
            </div>
            <div style={S.barTrack}>
              <div style={{ ...S.barFill, width: `${goodPct}%` }} />
            </div>
            <p style={{ fontFamily: "'Cinzel',serif", fontSize: 10, color: THEME.creamFaint, marginTop: 6, textAlign: "right", letterSpacing: 0.5 }}>
              {goodPct}% सुदेह
            </p>
          </div>

          {/* Teaching */}
          <div style={{ ...S.panelCard, borderColor: isSlouching ? `${THEME.red}60` : `${THEME.border}` }}>
            <p style={S.panelLabel}>॥ {LABELS.tip} ॥</p>
            <p style={S.tipText}>
              {isSlouching
                ? "शिर सीधा रखें। ठोड़ी को हल्का पीछे खींचें, वक्ष ऊपर उठाएं।"
                : isBonus
                ? "अति उत्तम! यह विशेष धारा जारी रखें।"
                : "सुंदर! ३० सेकंड तक धारण करने पर विशेष बोनस प्राप्त करें।"}
            </p>
            <p style={{ ...S.tipText, fontStyle: "italic", marginTop: 6, color: THEME.creamDim }}>
              {isSlouching
                ? "Keep head upright. Gently tuck chin, lift chest."
                : isBonus
                ? "Excellent! Maintain this special streak."
                : "Good! Hold 30s for bonus streak mode."}
            </p>
          </div>

        </aside>
      </main>

      {/* ── Footer ornament ── */}
      <div style={S.dividerRow}>
        <div style={S.dividerLine} />
        <span style={S.dividerText}>॥ स्वस्ति ॥</span>
        <div style={S.dividerLine} />
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100vh",
    background: THEME.bg,
    backgroundImage: `
      radial-gradient(ellipse at 20% 20%, rgba(90,70,20,0.15) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 80%, rgba(60,40,10,0.2) 0%, transparent 60%)
    `,
    color: THEME.cream,
    fontFamily: "'IM Fell English', serif",
    padding: "0 0 32px",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "20px 32px",
    borderBottom: `1px solid ${THEME.border}`,
    background: `linear-gradient(180deg, rgba(40,28,8,0.8) 0%, transparent 100%)`,
  },
  logoWrap: { display: "flex", alignItems: "center", gap: 14 },
  omSymbol: {
    fontSize: 38, color: THEME.gold,
    textShadow: `0 0 20px ${THEME.gold}88`,
    fontFamily: "'Tiro Devanagari Sanskrit', serif",
    lineHeight: 1,
  },
  logoTitle: {
    fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: 22,
    color: THEME.goldBright, letterSpacing: 2,
    textShadow: `0 0 12px ${THEME.gold}44`,
  },
  logoSub: {
    fontFamily: "'Tiro Devanagari Sanskrit', serif", fontSize: 12,
    color: THEME.goldDim, letterSpacing: 1, marginTop: 2,
  },
  statusCapsule: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "7px 16px", borderRadius: 2,
    border: "1px solid", transition: "all 0.4s ease",
  },
  statusDot: { width: 7, height: 7, borderRadius: "50%", display: "inline-block", transition: "all 0.4s" },
  dividerRow: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "6px 32px",
  },
  dividerLine: { flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${THEME.goldDim}, transparent)` },
  dividerText: { fontFamily: "'Tiro Devanagari Sanskrit',serif", fontSize: 13, color: THEME.goldDim, whiteSpace: "nowrap", letterSpacing: 3 },
  main: { display: "flex", gap: 24, padding: "20px 32px", alignItems: "flex-start", flexWrap: "wrap" },
  cameraCard: {
    flex: "1 1 520px", position: "relative",
    background: THEME.bgCard,
    borderRadius: 4,
    border: `1px solid ${THEME.border}`,
    boxShadow: `0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(201,151,42,0.1)`,
    overflow: "hidden",
    animation: "fadeUp 0.6s ease",
  },
  corner: {
    position: "absolute", zIndex: 20,
    color: THEME.gold, fontSize: 14,
    lineHeight: 1, pointerEvents: "none",
  },
  corners: {
    topLeft:     { top: 6, left: 8 },
    topRight:    { top: 6, right: 8 },
    bottomLeft:  { bottom: 6, left: 8 },
    bottomRight: { bottom: 6, right: 8 },
  },
  calibOverlay: {
    position: "absolute", inset: 0, zIndex: 10,
    background: "rgba(10,8,2,0.88)",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    backdropFilter: "blur(4px)", gap: 10,
  },
  calibOm: {
    fontFamily: "'Tiro Devanagari Sanskrit',serif",
    fontSize: 52, color: THEME.gold,
    textShadow: `0 0 30px ${THEME.gold}`, lineHeight: 1,
    animation: "flickerIn 1s ease",
  },
  calibTitle: { fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 22, color: THEME.cream, letterSpacing: 2 },
  calibSub: { fontFamily: "'IM Fell English',serif", fontStyle: "italic", fontSize: 13, color: THEME.creamDim, textAlign: "center", maxWidth: 260 },
  countdownRing: {
    marginTop: 14, width: 68, height: 68, borderRadius: "50%",
    border: `2px solid ${THEME.gold}`,
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: `0 0 20px ${THEME.gold}44`,
  },
  countdownNum: { fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: 28, color: THEME.gold },
  progressTrack: { height: 5, background: THEME.bgCardAlt, borderRadius: 0, overflow: "hidden", border: `1px solid ${THEME.goldDim}` },
  progressFill: { height: "100%", background: `linear-gradient(90deg, ${THEME.goldDim}, ${THEME.gold})`, transition: "width 0.3s ease" },
  video: { width: "100%", height: 380, objectFit: "cover", display: "block", transform: "scaleX(-1)", filter: "sepia(0.12) contrast(1.05)" },
  canvas: { position: "absolute", top: 0, left: 0, width: "100%", height: 380 },
  vignette: {
    position: "absolute", inset: 0, pointerEvents: "none",
    background: `radial-gradient(ellipse at center, transparent 50%, rgba(10,8,2,0.7) 100%)`,
    mixBlendMode: "multiply",
  },
  cameraFooter: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 16px",
    borderTop: `1px solid ${THEME.border}`,
    background: `linear-gradient(0deg, rgba(20,14,4,0.8) 0%, transparent 100%)`,
  },
  cameraFooterText: { fontFamily: "'Cinzel',serif", fontSize: 10, color: THEME.goldDim, letterSpacing: 2 },
  recalibBtn: {
    background: "transparent", border: `1px solid ${THEME.goldDim}`,
    color: THEME.creamDim, padding: "4px 12px", borderRadius: 2,
    cursor: "pointer", fontSize: 11, fontFamily: "'Cinzel',serif", letterSpacing: 0.5,
    transition: "all 0.2s",
  },
  panel: { flex: "0 0 220px", display: "flex", flexDirection: "column", gap: 14, animation: "fadeUp 0.7s ease" },
  panelCard: {
    background: THEME.bgCard,
    border: `1px solid ${THEME.border}`,
    borderRadius: 2,
    padding: "14px 16px",
    boxShadow: `0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(201,151,42,0.06)`,
    transition: "border-color 0.4s",
  },
  panelLabel: {
    fontFamily: "'Tiro Devanagari Sanskrit',serif", fontSize: 12,
    color: THEME.gold, letterSpacing: 1, textAlign: "center", marginBottom: 2,
  },
  statRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  statLabel: { fontFamily: "'IM Fell English',serif", fontStyle: "italic", fontSize: 12, color: THEME.creamDim },
  statVal: { fontFamily: "'Cinzel',serif", fontSize: 12, fontWeight: 600 },
  barTrack: { marginTop: 10, height: 4, background: THEME.bgCardAlt, borderRadius: 0, overflow: "hidden", border: `1px solid ${THEME.goldDim}44` },
  barFill: { height: "100%", background: `linear-gradient(90deg, ${THEME.green}, ${THEME.greenBright})`, transition: "width 1s ease" },
  tipText: { fontFamily: "'Tiro Devanagari Sanskrit',serif", fontSize: 12, color: THEME.cream, lineHeight: 1.7, marginTop: 8 },
};