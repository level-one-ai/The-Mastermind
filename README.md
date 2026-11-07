# The Mastermind

Level One's cold-calling skill and its memory.

The Mastermind writes a fully written call script for every local business Dean rings (no blanks, no variables), saves it here, and learns from how the calls went which scripts book meetings.

| Folder | What it is |
|---|---|
| `skill/the-mastermind/` | The skill itself: instructions, agents, references and `scripts/mastermind.py` |
| `the-mastermind.skill` | The same skill, packaged to upload to Claude |
| `desk/` | The **Call Desk** web app (Vercel). Setup: `desk/README.md` |
| `library/niches/` | Script templates per niche (trades, local services, property, professional services, B2B) |
| `library/desk/leads/` | One file per business: its script and every call logged |
| `library/learnings/` | The scoreboard (booked vs lost per script), the playbook of learned rules, the changelog |
| `library/voice/` | How Dean talks, learned from his edits |

Plain-English guide: `GUIDE.md`. Credits for the open-source skills it was built from: `skill/the-mastermind/references/credits.md`.
