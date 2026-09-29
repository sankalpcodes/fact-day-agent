// Tests for the rules in CLAUDE.md. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDay, getFact } from "./agent.js";

const NOW = new Date(2026, 8, 29); // September 29, 2026

test("accepts calendar date formats", () => {
  for (const input of ["March 14", "14/03", "2026-03-14", "14th March", "mar 14", "14th of March, 2026"]) {
    assert.deepEqual(parseDay(input, NOW), { kind: "date", month: 3, day: 14 }, input);
  }
});

test("reads unambiguous MM/DD correctly", () => {
  assert.deepEqual(parseDay("03/14", NOW), { kind: "date", month: 3, day: 14 });
});

test("assumes DD/MM for ambiguous dates and says so", () => {
  const result = parseDay("03/04", NOW);
  assert.equal(result.month, 4);
  assert.equal(result.day, 3);
  assert.match(result.note, /DD\/MM/);
});

test("accepts weekdays and abbreviations", () => {
  assert.deepEqual(parseDay("Tuesday", NOW), { kind: "weekday", weekday: "tuesday" });
  assert.deepEqual(parseDay("fri", NOW), { kind: "weekday", weekday: "friday" });
});

test("resolves relative days from the current date", () => {
  assert.deepEqual(parseDay("today", NOW), { kind: "date", month: 9, day: 29 });
  assert.deepEqual(parseDay("tomorrow", NOW), { kind: "date", month: 9, day: 30 });
  assert.deepEqual(parseDay("yesterday", NOW), { kind: "date", month: 9, day: 28 });
});

test("allows Feb 29 but rejects impossible dates", () => {
  assert.deepEqual(parseDay("Feb 29", NOW), { kind: "date", month: 2, day: 29 });
  assert.equal(parseDay("February 30", NOW), null);
  assert.equal(parseDay("13/13", NOW), null);
});

test("replies with the standard message when input isn't a day", async () => {
  assert.equal(
    await getFact("banana"),
    "Give me a day (like 'July 20' or 'Friday') and I'll share a fact about it.",
  );
});

test("weekday facts use the **Day** — fact format", async () => {
  assert.match(await getFact("Sunday"), /^\*\*Sunday\*\* — .+\.$/);
});
