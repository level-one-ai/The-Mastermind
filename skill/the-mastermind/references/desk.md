# The Call Desk

`desk/` in the library repo. A password-protected web page on Vercel that reads and writes `library/` through the GitHub API.

What Dean does there:
- **To call**: callbacks due today first, then new leads by niche. Each lead opens its full script.
- **Log the call**: quick buttons (Booked, Callback, No answer, Lost) or the full dropdown (also Voicemail, Gatekeeper, Asked for info, Do not call, Wrong number) with a note. Lost asks why and where it went wrong, then the lead moves to the **Lost** list. **Bring back** returns it.
- **Booked**: meetings booked.
- **Templates**: every niche's templates with their status and booking rate.
- **Stats**: booked vs lost and booking rate per template, niche and opener; top lost reasons and where calls go wrong.
- **Edit** any section; saved edits teach the voice (`voice-learning.md`).
- **TPS / CTPS checked** tick per lead.

The skill never needs the desk running: it reads the same JSON files.
