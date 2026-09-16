import json
import subprocess
import sys
from datetime import date
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from plan import DIRECTORY_URL, get_soup, read_validity
import requests


def main() -> None:
    root = Path(__file__).parent
    base_path = root / "data" / "base.json"
    today = datetime.now(ZoneInfo("Europe/Warsaw")).date()
    session = requests.Session()
    directory_soup = get_soup(session, DIRECTORY_URL)
    link = directory_soup.select_one('a[href^="plany/o"]')
    if link is None:
        raise RuntimeError("Nie znaleziono przykładowego planu klasy")
    first_url = requests.compat.urljoin(DIRECTORY_URL, link["href"])
    source_validity = read_validity(get_soup(session, first_url))

    should_update = not base_path.exists()
    if not should_update:
        base = json.loads(base_path.read_text(encoding="utf-8"))
        current_validity = base.get("metadata", {}).get("validity", {})
        end = date.fromisoformat(current_validity["to"])
        should_update = source_validity != current_validity and today >= end

    if should_update:
        subprocess.run([sys.executable, str(root / "plan.py")], check=True)
        print("Zaktualizowano plan bazowy.")
    else:
        print("Plan bazowy bez zmian; pominięto pełne pobieranie.")


if __name__ == "__main__":
    main()
