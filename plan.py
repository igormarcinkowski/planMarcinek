import json
import re
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup, NavigableString


BASE_URL = "https://plan.zse.bydgoszcz.pl/"
DIRECTORY_URL = urljoin(BASE_URL, "lista.html")
DAYS = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek"]
VALIDITY_RE = re.compile(
    r"Obowi.{0,3}zuje od:\s*(\d{2}\.\d{2}\.\d{4})\s*r\.\s*do\s*(\d{2}\.\d{2}\.\d{4})\s*r\.",
    re.IGNORECASE,
)
WARSAW = ZoneInfo("Europe/Warsaw")


def school_week(target: date) -> int:
    school_year = target.year if target.month >= 8 else target.year - 1
    first_day = date(school_year, 8, 31)
    return (target - first_day).days // 7 + 1


def get_soup(session: requests.Session, url: str) -> BeautifulSoup:
    response = session.get(url, timeout=30)
    response.raise_for_status()
    response.encoding = "utf-8"
    return BeautifulSoup(response.text, "html.parser")


def read_validity(soup: BeautifulSoup) -> dict[str, str]:
    match = VALIDITY_RE.search(soup.get_text(" ", strip=True))
    if not match:
        raise RuntimeError("Nie znaleziono daty obowiązywania planu")
    start = datetime.strptime(match.group(1), "%d.%m.%Y").date()
    end = datetime.strptime(match.group(2), "%d.%m.%Y").date()
    return {"from": start.isoformat(), "to": end.isoformat()}


def read_directory(
    session: requests.Session,
) -> tuple[list[dict[str, str]], dict[str, str], dict[str, str]]:
    soup = get_soup(session, DIRECTORY_URL)
    classes = []
    for link in soup.select('a[href^="plany/o"]'):
        name = link.get_text(" ", strip=True)
        href = link.get("href")
        if name and href:
            classes.append(
                {
                    "name": name.split()[0],
                    "label": name,
                    "url": urljoin(DIRECTORY_URL, href),
                }
            )

    teachers = {}
    teacher_directory = {}
    for link in soup.select('a[href^="plany/n"]'):
        label = link.get_text(" ", strip=True)
        match = re.match(r"(.+?)\s*\(([^)]+)\)", label)
        if match:
            full_name = re.sub(r"\.([^\s])", r". \1", match.group(1)).strip()
            teachers[match.group(2)] = full_name
            teacher_directory[match.group(2)] = full_name
    return classes, teachers, teacher_directory


def parse_class_plan(
    session: requests.Session,
    class_info: dict[str, str],
    teacher_names: dict[str, str],
) -> tuple[list[dict[str, object]], dict[str, str]]:
    soup = get_soup(session, class_info["url"])
    validity = read_validity(soup)
    table = soup.find("table", class_="tabela")
    if table is None:
        raise RuntimeError(f"Nie znaleziono tabeli planu: {class_info['url']}")

    rows = table.find_all("tr")[1:]
    lessons = []
    for row in rows:
        number_cell = row.find("td", class_="nr")
        cells = row.find_all("td", class_="l")
        if number_cell is None or len(cells) < 5:
            continue

        period = number_cell.get_text(strip=True)
        for day_index, cell in enumerate(cells[:5]):
            subject_spans = cell.find_all("span", class_="p")
            subject_texts = []
            for subject_span in subject_spans:
                text = subject_span.get_text(" ", strip=True)
                sibling = subject_span.next_sibling
                if isinstance(sibling, NavigableString):
                    suffix = sibling.strip().split(" ")[0]
                    if suffix.startswith("-"):
                        text += suffix
                subject_texts.append(text)
            if not subject_texts:
                plain_text = cell.get_text(" ", strip=True)
                if plain_text:
                    subject_texts.append(plain_text)
            subjects = [
                subject for subject in subject_texts
                if not subject.startswith("#")
            ]
            markers = [
                subject for subject in subject_texts if subject.startswith("#")
            ]
            teachers = cell.find_all("a", class_="n")
            rooms = cell.find_all("a", class_="s")
            for selected, subject in enumerate(subjects):
                group_match = re.search(r"-([123])/([23])$", subject)
                group = (
                    f"{group_match.group(1)}/{group_match.group(2)}"
                    if group_match
                    else ""
                )
                wf_group = ""
                if group_match:
                    subject = subject[:group_match.start()].strip()
                if subject.startswith("wf-j"):
                    wf_group = {"j1": "1/2", "j2": "2/2"}.get(subject[-2:], "")
                    group = ""
                    subject = "wf"

                teacher_code = (
                    teachers[selected].get_text(" ", strip=True)
                    if selected < len(teachers)
                    else "brak"
                )
                teacher = teacher_names.get(teacher_code, teacher_code)
                room = (
                    rooms[selected].get_text(" ", strip=True)
                    if selected < len(rooms)
                    else "brak"
                )
                if subject.startswith("religia"):
                    teacher = "T. Poćwiardowski"
                elif subject == "wf":
                    teacher = "Ł. Dolski"
                if subject == "brak":
                    teacher = room = "brak"

                lessons.append(
                    {
                        "class": class_info["name"],
                        "classLabel": class_info["label"],
                        "day": DAYS[day_index],
                        "dayIndex": day_index,
                        "period": int(period),
                        "subject": subject,
                        "group": group,
                        "wfGroup": wf_group,
                        "groupMarkers": markers,
                        "teacher": teacher,
                        "room": room,
                    }
                )
            if not subjects:
                lessons.append(
                    {
                        "class": class_info["name"],
                        "classLabel": class_info["label"],
                        "day": DAYS[day_index],
                        "dayIndex": day_index,
                        "period": int(period),
                        "subject": "brak",
                        "group": "",
                        "wfGroup": "",
                        "teacher": "brak",
                        "room": "brak",
                        "groupMarkers": [],
                    }
                )
    return lessons, validity


def add_group_aliases(lessons: list[dict[str, object]]) -> None:
    slots: dict[tuple[str, int, int], list[dict[str, object]]] = {}
    for lesson in lessons:
        key = (str(lesson["class"]), int(lesson["dayIndex"]), int(lesson["period"]))
        slots.setdefault(key, []).append(lesson)

    for slot in slots.values():
        standard_groups = {
            str(item["group"])
            for item in slot
            if str(item["group"]) in {"1/2", "2/2"}
        }
        for lesson in slot:
            group = str(lesson["group"])
            aliases = [group] if group else []
            markers = lesson.get("groupMarkers", [])
            if markers and standard_groups and lesson["subject"] == "wf":
                if "1/2" in standard_groups and "2/2" not in standard_groups:
                    lesson["wfGroup"] = "2/2"
                elif "2/2" in standard_groups and "1/2" not in standard_groups:
                    lesson["wfGroup"] = "1/2"
            lesson["groups"] = sorted(set(aliases))
            lesson.pop("groupMarkers", None)


def main() -> None:
    target = date.today()
    now = datetime.now(WARSAW)
    target = now.date()
    if target.weekday() == 5 or (target.weekday() == 6 and now.hour < 14):
        return
    if target.weekday() == 6:
        target += timedelta(days=1)

    session = requests.Session()
    classes, teacher_names, teacher_directory = read_directory(session)
    lessons = []
    for class_info in classes:
        class_lessons, validity = parse_class_plan(session, class_info, teacher_names)
        lessons.extend(class_lessons)
    add_group_aliases(lessons)

    output = {
        "metadata": {
            "generatedAt": now.isoformat(timespec="minutes"),
            "week": school_week(target),
            "source": DIRECTORY_URL,
            "validity": validity,
        },
        "classes": sorted({item["class"] for item in lessons}),
        "teachers": sorted({item["teacher"] for item in lessons if item["teacher"] != "brak"}),
        "teacherDirectory": teacher_directory,
        "rooms": sorted({item["room"] for item in lessons if item["room"] != "brak"}),
        "groups": sorted({
            group
            for item in lessons
            for group in item["groups"]
        }),
        "lessons": lessons,
    }

    root = Path(__file__).parent
    (root / "data" / "base.json").write_text(
        json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Zapisano {len(lessons)} lekcji z {len(classes)} klas do data/base.json")


if __name__ == "__main__":
    main()
