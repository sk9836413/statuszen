/*
 * Statuszen status widget (public/sz.js).
 *
 *   <script async src="https://PLATFORM/sz.js" data-page="my-status"
 *           data-position="bottom-left|bottom-right" data-theme="light|dark|auto"></script>
 *
 * Optional: data-lang="de" (headline language), data-label="View status" (banner link text).
 * Shows a small pill with the overall status; when an incident is open, a slim banner
 * with its title. Renders in a Shadow DOM, refreshes every 60 s while the tab is visible
 * and never throws. The only global is the double-load guard.
 */

declare const __SZ_CSS__: string;

interface WidgetStatus {
  name: string;
  url: string;
  status: string;
  headline: string;
  activeIncidents: Array<{ title: string; url: string }>;
}

(() => {
  try {
    const w = window as unknown as { __statuszenStatus?: 1 };
    if (w.__statuszenStatus) return;
    w.__statuszenStatus = 1;

    const script = (document.currentScript ||
      document.querySelector('script[data-page][src*="sz.js"]')) as HTMLScriptElement | null;
    const slug = script && script.getAttribute("data-page");
    if (!script || !slug) return;
    const attr = (name: string) => script.getAttribute("data-" + name) || "";

    const origin = new URL(script.src, location.href).origin;
    const right = attr("position") === "bottom-right";
    const theme = /^(light|dark)$/.test(attr("theme")) ? attr("theme") : "auto";
    const api = origin + "/api/status/" + encodeURIComponent(slug) + (attr("lang") ? "?lang=" + encodeURIComponent(attr("lang")) : "");
    const viewLabel = attr("label") || "View status";
    const dismissKey = "sz-dismissed:" + slug;

    let root: ShadowRoot | null = null;
    let wrap: HTMLElement;
    let last = 0;

    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
      const node = document.createElement(tag);
      node.className = cls;
      if (text) node.textContent = text;
      return node;
    };
    // Only follow links that point back to the platform.
    const safe = (url: string) => (typeof url === "string" && url.indexOf(origin + "/") === 0 ? url : origin + "/s/" + encodeURIComponent(slug));
    const link = (cls: string, href: string) => {
      const a = el("a", cls);
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
      return a;
    };

    const render = (data: WidgetStatus) => {
      if (!data || typeof data.headline !== "string") return;
      if (!root) {
        const host = document.createElement("div");
        host.setAttribute("data-statuszen", "");
        host.style.cssText = "all:initial;position:fixed;z-index:2147483000;bottom:16px;" + (right ? "right" : "left") + ":16px";
        document.body.appendChild(host);
        root = host.attachShadow({ mode: "open" });
        const style = document.createElement("style");
        style.textContent = __SZ_CSS__;
        wrap = el("div", "w " + theme + (right ? " r" : ""));
        root.append(style, wrap);
      }
      const tone = "s-" + String(data.status).replace(/[^a-z_]/g, "");
      wrap.textContent = "";

      const incident = data.activeIncidents && data.activeIncidents[0];
      let dismissed = "";
      try {
        dismissed = sessionStorage.getItem(dismissKey) || "";
      } catch {
        /* storage blocked */
      }
      if (incident && dismissed !== incident.url) {
        const banner = el("div", "b " + tone);
        banner.setAttribute("role", "status");
        const body = el("div", "bb");
        body.append(el("strong", "", incident.title), el("span", "h", data.headline));
        const more = link("v", safe(incident.url));
        more.textContent = viewLabel + " →";
        body.append(more);
        const close = el("button", "x", "×");
        close.type = "button";
        close.setAttribute("aria-label", "Dismiss");
        close.onclick = () => {
          try {
            sessionStorage.setItem(dismissKey, incident.url);
          } catch {
            /* storage blocked */
          }
          banner.remove();
        };
        banner.append(el("span", "d"), body, close);
        wrap.append(banner);
      }

      const pill = link("p " + tone, safe(data.url));
      pill.title = data.name;
      pill.append(el("span", "d"), el("span", "", data.headline));
      wrap.append(pill);
    };

    const load = () => {
      last = Date.now();
      try {
        fetch(api, { credentials: "omit" })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            try {
              if (d) render(d as WidgetStatus);
            } catch {
              /* never break the host page */
            }
          })
          .catch(() => undefined);
      } catch {
        /* fetch unavailable */
      }
    };

    const start = () => {
      load();
      setInterval(() => {
        if (document.visibilityState === "visible") load();
      }, 60_000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && Date.now() - last > 60_000) load();
      });
    };
    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start);
  } catch {
    /* never break the host page */
  }
})();
