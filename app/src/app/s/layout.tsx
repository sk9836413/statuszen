import type { ReactNode } from "react";
import { getLocale } from "@/lib/i18n/server";

// Status pages show live data and the visitor's language.
export const dynamic = "force-dynamic";

/** Public status pages: no marketing header or footer, only the page's own chrome (see [slug]/layout.tsx). */
export default async function StatusRootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const langScript = `document.documentElement.lang=${JSON.stringify(locale.code)};document.documentElement.dir=${JSON.stringify(locale.dir)};`;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: langScript }} />
      <div dir={locale.dir} lang={locale.code} className="flex min-h-dvh flex-col">
        {children}
      </div>
    </>
  );
}
