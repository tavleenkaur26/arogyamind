import React, { useState } from "react";
import principlesData from "../data/principles.json";
import "./DDF.css";

// Principle-based card colors
const principleColors = {
  Dharma: { bg: "#d0f0c0", heading: "#2e7d32" }, // green
  Vairagya: { bg: "#cfe3f6", heading: "#1565c0" }, // blue
  Abhyasa: { bg: "#fff4cc", heading: "#f9a825" } // yellow
};

const DharmicDecisionFramework = () => {
  // Emotional self-assessment
  const [stress, setStress] = useState(0);
  const [reactive, setReactive] = useState(0);
  const [overthinking, setOverthinking] = useState(0);

  // Resulting principle
  const [principle, setPrinciple] = useState(null);

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    let selectedPrinciple = "Abhyasa"; // default
    if (stress >= 4 || reactive >= 4) selectedPrinciple = "Vairagya";
    else if (overthinking >= 4) selectedPrinciple = "Dharma";

    setPrinciple(selectedPrinciple);
  };

  // Decision Clarity Score 0-100
  const clarityScore = 100 - ((stress + reactive + overthinking) / 15) * 100;

  // Dynamic clarity color
  const clarityColor =
    clarityScore >= 70 ? "#4caf50" : clarityScore >= 40 ? "#ff9800" : "#f44336";

  return (
    <div className="ddf-container">
      <h2>Dharmic Decision Framework</h2>

      {/* Self-assessment form */}
      <form onSubmit={handleSubmit} className="ddf-form">
        <label>Stress (1-5)</label>
        <input
          type="number"
          min="1"
          max="5"
          value={stress}
          onChange={(e) => setStress(Number(e.target.value))}
        />

        <label>Emotional Reactivity (1-5)</label>
        <input
          type="number"
          min="1"
          max="5"
          value={reactive}
          onChange={(e) => setReactive(Number(e.target.value))}
        />

        <label>Overthinking (1-5)</label>
        <input
          type="number"
          min="1"
          max="5"
          value={overthinking}
          onChange={(e) => setOverthinking(Number(e.target.value))}
        />

        <button type="submit">Generate Wisdom Card</button>
      </form>

      {/* Wisdom Card */}
      {principle && (
        <div
          className="wisdom-card"
          style={{
            backgroundColor: principleColors[principle].bg,
            color: "#000"
          }}
        >
          <h3 style={{ color: principleColors[principle].heading }}>
            {principle}
          </h3>
          <p>{principlesData[principle].description}</p>
          <p><strong>Reflect:</strong> {principlesData[principle].reflectionPrompt}</p>
          <p><strong>Practice:</strong> {principlesData[principle].microPractice}</p>
          <p><strong>Breathe:</strong> {principlesData[principle].breathingPrompt}</p>

          {/* Decision Clarity Score */}
          <div className="clarity-score">
            <label>Decision Clarity Score:</label>
            <progress
              value={clarityScore}
              max="100"
              style={{ accentColor: clarityColor }}
            >
              {clarityScore}%
            </progress>
            <span>{Math.round(clarityScore)}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DharmicDecisionFramework;