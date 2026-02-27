// ─── ArogyaMind — Light / English Theme ────────────────────────────────
// Shared design tokens, fonts, and global styles used by both detectors.

export const THEME = {
  bg:           "#fdf8ef",   // light parchment
  bgCard:       "#fffdfa",   // card surface
  bgCardAlt:    "#f7f3eb",   // slightly darker panel
  border:       "#c5a56c",   // soft gold border
  borderLight:  "#e0c48f",   // highlight gold accent
  gold:         "#d4af37",   // primary gold
  goldBright:   "#f0d750",   // highlight gold
  goldDim:      "#a87e2c",   // muted gold
  cream:        "#4a3f2f",   // text color
  creamDim:     "#7b6a4d",   // secondary text
  creamFaint:   "#a39378",   // very dim text
  green:        "#4e936e",   // good posture — sage
  greenBright:  "#7ec89a",
  red:          "#b84f44",   // slouch — terracotta
  redBright:    "#e07060",
  amber:        "#c4873a",   // warning
  blue:         "#4a7a9e",   // bonus — lapis
};

export const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=IM+Fell+English:ital@0;1&display=swap');

  @keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes slideOut { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-20px); opacity: 0; } }
  @keyframes pulseGold { 0%,100% { box-shadow: 0 0 0 0 rgba(212,175,55,0.4); } 50% { box-shadow: 0 0 0 10px rgba(212,175,55,0); } }
  @keyframes pulseRed { 0%,100% { box-shadow: 0 0 0 0 rgba(184,80,64,0.5); } 50% { box-shadow: 0 0 0 12px rgba(184,80,64,0); } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${THEME.bg}; }
`;

export const LABELS = {
  goodPosture:  "Good Posture",
  slouching:    "Slouching",
  calibrating:  "Calibrating",
  score:        "Score",
  session:      "Session",
  goodTime:     "Good Time",
  slouchTime:   "Slouch Time",
  tip:          "Tip",
  recalibrate:  "Recalibrate",
  holdTime:     "Hold Time",
  bestHold:     "Best",
  pose:         "Pose",
  mountain:     "Mountain",
  chair:        "Chair",
  tree:         "Tree",
  accuracy:     "Accuracy",
  bonus:        "Bonus",
};
