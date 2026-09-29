#!/usr/bin/env node
// Day Fact Agent (free version): give it a day, get one interesting fact about it.
// Follows the rules in CLAUDE.md. Facts come from Wikipedia's free "On this day"
// feed (no API key needed); weekday trivia comes from the built-in list below.
//
// Usage:
//   node agent.js              interactive mode (type a day, "exit" to quit)
//   node agent.js "March 14"   one-shot mode

import readline from "node:readline/promises";
import { pathToFileURL } from "node:url";

const FEED_URLS = [
  "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all",
  "https://en.wikipedia.org/api/rest_v1/feed/onthisday/all",
];
// Wikimedia asks API clients to identify themselves.
const USER_AGENT = "fact-day-agent/1.0 (personal learning project)";

const NOT_A_DAY = "Give me a day (like 'July 20' or 'Friday') and I'll share a fact about it.";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // Feb 29 allowed
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAY_ABBREVIATIONS = {
  sun: "sunday", mon: "monday", tue: "tuesday", tues: "tuesday", wed: "wednesday",
  thu: "thursday", thur: "thursday", thurs: "thursday", fri: "friday", sat: "saturday",
};

// Rule 4 in CLAUDE.md: etymology, culture or trivia for weekdays.
const WEEKDAY_FACTS = {
  monday: [
    "Its name comes from the Old English Mōnandæg, \"the Moon's day\", and many languages use the same idea, like Spanish lunes from luna.",
    "The international date standard ISO 8601 counts Monday as the first day of the week, not Sunday.",
  ],
  tuesday: [
    "It is named after Tiw (Týr), the one-handed Germanic god of war and law, while French mardi honours his Roman counterpart, Mars.",
  ],
  wednesday: [
    "It is \"Woden's day\", named after Woden (Odin), chief of the Germanic gods, while in German it is plainly Mittwoch, meaning \"mid-week\".",
    "In Romance languages it is named after Mercury, the Roman messenger god, as in Spanish miércoles and French mercredi.",
  ],
  thursday: [
    "It is \"Thor's day\", and the Romans' name for it, dies Iovis (Jupiter's day, still visible in French jeudi), also honoured a thunder god.",
  ],
  friday: [
    "It is named after the Germanic goddess Frigg, while French vendredi and Spanish viernes come from Venus, the Roman goddess of love.",
    "Fear of Friday the 13th has its own name: paraskevidekatriaphobia.",
  ],
  saturday: [
    "It is the only English weekday named after a Roman god, Saturn, and it kept its Latin root (Saturni dies).",
    "Spanish sábado and Italian sabato come from the Hebrew word Shabbat, the day of rest.",
  ],
  sunday: [
    "Its name comes from the Old English Sunnandæg, \"the Sun's day\", but in Russian it is voskresenye, meaning \"resurrection\".",
  ],
};

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function isValidDate(month, day) {
  return month >= 1 && month <= 12 && day >= 1 && day <= DAYS_IN_MONTH[month - 1];
}

function monthFromWord(word) {
  if (word.length < 3) return null;
  const index = MONTHS.findIndex((m) => m.startsWith(word));
  return index === -1 ? null : index + 1;
}

function label(month, day) {
  const name = MONTHS[month - 1];
  return `${name[0].toUpperCase()}${name.slice(1)} ${day}`;
}

// Turns user input into { kind: "date", month, day, note? } or { kind: "weekday", weekday }, or null.
export function parseDay(input, now = new Date()) {
  const text = input.trim().toLowerCase().replace(/[.!?]+$/, "");

  const offsets = { today: 0, tomorrow: 1, yesterday: -1 };
  if (text in offsets) {
    const d = new Date(now);
    d.setDate(d.getDate() + offsets[text]);
    return { kind: "date", month: d.getMonth() + 1, day: d.getDate() };
  }

  const weekday = WEEKDAYS.includes(text) ? text : WEEKDAY_ABBREVIATIONS[text];
  if (weekday) return { kind: "weekday", weekday };

  // 2026-03-14
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const month = Number(m[2]), day = Number(m[3]);
    return isValidDate(month, day) ? { kind: "date", month, day } : null;
  }

  // 14/03, 03/14, 03/04, 14-03-2026
  m = text.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2}|\d{4}))?$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    if (a > 12 && isValidDate(b, a)) return { kind: "date", month: b, day: a }; // clearly DD/MM
    if (b > 12 && isValidDate(a, b)) return { kind: "date", month: a, day: b }; // clearly MM/DD
    if (!isValidDate(b, a)) return null;
    // Ambiguous: CLAUDE.md says assume DD/MM and say so.
    const note = a === b ? undefined : `Reading ${m[1]}/${m[2]} as DD/MM (${label(b, a)}).`;
    return { kind: "date", month: b, day: a, note };
  }

  // March 14, 14th March, 14th of March, Mar 14 2026, march 14th, 2026
  const words = text
    .replace(/(\d+)(st|nd|rd|th)\b/g, "$1")
    .replace(/[,]/g, " ")
    .split(/\s+/)
    .filter((w) => w && w !== "of");
  let month = null, day = null;
  for (const word of words) {
    if (/^\d{1,2}$/.test(word) && day === null) day = Number(word);
    else if (/^\d{4}$/.test(word)) continue; // year: facts are about the date in any year
    else if (month === null && monthFromWord(word)) month = monthFromWord(word);
    else return null;
  }
  if (month !== null && day !== null && isValidDate(month, day)) return { kind: "date", month, day };
  return null;
}

async function fetchOnThisDay(month, day) {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  let lastError;
  for (const base of FEED_URLS) {
    try {
      const res = await fetch(`${base}/${mm}/${dd}`, {
        headers: { "User-Agent": USER_AGENT, "Api-User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

function clean(text) {
  return text.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim().replace(/[.;]$/, "");
}

// "The first convention..." reads wrong after "In 1848, ", but "The Mikado" is a title and stays.
function lowerLeadingArticle(text) {
  return text.replace(/^(The|A|An) (?=[a-z])/, (article) => article.toLowerCase());
}

// "Bill Owen, English actor (died 1999)" -> "Bill Owen, English actor,"
function person(text) {
  const who = clean(text).replace(/\s*\((born|died|d\.|b\.)[^)]*\)$/i, "");
  return who.includes(",") ? `${who},` : who;
}

// Sentence builders for each Wikipedia category.
const CATEGORIES = {
  events: (e) => `In ${e.year}, ${lowerLeadingArticle(clean(e.text))}.`,
  births: (e) => `In ${e.year}, ${person(e.text)} was born.`,
  deaths: (e) => `In ${e.year}, ${person(e.text)} died.`,
  holidays: (e) => `Observed on this day: ${clean(e.text)}.`,
};

// CLAUDE.md prefers events, then births/deaths, then observances, but also asks to vary picks.
// So the category is chosen at random, weighted toward the preferred ones.
const WEIGHTS = [["events", 50], ["births", 20], ["deaths", 15], ["holidays", 15]];

function chooseFact(feed) {
  const usable = (entry, category) =>
    entry && entry.text && entry.text.length <= 280 &&
    (category === "holidays" || Number.isFinite(entry.year));

  // Feast-day holidays are mostly lists of saints' names, so use them only as a last resort.
  const holidays = (feed.holidays ?? []).filter((h) => !/feast day/i.test(h.text));
  const pools = {
    events: feed.events ?? [],
    births: feed.births ?? [],
    deaths: feed.deaths ?? [],
    holidays: holidays.length ? holidays : feed.holidays ?? [],
  };

  const available = WEIGHTS.filter(([cat]) => pools[cat].some((e) => usable(e, cat)));
  if (!available.length) return null;

  let roll = Math.random() * available.reduce((sum, [, w]) => sum + w, 0);
  const [category] = available.find(([, w]) => (roll -= w) < 0) ?? available[0];

  // The full lists include many lesser-known entries, per CLAUDE.md's "prefer lesser-known facts".
  const entry = pick(pools[category].filter((e) => usable(e, category)));
  return CATEGORIES[category](entry);
}

const bold = (s) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : `**${s}**`);

export async function getFact(input) {
  const parsed = parseDay(input);
  if (!parsed) return NOT_A_DAY;

  if (parsed.kind === "weekday") {
    const name = parsed.weekday[0].toUpperCase() + parsed.weekday.slice(1);
    return `${bold(name)} — ${pick(WEEKDAY_FACTS[parsed.weekday])}`;
  }

  const feed = await fetchOnThisDay(parsed.month, parsed.day);
  const fact = chooseFact(feed);
  if (!fact) return `No facts found for ${label(parsed.month, parsed.day)}. Try another day.`;

  const line = `${bold(label(parsed.month, parsed.day))} — ${fact}`;
  return parsed.note ? `${parsed.note}\n${line}` : line;
}

async function answer(input) {
  try {
    console.log(`\n${await getFact(input)}\n`);
  } catch (err) {
    console.error(`\nCouldn't reach Wikipedia (${err.message}). Check your internet connection and try again.\n`);
  }
}

async function main() {
  const arg = process.argv.slice(2).join(" ").trim();
  if (arg) {
    await answer(arg);
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('Day Fact Agent. Enter a day (e.g. "July 20", "Friday", "tomorrow"). Type "exit" to quit.');
  rl.setPrompt("day> ");
  rl.prompt();
  for await (const line of rl) {
    const input = line.trim();
    if (["exit", "quit", "q"].includes(input.toLowerCase())) break;
    if (input) await answer(input);
    rl.prompt();
  }
  rl.close();
}

// Only start the prompt when run directly, so parseDay/getFact can be imported for testing.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
