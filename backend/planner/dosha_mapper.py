def time_str_to_minutes(time_str):
    hours, minutes = map(int, time_str.split(":"))
    return hours * 60 + minutes


def minutes_to_time_str(minutes):
    hours = (minutes // 60) % 24
    mins = minutes % 60
    return f"{hours:02d}:{mins:02d}"


def map_dosha_phases(wake_time, sleep_time):
    wake_minutes = time_str_to_minutes(wake_time)
    sleep_minutes = time_str_to_minutes(sleep_time)
    dosha_phase_length = 240  # 4 hours each

    # The first 3 phases are fixed-length from wake time
    raw_phases = [
        {"phase": "Kapha", "start": wake_minutes,                        "end": wake_minutes + dosha_phase_length},
        {"phase": "Pitta", "start": wake_minutes + dosha_phase_length,   "end": wake_minutes + 2 * dosha_phase_length},
        {"phase": "Vata",  "start": wake_minutes + 2 * dosha_phase_length, "end": wake_minutes + 3 * dosha_phase_length},
    ]

    # Evening Kapha: from end of Vata to sleep, only if there's time left
    vata_end = wake_minutes + 3 * dosha_phase_length
    if sleep_minutes > vata_end:
        raw_phases.append({"phase": "Kapha", "start": vata_end, "end": sleep_minutes})

    # Convert to time strings, skipping any zero-duration phases
    phases = []
    for p in raw_phases:
        if p["end"] > p["start"]:   # only keep phases with actual duration
            phases.append({
                "phase": p["phase"],
                "start": minutes_to_time_str(p["start"]),
                "end":   minutes_to_time_str(p["end"])
            })

    return phases