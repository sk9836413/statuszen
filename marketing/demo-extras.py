"""Extra demo data for the marketing screenshots, and a clean way to remove it again.

    python demo-extras.py apply      # add the extras (records what it added)
    python demo-extras.py fix        # point the "Pricing page" monitor at a page that exists
    python demo-extras.py monitoring # post a "Monitoring" update on the open Pricing page incident
    python demo-extras.py due        # make the administrator's monitors due now
    python demo-extras.py restore    # delete everything apply added, undo fix

Works on the SQLite database of a local demo install (DEMO_SEED=true) while the app runs
(WAL mode). Default database: E:/CODECANYON-tmp/sz-storage/database.sqlite (override with SZ_DB).
The list of added rows is kept in E:/CODECANYON-tmp/sz-marketing-state.json (SZ_STATE).

What it adds (all owned by the first administrator unless noted):
- Slack, Telegram, Discord, Microsoft Teams and webhook alert channels (fake URLs/tokens,
  never sent), attached to some monitors, and an alert log for the past incidents.
- Two weeks of "Nightly backup" heartbeat pings with run times.
- The administrator is renamed from "Owner" to "Alex Morgan".
- A second upcoming and one completed maintenance window.
- "Identified" update on the automatic "Pricing page is down" incident.
- Nine monitors of sample customers (never checked: next check far in the future) with
  24 hours of check results, so Admin -> Monitors shows a real platform.
"""
import json
import os
import random
import secrets
import sqlite3
import sys
from datetime import datetime, timedelta, timezone

DB = os.environ.get("SZ_DB", "E:/CODECANYON-tmp/sz-storage/database.sqlite")
STATE = os.environ.get("SZ_STATE", "E:/CODECANYON-tmp/sz-marketing-state.json")
NOW = datetime.now(timezone.utc)


def iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def parse(s):
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=timezone.utc)


def load_state():
    if os.path.exists(STATE):
        with open(STATE, encoding="utf8") as f:
            return json.load(f)
    return {"rows": [], "monitor2_config": None, "monitor2_status": None}


def save_state(state):
    with open(STATE, "w", encoding="utf8") as f:
        json.dump(state, f, indent=1)


def insert(c, state, table, row):
    cols = ", ".join(row)
    marks = ", ".join("?" for _ in row)
    cur = c.execute(f"INSERT INTO {table} ({cols}) VALUES ({marks})", list(row.values()))
    state["rows"].append([table, cur.lastrowid])
    return cur.lastrowid


def apply(c, state):
    if state["rows"]:
        sys.exit("Extras are already applied (run restore first).")
    random.seed(7)
    owner = c.execute("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1").fetchone()[0]
    # A real-looking name for the administrator ("Owner" in the seed).
    state["owner_name"] = [owner, c.execute("SELECT name FROM users WHERE id=?", (owner,)).fetchone()[0]]
    c.execute("UPDATE users SET name='Alex Morgan' WHERE id=?", (owner,))
    mon = {r[1]: r[0] for r in c.execute("SELECT id, name FROM monitors WHERE user_id=?", (owner,))}
    created = iso(NOW - timedelta(days=60))

    # Alert channels.
    ch = {}
    for key, typ, name, cfg in [
        ("slack", "slack", "#ops-alerts", {"webhookUrl": "https://hooks.slack.com/services/T04NW1ND/B07ALRTS/q8Zx2LmP4vT9kR3s"}),
        ("telegram", "telegram", "On-call (Telegram)", {"botToken": "7351902846:AAF3kq9ZtM2xV8wPq4LrN6yT1uB5cD7eG0h", "chatId": "-1002147483647"}),
        ("discord", "discord", "Dev team", {"webhookUrl": "https://discord.com/api/webhooks/1290412345678901234/kD9xQ2mV7pL5tR8wN3yB6cF1hJ4"}),
        ("teams", "teams", "IT operations", {"webhookUrl": "https://prod-42.westeurope.logic.azure.com/workflows/8f2c41d7/triggers/manual/paths/invoke"}),
        ("webhook", "webhook", "Incident bot (n8n)", {"url": "https://n8n.northwind.example/webhook/statuszen", "secret": secrets.token_hex(16)}),
    ]:
        ch[key] = insert(c, state, "alert_channels", {"user_id": owner, "type": typ, "name": name, "config": json.dumps(cfg), "is_active": 1, "created_at": created, "updated_at": created})
    email = c.execute("SELECT id FROM alert_channels WHERE user_id=? AND type='email' ORDER BY id LIMIT 1", (owner,)).fetchone()[0]
    links = {
        "slack": ["Website", "Pricing page", "Public API", "Docs", "SSL certificate", "Nightly backup"],
        "telegram": ["Website", "Public API", "Nightly backup"],
        "discord": ["Public API", "Docs"],
        "teams": ["SSL certificate", "Domain", "DNS"],
        "webhook": ["Public API", "Nightly backup"],
    }
    for key, names in links.items():
        for n in names:
            if n in mon:
                c.execute("INSERT OR IGNORE INTO monitor_channels (monitor_id, channel_id) VALUES (?, ?)", (mon[n], ch[key]))
                state["rows"].append(["monitor_channels", [mon[n], ch[key]]])

    # Alert log for the seeded past incidents: down + recovery to every attached channel.
    for inc_id, monitor_id, started, resolved in c.execute(
        "SELECT id, monitor_id, started_at, resolved_at FROM incidents WHERE kind='auto' AND status='resolved' AND monitor_id IS NOT NULL"
    ).fetchall():
        chans = [email] + [ch[k] for k, names in links.items() for n in names if mon.get(n) == monitor_id]
        s, r = parse(started), parse(resolved)
        for cid in chans:
            insert(c, state, "alert_log", {"monitor_id": monitor_id, "channel_id": cid, "event": "down", "ok": 1, "error": None, "created_at": iso(s + timedelta(seconds=1))})
            if (r - s) > timedelta(hours=1):
                insert(c, state, "alert_log", {"monitor_id": monitor_id, "channel_id": cid, "event": "reminder", "ok": 1, "error": None, "created_at": iso(s + timedelta(hours=1, seconds=2))})
            insert(c, state, "alert_log", {"monitor_id": monitor_id, "channel_id": cid, "event": "up", "ok": 1, "error": None, "created_at": iso(r + timedelta(seconds=1))})
    # A test message when the Slack channel was added.
    insert(c, state, "alert_log", {"monitor_id": mon.get("Website"), "channel_id": ch["slack"], "event": "test", "ok": 1, "error": None, "created_at": iso(NOW - timedelta(days=58))})

    # Heartbeat pings: the nightly backup ran at 02:00 UTC for the last 14 nights.
    hb = mon.get("Nightly backup")
    if hb:
        for d in range(14, 0, -1):
            day = (NOW - timedelta(days=d)).replace(hour=2, minute=0, second=0, microsecond=0)
            run = random.randint(260, 520)
            insert(c, state, "checks", {"monitor_id": hb, "ok": 1, "status_code": None, "response_ms": run * 1000, "error": None, "checked_at": iso(day + timedelta(seconds=run))})
        # Last night's run (keeps "Last ping" in line with the seeded last_ping_at when that is recent).
        last = c.execute("SELECT last_ping_at FROM monitors WHERE id=?", (hb,)).fetchone()[0]
        if last:
            state["hb_last_ms"] = [hb, c.execute("SELECT last_response_ms FROM monitors WHERE id=?", (hb,)).fetchone()[0]]
            c.execute("UPDATE monitors SET last_response_ms=384000 WHERE id=?", (hb,))
            insert(c, state, "checks", {"monitor_id": hb, "ok": 1, "status_code": None, "response_ms": 384000, "error": None, "checked_at": last})

    # Maintenance: a second upcoming window and a completed one.
    def maint(title, start, end, status, monitors, updates):
        iid = insert(c, state, "incidents", {
            "user_id": owner, "monitor_id": None, "kind": "maintenance", "title": title, "status": status, "impact": "maintenance",
            "started_at": iso(start), "resolved_at": iso(end) if status == "completed" else None, "scheduled_start": iso(start), "scheduled_end": iso(end),
            "cause": None, "created_at": iso(start - timedelta(days=3)), "updated_at": iso(start - timedelta(days=3)),
        })
        for n in monitors:
            if n in mon:
                c.execute("INSERT INTO incident_monitors (incident_id, monitor_id) VALUES (?, ?)", (iid, mon[n]))
                state["rows"].append(["incident_monitors", [iid, mon[n]]])
        for st, msg, at in updates:
            insert(c, state, "incident_updates", {"incident_id": iid, "status": st, "message": msg, "created_at": iso(at)})

    up_start = (NOW + timedelta(days=11)).replace(hour=1, minute=0, second=0, microsecond=0)
    maint("Payment provider migration", up_start, up_start + timedelta(hours=1, minutes=30), "scheduled", ["Website", "Pricing page"],
          [("scheduled", "We're moving checkout to a new payment provider. Checkout may be unavailable for up to 30 minutes.", NOW - timedelta(hours=20))])
    done_start = (NOW - timedelta(days=12)).replace(hour=22, minute=0, second=0, microsecond=0)
    maint("CDN migration", done_start, done_start + timedelta(hours=1), "completed", ["Website", "Docs"],
          [("scheduled", "We're moving our website and docs to a new CDN. You may see a short delay while caches warm up.", done_start - timedelta(days=3)),
           ("in_progress", "The migration has started.", done_start),
           ("completed", "The migration is complete. Everything is served from the new CDN.", done_start + timedelta(minutes=48))])

    # "Identified" update on the open automatic incident of the Pricing page.
    row = c.execute("SELECT id, started_at FROM incidents WHERE kind='auto' AND status!='resolved' ORDER BY id DESC LIMIT 1").fetchone()
    if row:
        iid, started = row
        at = min(parse(started) + timedelta(minutes=7), NOW - timedelta(minutes=1))
        insert(c, state, "incident_updates", {"incident_id": iid, "status": "identified", "message": "A deploy removed the /pricing route. We're rolling it back now.", "created_at": iso(at)})
        c.execute("UPDATE incidents SET status='identified' WHERE id=?", (iid,))
        state["incident_status"] = [iid, "investigating"]

    # Monitors of sample customers, for Admin -> Monitors.
    users = [r[0] for r in c.execute("SELECT id FROM users WHERE role='user' AND status='active' ORDER BY id LIMIT 9")]
    samples = [
        ("Storefront", "http", {"url": "https://shop.brightside.studio", "method": "GET", "headers": [], "body": "", "expectedStatus": "200-299", "timeoutSec": 15, "followRedirects": True, "maxResponseMs": 0}, 60, "up", 1, None, 180),
        ("Booking API", "http", {"url": "https://api.lumenbooking.io/health", "method": "GET", "headers": [], "body": "", "expectedStatus": "200-299", "timeoutSec": 15, "followRedirects": True, "maxResponseMs": 0}, 60, "up", 1, None, 95),
        ("Checkout", "keyword", {"url": "https://garciacoffee.com/checkout", "method": "GET", "headers": [], "body": "", "expectedStatus": "200-299", "timeoutSec": 15, "followRedirects": True, "maxResponseMs": 0, "keyword": "Pay now", "keywordMode": "present", "caseSensitive": False}, 60, "down", 1, "Expected 200-299, got 502", 240),
        ("Mail server", "tcp", {"host": "mail.novak-legal.cz", "port": 587, "timeoutSec": 10}, 300, "up", 1, None, 38),
        ("Invoices cron", "heartbeat", {"graceSec": 600}, 3600, "up", 1, None, None),
        ("SSL certificate", "ssl", {"host": "app.okafor.health", "port": 443, "warnDays": 14}, 3600, "up", 1, None, 64),
        ("Domain", "domain", {"domain": "yukijohnson.dev", "warnDays": 30}, 86400, "up", 1, None, 420),
        ("MX records", "dns", {"host": "patelandco.com", "recordType": "MX", "expected": "mail.patelandco.com"}, 300, "up", 1, None, 12),
        ("Marketing site", "http", {"url": "https://www.priyasilva.design", "method": "GET", "headers": [], "body": "", "expectedStatus": "200-299", "timeoutSec": 15, "followRedirects": True, "maxResponseMs": 0}, 300, "paused", 0, None, None),
    ]
    far = iso(NOW + timedelta(days=400))
    for i, (name, typ, cfg, interval, status, active, err, ms) in enumerate(samples):
        uid = users[i % len(users)]
        last = NOW - timedelta(minutes=random.randint(1, 4)) if active else NOW - timedelta(days=3)
        mid = insert(c, state, "monitors", {
            "user_id": uid, "name": name, "type": typ, "config": json.dumps(cfg), "interval_sec": interval, "confirm_count": 2, "status": status,
            "is_active": active, "fail_streak": 2 if status == "down" else 0, "last_check_at": iso(last), "next_check_at": far,
            "last_change_at": iso(NOW - timedelta(minutes=12) if status == "down" else NOW - timedelta(days=20)), "last_response_ms": ms, "last_error": err,
            "ssl_expires_at": iso(NOW + timedelta(days=74)) if typ == "ssl" else None, "domain_expires_at": iso(NOW + timedelta(days=212)) if typ == "domain" else None,
            "heartbeat_token": secrets.token_urlsafe(18)[:24], "last_ping_at": iso(last) if typ == "heartbeat" else None, "run_started_at": None,
            "last_reminder_at": None, "sort_order": 0, "created_at": iso(NOW - timedelta(days=30)), "updated_at": iso(NOW - timedelta(days=30)),
        })
        if not active:
            continue
        for h in range(24, 0, -1):
            at = NOW - timedelta(hours=h) + timedelta(minutes=random.randint(0, 50))
            bad = status == "down" and h <= 1
            insert(c, state, "checks", {"monitor_id": mid, "ok": 0 if bad else 1, "status_code": (502 if bad else 200) if typ in ("http", "keyword") else None,
                                        "response_ms": None if typ == "heartbeat" else int((ms or 50) * random.uniform(0.8, 1.3)), "error": err if bad else None, "checked_at": iso(at)})
        if status == "down":
            insert(c, state, "checks", {"monitor_id": mid, "ok": 0, "status_code": 502, "response_ms": 233, "error": err, "checked_at": iso(last)})


def fix(c, state):
    row = c.execute("SELECT id, config, status FROM monitors WHERE name='Pricing page' ORDER BY id LIMIT 1").fetchone()
    if not row:
        sys.exit("No Pricing page monitor")
    if state.get("monitor2_config") is None:
        state["monitor2_config"] = [row[0], row[1]]
    cfg = json.loads(row[1])
    cfg.update({"url": "https://example.com/", "keyword": "Example Domain"})
    c.execute("UPDATE monitors SET config=?, next_check_at=? WHERE id=?", (json.dumps(cfg), iso(NOW - timedelta(seconds=5)), row[0]))


def monitoring(c, state):
    row = c.execute("SELECT id FROM incidents WHERE kind='auto' AND status!='resolved' ORDER BY id DESC LIMIT 1").fetchone()
    if row:
        insert(c, state, "incident_updates", {"incident_id": row[0], "status": "monitoring", "message": "The route is back and the page loads again. We're keeping an eye on it.", "created_at": iso(NOW - timedelta(seconds=30))})
        c.execute("UPDATE incidents SET status='monitoring' WHERE id=?", (row[0],))


def due(c, state):
    """Make the administrator's HTTP-style monitors due now (for a fresh "Last result" in Admin -> System)."""
    owner = c.execute("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1").fetchone()[0]
    c.execute("UPDATE monitors SET next_check_at=? WHERE user_id=? AND type NOT IN ('heartbeat','domain') AND is_active=1", (iso(NOW - timedelta(seconds=5)), owner))


def restore(c, state):
    for table, key in reversed(state["rows"]):
        if table == "monitor_channels":
            c.execute("DELETE FROM monitor_channels WHERE monitor_id=? AND channel_id=?", key)
        elif table == "incident_monitors":
            c.execute("DELETE FROM incident_monitors WHERE incident_id=? AND monitor_id=?", key)
        elif table == "monitors":
            for t in ("checks", "monitor_daily", "alert_log", "monitor_channels", "incident_monitors"):
                c.execute(f"DELETE FROM {t} WHERE monitor_id=?", (key,))
            c.execute("DELETE FROM monitors WHERE id=?", (key,))
        elif table == "alert_channels":
            c.execute("DELETE FROM monitor_channels WHERE channel_id=?", (key,))
            c.execute("DELETE FROM alert_log WHERE channel_id=?", (key,))
            c.execute("DELETE FROM alert_channels WHERE id=?", (key,))
        else:
            c.execute(f"DELETE FROM {table} WHERE id=?", (key,))
    if state.get("monitor2_config"):
        mid, cfg = state["monitor2_config"]
        c.execute("UPDATE monitors SET config=? WHERE id=?", (cfg, mid))
    if state.get("hb_last_ms"):
        c.execute("UPDATE monitors SET last_response_ms=? WHERE id=?", (state["hb_last_ms"][1], state["hb_last_ms"][0]))
    if state.get("owner_name"):
        c.execute("UPDATE users SET name=? WHERE id=?", (state["owner_name"][1], state["owner_name"][0]))
    if state.get("incident_status"):
        iid, old = state["incident_status"]
        c.execute("UPDATE incidents SET status=? WHERE id=? AND status!='resolved'", (old, iid))
    state.update({"rows": [], "monitor2_config": None, "incident_status": None, "owner_name": None, "hb_last_ms": None})


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd not in ("apply", "fix", "monitoring", "due", "restore"):
        sys.exit(__doc__)
    conn = sqlite3.connect(DB, timeout=30)
    st = load_state()
    with conn:
        {"apply": apply, "fix": fix, "monitoring": monitoring, "due": due, "restore": restore}[cmd](conn, st)
    save_state(st)
    print(cmd, "done;", len(st["rows"]), "rows tracked")
