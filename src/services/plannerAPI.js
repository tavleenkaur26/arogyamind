export async function generatePlanner(wake, sleep) {
  const response = await fetch("http://127.0.0.1:8000/generate-planner", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      wake_time: wake,
      sleep_time: sleep,
      work_hours: [["09:00", "17:00"]],
      stress_level: "Medium",
      tasks: [{ name: "Math", type: "Deep Work" }],
    }),
  });

  return response.json();
}