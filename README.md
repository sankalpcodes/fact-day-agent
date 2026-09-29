# Day Fact Agent

Watch the video here: https://youtu.be/Hvu92vc-9sA?si=0Ag3Eq_XD-U9GhW3

A small command-line tool that tells you an interesting fact about any day you enter.

```
day> March 14
**March 14** — In 1942, Anne Miller becomes the first American patient to be treated with penicillin, under the care of Orvan Hess and John Bumstead.

day> Friday
**Friday** — Fear of Friday the 13th has its own name: paraskevidekatriaphobia.

day> tomorrow
**September 30** — In 1882, Hans Geiger, German physicist and academic, was born.
```

It comes in two versions:

| | `agent.js` (default) | `agent-claude.js` |
|---|---|---|
| How it works | Rule-based: parses your input and picks a fact from Wikipedia | AI agent: Claude picks the fact and checks it with web search |
| Where facts come from | Wikipedia's free ["On this day" feed](https://api.wikimedia.org/wiki/Feed_API/Reference/On_this_day) | Claude, checked with web search |
| Cost | Free, no API key | Needs a paid [Anthropic API key](https://console.anthropic.com) |

## Features

- **Accepts many input formats:** `March 14`, `14/03`, `03/14`, `2026-03-14`, `14th March`, `Mar 14`
- **Weekdays:** `Tuesday` or `tue` returns the origin of the name or other trivia about that day
- **Relative days:** `today`, `tomorrow` and `yesterday`
- **Handles ambiguous dates:** `03/04` is read as DD/MM (April 3), and the agent tells you so
- **Varied facts:** picks at random from historical events, famous births and deaths, and observances
- **Verified facts:** every date fact comes from Wikipedia, and nothing is made up

## Requirements

- [Node.js](https://nodejs.org) 18 or newer
- An internet connection

## Getting started

```bash
git clone https://github.com/<your-username>/fact-day-agent.git
cd fact-day-agent
npm install
```

## Usage

**Interactive mode.** Type a day, get a fact, and repeat. Type `exit` to quit.

```bash
npm start
```

**One-shot mode.** Get one fact and exit.

```bash
node agent.js "July 20"
```

### Claude version (optional)

```bash
export ANTHROPIC_API_KEY=your-key-here
npm run start:claude
```

## How it works

1. **Parse** the input into a month and day, or a weekday, and reject anything that isn't a real day.
2. **Fetch** that date's events, births, deaths and holidays from Wikipedia's "On this day" API.
3. **Pick** one fact at random. The random choice favours events first, then births and deaths, then holidays.
4. **Format** it as a single line: `**Day** — fact.`

The rules the agent follows (input formats, fact priority, accuracy, output format) are written in [`CLAUDE.md`](CLAUDE.md). The Claude version sends that file to Claude as its instructions. The free version implements the same rules in code.

## Project structure

```
├── agent.js          # Free version (Wikipedia API)
├── agent-claude.js   # Claude API version with web search
├── agent.test.js     # Tests for the rules in CLAUDE.md
├── CLAUDE.md         # The agent's rules and output spec
└── package.json
```

## Running tests

```bash
npm test
```

The tests use Node's built-in test runner, so there is nothing extra to install.

## Tech used

- JavaScript (Node.js, ES modules)
- Native `fetch` for the Wikipedia REST API
- `readline` for the interactive prompt
- `node:test` for testing
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) for the Claude version

## Credits

Date facts come from [Wikipedia](https://www.wikipedia.org) through the Wikimedia Feed API. Wikipedia content is available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

## License

[MIT](LICENSE)
