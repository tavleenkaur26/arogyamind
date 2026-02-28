"""
interventions.py
----------------
Fires grounding/affirmation prompts based purely on elapsed work time —
every 3 hours of continuous scheduled work, regardless of dosha phase.

If a person works 8 hours → 2 interventions (at hour 3 and hour 6).
If a person works 4 hours → 1 intervention (at hour 3).
"""

import random

INTERVENTION_INTERVAL_MINUTES = 180  # every 3 hours

AFFIRMATIONS = [
    {"message": "You've been at it for 3 hours. Drink a glass of warm water and roll your shoulders back.", "theme": "Body Check-in"},
    {"message": "Pause for a moment. Take 3 slow, deep breaths before you continue.", "theme": "Breathe & Reset"},
    {"message": "Step away from the screen for 5 minutes — no phone, just stillness.", "theme": "Screen Break"},
    {"message": "Write down one clear intention for the next hour before you dive back in.", "theme": "Clarity Anchor"},
    {"message": "Close your eyes, breathe out slowly, and soften your jaw. You're doing well.", "theme": "Tension Release"},
    {"message": "Feel your feet on the floor for 30 seconds. Ground yourself before the next block.", "theme": "Grounding"},
    {"message": "Rest is not lost time — it's how ideas crystallise. Take a short walk if you can.", "theme": "Rest Prompt"},
]


def time_str_to_minutes(time_str):
    h, m = map(int, time_str.split(":"))
    return h * 60 + m


def minutes_to_time_str(minutes):
    h = (minutes // 60) % 24
    m = minutes % 60
    return f"{h:02d}:{m:02d}"


def get_affirmation(used_themes):
    """Pick a random affirmation, avoiding repeating themes where possible."""
    unused = [a for a in AFFIRMATIONS if a["theme"] not in used_themes]
    pool = unused if unused else AFFIRMATIONS
    return random.choice(pool)


def detect_and_inject(schedule):
    """
    Walk the schedule tracking cumulative work minutes.
    Every time 3 hours of real work accumulate, inject a grounding prompt
    immediately after the task that crossed the threshold.

    Breaks do not count toward the 3-hour clock (they reset nothing —
    only a proper break would reset it, but micro-breaks are too short).

    Returns:
        enriched_schedule  — schedule with intervention entries injected inline
        intervention_log   — list of all interventions for end-of-day summary
    """
    enriched_schedule = []
    intervention_log = []
    used_themes = []

    cumulative_work_minutes = 0
    next_trigger_at = INTERVENTION_INTERVAL_MINUTES  # first fires at 180 min

    for entry in schedule:
        enriched_schedule.append(entry)

        # Don't count breaks toward work time
        if entry.get("break") or entry.get("intervention"):
            continue

        start_min = time_str_to_minutes(entry["start"])
        end_min = time_str_to_minutes(entry["end"])
        task_duration = end_min - start_min

        if task_duration <= 0:
            continue

        cumulative_work_minutes += task_duration

        # Check if we've crossed one or more intervention thresholds during this task
        while cumulative_work_minutes >= next_trigger_at:
            affirmation = get_affirmation(used_themes)
            used_themes.append(affirmation["theme"])

            # Calculate the exact minute within the workday this fires
            # (offset back from cumulative to find the clock time it crossed)
            minutes_into_task_when_triggered = task_duration - (cumulative_work_minutes - next_trigger_at)
            fire_time = minutes_to_time_str(start_min + minutes_into_task_when_triggered)

            intervention = {
                "task_name": f"🌿 Grounding Prompt [{affirmation['theme']}]",
                "phase": entry["phase"],
                "start": fire_time,
                "end": fire_time,
                "break": False,
                "intervention": True,
                "message": affirmation["message"],
                "triggered_by": entry["task_name"],
                "trigger_reason": f"{next_trigger_at} min of work completed"
            }

            enriched_schedule.append(intervention)
            intervention_log.append(intervention)

            next_trigger_at += INTERVENTION_INTERVAL_MINUTES  # schedule the next one

    return enriched_schedule, intervention_log


def print_schedule_with_interventions(schedule):
    """Print the enriched schedule with intervention prompts displayed inline."""
    for entry in schedule:
        if entry.get("intervention"):
            print(f"\n  ⚡ GROUNDING PROMPT at {entry['start']} — {entry['task_name']}")
            print(f"     → {entry['message']}\n")
        else:
            label = "[BREAK]" if entry["break"] else ""
            print(f"{entry['start']} - {entry['end']}: {entry['task_name']} ({entry['phase']}) {label}")


def print_intervention_summary(intervention_log):
    """Print a clean summary of all interventions fired today."""
    if not intervention_log:
        print("\n✅ No interventions triggered — great pacing today!")
        return

    print("\n" + "=" * 52)
    print("===  🌿 Today's Grounding Prompts (Summary)  ===")
    print("=" * 52)
    for i, item in enumerate(intervention_log, 1):
        print(f"\n[{i}] At {item['start']} — after '{item['triggered_by']}'")
        print(f"    Reason  : {item['trigger_reason']}")
        print(f"    Theme   : {item['task_name']}")
        print(f"    Message : {item['message']}")
    print()