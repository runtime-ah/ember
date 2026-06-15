// Natural-language parser for task input.
// Detects #tags, dates, times, priorities, effort, and recurrence from text.
// Returns { content, labels, dueDate, dueTime, priority, effort, recurrenceRule }
// where `content` is the raw text with detected tokens stripped.

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june",
                "july", "august", "september", "october", "november", "december"];
const MONTH_ABBR = ["jan", "feb", "mar", "apr", "may", "jun",
                    "jul", "aug", "sep", "oct", "nov", "dec"];

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function todayPlus(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

// Returns the next occurrence of `dayIndex` (0=Sun), exclusive of today.
function nextWeekday(dayIndex) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDay = today.getDay();
  let diff = dayIndex - todayDay;
  if (diff <= 0) diff += 7;
  const result = new Date(today);
  result.setDate(today.getDate() + diff);
  return result;
}

function isDateToken(tok, nextTok) {
  if (tok === "today" || tok === "tomorrow") return true;
  if (WEEKDAYS.includes(tok)) return true;
  if (MONTHS.includes(tok) || MONTH_ABBR.includes(tok)) return true;
  if (tok === "next" && nextTok && WEEKDAYS.includes(nextTok)) return true;
  return false;
}

// "9am" → "09:00", "2:30pm" → "14:30", "14:00" → "14:00"
function parseTimeToken(tok) {
  // 9am / 2pm
  let m = tok.match(/^(\d{1,2})([ap]m)$/i);
  if (m) {
    let h = parseInt(m[1]);
    const ap = m[2].toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:00`;
  }
  // 2:30pm / 9:30am
  m = tok.match(/^(\d{1,2}):(\d{2})([ap]m)$/i);
  if (m) {
    let h = parseInt(m[1]);
    const min = m[2];
    const ap = m[3].toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${min}`;
  }
  // 14:00 / 9:00 (24-hr, no am/pm)
  m = tok.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const h = parseInt(m[1]);
    if (h >= 0 && h <= 23) return `${String(h).padStart(2, "0")}:${m[2]}`;
  }
  return null;
}

export function parseTaskInput(text) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const consumed = new Set();

  const result = {
    labels: [],
    dueDate: null,
    dueTime: null,
    priority: null,
    effort: null,         // hours as number
    recurrenceRule: null,
  };

  let i = 0;
  while (i < tokens.length) {
    const raw = tokens[i];
    const tok = raw.toLowerCase();

    // #tag
    if (raw.startsWith("#") && raw.length > 1) {
      result.labels.push(raw.slice(1));
      consumed.add(i);
      i++;
      continue;
    }

    // Priority: p1–p4
    if (/^p[1-4]$/i.test(tok)) {
      if (result.priority === null) result.priority = parseInt(tok[1]);
      consumed.add(i);
      i++;
      continue;
    }

    // Effort: 2h, 1.5h, 30m (must be at a word boundary — we split on spaces so safe)
    let em = tok.match(/^(\d+(?:\.\d+)?)h$/);
    if (em) {
      if (result.effort === null) result.effort = parseFloat(em[1]);
      consumed.add(i);
      i++;
      continue;
    }
    em = tok.match(/^(\d+)m$/);
    if (em && parseInt(em[1]) <= 600) {
      if (result.effort === null) result.effort = parseFloat(em[1]) / 60;
      consumed.add(i);
      i++;
      continue;
    }

    // Time: 9am, 2:30pm, 14:00, noon, midnight
    if ((tok === "noon" || tok === "midday") && result.dueTime === null) {
      result.dueTime = "12:00";
      consumed.add(i); i++; continue;
    }
    if (tok === "midnight" && result.dueTime === null) {
      result.dueTime = "00:00";
      consumed.add(i); i++; continue;
    }
    const parsedTime = parseTimeToken(tok);
    if (parsedTime && result.dueTime === null) {
      result.dueTime = parsedTime;
      consumed.add(i);
      i++;
      continue;
    }

    // "at <time>" — consume "at" when followed by a recognisable time
    if (tok === "at" && i + 1 < tokens.length && result.dueTime === null) {
      const next = tokens[i + 1].toLowerCase();
      if (parseTimeToken(next) || next === "noon" || next === "midday" || next === "midnight") {
        consumed.add(i); i++; continue;
      }
    }

    // "by / on / due <date>" — consume the preposition when followed by a date token
    if ((tok === "by" || tok === "on" || tok === "due") && i + 1 < tokens.length && result.dueDate === null) {
      const next = tokens[i + 1].toLowerCase();
      const after = tokens[i + 2]?.toLowerCase();
      if (isDateToken(next, after)) {
        consumed.add(i); i++; continue;
      }
    }

    // Recurrence keywords
    if (tok === "daily" || tok === "everyday") {
      if (result.recurrenceRule === null) result.recurrenceRule = "daily";
      consumed.add(i);
      i++;
      continue;
    }
    if (tok === "weekly") {
      if (result.recurrenceRule === null) result.recurrenceRule = "weekly";
      consumed.add(i);
      i++;
      continue;
    }
    if (tok === "weekdays") {
      if (result.recurrenceRule === null) result.recurrenceRule = "weekdays";
      consumed.add(i);
      i++;
      continue;
    }
    if (tok === "biweekly") {
      if (result.recurrenceRule === null) result.recurrenceRule = "biweekly";
      consumed.add(i);
      i++;
      continue;
    }
    if (tok === "monthly") {
      if (result.recurrenceRule === null) result.recurrenceRule = "monthly";
      consumed.add(i);
      i++;
      continue;
    }

    // "every X" → recurrence (and optionally a due date for "every tuesday")
    if (tok === "every" && i + 1 < tokens.length) {
      const next = tokens[i + 1].toLowerCase();
      if (next === "day") {
        if (result.recurrenceRule === null) result.recurrenceRule = "daily";
        consumed.add(i); consumed.add(i + 1);
        i += 2; continue;
      }
      if (next === "week") {
        if (result.recurrenceRule === null) result.recurrenceRule = "weekly";
        consumed.add(i); consumed.add(i + 1);
        i += 2; continue;
      }
      if (next === "month") {
        if (result.recurrenceRule === null) result.recurrenceRule = "monthly";
        consumed.add(i); consumed.add(i + 1);
        i += 2; continue;
      }
      const wdIdx = WEEKDAYS.indexOf(next);
      if (wdIdx >= 0) {
        if (result.recurrenceRule === null) result.recurrenceRule = "weekly";
        if (result.dueDate === null) result.dueDate = formatDate(nextWeekday(wdIdx));
        consumed.add(i); consumed.add(i + 1);
        i += 2; continue;
      }
    }

    // Dates
    if (tok === "today" && result.dueDate === null) {
      result.dueDate = formatDate(todayPlus(0));
      consumed.add(i); i++; continue;
    }
    if (tok === "tomorrow" && result.dueDate === null) {
      result.dueDate = formatDate(todayPlus(1));
      consumed.add(i); i++; continue;
    }

    // "this monday" → next occurrence of that weekday
    if (tok === "this" && i + 1 < tokens.length && result.dueDate === null) {
      const wdIdx = WEEKDAYS.indexOf(tokens[i + 1].toLowerCase());
      if (wdIdx >= 0) {
        result.dueDate = formatDate(nextWeekday(wdIdx));
        consumed.add(i); consumed.add(i + 1);
        i += 2; continue;
      }
    }

    // "next monday"
    if (tok === "next" && i + 1 < tokens.length && result.dueDate === null) {
      const wdIdx = WEEKDAYS.indexOf(tokens[i + 1].toLowerCase());
      if (wdIdx >= 0) {
        // Force at least 7 days out
        const d = nextWeekday(wdIdx);
        if (d.getDay() === new Date().getDay()) d.setDate(d.getDate() + 7);
        result.dueDate = formatDate(d);
        consumed.add(i); consumed.add(i + 1);
        i += 2; continue;
      }
    }

    // Bare weekday name → next occurrence
    const wdIdx = WEEKDAYS.indexOf(tok);
    if (wdIdx >= 0 && result.dueDate === null) {
      result.dueDate = formatDate(nextWeekday(wdIdx));
      consumed.add(i); i++; continue;
    }

    // "jan 15", "december 25"
    const mIdx = MONTH_ABBR.indexOf(tok) >= 0 ? MONTH_ABBR.indexOf(tok) : MONTHS.indexOf(tok);
    if (mIdx >= 0 && result.dueDate === null && i + 1 < tokens.length) {
      const dayTok = tokens[i + 1];
      if (/^\d{1,2}(st|nd|rd|th)?$/.test(dayTok)) {
        const day = parseInt(dayTok);
        const year = new Date().getFullYear();
        let d = new Date(year, mIdx, day);
        d.setHours(0, 0, 0, 0);
        if (d < new Date()) d = new Date(year + 1, mIdx, day);
        result.dueDate = formatDate(d);
        consumed.add(i); consumed.add(i + 1);
        i += 2; continue;
      }
    }

    i++;
  }

  result.content = tokens.filter((_, idx) => !consumed.has(idx)).join(" ").trim();
  return result;
}
