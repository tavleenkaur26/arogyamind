from planner.user_input import get_user_input
from planner.dosha_mapper import map_dosha_phases
from planner.task_scheduler import schedule_tasks
from planner.interventions import (
    detect_and_inject,
    print_schedule_with_interventions,
    print_intervention_summary
)

DOSHA_DESCRIPTIONS = {
    "Kapha": "🌿 Slow & steady — ideal for planning, light admin, and easing into the day.",
    "Pitta": "🔥 Sharp & focused — peak time for deep work, analysis, and important decisions.",
    "Vata": "🌬  Creative & expansive — best for brainstorming, creative tasks, and flexible thinking.",
}


def main():
    print("=== Welcome to Dinacharya Planner MVP ===\n")
    user_data = get_user_input()

    # Step 1: Map dosha phases to the user's day
    phases = map_dosha_phases(user_data["wake_time"], user_data["sleep_time"])

    print("\nYour Dosha Phases for the Day:")
    for p in phases:
        description = DOSHA_DESCRIPTIONS.get(p['phase'], "")
        print(f"  {p['phase']}: {p['start']} - {p['end']}")
        print(f"    {description}")

    # Step 2: Schedule tasks within work hours
    schedule = schedule_tasks(
        user_data["tasks"],
        phases,
        user_data["stress_level"],
        user_data["work_hours"]
    )

    # Step 3: Detect triggers and inject interventions
    enriched_schedule, intervention_log = detect_and_inject(schedule)

    # Step 4: Print the full schedule (with inline intervention flags)
    print("\n=== Your Dinacharya Daily Schedule ===\n")
    print_schedule_with_interventions(enriched_schedule)

    # Step 5: Print the end-of-day intervention summary
    print_intervention_summary(intervention_log)


if __name__ == "__main__":
    main()
