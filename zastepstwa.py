import json
import re
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup


SUBSTITUTIONS_URL = "https://zastepstwa.zse.bydgoszcz.pl/"
DAYS = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek"]
DAY_NAMES = [day.lower() for day in DAYS]
WARSAW = ZoneInfo("Europe/Warsaw")


def school_week(target: date) -> int:
    school_year = target.year if target.month >= 8 else target.year - 1
    first_day = date(school_year, 8, 31)
    return (target - first_day).days // 7 + 1


def next_school_day(current: date) -> date:
    days_ahead = 1 if current.weekday() < 4 else 3
    return current + timedelta(days=days_ahead)


def base_target_date() -> date | None:
    now = datetime.now(WARSAW)
    current = now.date()
    if current.weekday() == 5 or (
        current.weekday() == 6 and now.hour < 14
    ):
        return None
    if current.weekday() == 6:
        return current + timedelta(days=1)
    return current


def page_day_index(soup: BeautifulSoup) -> int | None:
    nobr = soup.find("nobr")
    text = (
        nobr.get_text("\n", strip=True).splitlines()[0]
        if nobr else soup.get_text(" ", strip=True)
    )
    normalized = text.lower()
    match = re.search(r"zastępstwa\s+w\s+dniu\s+\d{2}\.\d{2}\.\d{4}\s+(\S+)", normalized)
    if match:
        day = match.group(1)
        if day in DAY_NAMES:
            return DAY_NAMES.index(day)
    for index, name in enumerate(DAY_NAMES):
        if name in normalized:
            return index
    return None


def read_substitutions(
    session: requests.Session,
) -> tuple[list[list[str]], int | None]:
    response = session.get(SUBSTITUTIONS_URL, timeout=30)
    response.raise_for_status()
    response.encoding = "iso-8859-2"
    soup = BeautifulSoup(response.text, "html.parser")
    teacher_cells = soup.find_all("td", class_="st1")
    rows = soup.find_all("tr")
    teachers = [cell.get_text(strip=True) for cell in teacher_cells]
    result = []
    teacher_index = 0
    current_teacher = None

    for row in rows[1:]:
        headers = row.find_all("td", class_="st1")
        info = row.find_all("td", string=lambda text: text and "opis" in text)
        if headers:
            if teacher_index >= len(teachers):
                continue
            current_teacher = teachers[teacher_index]
            teacher_index += 1

        if not current_teacher:
            continue
        values = [cell.get_text(" ", strip=True).replace("\xa0", "") for cell in row.find_all("td")]
        values = [value or "brak" for value in values]
        if headers or info or len(values) < 4:
            continue
        values = [current_teacher, *values]
        values[2:3] = values[2].split(" - ", 1)
        while len(values) < 6:
            values.append("brak")
        result.append(values[:6])
    return result, page_day_index(soup)


def class_selector(value: str) -> tuple[str, str]:
    group_match = re.search(r"\(([12])\)", value)
    value = re.sub(r"\([12]\)", "", value)
    name = re.sub(r"^(\d+)\s*([A-Za-z])$", r"\1\2", value.strip())
    return name, (f"{group_match.group(1)}/" if group_match else "")


def moved_from_period(subject: str) -> int | None:
    match = re.search(r"\bz\s*(\d+)\s*h\s*lek\.?", subject, re.IGNORECASE)
    return int(match.group(1)) if match else None


def replacement_subject(subject: str) -> str:
    return re.sub(r"\s+z\s*\d+\s*h\s*lek\.?", "", subject, flags=re.IGNORECASE).strip()


def apply_substitutions(plan: dict, rows: list[list[str]], day_index: int) -> int:
    changed = 0
    for row in rows:
        if len(row) < 6 or row[1] == "brak" or row[2] == "brak":
            continue
        selected_class, selected_group = class_selector(row[2])
        try:
            period = int(row[1])
        except ValueError:
            continue
        source_period = moved_from_period(row[5])
        for lesson in plan["lessons"]:
            if (
                source_period is not None
                and lesson["dayIndex"] == day_index
                and lesson["period"] == source_period
                and lesson["class"] == selected_class
                and (
                    not selected_group
                    or lesson["group"].startswith(selected_group)
                )
            ):
                lesson["subject"] = "brak"
                lesson["teacher"] = "brak"
                lesson["room"] = "brak"
                lesson.pop("substitution", None)
            if (
                lesson["dayIndex"] == day_index
                and lesson["period"] == period
                and lesson["class"] == selected_class
                and (
                    not selected_group
                    or lesson["group"].startswith(selected_group)
                )
            ):
                original = {
                    "subject": lesson["subject"],
                    "teacher": lesson["teacher"],
                    "room": lesson["room"],
                }
                if row[5] != "brak":
                    lesson["subject"] = replacement_subject(row[5])
                lesson["teacher"] = row[4]
                lesson["room"] = row[3]
                lesson["substitution"] = {"original": original, "source": SUBSTITUTIONS_URL}
                changed += 1
    return changed


def main() -> None:
    root = Path(__file__).parent
    base_path = root / "data" / "base.json"
    plan = json.loads(base_path.read_text(encoding="utf-8"))
    current = base_target_date()
    if current is None:
        print("Brak zastępstw przed niedzielnym resetem o 14:00.")
        return

    session = requests.Session()
    rows, page_day = read_substitutions(session)
    if page_day is None:
        raise RuntimeError("Nie udało się odczytać dnia, którego dotyczą zastępstwa")

    expected_day = current.weekday()
    next_day = next_school_day(current)
    if page_day == expected_day:
        target = current
    elif page_day == next_day.weekday():
        target = next_day
    else:
        raise RuntimeError(
            "Strona zastępstw dotyczy nieoczekiwanego dnia: "
            f"{DAYS[page_day]}, oczekiwano {DAYS[expected_day]} "
            f"lub {DAYS[next_day.weekday()]}"
        )

    plan["metadata"]["week"] = school_week(target)
    week_path = root / "data" / f"tydzien_{plan['metadata']['week']}"
    week_path.mkdir(parents=True, exist_ok=True)
    daily_path = week_path / f"zastepstwa-{target.isoformat()}.json"
    daily_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")

    changed = 0
    for saved_path in sorted(week_path.glob("zastepstwa-*.json")):
        saved_date = date.fromisoformat(saved_path.stem.removeprefix("zastepstwa-"))
        if saved_date.weekday() < 5:
            saved_rows = json.loads(saved_path.read_text(encoding="utf-8"))
            changed += apply_substitutions(plan, saved_rows, saved_date.weekday())

    plan["metadata"]["substitutionsDate"] = target.isoformat()
    plan["metadata"]["substitutionsUpdatedAt"] = datetime.now(WARSAW).isoformat(timespec="minutes")
    substitution_files = [
        path.name
        for path in sorted(week_path.glob("zastepstwa-*.json"))
        if date.fromisoformat(path.stem.removeprefix("zastepstwa-")).weekday() < 5
    ]
    manifest = {
        "base": "base.json",
        "week": plan["metadata"]["week"],
        "substitutionFiles": [
            f"tydzien_{plan['metadata']['week']}/{name}"
            for name in substitution_files
        ],
        "metadata": {
            "substitutionsDate": target.isoformat(),
            "substitutionsUpdatedAt": plan["metadata"]["substitutionsUpdatedAt"],
        },
    }
    (root / "data" / "current.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Naniesiono {changed} zastępstw dla dnia {DAYS[target.weekday()]}.")


if __name__ == "__main__":
    main()
