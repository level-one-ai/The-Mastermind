#!/usr/bin/env python3
"""The Mastermind: save, check, pick, stats, sync and render cold-call scripts.

Run from the repo root, for example:
  python3 skill/the-mastermind/scripts/mastermind.py check --file lead.json
  python3 skill/the-mastermind/scripts/mastermind.py save  --library library/ --file lead.json
  python3 skill/the-mastermind/scripts/mastermind.py pick  --library library/ --niche trades
  python3 skill/the-mastermind/scripts/mastermind.py stats --library library/
  python3 skill/the-mastermind/scripts/mastermind.py sync  --library library/
  python3 skill/the-mastermind/scripts/mastermind.py render --library library/ --lead <id>

Standard library only. Definitions match desk/lib/stats.ts so the desk and the skill agree.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import shutil
import sys
from collections import Counter, defaultdict
from pathlib import Path

SECTIONS = [
    ("prep", "Before you dial"),
    ("gatekeeper", "If someone else answers"),
    ("opener", "Opener"),
    ("reason", "Why I'm calling"),
    ("questions", "Questions"),
    ("bridge", "If it's a problem for them"),
    ("ask", "The ask"),
    ("objections", "If they push back"),
    ("voicemail", "Voicemail"),
    ("booked", "When they say yes"),
    ("followup", "Text after the call"),
]
SECTION_IDS = [s for s, _ in SECTIONS]
LABELS = dict(SECTIONS)

OUTCOMES = {
    "booked": "Meeting booked",
    "callback": "Callback",
    "no-answer": "No answer",
    "voicemail": "Voicemail left",
    "gatekeeper": "Gatekeeper",
    "info": "Asked for info",
    "lost": "Lost",
    "dnc": "Do not call",
    "wrong-number": "Wrong number",
}
CONVERSATION = {"booked", "callback", "info", "lost", "dnc"}
LOST_OUTCOMES = {"lost", "dnc", "wrong-number"}

MIN_DECIDED = 10  # before a template can be champion or be judged
RETIRE_AFTER = 15
PROMOTE_MARGIN = 0.05
RETIRE_MARGIN = 0.10

WPM = 150  # spoken words per minute

PLACEHOLDER = re.compile(r"\{\{|\}\}|\[[^\]\n]{1,40}\]|\binsert\b|\bTBC\b|\bXXX*\b|<[a-z _]+>", re.I)
BANNED_WORDS = re.compile(r"\bAI\b|\bA\.I\.|artificial intelligence|\bautomat\w*|\bchat ?bot\w*", re.I)
BANNED_PHRASES = [
    "sorry to bother",
    "did i catch you at a bad time",
    "how are you today",
    "how have you been",
    "just calling to introduce",
    "reach out",
    "leverage",
    "solution",
    "streamline",
    "game-changer",
    "game changer",
    "seamless",
    "cutting-edge",
    "unlock",
]
PRICE = re.compile(r"£\s?\d")
DASH = re.compile(r"—|\s–\s")
DIRECTION = re.compile(r"_\([^)]*\)_")


# ---------- helpers ----------

def now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def write_json(p: Path, data) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def slug(s: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s[:60] or "lead"


def spoken(text: str) -> str:
    """Text Dean actually says: stage directions and 'They:' lines removed."""
    lines = [ln for ln in text.splitlines() if not ln.strip().lower().startswith(("they:", "listen for:"))]
    return DIRECTION.sub(" ", "\n".join(lines))


def words(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9£'’]+", text))


def leads_dir(lib: Path) -> Path:
    return lib / "desk" / "leads"


def load_leads(lib: Path, include_demo=False):
    out = []
    for p in sorted(leads_dir(lib).glob("*.json")):
        lead = read_json(p)
        if lead.get("demo") and not include_demo:
            continue
        out.append(lead)
    return out


def load_niches(lib: Path):
    return {read_json(p)["id"]: read_json(p) for p in sorted((lib / "niches").glob("*.json"))}


# ---------- check ----------

def check_lead(lead: dict):
    errors, warnings = [], []
    for field in ("company", "niche"):
        if not lead.get(field):
            errors.append(f"Missing {field}")
    if not lead.get("phone"):
        warnings.append("No phone number yet")
    script = lead.get("script") or {}
    if not script.get("templateId"):
        errors.append("script.templateId missing (use mastermind.py pick)")
    secs = {s.get("id"): s for s in script.get("sections", [])}
    for sid in SECTION_IDS:
        if sid not in secs or not str(secs[sid].get("body", "")).strip():
            errors.append(f"Section '{sid}' ({LABELS[sid]}) is missing or empty")
    for sid, sec in secs.items():
        body = str(sec.get("body", ""))
        where = LABELS.get(sid, sid)
        for m in PLACEHOLDER.finditer(body):
            errors.append(f"{where}: blank or variable left in: '{m.group(0)}'")
        say = spoken(body)
        if sid != "prep":
            for m in BANNED_WORDS.finditer(say):
                errors.append(f"{where}: Dean never says '{m.group(0)}' on a call")
            low = say.lower()
            for phrase in BANNED_PHRASES:
                if phrase in low:
                    errors.append(f"{where}: cut '{phrase}'")
            if PRICE.search(say):
                errors.append(f"{where}: no prices on a cold call")
        if DASH.search(body):
            errors.append(f"{where}: em or en dash, use a full stop or comma")
    if "opener" in secs:
        n = words(spoken(secs["opener"]["body"]))
        secs_aloud = round(n / WPM * 60)
        if n > 75:
            errors.append(f"Opener is {n} words (~{secs_aloud}s aloud). Keep it to 75 words / 30 seconds")
        elif n > 60:
            warnings.append(f"Opener is {n} words (~{secs_aloud}s). Fine, but tighter is better")
        if spoken(secs["opener"]["body"]).count("?") > 2:
            warnings.append("Opener asks more than two questions")
    if "voicemail" in secs:
        n = words(spoken(secs["voicemail"]["body"]))
        if n > 80:
            errors.append(f"Voicemail is {n} words (~{round(n / WPM * 60)}s). Keep it under 25 seconds")
        elif n > 65:
            warnings.append(f"Voicemail is {n} words, close to the 25 second limit")
    if "followup" in secs and words(secs["followup"]["body"]) > 60:
        errors.append("Text after the call is over 60 words")
    if "objections" in secs:
        k = len(re.findall(r"^\s*They:", secs["objections"]["body"], re.M))
        if k < 3:
            warnings.append(f"Only {k} objections; aim for 4")
    if "ask" in secs and secs["ask"]["body"].count("?") > 2:
        warnings.append("The ask has more than two questions. One ask only")
    return errors, warnings


def cmd_check(a):
    lead = read_json(Path(a.file))
    errors, warnings = check_lead(lead)
    for w in warnings:
        print(f"warn  {w}")
    for e in errors:
        print(f"FAIL  {e}")
    if errors:
        print(f"\n{len(errors)} problem(s). Fix and run check again.")
        sys.exit(1)
    print("PASS  script is ready" + (f" ({len(warnings)} warning(s))" if warnings else ""))


# ---------- save ----------

def next_script_id(lib: Path) -> str:
    top = 0
    for lead in load_leads(lib, include_demo=True):
        m = re.match(r"S-(\d+)", (lead.get("script") or {}).get("id", ""))
        if m:
            top = max(top, int(m.group(1)))
    return f"S-{top + 1:04d}"


def cmd_save(a):
    lib = Path(a.library)
    lead = read_json(Path(a.file))
    errors, warnings = check_lead(lead)
    for w in warnings:
        print(f"warn  {w}")
    if errors:
        for e in errors:
            print(f"FAIL  {e}")
        sys.exit("Not saved: fix the problems above first.")
    stamp = now()
    lead.setdefault("id", f"{stamp[:10]}-{slug(lead['company'])}")
    if not re.fullmatch(r"[\w-]+", lead["id"]):
        sys.exit("Lead id may only use letters, numbers, - and _")
    path = leads_dir(lib) / f"{lead['id']}.json"
    old = read_json(path) if path.exists() else None
    if old and not a.replace:
        sys.exit(f"{path} already exists. Use --replace to write a new script for it (call log is kept).")
    script = lead["script"]
    script["id"] = (old or {}).get("script", {}).get("id") if old and not a.new_id else None
    script["id"] = script["id"] or next_script_id(lib)
    script.setdefault("slot", "champion")
    script.setdefault("variable", "")
    script.setdefault("pattern", "")
    script["writtenAt"] = stamp
    ordered = []
    secs = {s["id"]: s for s in script["sections"]}
    for sid in SECTION_IDS:
        s = secs[sid]
        body = s["body"].strip()
        ordered.append({"id": sid, "label": LABELS[sid], "body": body, "original": body, "edited": False})
    script["sections"] = ordered
    lead.setdefault("signals", [])
    lead.setdefault("bestTime", "")
    lead.setdefault("contact", "")
    lead.setdefault("role", "")
    lead.setdefault("town", "")
    lead.setdefault("website", "")
    lead["tps"] = (old or lead).get("tps") or {"checked": False}
    lead["status"] = (old or {}).get("status", lead.get("status", "to-call"))
    lead["calls"] = (old or {}).get("calls", [])
    if old and old.get("callbackAt"):
        lead["callbackAt"] = old["callbackAt"]
    lead["createdAt"] = (old or {}).get("createdAt", stamp)
    lead["updatedAt"] = stamp
    write_json(path, lead)
    print(f"Saved {path} ({script['id']}, template {script['templateId']}, {script['slot']})")


# ---------- stats ----------

def final_state(lead: dict) -> str:
    """booked | lost | bad | open"""
    status = lead.get("status")
    if status == "booked":
        return "booked"
    if status == "lost":
        last = next((c for c in reversed(lead.get("calls", [])) if c.get("outcome") in LOST_OUTCOMES), None)
        if last and last.get("outcome") == "wrong-number":
            return "bad"
        return "lost"
    return "open"


def empty_row():
    return {"leads": 0, "calls": 0, "conversations": 0, "booked": 0, "lost": 0, "bad": 0, "open": 0}


def rate(row) -> float | None:
    d = row["booked"] + row["lost"]
    return round(row["booked"] / d, 4) if d else None


def compute(lib: Path):
    leads = load_leads(lib)
    niches = load_niches(lib)
    tpl_meta = {}
    for n in niches.values():
        for t in n.get("templates", []):
            tpl_meta[t["id"]] = {"name": t.get("name", t["id"]), "niche": n["id"], "pattern": t.get("pattern", ""), "status": t.get("status", "testing")}
    by = {"template": defaultdict(empty_row), "niche": defaultdict(empty_row), "pattern": defaultdict(empty_row)}
    total = empty_row()
    reasons = defaultdict(Counter)
    stages = defaultdict(Counter)
    for lead in leads:
        s = lead.get("script") or {}
        keys = {"template": s.get("templateId", "unknown"), "niche": lead.get("niche", "unknown"), "pattern": s.get("pattern") or tpl_meta.get(s.get("templateId"), {}).get("pattern", "unknown")}
        state = final_state(lead)
        calls = lead.get("calls", [])
        conv = sum(1 for c in calls if c.get("outcome") in CONVERSATION)
        for row in [total] + [by[k][v] for k, v in keys.items()]:
            row["leads"] += 1
            row["calls"] += len(calls)
            row["conversations"] += conv
            row[state] += 1
        if state == "lost":
            last = next((c for c in reversed(calls) if c.get("outcome") in LOST_OUTCOMES), {})
            reason = "Asked not to call" if last.get("outcome") == "dnc" else (last.get("lostReason") or "No reason given")
            reasons["all"][reason] += 1
            reasons[keys["niche"]][reason] += 1
            if last.get("stage"):
                stages["all"][last["stage"]] += 1
                stages[keys["niche"]][last["stage"]] += 1
    def table(d):
        out = {}
        for k, row in d.items():
            r = dict(row)
            r["decided"] = row["booked"] + row["lost"]
            r["bookingRate"] = rate(row)
            out[k] = r
        return out
    templates = table(by["template"])
    for tid, meta in tpl_meta.items():
        templates.setdefault(tid, {**empty_row(), "decided": 0, "bookingRate": None})
        templates[tid].update(meta)
    tot = dict(total)
    tot["decided"] = total["booked"] + total["lost"]
    tot["bookingRate"] = rate(total)
    return {
        "generatedAt": now(),
        "definitions": "bookingRate = booked / (booked + lost). Wrong numbers are not losses. Decided = booked + lost.",
        "total": tot,
        "templates": templates,
        "niches": table(by["niche"]),
        "patterns": table(by["pattern"]),
        "lostReasons": {k: dict(v.most_common()) for k, v in reasons.items()},
        "wentWrongAt": {k: dict(v.most_common()) for k, v in stages.items()},
    }


def pct(r):
    return "-" if r is None else f"{round(r * 100)}%"


def verdict(row):
    if row["decided"] < MIN_DECIDED:
        return f"too early ({MIN_DECIDED - row['decided']} more decided)"
    return pct(row["bookingRate"])


def scoreboard_md(sb, niches) -> str:
    t = sb["total"]
    lines = [
        "# Scoreboard",
        "",
        f"Generated {sb['generatedAt']} by mastermind.py stats. Don't hand-edit.",
        "",
        f"**All calls:** {t['leads']} leads, {t['calls']} calls logged, {t['conversations']} conversations, "
        f"**{t['booked']} booked**, {t['lost']} lost, {t['bad']} wrong numbers, {t['open']} still being called. "
        f"Booking rate {pct(t['bookingRate'])}.",
        "",
        "Booking rate = booked ÷ (booked + lost). A template needs 10 decided leads before it's judged.",
        "",
        "## Templates",
        "",
        "| Niche | Template | Status | Leads | Booked | Lost | Rate | Verdict |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for tid, r in sorted(sb["templates"].items(), key=lambda kv: (kv[1].get("niche", ""), kv[0])):
        lines.append(f"| {r.get('niche', '?')} | {r.get('name', tid)} (`{tid}`) | {r.get('status', '?')} | {r['leads']} | {r['booked']} | {r['lost']} | {pct(r['bookingRate'])} | {verdict(r)} |")
    lines += ["", "## Niches", "", "| Niche | Leads | Booked | Lost | Rate |", "|---|---|---|---|---|"]
    for k, r in sorted(sb["niches"].items()):
        label = niches.get(k, {}).get("label", k)
        lines.append(f"| {label} | {r['leads']} | {r['booked']} | {r['lost']} | {pct(r['bookingRate'])} |")
    lines += ["", "## Opener patterns", "", "| Pattern | Leads | Booked | Lost | Rate |", "|---|---|---|---|---|"]
    for k, r in sorted(sb["patterns"].items()):
        lines.append(f"| {k} | {r['leads']} | {r['booked']} | {r['lost']} | {pct(r['bookingRate'])} |")
    for title, key in (("Why leads were lost", "lostReasons"), ("Where it went wrong", "wentWrongAt")):
        lines += ["", f"## {title}", ""]
        data = sb[key]
        if not data:
            lines.append("Nothing logged yet.")
            continue
        for scope in ["all"] + sorted(k for k in data if k != "all"):
            items = ", ".join(f"{k} {v}" for k, v in data[scope].items())
            lines.append(f"- **{'All niches' if scope == 'all' else niches.get(scope, {}).get('label', scope)}:** {items}")
    return "\n".join(lines) + "\n"


def cmd_stats(a):
    lib = Path(a.library)
    sb = compute(lib)
    write_json(lib / "learnings" / "scoreboard.json", sb)
    (lib / "learnings" / "scoreboard.md").write_text(scoreboard_md(sb, load_niches(lib)), encoding="utf-8")
    t = sb["total"]
    print(f"Scoreboard: {t['leads']} leads, {t['booked']} booked, {t['lost']} lost, rate {pct(t['bookingRate'])}")
    return sb


# ---------- pick ----------

def cmd_pick(a):
    lib = Path(a.library)
    niches = load_niches(lib)
    if a.niche not in niches:
        sys.exit(f"No niche '{a.niche}'. Have: {', '.join(niches)}")
    niche = niches[a.niche]
    sb = compute(lib)["templates"]
    live = [t for t in niche["templates"] if t.get("status") != "retired"]
    if not live:
        sys.exit("Every template in this niche is retired. Write a new one (analyst).")
    row = lambda t: sb.get(t["id"], {"decided": 0, "bookingRate": None, "leads": 0})
    judged = [t for t in live if row(t)["decided"] >= MIN_DECIDED]
    champion = max(judged, key=lambda t: row(t)["bookingRate"] or 0) if judged else None
    testing = [t for t in live if t.get("status") == "testing" and row(t)["decided"] < MIN_DECIDED and t is not champion]
    niche_leads = sum(1 for lead in load_leads(lib) if lead.get("niche") == a.niche)
    notes = []
    if champion is None:
        pickt = min(live, key=lambda t: (row(t)["leads"], t["id"]))
        slot = "rotation"
        notes.append(f"No template has {MIN_DECIDED} decided leads yet, so templates take turns (fewest leads first).")
    elif testing and (niche_leads + 1) % 3 == 0:
        pickt = sorted(testing, key=lambda t: t.get("createdAt", ""))[-1]
        slot = "challenger"
        notes.append(f"Every third lead tests the challenger. Champion is {champion['id']} at {pct(row(champion)['bookingRate'])}.")
    else:
        pickt = champion
        slot = "champion"
        notes.append(f"Champion: {pct(row(champion)['bookingRate'])} over {row(champion)['decided']} decided leads.")
    # Promotion / retirement advice for the analyst.
    if champion:
        cr = row(champion)["bookingRate"] or 0
        for t in live:
            r = row(t)
            if t is champion or r["bookingRate"] is None:
                continue
            if t.get("status") == "testing" and r["decided"] >= MIN_DECIDED and r["bookingRate"] >= cr + PROMOTE_MARGIN:
                notes.append(f"PROMOTE {t['id']}: {pct(r['bookingRate'])} beats champion {pct(cr)}.")
            if r["decided"] >= RETIRE_AFTER and (r["booked"] == 0 or r["bookingRate"] <= cr - RETIRE_MARGIN):
                notes.append(f"RETIRE {t['id']}: {pct(r['bookingRate'])} over {r['decided']} decided.")
    if not any(t.get("status") == "testing" for t in live):
        notes.append("No challenger in this niche. Analyst: write one that changes one variable.")
    print(json.dumps({"niche": a.niche, "templateId": pickt["id"], "pattern": pickt.get("pattern", ""), "slot": slot, "variable": pickt.get("variable", ""), "notes": notes}, indent=2))
    if a.show:
        print()
        for s in pickt["sections"]:
            print(f"## {LABELS.get(s['id'], s['id'])}\n{s['body']}\n")


# ---------- sync ----------

def cmd_sync(a):
    lib = Path(a.library)
    pending = lib / "desk" / "edits" / "pending"
    processed = lib / "desk" / "edits" / "processed"
    processed.mkdir(parents=True, exist_ok=True)
    edits_log = lib / "voice" / "edits.md"
    edits_log.parent.mkdir(parents=True, exist_ok=True)
    if not edits_log.exists():
        edits_log.write_text("# Dean's script edits\n\nWritten by mastermind.py sync from the Call Desk. Newest last.\n", encoding="utf-8")
    n_edits = 0
    entries = []
    for p in sorted(pending.glob("*.json")):
        e = read_json(p)
        entries.append(
            f"\n## {e.get('savedAt', '')[:16]} · {e.get('company', e.get('leadId'))} · {e.get('label', e.get('section'))}\n"
            f"Template `{e.get('templateId', '')}`\n\n**Before**\n\n{e.get('before', '').strip()}\n\n**Dean's version**\n\n{e.get('edited', '').strip()}\n"
        )
        shutil.move(str(p), processed / p.name)
        n_edits += 1
    if entries:
        with edits_log.open("a", encoding="utf-8") as f:
            f.write("".join(entries))
    marker = lib / "learnings" / ".last-sync"
    since = marker.read_text().strip() if marker.exists() else ""
    new_calls = []
    for lead in load_leads(lib):
        for c in lead.get("calls", []):
            if c.get("at", "") > since:
                new_calls.append((c["at"], lead["company"], c))
    new_calls.sort()
    sb = cmd_stats(a)
    stamp = now()
    marker.write_text(stamp + "\n")
    print(f"Edits filed into voice/edits.md: {n_edits}")
    print(f"Calls logged since last sync: {len(new_calls)}")
    for at, company, c in new_calls:
        extra = " · ".join(x for x in (c.get("lostReason"), c.get("stage") and f"went wrong at {c['stage']}", c.get("note")) if x)
        print(f"  {at[:16]}  {company}: {OUTCOMES.get(c['outcome'], c['outcome'])}{(' · ' + extra) if extra else ''}")
    if n_edits or new_calls:
        log = lib / "learnings" / "changelog.md"
        with log.open("a", encoding="utf-8") as f:
            f.write(f"- {stamp[:10]} sync: {len(new_calls)} calls, {n_edits} edits; booked {sb['total']['booked']}, lost {sb['total']['lost']}, rate {pct(sb['total']['bookingRate'])}\n")


# ---------- render ----------

def cmd_render(a):
    lib = Path(a.library)
    lead = read_json(leads_dir(lib) / f"{a.lead}.json")
    print(f"# {lead['company']}  ({lead.get('town', '')}, {lead.get('phone', '')})\n")
    for s in lead["script"]["sections"]:
        print(f"## {s['label']}\n{s['body']}\n")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("check"); p.add_argument("--file", required=True); p.set_defaults(fn=cmd_check)
    p = sub.add_parser("save"); p.add_argument("--library", required=True); p.add_argument("--file", required=True)
    p.add_argument("--replace", action="store_true"); p.add_argument("--new-id", action="store_true"); p.set_defaults(fn=cmd_save)
    p = sub.add_parser("pick"); p.add_argument("--library", required=True); p.add_argument("--niche", required=True)
    p.add_argument("--show", action="store_true", help="print the template too"); p.set_defaults(fn=cmd_pick)
    p = sub.add_parser("stats"); p.add_argument("--library", required=True); p.set_defaults(fn=cmd_stats)
    p = sub.add_parser("sync"); p.add_argument("--library", required=True); p.set_defaults(fn=cmd_sync)
    p = sub.add_parser("render"); p.add_argument("--library", required=True); p.add_argument("--lead", required=True); p.set_defaults(fn=cmd_render)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
