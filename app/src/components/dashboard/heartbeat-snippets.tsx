"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { useT } from "@/lib/i18n/client";
import { CopyField } from "./copy";

const LANGS = ["cron", "shell", "powershell", "node", "python", "github"] as const;
type Lang = (typeof LANGS)[number];

function snippet(lang: Lang, url: string): string {
  switch (lang) {
    case "cron":
      return `# Run the job every hour, then ping when it succeeds\n0 * * * * /path/to/job.sh && curl -fsS -m 10 --retry 3 ${url} > /dev/null`;
    case "shell":
      return `curl -fsS -m 10 --retry 3 ${url}/start\nif /path/to/job.sh; then\n  curl -fsS -m 10 --retry 3 ${url}\nelse\n  curl -fsS -m 10 --retry 3 ${url}/fail\nfi`;
    case "powershell":
      return `try {\n  # ... your job ...\n  Invoke-RestMethod -Uri "${url}" -TimeoutSec 10 | Out-Null\n} catch {\n  Invoke-RestMethod -Uri "${url}/fail" -TimeoutSec 10 | Out-Null\n}`;
    case "node":
      return `const PING = "${url}";\n\ntry {\n  await runJob();\n  await fetch(PING);\n} catch (err) {\n  await fetch(\`\${PING}/fail\`, { method: "POST", body: String(err) });\n}`;
    case "python":
      return `import urllib.request\n\nPING = "${url}"\n\ntry:\n    run_job()\n    urllib.request.urlopen(PING, timeout=10)\nexcept Exception:\n    urllib.request.urlopen(PING + "/fail", timeout=10)`;
    case "github":
      return `      - name: Report success to the heartbeat monitor\n        if: success()\n        run: curl -fsS -m 10 --retry 3 ${url}\n\n      - name: Report failure\n        if: failure()\n        run: curl -fsS -m 10 --retry 3 ${url}/fail`;
  }
}

const LABELS: Record<Lang, string> = { cron: "Crontab", shell: "Bash", powershell: "PowerShell", node: "Node.js", python: "Python", github: "GitHub Actions" };

/** The heartbeat ping URL with copy-paste snippets for common schedulers and languages. */
export function HeartbeatSnippets({ url }: { url: string }) {
  const t = useT();
  const [lang, setLang] = useState<Lang>("cron");
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-1.5 text-sm font-medium">{t("dash.heartbeat.urlLabel")}</p>
        <CopyField value={url} label={t("dash.heartbeat.urlLabel")} />
        <p className="mt-1.5 text-xs text-muted">{t("dash.heartbeat.urlHint")}</p>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t("dash.heartbeat.examples")}</p>
        <Segmented value={lang} onChange={setLang} label={t("dash.heartbeat.examples")} options={LANGS.map((l) => ({ value: l, label: LABELS[l] }))} />
        <CopyField value={snippet(lang, url)} label={LABELS[lang]} multiline className="mt-3" />
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        {[
          { path: "", text: t("dash.heartbeat.success") },
          { path: "/start", text: t("dash.heartbeat.start") },
          { path: "/fail", text: t("dash.heartbeat.fail") },
        ].map((row) => (
          <div key={row.path} className="rounded-lg border border-line bg-paper p-3">
            <dt className="font-mono text-xs font-semibold text-primary" dir="ltr">
              {row.path ? `…${row.path}` : t("dash.heartbeat.plainUrl")}
            </dt>
            <dd className="mt-1 text-xs text-muted">{row.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
