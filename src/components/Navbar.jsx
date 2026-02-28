import { NavLink } from "react-router-dom";
import { THEME } from "./theme";

const NAV_LINKS = [
  { path: "/",        label: "Home"    },
  { path: "/posture", label: "Posture" },
  { path: "/yoga",    label: "Yoga"    },
  { path: "/ddf",     label: "DDF"     },
  { path: "/planner", label: "Planner" },
];

export default function Navbar() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=IM+Fell+English:ital@0;1&display=swap');

        .nav-link {
          padding: 6px 16px;
          border-radius: 20px;
          font-family: 'Cinzel', serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-decoration: none;
          color: ${THEME.creamDim};
          border: 1px solid transparent;
          transition: all 0.25s ease;
          white-space: nowrap;
        }

        .nav-link:hover {
          color: ${THEME.gold};
          border-color: ${THEME.borderLight};
          background: ${THEME.gold}10;
        }

        .nav-link.active {
          color: ${THEME.goldDim};
          border-color: ${THEME.border};
          background: ${THEME.gold}15;
        }
      `}</style>

      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: THEME.bgCard,
        borderBottom: `1px solid ${THEME.border}`,
        boxShadow: `0 2px 16px ${THEME.gold}12`,
        backdropFilter: "blur(10px)",
      }}>
        <div style={{
          maxWidth: "1100px", margin: "0 auto",
          padding: "0 28px", height: "58px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>

          {/* Logo */}
          <NavLink to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px", lineHeight: 1 }}>☀️</span>
            <span style={{
              fontFamily: "'Cinzel', serif", fontWeight: "700",
              fontSize: "15px", letterSpacing: "0.14em",
              color: THEME.cream,
            }}>
              ArogyaMind
            </span>
          </NavLink>

          {/* Links */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {NAV_LINKS.map(({ path, label }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/"}
                className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              >
                {label}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Gold shimmer line */}
        <div style={{
          height: "2px",
          background: `linear-gradient(90deg, transparent, ${THEME.gold}60, ${THEME.goldBright}80, ${THEME.gold}60, transparent)`,
        }} />
      </nav>
    </>
  );
