from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

from planner.dosha_mapper import map_dosha_phases
from planner.task_scheduler import schedule_tasks
from planner.interventions import detect_and_inject

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Task(BaseModel):
    name: str
    type: str

class PlannerRequest(BaseModel):
    wake_time: str
    sleep_time: str
    work_hours: list
    stress_level: str
    tasks: list

@app.post("/generate-planner")
def generate_planner(data: PlannerRequest):

    phases = map_dosha_phases(data.wake_time, data.sleep_time)

    schedule = schedule_tasks(
        data.tasks,
        phases,
        data.stress_level,
        data.work_hours
    )

    enriched_schedule, intervention_log = detect_and_inject(schedule)

    return {
        "phases": phases,
        "schedule": enriched_schedule,
        "interventions": intervention_log
    }