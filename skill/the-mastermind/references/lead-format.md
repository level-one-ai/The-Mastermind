# Lead file format

One file per company: `library/desk/leads/<id>.json`. The skill writes it; the Call Desk changes `status`, `calls`, `tps`, `notes`, `callbackAt` and section bodies. Never hand-edit `calls` from the skill side.

```json
{
  "id": "2026-11-09-gary-mcleod-plumbing",
  "company": "Gary McLeod Plumbing & Heating",
  "contact": "Gary",
  "role": "Owner",
  "phone": "0131 000 0000",
  "website": "https://...",
  "email": "",
  "instagram": "",
  "town": "Dalkeith",
  "niche": "trades",
  "signals": [
    { "text": "Two Google reviews in Oct 2026 say they couldn't get through on the phone", "source": "Google Business Profile", "date": "2026-10", "confidence": "verified" }
  ],
  "bestTime": "Tue to Thu, 7:30 to 8:30am or after 5pm",
  "tps": { "checked": false },
  "script": {
    "id": "S-0007",
    "templateId": "trades-permission-v1",
    "pattern": "permission",
    "slot": "champion",
    "variable": "",
    "writtenAt": "2026-11-09T10:12:00Z",
    "sections": [
      { "id": "prep", "label": "Before you dial", "body": "...", "original": "...", "edited": false }
    ]
  },
  "status": "to-call",
  "calls": [],
  "createdAt": "2026-11-09T10:12:00Z",
  "updatedAt": "2026-11-09T10:12:00Z"
}
```

- `status`: `to-call` | `callback` | `booked` | `lost`.
- `calls[]`: `{ "at", "outcome", "note", "lostReason"?, "stage"?, "callbackAt"? }`. Outcomes: `booked`, `callback`, `no-answer`, `voicemail`, `gatekeeper`, `info`, `lost`, `dnc`, `wrong-number`.
- `lost` and `dnc` and `wrong-number` move the lead to the Lost list. `booked` to Booked. `callback` sets `callbackAt`.
- Dean can change `company`, `contact`, `role`, `phone`, `town`, `website`, `email`, `instagram` and `bestTime` from the desk (Edit details). A blank `phone` is allowed: the desk shows "Add phone number". Never invent a number; leave it blank and say so in `prep`.
- `demo: true` marks the sample lead; it's hidden once real leads exist and never counted.
- Section IDs and labels: see `script-anatomy.md`. `mastermind.py save` fills `original`, `edited`, the script ID and timestamps; write only `id`, `label` and `body`.
