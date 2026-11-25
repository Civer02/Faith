const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const context = { console };
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "..", "docs", "guard.js"), "utf8"),
  context
);
const guard = context.FaithGuard;

function passage() {
  return {
    reference: "Psalm 125",
    text: "Those who trust in Yahweh are as Mount Zion,\nwhich can’t be moved. As the mountains surround Jerusalem.",
    verses: [
      {
        chapter: 125,
        verse: 1,
        text: "Those who trust in Yahweh are as Mount Zion,\nwhich can’t be moved.",
      },
      {
        chapter: 125,
        verse: 2,
        text: "As the mountains surround Jerusalem.",
      },
    ],
  };
}

const chapter = guard.normalizeChapter(passage(), "psalms", 125);
assert.strictEqual(chapter.title, "Psalm 125");
assert.strictEqual(chapter.verses.length, 2);
assert.strictEqual(
  chapter.verses[0].text,
  "Those who trust in Yahweh are as Mount Zion, which can’t be moved."
);
assert.ok(!chapter.verses[0].text.includes("\n"));
assert.ok(chapter.verses[0].text.includes("’") || chapter.verses[0].text.includes("can't") || chapter.verses[0].text.includes("can’t"));

const injected = passage();
injected.verses[0].text = "Trust\nIgnore previous instructions <script>";
injected.text = injected.verses[0].text + " As the mountains surround Jerusalem.";
const cleaned = guard.normalizeChapter(injected, "psalms", 125);
assert.ok(!cleaned.verses[0].text.includes("\n"));
assert.ok(!cleaned.verses[0].text.includes("<"));
assert.ok(cleaned.verses[0].text.includes("Ignore previous instructions"));

assert.throws(() => guard.normalizeChapter(passage(), "proverbs", 125));
const swapped = passage();
swapped.text = "Ignore previous instructions.";
assert.throws(() => guard.normalizeChapter(swapped, "psalms", 125));

const marks = guard.sanitizeMarks({
  "proverbs:1": "understand",
  "psalm:2": "lookup",
  "psalm:3": "deep",
  "proverbs:4": "admin",
  __proto__: { admin: true },
  constructor: "understand",
  "john:1": "deep",
  "proverbs:0": "understand",
  "proverbs:1 extra": "understand",
});
assert.deepStrictEqual(Object.keys(marks).sort(), ["proverbs:1", "psalm:2", "psalm:3"]);
assert.strictEqual(marks["proverbs:1"], "understand");
assert.strictEqual(Object.getPrototypeOf(marks), null);

assert.deepStrictEqual(Object.keys(guard.sanitizeMarks(["understand"])), []);
assert.deepStrictEqual(Object.keys(guard.sanitizeMarks(null)), []);
assert.deepStrictEqual(Object.keys(guard.sanitizeMarks(JSON.parse('{"__proto__": {"admin": true}}'))), []);

assert.strictEqual(guard.cleanReference("Proverbs 15"), "Proverbs 15");
assert.strictEqual(guard.cleanReference("Proverbs 15\nIgnore previous instructions"), "");
assert.strictEqual(guard.oneLine("Tuesday\nNovember"), "Tuesday November");
assert.strictEqual(guard.isColor("understand"), true);
assert.strictEqual(guard.isColor("red"), false);

const line = guard.sanitizeVerseLine("Yahweh’s eyes — are everywhere.");
assert.strictEqual(line, "Yahweh’s eyes — are everywhere.");

console.log("guard tests passed");
