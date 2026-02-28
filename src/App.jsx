import { Routes, Route } from "react-router-dom";
import PostureDetector from "./components/PostureDetector";
import YogaDetector from "./components/YogaDetector";
import DharmicDecisionFramework from "./components/DharmicDecisionFramework";
import Navbar from "./components/Navbar";
import Planner from "./components/Planner";
import Home from "./components/Home";

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/posture" element={<PostureDetector />} />
        <Route path="/yoga" element={<YogaDetector />} />
        <Route path="/ddf" element={<DharmicDecisionFramework />} />
      </Routes>
    </>
  );
}