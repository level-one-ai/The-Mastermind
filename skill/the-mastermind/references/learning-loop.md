# Learning loop

The Mastermind gets better from two things Dean does anyway: logging calls in the Call Desk, and editing script text there.

## What counts

- **Decided lead**: final outcome is Booked or Lost (Lost includes Do not call). Wrong numbers are excluded: a bad number isn't the script's fault.
- **Booking rate** = booked ÷ (booked + lost). This is the number the desk shows per script template.
- **Conversation** = any call where Dean spoke to the decision maker (Booked, Callback, Asked for info, Lost, Do not call).
- Leads still being called (no answer, voicemail, callback pending) don't count yet.

`mastermind.py stats` computes all of this per template, per niche, per opener pattern and per section where things went wrong, into `library/learnings/scoreboard.json` and `scoreboard.md`.

## Picking a template for a new script (`mastermind.py pick`)

Per niche:

1. **Champion**: the active template with the best booking rate among those with ≥ 10 decided leads. Until one has 10, there is no champion: rotate the niche's templates evenly (fewest leads first).
2. **Challenger slot**: every third new lead in a niche uses the challenger (the newest `testing` template) until it reaches 10 decided leads.
3. **Promote**: a challenger with ≥ 10 decided leads and a booking rate at least 5 points above the champion becomes champion. The old champion becomes `active` (still allowed, not preferred).
4. **Retire**: any template with 0 booked in 15+ decided leads, or 10+ points below the champion after 15 decided, becomes `retired`. Retired templates stay in the library for reference but are never picked.
5. **Always a challenger**: when a niche has no `testing` template left, the analyst writes one, changing one variable based on the evidence (see below).

## Turning evidence into the next challenger

The desk logs, per lost lead, **why** (Not interested, Already have someone, Too expensive, Bad timing, Not a fit, Asked not to call) and **where it went wrong** (Gatekeeper, Opener, Reason, Questions, Ask, Objection).

| Pattern on the scoreboard (≥ 6 losses in a niche) | Challenger changes |
|---|---|
| "Went wrong at Opener" is the top stage | The opener pattern (permission → direct, or context-first when research is strong) |
| "Went wrong at Reason" | The pain line wording |
| "Went wrong at Ask" | The ask (pop-in vs phone, two times vs "this week or next") |
| A lost reason is > 35% of losses | Lead the objection block with it and rewrite that answer |
| Lots of Asked for info, few decisions | Qualifying question in the "send me an email" answer |
| Gatekeeper is the top stage | The gatekeeper section and the call window |

One variable per challenger. Write the change in the template's `why` and each script's `variable`.

## Section-level learning

Scripts carry `templateId`, `pattern` and section IDs. When Dean edits the same section the same way twice (in the desk), that edit becomes a voice rule (`voice-learning.md`). When the winning template's opener differs from the loser's, copy the winning line's shape, not its words, into the next challenger in other niches as a `provisional` playbook rule.

## Playbook format (`library/learnings/playbook.md`)

```
PB-001 [provisional] Trades: direct reason-for-call opener books more than permission (4/12 vs 1/11). Source: scoreboard 2026-11-20.
```

Promote to `[confirmed]` when the next 10 decided leads agree. Demote or delete when they don't. Log every change in `changelog.md`.

## Honesty about small numbers

Dean is one person making maybe 20 to 60 calls a week. A 2-in-5 vs 0-in-5 split is noise. Say "too early" under 10 decided leads, never call a winner, and say how many more calls would settle it.
