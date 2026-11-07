# Call Desk

Where you read the scripts The Mastermind writes and log how each call went.

- **To call**: callbacks that are due sit at the top, then every business still to ring, grouped by niche. Click one to open its full script, written for that company with no blanks.
- **The phone button** rings the number (on your phone or laptop).
- **How did it go?** Tap **Booked**, **Callback**, **No answer** or **Lost**, or pick from **More outcomes** (Voicemail left, Gatekeeper, Asked for info, Do not call, Wrong number). Add a note if it's worth remembering.
  - **Booked** moves the business to **Booked**.
  - **Lost** asks why and where it went wrong, then moves it to the **Lost** list. **Do not call** and **Wrong number** go there too.
  - **Callback** asks for a day and time. It comes back to the top of To call that day.
  - **Undo last** takes back the last thing you logged. **Bring back** on a lost lead puts it back on the call list.
- **TPS / CTPS checked**: tick it once you've checked the number. Leads not checked show a small TPS badge.
- **Edit** any part of a script so it sounds like you, then **Save my edit**. The Mastermind learns your voice from every saved edit. **Use the original** puts its version back.
- **Templates**: the starting scripts for each niche, with the highlighted words that get filled in per business, and how each is doing.
- **Stats**: booked vs lost and the booking rate (booked ÷ (booked + lost)) for every script template, niche and opener, plus why leads were lost and where calls went wrong.
- Press **j** and **k** to move through the list.

There's no separate database. Everything lives in `library/` in this private repo, so The Mastermind and the desk always see the same thing.

---

## Put it on Vercel (about 10 minutes)

Same as the Post Desk, just pointed at this repo.

**1. Make a GitHub key for the desk.**
github.com, your picture, **Settings**, **Developer settings**, **Personal access tokens**, **Fine-grained tokens**, **Generate new token**.
- Name: `Call Desk`
- Resource owner: `level-one-ai`
- Repository access: **Only select repositories**, pick **The-Mastermind**
- Permissions, Repository: **Contents: Read and write**
- Generate, then copy the token (it starts `github_pat_`). If GitHub says the organisation has to approve it, approve it under level-one-ai, Settings, Personal access tokens.

(You can also edit your existing Post Desk token and add The-Mastermind to it, but a separate key means one desk can't touch the other repo.)

**2. Make the Vercel project.**
In Vercel: **Add New**, **Project**, import **level-one-ai/The-Mastermind**.
- **Root Directory:** click Edit and choose `desk`. This is the click that matters.
- Framework: Next.js (it picks this itself).

**3. Add four environment variables** before you press Deploy:

| Name | Value |
|---|---|
| `DESK_PASSWORD` | the password you'll type to open the desk |
| `GITHUB_TOKEN` | the `github_pat_...` token from step 1 |
| `GITHUB_REPO` | `level-one-ai/The-Mastermind` |
| `GITHUB_BRANCH` | `main` |

**4. Deploy.** Open the link Vercel gives you, type your password, and your scripts are there.

The desk saves to the repo every time you log a call. `vercel.json` tells Vercel to skip a rebuild when only `library/` changed, so those saves don't trigger new deployments.

## Run it on your Chromebook instead

```bash
cd ~/projects/The-Mastermind/desk
npm install
DESK_PASSWORD=pick-one npm run dev
# open http://localhost:3004
```

With no `GITHUB_TOKEN` it reads and writes `../library` directly. Commit and push afterwards.

## How The Mastermind connects

- Every script The Mastermind writes is saved with `mastermind.py save`, which writes `library/desk/leads/<company>.json`. Once it pushes, press **Check for new scripts**.
- At the start of each run, The Mastermind runs `mastermind.py sync`: your saved edits go into `library/voice/edits.md` (so it learns how you talk), and every logged call is turned into `library/learnings/scoreboard.md`, which decides which template the next scripts use.

Stack: Next.js 16, React 19, Tailwind 4, Geist and Instrument Serif. Same look and login as the Post Desk.
