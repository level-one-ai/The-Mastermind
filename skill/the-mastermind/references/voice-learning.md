# Voice learning

Dean edits script text in the Call Desk so it sounds like him. Each saved edit lands in `library/desk/edits/pending/` as a JSON file (lead, section, original, before, after). `mastermind.py sync` appends each to `library/voice/edits.md` and moves the file to `processed/`.

Then read the new entries:

- **Same kind of change twice** (e.g. he swaps "folk" for "people" twice, or cuts the permission line twice) → a rule in `library/voice/voice-profile.md` under "Rules", with the two examples.
- **Words he always uses** → "Words Dean uses". **Words he always cuts** → "Words Dean never says".
- One-off edits stay in the log only.

The scriptwriter reads `voice-profile.md` before every script. Rules there beat this skill's default phrasing, never the hard rules.

Dean's starting voice (from his Copy Boss emails): laid-back, local, warm, direct, short. Says "no bother", "give you a ring", "pop in". Never corporate ("solutions", "leverage", "streamline", "reach out").
