"""Turn raw screenshots and rendered templates into the final Envato images.

    python demo-extras.py apply   # optional sample data (see shoot.mjs for the full recipe)
    node shoot.mjs                # raw/  (needs the demo server, default http://localhost:3700)
    node render.mjs               # out/  (compositions, preview, thumbnail)
    python finalize.py            # final/

The screenshots zip is built with Windows PowerShell's Compress-Archive: Envato's
uploader rejected a zip written by Python's zipfile for Toolzen ("not a zip").
"""
import subprocess
import zipfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
RAW, OUT, FINAL = HERE / "raw", HERE / "out", HERE / "final"
SHOTS = FINAL / "screenshots"
ZIP = FINAL / "Statuszen-Screenshots.zip"

ORDER = [
    ("01-features", OUT / "features.png"),
    ("02-home", RAW / "l1-home-hero.png"),
    ("03-alerts-everywhere", OUT / "alerts.png"),
    ("04-public-status-page", RAW / "s1b-status-full.png"),
    ("05-status-page-dark-incident", RAW / "x1-status-outage-dark.png"),
    ("06-dashboard-overview", RAW / "d01-overview.png"),
    ("07-monitors", RAW / "d02-monitors.png"),
    ("08-monitor-detail", RAW / "d03b-monitor-detail-full.png"),
    ("09-seven-monitor-types", RAW / "d04-new-monitor.png"),
    ("10-http-monitor-test-now", RAW / "d05-new-monitor-form.png"),
    ("11-cron-heartbeat-monitor", RAW / "d06b-heartbeat-full.png"),
    ("12-incident-updates", RAW / "x6-incident-detail.png"),
    ("13-incidents", RAW / "d07-incidents.png"),
    ("14-public-incident-page", RAW / "s3-incident.png"),
    ("15-incident-history", RAW / "s4-history.png"),
    ("16-maintenance-windows", RAW / "d09-maintenance.png"),
    ("17-status-page-builder", RAW / "d08b-status-page-builder-full.png"),
    ("18-email-subscriptions", RAW / "s5-subscribe.png"),
    ("19-alert-channels", RAW / "d11-channels.png"),
    ("20-alert-channel-types", RAW / "d12-channel-types.png"),
    ("21-telegram-channel", RAW / "d14-channel-telegram.png"),
    ("22-badges-widget-json-api", OUT / "embed.png"),
    ("23-mobile", OUT / "mobile.png"),
    ("24-arabic-rtl-status-page", RAW / "r1-status-ar.png"),
    ("25-arabic-rtl-dashboard", RAW / "r2-overview-ar.png"),
    ("26-hindi-dashboard", RAW / "r5-overview-hi.png"),
    ("27-admin-dashboard", RAW / "a1-admin-dashboard.png"),
    ("28-admin-monitors", RAW / "a2-admin-monitors.png"),
    ("29-admin-system-scheduler", RAW / "a3-admin-system.png"),
    ("30-admin-plans", RAW / "a4-admin-plans.png"),
    ("31-admin-monitoring-settings", RAW / "a5-admin-settings-monitoring.png"),
    ("32-admin-users", RAW / "a6-admin-users.png"),
    ("33-admin-payments", RAW / "a7-admin-payments.png"),
    ("34-pricing", RAW / "l4-pricing.png"),
    ("35-dark-mode", RAW / "l3-home-dark.png"),
    ("36-home-full-page", RAW / "l2-home-full.png"),
]

missing = [str(src) for _, src in ORDER if not src.exists()]
if missing:
    raise SystemExit("Missing: " + ", ".join(missing))

SHOTS.mkdir(parents=True, exist_ok=True)
for old in SHOTS.glob("*.jpg"):
    old.unlink()
for name, src in ORDER:
    Image.open(src).convert("RGB").save(SHOTS / f"{name}.jpg", "JPEG", quality=88, optimize=True, progressive=True)

Image.open(OUT / "preview-590x300.png").convert("RGB").save(FINAL / "preview-590x300.jpg", "JPEG", quality=92, optimize=True)
Image.open(OUT / "thumbnail-80x80.png").save(FINAL / "thumbnail-80x80.png", optimize=True)

if ZIP.exists():
    ZIP.unlink()
subprocess.run(
    [
        "powershell.exe", "-NoProfile", "-NonInteractive", "-Command",
        f"Compress-Archive -Path '{SHOTS}\\*.jpg' -DestinationPath '{ZIP}' -CompressionLevel Optimal -Force",
    ],
    check=True,
)

# Check the archive: every image at the zip root, nothing else.
with zipfile.ZipFile(ZIP) as z:
    names = sorted(z.namelist())
    bad = z.testzip()
expected = sorted(f"{name}.jpg" for name, _ in ORDER)
if bad or names != expected:
    raise SystemExit(f"Zip check failed: bad={bad} names={names}")

thumb = (FINAL / "thumbnail-80x80.png").stat().st_size
size = Image.open(FINAL / "preview-590x300.jpg").size
print(f"{len(ORDER)} screenshots, zip {ZIP.stat().st_size // 1024} KB, preview {size}, thumbnail {thumb / 1024:.1f} KB")
if thumb >= 50 * 1024 or size != (590, 300):
    raise SystemExit("thumbnail or preview does not meet Envato's limits")
