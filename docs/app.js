// November 8, 2026 was Proverbs 15 and Psalm 125. Each calendar day moves one chapter.
const ANCHOR = { year: 2026, month: 11, day: 8, proverbs: 15, psalm: 125 };

const COLORS = ["understand", "lookup", "deep"];
const RESPONSE_LIMIT = 500000;

const readingEl = document.querySelector("#reading");
const todayEl = document.querySelector("#today");
const statusEl = document.querySelector("#status");
const printBtn = document.querySelector("#print");
const themeBtn = document.querySelector("#theme");

let selected = "understand";

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
    const raw = localStorage.getItem(storageKey(date));
    if (!raw || raw.length > 20000) return Object.create(null);
    return FaithGuard.sanitizeMarks(JSON.parse(raw));
  } catch {
    return Object.create(null);
  }
}

function saveMarks(date, marks) {
  try {
    localStorage.setItem(storageKey(date), JSON.stringify(FaithGuard.sanitizeMarks(marks)));
  } catch {
    statusEl.hidden = false;
    statusEl.textContent = "This browser could not save the highlights.";
  }
}

function showStatus(message) {
  statusEl.hidden = false;
  statusEl.textContent = message;
}

async function readLimitedText(response) {
  if (!response.body || !response.body.getReader) {
    const text = await response.text();
    if (text.length > RESPONSE_LIMIT) throw new Error("The reading was too large to use.");
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > RESPONSE_LIMIT) {
      await reader.cancel();
      throw new Error("The reading was too large to use.");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

async function fetchChapter(book, chapter) {
  if ((book !== "proverbs" && book !== "psalms") || !Number.isInteger(chapter)) {
    throw new Error("The reading could not load.");
  }
  const url = `https://bible-api.com/${book}+${chapter}?translation=web`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (error && error.name === "AbortError") throw new Error("The reading took too long to load.");
    throw new Error(`Could not load ${book} ${chapter}`);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new Error(`Could not load ${book} ${chapter}`);
  const type = response.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("application/json")) {
    throw new Error("The reading was not valid.");
  }
  let data;
  try {
    data = JSON.parse(await readLimitedText(response));
  } catch (error) {
    if (error && error.message === "The reading was too large to use.") throw error;
    throw new Error("The reading was not valid.");
  }
  return FaithGuard.normalizeChapter(data, book, chapter);
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
    const mark = marks[id];
    if (FaithGuard.isColor(mark)) button.classList.add(mark);
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
  if (!/^(proverbs|psalm):[1-9][0-9]{0,2}$/.test(id || "")) return;
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
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("faith-theme", next);
  } catch {
    /* Highlights still work when theme storage is blocked. */
  }
  themeBtn.textContent = next === "dark" ? "Light mode" : "Dark mode";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = next === "dark" ? "#1b1814" : "#f4efe4";
}

function setColor(color) {
  if (!FaithGuard.isColor(color)) return;
  selected = color;
  for (const tool of document.querySelectorAll(".tool")) {
    tool.setAttribute("aria-pressed", String(tool.dataset.color === color));
  }
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
    const passages = [
      { id: "proverbs", ...proverbs },
      { id: "psalm", ...psalm },
    ];
    const marks = loadMarks(plan.date);
    readingEl.replaceChildren(...passages.map((passage) => renderPassage(passage, marks)));
  } catch (error) {
    readingEl.textContent = "The reading could not load. Check the connection and open this page again.";
    const message = error && typeof error.message === "string" ? error.message : "";
    const safe = message === "The reading was not valid."
      || message === "The reading did not match the requested chapter."
      || message === "The reading was too large to use."
      || message === "The reading took too long to load."
      || /^Could not load (proverbs|psalms) [1-9][0-9]{0,2}$/.test(message);
    showStatus(safe ? message : "The reading could not load. Check the connection and open this page again.");
  }
}

for (const tool of document.querySelectorAll(".tool")) {
  tool.addEventListener("click", () => setColor(tool.dataset.color));
}
printBtn.addEventListener("click", () => window.print());
themeBtn.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
});
applyTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");

start();
