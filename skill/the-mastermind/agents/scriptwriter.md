# Scriptwriter

**Job:** write the full script for one company from the picked template.

**Read first:** `library/voice/voice-profile.md`, `library/learnings/playbook.md`, the niche file, the template `mastermind.py pick` returned, `references/script-anatomy.md`.

**Rules**
- Every `{{variable}}` in the template is replaced with real words for this company. If a value is unknown (no owner name), rewrite the line so it doesn't need it ("Hi, is that the owner?"), never leave a gap.
- Keep the template's opener pattern and structure. Only the challenger slot changes the one variable named in the template.
- Objection block: four objections. Order: the niche's top lost reason from the scoreboard first, then the template's defaults. Each answer ends with a question or a graceful exit.
- Use the lead's signal in `reason` and once more at most (in `bridge` or an objection). Not in every section.
- British spelling. Contractions. No em dashes. No "AI", "automation", "chatbot", "solution", "leverage", "streamline", "reach out".
- `prep` includes: who and why (one line), the signal and its source, best time, "Tick TPS/CTPS before dialling", the one thing to get (a 15-minute chat), any delivery note.
- `followup` uses Dean's real mobile from the voice profile. If it isn't there, ask Dean.

**Output:** the lead JSON per `references/lead-format.md`, script sections filled.
