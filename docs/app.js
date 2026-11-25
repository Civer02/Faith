// November 8, 2026 was Proverbs 15 and Psalm 125. Each calendar day moves one chapter.
const ANCHOR = { year: 2026, month: 11, day: 8, proverbs: 15, psalm: 125 };

const COLORS = ["understand", "lookup", "deep"];
const COLOR_LABEL = {
  understand: "Understand",
  lookup: "Look up",
  deep: "Deep dive",
};

const readingEl = document.querySelector("#reading");
const todayEl = document.querySelector("#today");
const statusEl = document.querySelector("#status");
const copyBtn = document.querySelector("#copy");
const printBtn = document.querySelector("#print");
const themeBtn = document.querySelector("#theme");

let selected = "understand";
let passages = [];

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysAfterAnchor(today) {
  const anchor = new Date(ANCHOR.year, ANCHOR.month - 1, ANCHOR.day);
  return Math.round((startOfDay(today) - anchor) / 86400000);
}

function wrap(start, days, size) {
  return ((start - 1 + days) % size + size) % size + 1;
}

function todaysPlan(today) {
  const days = daysAfterAnchor(today);
  return {
    date: today,
    days,
    proverbs: wrap(ANCHOR.proverbs, days, 31),
    psalm: wrap(ANCHOR.psalm, days, 150),
  };
}

function dateKey(date) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function storageKey(date) {
  return `faith-marks-${dateKey(date)}`;
}

function loadMarks(date) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(date))) || {};
  } catch {
    return {};
  }
}

function saveMarks(date, marks) {
  localStorage.setItem(storageKey(date), JSON.stringify(marks));
}

async function fetchChapter(book, chapter) {
  const url = `https://bible-api.com/${book}+${chapter}?translation=web`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${book} ${chapter}`);
  const data = await response.json();
  return {
    title: data.reference,
    verses: data.verses.map((verse) => ({
      n: verse.verse,
      text: verse.text.replace(/\s+/g, " ").trim(),
    })),
  };
}

function renderPassage(passage, marks) {
  const section = document.createElement("section");
  section.className = "passage";
  const heading = document.createElement("h2");
  heading.textContent = passage.title;
  section.append(heading);
  for (const verse of passage.verses) {
    const id = `${passage.id}:${verse.n}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "verse";
    button.dataset.id = id;
    button.dataset.title = passage.title;
    button.dataset.n = String(verse.n);
    button.dataset.text = verse.text;
    const mark = marks[id];
    if (mark) button.classList.add(mark);
    const num = document.createElement("span");
    num.className = "num";
    num.textContent = String(verse.n);
    const words = document.createElement("span");
    words.textContent = verse.text;
    button.append(num, words);
    button.addEventListener("click", () => toggleVerse(button, marks));
    section.append(button);
  }
  return section;
}

function toggleVerse(button, marks) {
  const id = button.dataset.id;
  if (marks[id] === selected) {
    delete marks[id];
    button.classList.remove(selected);
  } else {
    for (const color of COLORS) button.classList.remove(color);
    marks[id] = selected;
    button.classList.add(selected);
  }
  saveMarks(plan.date, marks);
  statusEl.hidden = true;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("faith-theme", theme);
  themeBtn.textContent = theme === "dark" ? "Light mode" : "Dark mode";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === "dark" ? "#1b1814" : "#f4efe4";
}

function setColor(color) {
  selected = color;
  for (const tool of document.querySelectorAll(".tool")) {
    tool.setAttribute("aria-pressed", String(tool.dataset.color === color));
  }
}

function reportText() {
  const groups = { understand: [], lookup: [], deep: [] };
  for (const button of readingEl.querySelectorAll(".verse")) {
    const mark = COLORS.find((color) => button.classList.contains(color));
    if (!mark) continue;
    groups[mark].push(`${button.dataset.title}:${button.dataset.n} ${button.dataset.text}`);
  }
  const marked = COLORS.reduce((sum, color) => sum + groups[color].length, 0);
  if (!marked) return "";
  const lines = [
    "Highlight key",
    "Green = Understand. Already clear.",
    "Yellow = Look up. Explain briefly.",
    "Pink = Deep dive. Study in depth. A red mark means the same as pink.",
    "",
    todayEl.textContent,
    passages.map((passage) => passage.title).join(" and "),
    "",
  ];
  for (const color of COLORS) {
    if (!groups[color].length) continue;
    lines.push(COLOR_LABEL[color]);
    for (const line of groups[color]) lines.push(line);
    lines.push("");
  }
  lines.push("Write a study report from these highlights.");
  return lines.join("\n");
}

async function copyReport() {
  const text = reportText();
  if (!text) {
    statusEl.hidden = false;
    statusEl.textContent = "Mark a verse first, then copy it for chat.";
    return;
  }
  await navigator.clipboard.writeText(text);
  statusEl.hidden = false;
  statusEl.textContent = "Copied. Paste it into a chat to get the study report.";
}

let plan;

async function start() {
  plan = todaysPlan(new Date());
  todayEl.textContent = plan.date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  readingEl.textContent = "Loading today’s reading…";
  try {
    const [proverbs, psalm] = await Promise.all([
      fetchChapter("proverbs", plan.proverbs),
      fetchChapter("psalms", plan.psalm),
    ]);
    passages = [
      { id: "proverbs", ...proverbs },
      { id: "psalm", ...psalm },
    ];
    const marks = loadMarks(plan.date);
    readingEl.replaceChildren(...passages.map((passage) => renderPassage(passage, marks)));
  } catch (error) {
    readingEl.textContent = "The reading could not load. Check the connection and open this page again.";
    statusEl.hidden = false;
    statusEl.textContent = error.message;
  }
}

for (const tool of document.querySelectorAll(".tool")) {
  tool.addEventListener("click", () => setColor(tool.dataset.color));
}
copyBtn.addEventListener("click", () => {
  copyReport().catch(() => {
    statusEl.hidden = false;
    statusEl.textContent = "Copy did not work. Select the verses and copy them yourself.";
  });
});
printBtn.addEventListener("click", () => window.print());
themeBtn.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
});
applyTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");

start();
