// Captures marketing screenshots of a running Statuszen instance with headless Chrome (CDP).
//
//   node shoot.mjs [baseUrl] [outDir] [only]
//
// baseUrl  default http://localhost:3700 (a production build seeded with DEMO_SEED=true)
// outDir   default ./raw
// only     optional comma list of name prefixes, e.g. "l,d03" (l = landing, s = status page,
//          d = dashboard, m = mobile, r = Arabic / Hindi, a = admin, b = badges, w = widget)
//
// Sign-in: SHOT_EMAIL / SHOT_PASSWORD (default owner@example.com / owner12345).
// The Chrome profile is created under E:/CODECANYON-tmp/tmp (SHOT_TMP) and removed afterwards.
//
// Recipe used for the CodeCanyon images (see demo-extras.py):
//   python demo-extras.py apply                       sample channels, alert log, pings, customers
//   node shoot.mjs "" "" "x"                          scenes marked "outage" (Pricing page down)
//   python demo-extras.py monitoring; python demo-extras.py fix; open the cron URL
//   node shoot.mjs "" "" "l,s,d,m,r,a,b,w"            everything else, all systems operational
//   python demo-extras.py restore
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch, sleep } from "./lib/cdp.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] || "http://localhost:3700").replace(/\/$/, "");
const OUT = path.resolve(process.argv[3] || path.join(HERE, "raw"));
const ONLY = (process.argv[4] ?? "").split(",").filter(Boolean);
const EMAIL = process.env.SHOT_EMAIL ?? "owner@example.com";
const PASSWORD = process.env.SHOT_PASSWORD ?? "owner12345";
// What the screenshots show instead of the local demo addresses (display only, nothing is saved).
const PUBLIC_URL = "https://status.example.com";
const HOST = new URL(BASE).host;
const SWAPS = [
  [/E:\\CODECANYON-tmp\\sz-storage/g, "/var/www/statuszen/storage"],
  [/testsecret-long-1/g, "c7f3e91a4b2d58066e1f9a7c"],
  [/(?<!status\.)example\.com/g, "northwind.io"],
  [new RegExp("https?://" + HOST.replace(/[.:]/g, "\\$&"), "g"), PUBLIC_URL],
  [new RegExp(HOST.replace(/[.:]/g, "\\$&"), "g"), new URL(PUBLIC_URL).host],
];

fs.mkdirSync(OUT, { recursive: true });
const { send, waitFor, evaluate, close, errors } = await launch();

await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Network.enable");

let current = { width: 1440, height: 900, mobile: false, scale: 1 };
async function viewport(width, height, { mobile = false, scale = 1 } = {}) {
  current = { width, height, mobile, scale };
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile });
  await send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
}
async function scheme(dark) {
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: dark ? "dark" : "light" }, { name: "prefers-reduced-motion", value: "no-preference" }] });
}
async function lang(code) {
  await send("Network.setCookie", { name: "tz_lang", value: code, url: BASE + "/" });
}
async function theme(t) {
  await evaluate(`localStorage.setItem('tz-theme', '${t}'); true`);
  await scheme(t === "dark");
}
async function go(url, settle = 1800) {
  const loaded = waitFor("Page.loadEventFired");
  await send("Page.navigate", { url: url.startsWith("http") || url.startsWith("file:") ? url : BASE + url });
  await loaded;
  await evaluate("document.fonts.ready.then(() => true)");
  await sleep(settle);
  await prep();
}

// Hide scrollbars and the cookie banner, finish entrance animations and swap the local demo
// addresses for public-looking ones (text only, nothing is saved).
async function prep() {
  await evaluate(`(() => {
    if (!document.getElementById('sz-shot')) {
      const s = document.createElement('style'); s.id = 'sz-shot';
      s.textContent = 'html{scrollbar-width:none} ::-webkit-scrollbar{display:none} nextjs-portal{display:none!important}';
      document.head.appendChild(s);
    }
    return true; })()`);
  await settleAnimations();
  await brandify();
}
async function settleAnimations() {
  // Finite animations jump to their end. Looping ones are paused at a good frame: the home page
  // alert toasts where the "recovered" toast sits above the faded "down" toast, pings mid-pulse.
  await evaluate(`(() => { document.getAnimations().forEach((a) => { const t = a.effect?.getTiming?.(); if (!t) return;
    if (t.iterations !== Infinity) { try { a.finish(); } catch {} return; }
    a.pause(); a.currentTime = /toast/.test(a.animationName || '') ? 6000 : 350; }); return true; })()`);
}
async function brandify() {
  const swaps = SWAPS.map(([re, to]) => [re.source, re.flags, to]);
  await evaluate(`(() => {
    const swaps = ${JSON.stringify(swaps)}.map(([s, f, t]) => [new RegExp(s, f), t]);
    const swap = (v) => swaps.reduce((acc, [re, t]) => acc.replace(re, t), v);
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode()); ) { const v = swap(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
    document.querySelectorAll('input, textarea').forEach((el) => { if (el.value) { const v = swap(el.value); if (v !== el.value) el.value = v; } if (el.placeholder) el.placeholder = swap(el.placeholder); });
    return true; })()`);
}

async function shot(name, { full = false, clip, height } = {}) {
  await sleep(150);
  const params = { format: "png" };
  if (full || height) {
    const h = height ?? (await evaluate("Math.ceil(document.documentElement.scrollHeight)"));
    params.clip = { x: 0, y: 0, width: current.width, height: h, scale: 1 };
    params.captureBeyondViewport = true;
  } else if (clip) {
    params.clip = { ...clip, scale: 1 };
  }
  const { data } = await send("Page.captureScreenshot", params);
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, "base64"));
  console.log("saved", name);
}
// Tall screenshot: grow the viewport to the page height first, so sticky sidebars fill it.
async function tall(name, maxHeight = 6000, minHeight = 900) {
  const h = Math.max(minHeight, Math.min(maxHeight, await evaluate("Math.ceil(document.documentElement.scrollHeight)")));
  const keep = { ...current };
  await viewport(current.width, h, { mobile: current.mobile, scale: current.scale });
  await sleep(900);
  await settleAnimations();
  await brandify();
  await shot(name);
  await viewport(keep.width, keep.height, keep);
  return h;
}
// Outage scenes ("x…") only run when asked for explicitly.
// Tall screenshot that ends just below the card whose heading starts with `heading`.
async function tallTo(name, heading, pad = 16) {
  const h = await evaluate("Math.ceil(document.documentElement.scrollHeight)");
  const keep = { ...current };
  await viewport(current.width, h, { mobile: current.mobile, scale: current.scale });
  await sleep(900);
  await settleAnimations();
  await brandify();
  const bottom = await evaluate(`(() => { const el = [...document.querySelectorAll('h2,h3,p,span,div')].find((x) => x.children.length === 0 && x.textContent.trim().startsWith(${JSON.stringify(heading)}));
    if (!el) return 0; let card = el; while (card.parentElement && !/rounded/.test(card.className || '')) card = card.parentElement;
    const top = card.getBoundingClientRect().top; const rows = [...(card.parentElement?.children ?? [card])].filter((r) => Math.abs(r.getBoundingClientRect().top - top) < 4);
    return Math.ceil(Math.max(...rows.map((r) => r.getBoundingClientRect().bottom)) + scrollY); })()`);
  await shot(name, { height: bottom ? Math.min(h, bottom + pad) : h });
  await viewport(keep.width, keep.height, keep);
}
const want = (name) => (name.startsWith("x") ? ONLY.some((p) => p.startsWith("x") && name.startsWith(p)) : !ONLY.length || ONLY.some((p) => name.startsWith(p) || p.startsWith(name)));

async function login() {
  await go("/login", 1000);
  await evaluate(`(() => { const set = (n, v) => { const el = document.querySelector('input[name=' + n + ']'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    set('email', ${JSON.stringify(EMAIL)}); set('password', ${JSON.stringify(PASSWORD)}); document.querySelector('form button[type=submit]').click(); return true; })()`);
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    const p = await evaluate("location.pathname");
    if (p !== "/login") return p;
  }
  throw new Error("login failed");
}
const setValue = (selector, value) =>
  evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
const clickText = (selector, re) =>
  evaluate(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => ${re}.test(x.textContent.trim())); el?.click(); return !!el; })()`);

try {
  await viewport(1440, 900);
  await scheme(false);
  await go("/", 300);
  await evaluate("localStorage.setItem('tz-cookie-consent','1'); localStorage.setItem('tz-theme','light'); true");
  await lang("en");

  // ── Outage scenes (run while the "Pricing page" monitor is down, see the recipe above) ──
  if (want("x")) {
    await scheme(true);
    await go("/s/demo", 1500);
    await shot("x1-status-outage-dark");
    await tall("x1b-status-outage-dark-full");
    await scheme(false);
    await go("/s/demo", 1500);
    await shot("x2-status-outage");
    // The status widget on a sample website, with the incident banner.
    await go(pathToFileURL(path.join(HERE, "templates", "widget-host.html")).href + "?base=" + encodeURIComponent(BASE), 3500);
    await shot("x3-widget-outage");
    await viewport(390, 844, { mobile: true, scale: 2 });
    await go("/s/demo", 1500);
    await shot("x4-status-outage-mobile");
    await viewport(1440, 900);
    console.log("login ->", await login());
    await go("/dashboard", 1500);
    await shot("x5-overview-down");
    const inc = await evaluate(`document.querySelector('a[href^="/dashboard/incidents/"]:not([href$="/new"])')?.getAttribute('href')`);
    if (inc) {
      await go(inc, 1500);
      await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Monitoring$/.test(x.textContent.trim())); b?.click(); return true; })()`);
      await setValue("form textarea", "The /pricing route is back after the rollback and the page loads normally. We're keeping an eye on it.");
      await sleep(400);
      await shot("x6-incident-detail");
    }
    await go("/dashboard/incidents", 1500);
    await shot("x7-incidents-open");
    await viewport(390, 844, { mobile: true, scale: 2 });
    await go("/dashboard", 1500);
    await shot("x8-overview-down-mobile");
    await viewport(1440, 900);
  }

  // ── Landing ──
  if (want("l1")) {
    await go("/", 2500);
    await shot("l1-home-hero", { clip: { x: 0, y: 0, width: 1440, height: 848 } });
  }
  if (want("l2")) {
    await go("/", 1500);
    await evaluate(`(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 150)); } scrollTo(0, 0); return true; })()`);
    await sleep(1500);
    await tall("l2-home-full", 12000);
  }
  if (want("l3")) {
    await theme("dark");
    await go("/", 2500);
    await shot("l3-home-dark", { clip: { x: 0, y: 0, width: 1440, height: 848 } });
    await theme("light");
  }
  if (want("l4")) {
    await go("/pricing", 1500);
    await tallTo("l4-pricing", "Agency", 64);
  }

  // ── Public status page ──
  if (want("s")) {
    await go("/s/demo", 1500);
    if (want("s1")) {
      await shot("s1-status");
      await tall("s1b-status-full");
    }
    if (want("s2")) {
      await scheme(true);
      await go("/s/demo", 1500);
      await shot("s2-status-dark");
      await scheme(false);
    }
    if (want("s3")) {
      const inc = await evaluate(`(() => { const a = [...document.querySelectorAll('a[href*="/incidents/"]')].find((x) => /Pricing page/.test(x.textContent)); return a?.getAttribute('href'); })()`);
      await go(inc || "/s/demo/history", 1500);
      await shot("s3-incident");
    }
    if (want("s4")) {
      await go("/s/demo/history", 1500);
      await shot("s4-history");
    }
    if (want("s5")) {
      await go("/s/demo", 1500);
      await clickText("header button", /Subscribe/);
      await sleep(600);
      await setValue("dialog input[type=email]", "jordan@brightside.studio");
      await sleep(400);
      await shot("s5-subscribe");
    }
  }

  // ── Customer dashboard ──
  const needLogin = ["d", "m", "r", "a"].some((p) => ONLY.length === 0 || ONLY.some((o) => o.startsWith(p)));
  if (needLogin) console.log("login ->", await login());

  if (want("d")) {
    const pages = [
      ["d01-overview", "/dashboard"],
      ["d02-monitors", "/dashboard/monitors"],
      ["d04-new-monitor", "/dashboard/monitors/new"],
      ["d07-incidents", "/dashboard/incidents?tab=resolved"],
      ["d09-maintenance", "/dashboard/maintenance"],
      ["d10-status-pages", "/dashboard/status-pages"],
      ["d11-channels", "/dashboard/channels"],
      ["d12-channel-types", "/dashboard/channels/new"],
    ];
    for (const [name, url] of pages) {
      if (!want(name)) continue;
      await go(url, 1800);
      await shot(name);
    }
    if (want("d03")) {
      await go("/dashboard/monitors/1", 2000);
      await shot("d03-monitor-detail");
      await tallTo("d03b-monitor-detail-full", "Badges");
    }
    if (want("d05")) {
      await go("/dashboard/monitors/new?type=http", 1500);
      await setValue("input[name=name]", "Shop homepage");
      await setValue("input[type=url]", "https://example.com/");
      await evaluate(`(() => { const d = [...document.querySelectorAll('details')].find((x) => /Advanced request/.test(x.textContent)); if (d) d.open = true; return !!d; })()`);
      await sleep(300);
      await clickText("button", /^Test now$/);
      for (let i = 0; i < 40; i++) {
        await sleep(500);
        if (await evaluate(`![...document.querySelectorAll('button')].some((b) => /Testing/.test(b.textContent))`)) break;
      }
      await sleep(800);
      await settleAnimations();
      await brandify();
      await tall("d05-new-monitor-form", 3000);
    }
    if (want("d06")) {
      await go("/dashboard/monitors/8?range=7d", 2000);
      await clickText("[role=tab], button", /^Bash$/);
      await sleep(500);
      await brandify();
      await shot("d06-heartbeat");
      await tallTo("d06b-heartbeat-full", "Uptime history");
    }
    if (want("d08")) {
      await go("/dashboard/status-pages/1", 2000);
      await shot("d08-status-page-builder");
      await tall("d08b-status-page-builder-full", 3200);
    }
    if (want("d13") || want("d14")) {
      await go("/dashboard/channels", 1500);
      const hrefs = await evaluate(`Object.fromEntries([...document.querySelectorAll('a[href^="/dashboard/channels/"]')].filter((a) => /\\/\\d+$/.test(a.getAttribute('href'))).map((a) => [a.closest('li,article,div')?.innerText.split('\\n')[0] ?? '', a.getAttribute('href')]))`);
      console.log("channels", hrefs);
      const all = await evaluate(`[...new Set([...document.querySelectorAll('a[href^="/dashboard/channels/"]')].map((a) => a.getAttribute('href')).filter((h) => /\\/\\d+$/.test(h)))]`);
      for (const href of all) {
        await go(href, 1500);
        const type = await evaluate(`document.querySelector('input[name=type]')?.value`);
        if (type === "slack" && want("d13")) await shot("d13-channel-slack");
        if (type === "telegram" && want("d14")) {
          // The help box's long getUpdates URL overflows its card (app bug, reported); wrap it for the picture.
          await evaluate(`(() => { const s = document.createElement('style'); s.textContent = 'ol li, ol li * { overflow-wrap: anywhere; }'; document.head.appendChild(s); return true; })()`);
          await sleep(200);
          await shot("d14-channel-telegram");
        }
      }
    }
  }

  // ── Mobile ──
  if (want("m")) {
    await viewport(390, 844, { mobile: true, scale: 2 });
    await go("/s/demo", 1500);
    await shot("m1-status");
    await go("/dashboard", 1800);
    await shot("m2-overview");
    await go("/dashboard/monitors/1", 1800);
    await shot("m3-monitor");
    await go("/", 2000);
    await shot("m4-home");
    await viewport(1440, 900);
  }

  // ── Arabic RTL and Hindi ──
  if (want("r")) {
    await lang("ar");
    await go("/s/demo", 1500);
    await shot("r1-status-ar");
    await go("/dashboard", 1800);
    await shot("r2-overview-ar");
    await go("/dashboard/monitors/1", 1800);
    await shot("r3-monitor-ar");
    await go("/", 2500);
    await shot("r4-home-ar", { clip: { x: 0, y: 0, width: 1440, height: 848 } });
    await lang("hi");
    await go("/dashboard", 1800);
    await shot("r5-overview-hi");
    await go("/s/demo", 1500);
    await shot("r6-status-hi");
    await lang("en");
  }

  // ── Admin ──
  if (want("a")) {
    for (const [name, url] of [
      ["a1-admin-dashboard", "/admin"],
      ["a2-admin-monitors", "/admin/monitors"],
      ["a3-admin-system", "/admin/system"],
      ["a4-admin-plans", "/admin/plans"],
      ["a5-admin-settings-monitoring", "/admin/settings/monitoring"],
      ["a6-admin-users", "/admin/users"],
      ["a7-admin-payments", "/admin/payments"],
      ["a8-admin-settings-payments", "/admin/settings/payments"],
      ["a9-admin-languages", "/admin/languages"],
    ]) {
      if (!want(name)) continue;
      // A fresh cron tick first, so the Scheduler card shows a real result (SHOT_CRON_URL, optional).
      if (name === "a3-admin-system" && process.env.SHOT_CRON_URL) {
        execFileSync("python", [path.join(HERE, "demo-extras.py"), "due"]);
        console.log("tick", (await (await fetch(process.env.SHOT_CRON_URL)).text()).slice(0, 120));
      }
      await go(url, 1800);
      await shot(name);
    }
  }

  // ── Badges (SVG files for the embed composition) ──
  if (want("b")) {
    const dir = path.join(OUT, "badges");
    fs.mkdirSync(dir, { recursive: true });
    await go("/dashboard/monitors/1", 1500);
    const key = await evaluate(`(() => { const v = [...document.querySelectorAll('input')].map((i) => i.value).find((v) => /\\/badge\\/m\\//.test(v)); return v ? v.match(/\\/badge\\/m\\/([^.\\/"?)]+)\\.svg/)[1] : null; })()`);
    const list = [
      ["page", "/badge/demo.svg"],
      ["page-square", "/badge/demo.svg?style=flat-square"],
      ["page-label", "/badge/demo.svg?label=Northwind"],
      ...(key ? [["monitor", `/badge/m/${key}.svg`], ["monitor-uptime", `/badge/m/${key}.svg?type=uptime`], ["monitor-uptime-square", `/badge/m/${key}.svg?type=uptime&style=flat-square`], ["monitor-label", `/badge/m/${key}.svg?label=API`]] : []),
    ];
    for (const [name, url] of list) {
      const svg = await (await fetch(BASE + url)).text();
      fs.writeFileSync(path.join(dir, `${name}.svg`), svg);
      console.log("badge", name, svg.length);
    }
    const json = await (await fetch(BASE + "/api/status/demo")).text();
    fs.writeFileSync(path.join(dir, "status.json"), json.replaceAll(BASE, PUBLIC_URL));
  }

  // ── Status widget on a sample website ──
  if (want("w")) {
    await go(pathToFileURL(path.join(HERE, "templates", "widget-host.html")).href + "?base=" + encodeURIComponent(BASE), 3500);
    await shot("w1-widget");
    await scheme(true);
    await go(pathToFileURL(path.join(HERE, "templates", "widget-host.html")).href + "?base=" + encodeURIComponent(BASE) + "&dark=1", 3500);
    await shot("w2-widget-dark");
    await scheme(false);
  }

  console.log("errors:", errors.length ? [...new Set(errors)].slice(0, 25) : "none");
} finally {
  await close();
}
process.exit(0);
