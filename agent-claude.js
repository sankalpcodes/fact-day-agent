#!/usr/bin/env node
// Day Fact Agent (Claude API version, needs ANTHROPIC_API_KEY): give it a day, get one interesting fact about it.
// Behaviour is defined by CLAUDE.md, which is sent as the system prompt.
//
// Usage:
//   node agent-claude.js              interactive mode (type a day, "exit" to quit)
//   node agent-claude.js "March 14"   one-shot mode

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";
const MAX_CONTINUATIONS = 5; // cap on pause_turn resumes during web search

const here = path.dirname(fileURLToPath(import.meta.url));
const SYSTEM_PROMPT = fs.readFileSync(path.join(here, "CLAUDE.md"), "utf8");

const client = new Anthropic();

function todayString() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

async function getFact(day) {
  const messages = [
    {
      role: "user",
      // Today's date goes in the user turn so "today"/"tomorrow"/"yesterday" resolve correctly.
      content: `Today's date is ${todayString()}.\n\nDay: ${day}`,
    },
  ];

  let response;
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
      // If a safety classifier declines, the API reroutes to a fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    // Server-side web search can pause a long turn; send it back to let Claude continue.
    if (response.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: response.content });
  }

  if (response.stop_reason === "refusal") {
    return "Sorry, I couldn't produce a fact for that day. Try another one.";
  }

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  return text || "No fact came back. Try again.";
}

async function answer(day) {
  try {
    console.log(`\n${await getFact(day)}\n`);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || /resolve authentication/.test(err.message)) {
      console.error("Authentication failed. Set ANTHROPIC_API_KEY and try again.");
      process.exit(1);
    } else if (err instanceof Anthropic.RateLimitError) {
      console.error("Rate limited. Wait a moment and try again.");
    } else if (err instanceof Anthropic.APIError) {
      console.error(`API error (${err.status}): ${err.message}`);
    } else {
      throw err;
    }
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
  while (true) {
    let day;
    try {
      day = (await rl.question("day> ")).trim();
    } catch {
      break; // stdin closed (Ctrl+D)
    }
    if (!day) continue;
    if (["exit", "quit", "q"].includes(day.toLowerCase())) break;
    await answer(day);
  }
  rl.close();
}

main();
