import { Link, useLocation } from "react-router-dom";
import { THEME } from "./theme";

export default function Navbar() {
  const location = useLocation();

  const linkStyle = (path) => ({
    margin: "0 18px",
    textDecoration: "none",
    fontFamily: "'Cinzel', serif",
    fontSize: "14px",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: location.pathname === path ? THEME.gold : THEME.creamDim,
    transition: "all 0.3s ease",
    borderBottom:
      location.pathname === path
        ? `1px solid ${THEME.gold}`
        : "1px solid transparent",
    paddingBottom: "4px",
  });

  return (
    <nav
      style={{
        background: THEME.bg,
        borderBottom: `1px solid ${THEME.border}`,
        padding: "20px 40px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        position: "sticky",
        top: 0,
        zIndex: 100,
        backdropFilter: "blur(6px)",
      }}
    >
      <Link to="/" style={linkStyle("/")}>Home</Link>
      <Link to="/posture" style={linkStyle("/posture")}>Posture</Link>
      <Link to="/yoga" style={linkStyle("/yoga")}>Yoga</Link>
      <Link to="/ddf" style={linkStyle("/ddf")}>DDF</Link>
      <Link to="/planner" style={linkStyle("/planner")}>Planner</Link>
    </nav>
  );
}
