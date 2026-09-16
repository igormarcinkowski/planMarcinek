const kind = document.querySelector("#kind");
const value = document.querySelector("#value");
const group = document.querySelector("#group");
const groupField = document.querySelector("#group-field");
const wfGroup = document.querySelector("#wf-group");
const wfGroupField = document.querySelector("#wf-group-field");
const religion = document.querySelector("#religion");
const lessons = document.querySelector("#lessons");
const header = document.querySelector("#header");
const status = document.querySelector("#status");
const holidayName = document.querySelector("#holiday-name");
const selectionBadge = document.querySelector("#selection-badge");
const favoriteClassButton = document.querySelector("#favorite-class-button");
const favoriteClassPanel = document.querySelector("#favorite-class-panel");
const favoriteClassName = document.querySelector("#favorite-class-name");
const favoriteClassOpen = document.querySelector("#favorite-class-open");
let data;
let calendar;
const lessonHours = {
  0: ["07:05", "07:50"], 1: ["08:00", "08:45"],
  2: ["08:55", "09:40"], 3: ["09:50", "10:35"],
  4: ["10:45", "11:30"], 5: ["11:40", "12:25"],
  6: ["12:45", "13:30"], 7: ["13:40", "14:25"],
  8: ["14:45", "15:30"], 9: ["15:40", "16:25"],
  10: ["16:35", "17:20"], 11: ["17:30", "18:15"],
};
const fallbackCalendar = {
  holidays: [
    { name: "Dzień Nauczyciela", start: "2026-10-14", end: "2026-10-15", type: "holiday" },
    { name: "Wszystkich Świętych", start: "2026-11-01", end: "2026-11-02", type: "holiday" },
    { name: "Narodowe Święto Niepodległości", start: "2026-11-11", end: "2026-11-12", type: "holiday" },
    { name: "Zimowa przerwa świąteczna", start: "2026-12-23", end: "2027-01-02", type: "break" },
    { name: "Trzech Króli", start: "2027-01-06", end: "2027-01-07", type: "holiday" },
    { name: "Ferie zimowe", start: "2027-02-15", end: "2027-03-01", type: "break" },
    { name: "Wiosenna przerwa świąteczna", start: "2027-03-25", end: "2027-03-31", type: "break" },
    { name: "Święto Pracy", start: "2027-05-01", end: "2027-05-02", type: "holiday" },
    { name: "Święto Konstytucji 3 Maja", start: "2027-05-03", end: "2027-05-04", type: "holiday" },
    { name: "Boże Ciało", start: "2027-05-27", end: "2027-05-28", type: "holiday" },
    { name: "Dni dyrektorskie", start: "2027-01-08", end: "2027-01-09", type: "dwozd" },
    { name: "Dni dyrektorskie", start: "2027-05-04", end: "2027-05-05", type: "dwozd" },
    { name: "Dni dyrektorskie", start: "2027-05-05", end: "2027-05-06", type: "dwozd" },
    { name: "Dni dyrektorskie", start: "2027-05-06", end: "2027-05-07", type: "dwozd" },
    { name: "Dni dyrektorskie", start: "2027-05-07", end: "2027-05-08", type: "dwozd" },
    { name: "Dni dyrektorskie", start: "2027-05-17", end: "2027-05-18", type: "dwozd" },
    { name: "Dni dyrektorskie", start: "2027-05-28", end: "2027-05-29", type: "dwozd" },
    { name: "Dni dyrektorskie", start: "2027-06-24", end: "2027-06-25", type: "dwozd" },
  ],
  exams: "2027-05-04T09:00:00",
  vacation: "2027-06-25T15:00:00",
};

function optionsFor(selectedKind) {
  return selectedKind === "class" ? data.classes
    : selectedKind === "teacher" ? data.teachers : data.rooms;
}

function favoritePlan() {
  const saved = localStorage.getItem("favorite-class");
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed.value === "string") return parsed;
    if (parsed && typeof parsed.className === "string") {
      return { ...parsed, kind: "class", value: parsed.className };
    }
  } catch {
    return {
      kind: "class", value: saved, className: saved,
      group2: "", group3: "", wfGroup: "", religion: false,
    };
  }
  return null;
}

function renderOptions(selectedValue = localStorage.getItem("plan-value")) {
  value.replaceChildren();
  for (const item of optionsFor(kind.value)) {
    value.add(new Option(item, item));
  }
  if ([...value.options].some((option) => option.value === selectedValue)) {
    value.value = selectedValue;
  } else if (value.options.length) {
    value.selectedIndex = 0;
  }
  const groups = kind.value === "class"
    ? [...new Set(
      data.lessons
        .filter((lesson) => lesson.class === value.value)
        .flatMap((lesson) => lesson.groups || [])
    )]
    : [];
  const wfGroups = kind.value === "class"
    ? [...new Set(data.lessons
      .filter((lesson) => lesson.class === value.value && lesson.wfGroup)
      .map((lesson) => lesson.wfGroup))]
    : [];
  group.replaceChildren();
  const classKey = value.value;
  const favorite = favoritePlan();
  const favoriteForClass = kind.value === "class" && favorite?.kind === "class"
    && favorite.value === classKey ? favorite : null;
  const savedGroup2 = favoriteForClass?.group2
    ?? localStorage.getItem(`plan-group-2-${classKey}`)
    ?? localStorage.getItem("plan-group-2")
    ?? localStorage.getItem("plan-group") ?? "";
  const savedGroup3 = favoriteForClass?.group3
    ?? localStorage.getItem(`plan-group-3-${classKey}`)
    ?? localStorage.getItem("plan-group-3") ?? "";
  const savedWfGroup = favoriteForClass?.wfGroup
    ?? localStorage.getItem(`plan-wf-group-${classKey}`)
    ?? localStorage.getItem("plan-wf-group") ?? "";
  renderGroupFamily("Podział na 2", groups.filter((item) => item.endsWith("/2")), savedGroup2, "group-2");
  renderGroupFamily("Podział na 3", groups.filter((item) => item.endsWith("/3")), savedGroup3, "group-3");
  groupField.hidden = kind.value !== "class" || groups.length === 0;
  renderChoiceRadios(wfGroup, wfGroups, savedWfGroup, "wf-group");
  wfGroupField.hidden = kind.value !== "class" || wfGroups.length === 0;
  document.querySelector(".religion-panel").hidden = kind.value !== "class";
  updateFavoriteClass();
  renderLessons();
}

function updateFavoriteClass() {
  const favorite = favoritePlan();
  const isClass = kind.value === "class";
  const selectedGroups = {
    group2: group.querySelector('input[name="group-2"]:checked')?.value || "",
    group3: group.querySelector('input[name="group-3"]:checked')?.value || "",
    wfGroup: wfGroup.querySelector("input:checked")?.value || "",
    religion: religion.checked,
  };
  const selectedIsFavorite = kind.value === favorite?.kind
    && value.value === favorite?.value
    && (!isClass
      || (selectedGroups.group2 === (favorite?.group2 || "")
        && selectedGroups.group3 === (favorite?.group3 || "")
        && selectedGroups.wfGroup === (favorite?.wfGroup || "")
        && selectedGroups.religion === (favorite?.religion === true)));
  favoriteClassButton.hidden = false;
  favoriteClassButton.textContent = selectedIsFavorite ? "★" : "☆";
  favoriteClassButton.classList.toggle("is-favorite", selectedIsFavorite);
  favoriteClassButton.title = selectedIsFavorite
    ? "Usuń ulubiony widok"
    : "Zapisz jako ulubiony widok";
  const favoriteOptions = optionsFor(favorite?.kind || "class");
  favoriteClassPanel.hidden = !favorite || !favoriteOptions.includes(favorite.value);
  const favoriteGroups = favorite
    ? [
      favorite.group2,
      favorite.group3,
      favorite.kind === "class" && favorite.group2,
      favorite.kind === "class" && favorite.group3,
      favorite.kind === "class" && favorite.wfGroup && `WF ${favorite.wfGroup}`,
      favorite.kind === "class" && favorite.religion && "religia",
    ]
      .filter(Boolean)
      .join(" · ")
    : "";
  const favoriteLabel = favorite?.kind === "class" ? "Moja klasa"
    : favorite?.kind === "teacher" ? "Mój nauczyciel" : "Moja sala";
  favoriteClassName.textContent = favorite
    ? `${favoriteLabel}: ${favorite.value}${favoriteGroups ? ` · ${favoriteGroups}` : ""}`
    : "";
}

function renderGroupFamily(title, options, selected, name) {
  if (!options.length) return;
  const family = document.createElement("div");
  family.className = `group-family ${name === "group-2" ? "family-2" : "family-3"}`;
  const heading = document.createElement("span");
  heading.className = "group-family-title";
  heading.textContent = title;
  family.append(heading);
  const all = document.createElement("label");
  const allInput = document.createElement("input");
  allInput.type = "radio";
  allInput.name = name;
  allInput.value = "";
  all.append(allInput, document.createTextNode(" Wszystkie"));
  family.append(all);
  for (const item of options.sort()) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = item;
    label.append(input, document.createTextNode(` ${item}`));
    family.append(label);
  }
  const selectedInput = [...family.querySelectorAll("input")]
    .find((input) => input.value === selected);
  (selectedInput || allInput).checked = true;
  group.append(family);
}

function renderChoiceRadios(container, options, selected, name) {
  container.replaceChildren();
  const all = document.createElement("label");
  const allInput = document.createElement("input");
  allInput.type = "radio";
  allInput.name = name;
  allInput.value = "";
  all.append(allInput, document.createTextNode(" Wszystkie"));
  container.append(all);
  for (const item of options.sort()) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = item;
    label.append(input, document.createTextNode(` ${item}`));
    container.append(label);
  }
  const selectedInput = [...container.querySelectorAll("input")]
    .find((input) => input.value === selected);
  (selectedInput || allInput).checked = true;
}

function selectRoom(roomName) {
  kind.value = "room";
  localStorage.setItem("plan-value", roomName);
  renderOptions(roomName);
  renderLessons();
  saveSelection();
}

function selectTeacher(teacherName) {
  kind.value = "teacher";
  localStorage.setItem("plan-value", teacherName);
  renderOptions(teacherName);
  renderLessons();
  saveSelection();
}

function selectClass(className) {
  kind.value = "class";
  localStorage.setItem("plan-value", className);
  renderOptions(className);
  renderLessons();
  saveSelection();
}

function saveSelection() {
  localStorage.setItem("plan-kind", kind.value);
  localStorage.setItem("plan-value", value.value);
  const selectedGroup2 = group.querySelector('input[name="group-2"]:checked')?.value || "";
  const selectedGroup3 = group.querySelector('input[name="group-3"]:checked')?.value || "";
  const selectedWfGroup = wfGroup.querySelector("input:checked")?.value || "";
  localStorage.setItem("plan-group-2", selectedGroup2);
  localStorage.setItem("plan-group-3", selectedGroup3);
  localStorage.setItem("plan-wf-group", selectedWfGroup);
  if (kind.value === "class" && value.value) {
    localStorage.setItem(`plan-group-2-${value.value}`, selectedGroup2);
    localStorage.setItem(`plan-group-3-${value.value}`, selectedGroup3);
    localStorage.setItem(`plan-wf-group-${value.value}`, selectedWfGroup);
  }
  localStorage.setItem("plan-religion", religion.checked ? "true" : "false");
}

function renderLessons() {
  const selected = value.value;
  const kindLabels = { class: "Klasa", teacher: "Nauczyciel", room: "Sala" };
  selectionBadge.querySelector(".selection-badge-kind").textContent = kindLabels[kind.value];
  selectionBadge.querySelector("strong").textContent = kind.value === "teacher"
    ? teacherDisplayName(selected)
    : selected || "Nie wybrano";
  const rows = visibleLessons();
  const highlightedSlots = highlightedSlotKeys(rows, new Date());
  const periods = [...new Set(rows.map((lesson) => lesson.period))].sort((a, b) => a - b);
  const bySlot = new Map();
  for (const lesson of rows) {
    const key = `${lesson.period}:${lesson.dayIndex}`;
    if (!bySlot.has(key)) bySlot.set(key, []);
    bySlot.get(key).push(lesson);
  }

  function teacherDisplayName(name) {
    if (!name) return "Nie wybrano";
    const directory = data?.teacherDirectory || {};
    return Object.values(directory).includes(name)
      ? name
      : directory[name] || name;
  }

  header.replaceChildren();
  const headerRow = document.createElement("tr");
  for (const text of ["Lekcja", "Godziny", ...["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek"]]) {
    const cell = document.createElement("th");
    cell.textContent = text;
    headerRow.append(cell);
  }
  header.append(headerRow);
  lessons.replaceChildren();
  for (const period of periods) {
    const row = document.createElement("tr");
    const periodCell = document.createElement("th");
    periodCell.className = "period-cell";
    periodCell.textContent = period;
    row.append(periodCell);
    const timeCell = document.createElement("th");
    timeCell.className = "time-cell";
    const hours = lessonHours[period];
    timeCell.textContent = hours ? `${hours[0]}–${hours[1]}` : "—";
    row.append(timeCell);
    for (let day = 0; day < 5; day += 1) {
      const slot = bySlot.get(`${period}:${day}`) || [];
      const cell = document.createElement("td");
      const slotKey = `${period}:${day}`;
      if (highlightedSlots.current.has(slotKey)) cell.classList.add("current-lesson");
      if (highlightedSlots.next === slotKey) cell.classList.add("next-lesson");
      for (const lesson of slot) {
        const item = document.createElement("div");
        item.classList.toggle("substitution", Boolean(lesson.substitution));
        item.classList.toggle("cancelled-lesson",
          Boolean(lesson.cancelled
            || (kind.value === "teacher" && lesson.originalTeacher === value.value)
            || (kind.value === "room" && lesson.originalRoom === value.value)));
        if (kind.value !== "class") {
          const classLink = document.createElement("button");
          classLink.className = "class-link";
          classLink.type = "button";
          classLink.textContent = lesson.class;
          classLink.addEventListener("click", () => selectClass(lesson.class));
          item.append(classLink, document.createElement("br"));
        }
        if (!lesson.subject && lesson.teacher === "brak" && lesson.room === "brak") continue;
        const subject = document.createElement("strong");
        subject.textContent = lesson.subject === "brak" ? "" : lesson.subject;
        if (lesson.groups?.length) subject.textContent += ` (${lesson.groups[0]})`;
        item.append(subject);
        if (kind.value === "class" && lesson.teacher !== "brak"
          && isClickableValue(lesson.teacher)) {
          const teacherLink = document.createElement("button");
          teacherLink.className = "teacher-link";
          teacherLink.type = "button";
          teacherLink.textContent = lesson.teacher;
          teacherLink.addEventListener("click", () => selectTeacher(lesson.teacher));
          item.append(document.createElement("br"), teacherLink);
        } else if (kind.value === "room" && lesson.teacher !== "brak"
          && isClickableValue(lesson.teacher)) {
          const teacherLink = document.createElement("button");
          teacherLink.className = "teacher-link";
          teacherLink.type = "button";
          teacherLink.textContent = lesson.teacher;
          teacherLink.addEventListener("click", () => selectTeacher(lesson.teacher));
          item.append(document.createElement("br"), teacherLink);
        }
        if (lesson.room === "brak" && lesson.teacher === "brak" && lesson.subject === "brak") {
          item.textContent = "\u00a0";
        } else if (kind.value === "teacher" && lesson.room !== "brak"
          && isClickableValue(lesson.room)) {
          const roomLink = document.createElement("button");
          roomLink.className = "room-link";
          roomLink.type = "button";
          roomLink.textContent = lesson.room;
          roomLink.addEventListener("click", () => selectRoom(lesson.room));
          item.append(document.createElement("br"), roomLink);
        } else if (kind.value === "class" && lesson.room !== "brak"
          && isClickableValue(lesson.room)) {
          const roomLink = document.createElement("button");
          roomLink.className = "room-link";
          roomLink.type = "button";
          roomLink.textContent = lesson.room;
          roomLink.addEventListener("click", () => selectRoom(lesson.room));
          item.append(document.createElement("br"), roomLink);
        }
        if (lesson.substitution?.original) {
          const change = document.createElement("small");
          change.className = "substitution-change";
          change.append(document.createTextNode("było: "));
          const original = lesson.substitution.original;
          const oldText = [original.subject, original.teacher, original.room]
            .filter((part) => part && part !== "brak").join(" · ");
          const deleted = document.createElement("del");
          deleted.textContent = oldText || "brak lekcji";
          change.append(deleted);
          item.append(document.createElement("br"), change);
        }
        cell.append(item);
      }
      row.append(cell);
    }
    lessons.append(row);
  }
  const substitutions = rows.filter((lesson) => lesson.substitution).length;
  const updateText = new Date(data.metadata.generatedAt).toLocaleString("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const lessonCount = kind.value === "class"
    ? new Set(rows
      .filter((lesson) => lesson.subject !== "brak")
      .map((lesson) => `${lesson.dayIndex}:${lesson.period}`)).size
    : rows.filter((lesson) => lesson.subject !== "brak").length;
  status.innerHTML = `<span class="status-main">${lessonCount} lekcji</span> · ${substitutions} zastępstw <span class="status-update">• Plan zaktualizowano: ${updateText}</span>`;
  updateCountdowns(rows);
}

function formatDuration(milliseconds, includeMinutes = false, includeSeconds = false) {
  if (milliseconds <= 0) return "0m";
  const seconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (includeMinutes && minutes) parts.push(`${minutes}m`);
  if (includeSeconds && seconds % 60) parts.push(`${seconds % 60}s`);
  return parts.join(" ") || "0m";
}

function nextLessonDate(rows, now) {
  let result = null;
  for (const lesson of rows) {
    if (!lessonHours[lesson.period] || lesson.subject === "brak" || lesson.cancelled) continue;
    const day = now.getDay() === 0 ? 7 : now.getDay();
    let distance = lesson.dayIndex + 1 - day;
    if (distance < 0) distance += 7;
    const candidate = new Date(now);
    candidate.setHours(0, 0, 0, 0);
    candidate.setDate(candidate.getDate() + distance);
    const [hours, minutes] = lessonHours[lesson.period][0].split(":").map(Number);
    candidate.setHours(hours, minutes, 0, 0);
    if (candidate <= now) candidate.setDate(candidate.getDate() + 7);
    if (!result || candidate < result) result = candidate;
  }
  return result;
}

function updateCountdowns(rows = []) {
  const now = new Date();
  const lessonState = lessonStateFor(rows, now);
  const lessonCountdown = document.querySelector("#lesson-countdown");
  const lessonDetail = document.querySelector("#lesson-detail");
  setCountdownText(lessonCountdown, lessonState?.active
    ? "Trwa lekcja"
    : lessonState ? formatDuration(lessonState.time - now, true, true) : "Brak lekcji");
  lessonDetail.textContent = lessonState?.active
    ? `Do końca lekcji: ${formatDuration(lessonState.end - now, true, true)}`
    : lessonState ? "do rozpoczęcia" : "";

  const weekend = new Date(now);
  const days = (6 - now.getDay() + 7) % 7;
  weekend.setDate(weekend.getDate() + (now.getDay() === 0 || now.getDay() === 6 ? days + 7 : days));
  weekend.setHours(0, 0, 0, 0);
  setCountdownText(document.querySelector("#weekend-countdown"), formatDuration(weekend - now, true));

  const holidays = calendar?.holidays.map((holiday) => ({
    ...holiday,
    startDate: new Date(`${holiday.start}T00:00:00`),
    endDate: new Date(`${holiday.end}T00:00:00`),
  })).sort((a, b) => a.startDate - b.startDate) || [];
  const upcoming = holidays.find((holiday) => holiday.startDate > now);
  const active = holidays.find((holiday) => holiday.startDate <= now && now < holiday.endDate);
  holidayName.textContent = active ? active.name : upcoming?.name || "Brak zaplanowanych dni wolnych";
  setCountdownText(document.querySelector("#holiday-countdown"), active
    ? "DZISIAJ" : upcoming ? formatDuration(upcoming.startDate - now) : "Brak");

  const exams = new Date(calendar?.exams || fallbackCalendar.exams);
  setCountdownText(document.querySelector("#exam-countdown"), exams > now
    ? formatDuration(exams - now) : "MATURY TRWAJĄ");

  const vacation = new Date(calendar?.vacation || fallbackCalendar.vacation);
  setCountdownText(document.querySelector("#vacation-countdown"), vacation > now
    ? formatDuration(vacation - now) : "WAKACJE TRWAJĄ");
}

function setCountdownText(element, text) {
  if (element.textContent === text) return;
  element.textContent = text;
  element.classList.remove("countdown-updated");
  void element.offsetWidth;
  element.classList.add("countdown-updated");
}

function visibleLessons() {
  if (!data) return [];
  const selectedGroup2 = group.querySelector('input[name="group-2"]:checked')?.value;
  const selectedGroup3 = group.querySelector('input[name="group-3"]:checked')?.value;
  const selectedWfGroup = wfGroup.querySelector("input:checked")?.value;
  const lessonGroups = (lesson) => lesson.groups || [];
  return data.lessons.filter((lesson) => (
    (lesson[kind.value] === value.value
      || (kind.value === "teacher" && lesson.originalTeacher === value.value)
      || (kind.value === "room" && lesson.originalRoom === value.value))
    && (religion.checked || !lesson.subject?.startsWith("religia"))
    && (
      kind.value !== "class"
      || (
        (!selectedGroup2
          || lessonGroups(lesson).includes(selectedGroup2)
          || !lessonGroups(lesson).some((item) => item.endsWith("/2")))
        && (!selectedGroup3
          || lessonGroups(lesson).includes(selectedGroup3)
          || !lessonGroups(lesson).some((item) => item.endsWith("/3")))
      )
    )
    && (
      kind.value !== "class"
      || !selectedWfGroup
      || !lesson.wfGroup
      || lesson.wfGroup === selectedWfGroup
    )
  ));
}

function highlightedSlotKeys(rows, now) {
  const current = new Set();
  let next = null;
  for (const lesson of rows) {
    const hours = lessonHours[lesson.period];
    if (!hours || lesson.subject === "brak" || lesson.cancelled) continue;
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const distance = (lesson.dayIndex + 1 - (now.getDay() || 7) + 7) % 7;
    start.setDate(start.getDate() + distance);
    const [startHour, startMinute] = hours[0].split(":").map(Number);
    const [endHour, endMinute] = hours[1].split(":").map(Number);
    start.setHours(startHour, startMinute, 0, 0);
    const end = new Date(start);
    end.setHours(endHour, endMinute, 0, 0);
    const key = `${lesson.period}:${lesson.dayIndex}`;
    if (start <= now && now < end) current.add(key);
    if (start <= now) start.setDate(start.getDate() + 7);
    if (!next || start < next.time) next = { key, time: start };
  }
  return { current, next: next?.key || null };
}

function lessonStateFor(rows, now) {
  let next = null;
  for (const lesson of rows) {
    const hours = lessonHours[lesson.period];
    if (!hours || lesson.subject === "brak" || lesson.cancelled) continue;
    const weekday = now.getDay() || 7;
    let distance = lesson.dayIndex + 1 - weekday;
    if (distance < 0) distance += 7;
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + distance);
    const [startHour, startMinute] = hours[0].split(":").map(Number);
    const [endHour, endMinute] = hours[1].split(":").map(Number);
    start.setHours(startHour, startMinute, 0, 0);
    const end = new Date(start);
    end.setHours(endHour, endMinute, 0, 0);
    if (start <= now && now < end) return { time: now, end, active: true };
    if (start > now && (!next || start < next.time)) next = { time: start, end, active: false };
  }
  return next;
}

function renderHolidays() {
  const list = document.querySelector("#holidays");
  list.replaceChildren();
  for (const holiday of [...calendar.holidays].sort((a, b) => a.start.localeCompare(b.start))) {
    const item = document.createElement("li");
    const start = new Date(`${holiday.start}T00:00:00`);
    const end = new Date(`${holiday.end}T00:00:00`);
    item.className = holiday.type === "dwozd" ? "student-day-off" : "";
    const lastDay = new Date(end - 86400000);
    const dates = start.toDateString() === lastDay.toDateString()
      ? start.toLocaleDateString("pl-PL")
      : `${start.toLocaleDateString("pl-PL")}–${lastDay.toLocaleDateString("pl-PL")}`;
    item.textContent = `${holiday.name} — ${dates}`;
    list.append(item);
  }
}

function isClickableValue(value) {
  const normalized = value.toLocaleLowerCase("pl-PL");
  return !["uczniowie", "świetlica", "swietlica", "przychodzą później", "przychodza pozniej"]
    .some((phrase) => normalized.includes(phrase));
}

async function load() {
  const response = await fetch("data/current.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Nie udało się pobrać planu (${response.status})`);
  const current = await response.json();
  if (current.base && current.substitutionFiles) {
    const baseResponse = await fetch(`data/${current.base}`, { cache: "no-store" });
    if (!baseResponse.ok) throw new Error(`Nie udało się pobrać bazy planu (${baseResponse.status})`);
    data = await baseResponse.json();
    const substitutionResponses = await Promise.all(
      current.substitutionFiles.map((file) => fetch(`data/${file}`, { cache: "no-store" }))
    );
    const substitutionRows = [];
    for (const [index, substitutionResponse] of substitutionResponses.entries()) {
      if (!substitutionResponse.ok) {
        throw new Error(`Nie udało się pobrać zastępstw (${substitutionResponse.status})`);
      }
      const rows = await substitutionResponse.json();
      if (Array.isArray(rows)) {
        const fileDate = current.substitutionFiles[index].match(/\d{4}-\d{2}-\d{2}/)?.[0];
        substitutionRows.push(...rows.map((row) => ({ row, dayIndex: fileDate
          ? (new Date(`${fileDate}T00:00:00`).getDay() + 6) % 7 : 0 })));
      }
    }
    applySubstitutions(substitutionRows);
    data.metadata = { ...data.metadata, ...current.metadata };
  } else {
    data = current;
  }
  const calendarResponse = await fetch("data/calendar.json", { cache: "no-store" });
  calendar = calendarResponse.ok ? await calendarResponse.json() : fallbackCalendar;
  const favorite = favoritePlan();
  const savedKind = localStorage.getItem("plan-kind");
  const favoriteOptions = favorite ? optionsFor(favorite.kind) : [];
  if (favorite && favoriteOptions.includes(favorite.value)) {
    kind.value = favorite.kind;
    localStorage.setItem("plan-kind", favorite.kind);
    localStorage.setItem("plan-value", favorite.value);
  } else if (["class", "teacher", "room"].includes(savedKind)) {
    kind.value = savedKind;
  }
  religion.checked = favorite?.kind === "class"
    && favorite.value === localStorage.getItem("plan-value")
    ? favorite.religion === true
    : localStorage.getItem("plan-religion") === "true";
  renderHolidays();
  renderOptions();
}

function applySubstitutions(rows) {
  for (const entry of rows) {
    const row = entry.row;
    if (!Array.isArray(row) || row.length < 6 || row[1] === "brak" || row[2] === "brak") continue;
    const groupMatch = String(row[2]).match(/\(([12])\)/);
    const selectedClass = String(row[2]).replace(/\([12]\)/g, "").replace(/^(\d+)\s*([A-Za-z])$/, "$1$2").trim();
    const selectedGroup = groupMatch ? `${groupMatch[1]}/` : "";
    const period = Number(row[1]);
    const movedFromMatch = String(row[5]).match(/\bz\s*(\d+)\s*h\s*lek\.?/i);
    const movedFromPeriod = movedFromMatch ? Number(movedFromMatch[1]) : null;
    const replacementSubject = String(row[5])
      .replace(/\s+z\s*\d+\s*h\s*lek\.?/i, "").trim();
    for (const lesson of data.lessons) {
      if (movedFromPeriod !== null && lesson.dayIndex === entry.dayIndex
        && lesson.period === movedFromPeriod && lesson.class === selectedClass
        && (!selectedGroup || lesson.group.startsWith(selectedGroup))) {
        lesson.cancelled = true;
      }
      if (lesson.dayIndex !== entry.dayIndex || lesson.period !== period
        || lesson.class !== selectedClass
        || (selectedGroup && !lesson.group.startsWith(selectedGroup))) continue;
      const original = {
        subject: lesson.subject,
        teacher: lesson.teacher,
        room: lesson.room,
      };
      if (lesson.teacher === row[0]) {
        lesson.originalTeacher = lesson.teacher;
      }
      lesson.originalRoom = lesson.room;
      if (row[5] !== "brak") lesson.subject = replacementSubject;
      lesson.teacher = row[4];
      lesson.room = row[3];
      lesson.substitution = { original, source: "https://zastepstwa.zse.bydgoszcz.pl/" };
    }
  }
}

kind.addEventListener("change", () => {
  const selectedKind = kind.value;
  localStorage.setItem("plan-kind", selectedKind);
  renderOptions();
  saveSelection();
});
value.addEventListener("change", () => {
  const selectedValue = value.value;
  localStorage.setItem("plan-value", selectedValue);
  renderOptions(selectedValue);
  saveSelection();
});
group.addEventListener("change", () => {
  saveSelection();
  updateFavoriteClass();
  renderLessons();
});
wfGroup.addEventListener("change", () => {
  saveSelection();
  updateFavoriteClass();
  renderLessons();
});
religion.addEventListener("change", () => {
  saveSelection();
  updateFavoriteClass();
  renderLessons();
});
favoriteClassButton.addEventListener("click", () => {
  if (!value.value) return;
  const favorite = favoritePlan();
  const currentIsFavorite = favorite?.kind === kind.value
    && favorite.value === value.value
    && (kind.value !== "class"
      || ((favorite.group2 || "") === (group.querySelector('input[name="group-2"]:checked')?.value || "")
        && (favorite.group3 || "") === (group.querySelector('input[name="group-3"]:checked')?.value || "")
        && (favorite.wfGroup || "") === (wfGroup.querySelector("input:checked")?.value || "")
        && (favorite.religion === true) === religion.checked));
  if (currentIsFavorite) {
    localStorage.removeItem("favorite-class");
  } else {
    localStorage.setItem("favorite-class", JSON.stringify({
      kind: kind.value,
      value: value.value,
      ...(kind.value === "class" ? {
        group2: group.querySelector('input[name="group-2"]:checked')?.value || "",
        group3: group.querySelector('input[name="group-3"]:checked')?.value || "",
        wfGroup: wfGroup.querySelector("input:checked")?.value || "",
        religion: religion.checked,
      } : {}),
    }));
  }
  updateFavoriteClass();
});
favoriteClassOpen.addEventListener("click", () => {
  const favorite = favoritePlan();
  if (!favorite || !optionsFor(favorite.kind).includes(favorite.value)) return;
  kind.value = favorite.kind;
  localStorage.setItem("plan-value", favorite.value);
  renderOptions(favorite.value);
  saveSelection();
  updateFavoriteClass();
  renderLessons();
});
load().catch((error) => { status.textContent = error.message; });
setInterval(() => updateCountdowns(visibleLessons()), 1000);
