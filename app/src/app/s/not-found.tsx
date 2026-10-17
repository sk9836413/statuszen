import { SearchX } from "lucide-react";
import { getT } from "@/lib/i18n/server";

export default async function StatusNotFound() {
  const t = await getT();
  return (
    <main className="grid flex-1 place-items-center px-5 py-24 text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
          <SearchX className="size-7" aria-hidden />
        </span>
        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight text-ink">{t("status.notFoundTitle")}</h1>
        <p className="mt-2 text-muted">{t("status.notFoundText")}</p>
      </div>
    </main>
  );
}
