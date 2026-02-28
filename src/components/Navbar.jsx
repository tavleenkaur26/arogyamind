import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav style={{ padding: "15px", background: "#111", color: "white" }}>
      <Link to="/" style={{ margin: "10px", color: "white" }}>Home</Link>
      <Link to="/posture" style={{ margin: "10px", color: "white" }}>Posture</Link>
      <Link to="/yoga" style={{ margin: "10px", color: "white" }}>Yoga</Link>
      <Link to="/ddf" style={{ margin: "10px", color: "white" }}>DDF</Link>
      <Link to="/planner">Planner</Link>
    </nav>
  );
}
