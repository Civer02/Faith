// Pure checks for Bible API data, saved highlights, and clipboard text.
var FaithGuard = (function () {
  var COLORS = { understand: true, lookup: true, deep: true };
  var REFERENCE = /^(Proverbs|Psalm|Psalms) ([1-9][0-9]{0,2})$/;
  var MARK_ID = /^(proverbs|psalm):([1-9][0-9]{0,2})$/;
  // Newlines and tabs are whitespace, so they stay here and collapse into spaces.
  var HIDDEN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/g;

  function isColor(value) {
    return typeof value === "string" && Object.prototype.hasOwnProperty.call(COLORS, value);
  }

  function collapseText(value) {
    if (typeof value !== "string") return "";
    return value.replace(HIDDEN, "").replace(/[<>`]/g, "").replace(/\s+/g, " ").trim();
  }

  function sanitizeVerseLine(value) {
    var text = collapseText(value);
    if (!text || text.length > 1000) return "";
    return text;
  }

  function cleanReference(value) {
    var reference = collapseText(value);
    if (!REFERENCE.test(reference)) return "";
    return reference;
  }

  function referenceMatches(reference, book, chapter) {
    var cleaned = cleanReference(reference);
    if (!cleaned) return "";
    var parts = cleaned.split(" ");
    var name = parts[0];
    var number = Number(parts[1]);
    if (number !== chapter) return "";
    if (book === "proverbs" && name !== "Proverbs") return "";
    if (book === "psalms" && name !== "Psalm" && name !== "Psalms") return "";
    if (book !== "proverbs" && book !== "psalms") return "";
    return cleaned;
  }

  function normalizeChapter(data, book, chapter) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("The reading was not valid.");
    }
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > 200) {
      throw new Error("The reading was not valid.");
    }
    var title = referenceMatches(data.reference, book, chapter);
    if (!title) throw new Error("The reading did not match the requested chapter.");
    if (!Array.isArray(data.verses) || data.verses.length < 1 || data.verses.length > 200) {
      throw new Error("The reading was not valid.");
    }
    var verses = [];
    var seen = {};
    for (var i = 0; i < data.verses.length; i += 1) {
      var verse = data.verses[i];
      if (!verse || typeof verse !== "object" || Array.isArray(verse)) {
        throw new Error("The reading was not valid.");
      }
      var n = verse.verse;
      if (!Number.isInteger(n) || n < 1 || n > 200 || seen[n]) {
        throw new Error("The reading was not valid.");
      }
      if (verse.chapter !== chapter) {
        throw new Error("The reading did not match the requested chapter.");
      }
      var text = sanitizeVerseLine(verse.text);
      if (!text) throw new Error("The reading was not valid.");
      seen[n] = true;
      verses.push({ n: n, text: text });
    }
    verses.sort(function (a, b) { return a.n - b.n; });
    if (typeof data.text !== "string" || data.text.length > 100000) {
      throw new Error("The reading was not valid.");
    }
    var block = collapseText(data.text);
    var joined = collapseText(verses.map(function (verse) { return verse.text; }).join(" "));
    if (!block || block !== joined) throw new Error("The reading was not valid.");
    return { title: title, verses: verses };
  }

  function sanitizeMarks(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return Object.create(null);
    var keys = Object.keys(value);
    if (keys.length > 400) return Object.create(null);
    var clean = Object.create(null);
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (!MARK_ID.test(key)) continue;
      if (isColor(value[key])) clean[key] = value[key];
    }
    return clean;
  }

  function oneLine(value) {
    if (typeof value !== "string") return "";
    return value.replace(HIDDEN, "").replace(/\s+/g, " ").trim();
  }

  return {
    isColor: isColor,
    sanitizeVerseLine: sanitizeVerseLine,
    cleanReference: cleanReference,
    normalizeChapter: normalizeChapter,
    sanitizeMarks: sanitizeMarks,
    oneLine: oneLine,
  };
})();
