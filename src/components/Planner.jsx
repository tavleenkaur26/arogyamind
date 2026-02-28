import { useState } from "react";
import { generatePlanner } from "../services/plannerAPI";

export default function Planner() {
  const [wake, setWake] = useState("07:00");
  const [sleep, setSleep] = useState("23:00");
  const [schedule, setSchedule] = useState([]);

  const handleGenerate = async () => {
    try {
      const data = await generatePlanner(wake, sleep);
      setSchedule(data.schedule);
    } catch (error) {
      console.error("Error generating planner:", error);
    }
  };

  return (
    <div style={{ padding: "40px" }}>
      <h2>Dinacharya Planner</h2>

      <div>
        <label>Wake Time:</label>
        <input
          type="time"
          value={wake}
          onChange={(e) => setWake(e.target.value)}
        />
      </div>

      <div>
        <label>Sleep Time:</label>
        <input
          type="time"
          value={sleep}
          onChange={(e) => setSleep(e.target.value)}
        />
      </div>

      <button onClick={handleGenerate}>Generate Planner</button>

      <div style={{ marginTop: "20px" }}>
        {schedule.map((block, index) => (
          <div key={index}>
            {block.start} - {block.end} → {block.task} ({block.energy_type})
          </div>
        ))}
      </div>
    </div>
  );
}