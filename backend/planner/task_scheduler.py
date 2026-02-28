TASK_PHASE_MAP = {
    "Deep Work": "Pitta",
    "High-Stakes Decision": "Pitta",
    "Creative": "Vata",
    "Light Work": "Kapha"
}

STRESS_BREAK_MAP = {
    "Low": 180,
    "Medium": 120,
    "High": 60
}


def time_str_to_minutes(time_str):
    hours, minutes = map(int, time_str.split(":"))
    return hours * 60 + minutes


def minutes_to_time_str(minutes):
    hours = (minutes // 60) % 24
    mins = minutes % 60
    return f"{hours:02d}:{mins:02d}"


def get_work_window(work_hours):
    windows = []
    for (start_str, end_str) in work_hours:
        windows.append((time_str_to_minutes(start_str), time_str_to_minutes(end_str)))
    return windows


def clip_to_work_window(phase_start, phase_end, work_windows):
    clipped = []
    for (w_start, w_end) in work_windows:
        overlap_start = max(phase_start, w_start)
        overlap_end = min(phase_end, w_end)
        if overlap_end > overlap_start:
            clipped.append((overlap_start, overlap_end))
    return clipped


def get_all_work_slots(phase_minutes, work_windows):
    """Return every minute-slot that is both inside a phase and inside work hours."""
    all_slots = []
    for p in phase_minutes:
        clipped = clip_to_work_window(p['start_min'], p['end_min'], work_windows)
        for (s, e) in clipped:
            all_slots.append({"phase": p['phase'], "start_min": s, "end_min": e})
    # Sort by start time
    return sorted(all_slots, key=lambda x: x['start_min'])


def schedule_tasks(tasks, phases, stress_level, work_hours):
    scheduled = []
    work_windows = get_work_window(work_hours)

    # Convert phases to minutes, skip zero-duration phases
    phase_minutes = []
    for p in phases:
        start_min = time_str_to_minutes(p['start'])
        end_min = time_str_to_minutes(p['end'])
        if end_min > start_min:
            phase_minutes.append({
                "phase": p['phase'],
                "start_min": start_min,
                "end_min": end_min
            })

    # Bucket tasks into their ideal phase
    phase_tasks = {p['phase']: [] for p in phase_minutes}
    orphan_tasks = []  # tasks whose ideal phase has no work-hour overlap

    for task in tasks:
        task_phase = TASK_PHASE_MAP.get(task['type'], "Kapha")
        # Check if the ideal phase actually has work-hour overlap
        ideal_phase_slots = []
        for p in phase_minutes:
            if p['phase'] == task_phase:
                ideal_phase_slots = clip_to_work_window(p['start_min'], p['end_min'], work_windows)
                break
        if ideal_phase_slots:
            phase_tasks[task_phase].append(task)
        else:
            orphan_tasks.append(task)

    # ── FALLBACK: redistribute orphan tasks across available work slots ──
    # Build a list of phases that DO have work-hour overlap, in time order
    if orphan_tasks:
        available_phases_with_slots = []
        for p in phase_minutes:
            slots = clip_to_work_window(p['start_min'], p['end_min'], work_windows)
            if slots:
                available_phases_with_slots.append(p['phase'])

        if available_phases_with_slots:
            # Round-robin orphans across available phases
            for i, task in enumerate(orphan_tasks):
                fallback_phase = available_phases_with_slots[i % len(available_phases_with_slots)]
                phase_tasks[fallback_phase].append(task)
                print(f"  [Note: '{task['name']}' ({task['type']}) ideal phase has no work-hour overlap. "
                      f"Rescheduled into {fallback_phase} phase.]")
        else:
            print("  [Warning: No work-hour overlap with any phase. No tasks scheduled.]")

    break_interval = STRESS_BREAK_MAP.get(stress_level, 120)

    for p in phase_minutes:
        tasks_in_phase = phase_tasks.get(p['phase'], [])
        if not tasks_in_phase:
            continue

        available_slots = clip_to_work_window(p['start_min'], p['end_min'], work_windows)
        if not available_slots:
            continue

        total_available = sum(end - start for start, end in available_slots)
        duration_per_task = total_available // len(tasks_in_phase)
        if duration_per_task < 1:
            duration_per_task = 1

        task_index = 0
        remaining = duration_per_task

        for (slot_start, slot_end) in available_slots:
            current_min = slot_start

            while task_index < len(tasks_in_phase) and current_min < slot_end:
                task = tasks_in_phase[task_index]
                task_start = current_min
                task_end = min(current_min + remaining, slot_end)

                if task_end <= task_start:
                    break

                scheduled.append({
                    "task_name": task['name'],
                    "phase": p['phase'],
                    "start_min": task_start,
                    "end_min": task_end,
                    "break": False
                })

                task_duration = task_end - task_start
                if task_duration >= break_interval:
                    mid = task_start + task_duration // 2
                    break_end = min(mid + 5, task_end - 1)
                    scheduled.append({
                        "task_name": "Micro-Break",
                        "phase": p['phase'],
                        "start_min": mid,
                        "end_min": break_end,
                        "break": True
                    })

                time_used = task_end - task_start
                remaining -= time_used
                if remaining <= 0:
                    task_index += 1
                    remaining = duration_per_task
                current_min = task_end

    # Sort and format
    final_schedule = []
    for s in sorted(scheduled, key=lambda x: x['start_min']):
        final_schedule.append({
            "task_name": s['task_name'],
            "phase": s['phase'],
            "start": minutes_to_time_str(s['start_min']),
            "end": minutes_to_time_str(s['end_min']),
            "break": s['break']
        })

    return final_schedule