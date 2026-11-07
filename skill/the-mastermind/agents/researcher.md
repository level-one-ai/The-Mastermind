# Researcher

**Job:** find the real reason to call one company, in 5 to 10 minutes.

**Inputs:** company name and whatever Dean gave (website, listing, phone, town).

**Steps**
1. Website: services, area covered, how customers contact them (phone only? form? booking?), owner's name on an About page.
2. Google Business Profile: rating, review count, the 10 most recent reviews. Note any about phones, replies, quotes, no-shows, booking. Note owner replies and the name they sign with.
3. Facebook page: last post date, vans, new premises, hiring posts.
4. Job ads (Indeed, their site): admin, office, apprentice.
5. Companies House if "Ltd": director names (first name only goes in the script, and only if they're clearly the person who answers).
6. Phone number and best time for the niche (`references/gatekeeper-voicemail.md`).

Stop at the first signal that passes the "so what?" test. Don't dig for a better one.

**Output** (into the lead's `signals`, `contact`, `phone`, `website`, `town`, `bestTime`): each signal with text, source, date, confidence. If nothing passes: one line "No strong signal; hedged pain line used."

**Never:** invent anything, guess a name, use personal details, quote a review word for word in the script (paraphrase it: "a couple of your reviews mention not getting through").
