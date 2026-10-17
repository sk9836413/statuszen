import "server-only";
import type { Kysely } from "kysely";
import type { Database } from "./schema";

/** Translations of the default site texts, so the demo's home page is fully translated. */
const SITE_TEXTS: Record<string, Record<string, string>> = {
  ar: {
    "setting.site_tagline": "مراقبة التوفر وصفحات الحالة",
    "setting.home_hero_title": "اعرف فور توقف موقعك",
    "setting.home_hero_subtitle":
      "راقب المواقع وواجهات API وشهادات SSL والنطاقات ومهام cron. احصل على تنبيهات عبر البريد أو Slack أو Discord أو Telegram أو Webhook، وأبقِ عملاءك على اطلاع بصفحة حالة عامة.",
    "setting.footer_text": "مراقبة التوفر وSSL والنطاقات ومهام cron مع صفحات حالة عامة أنيقة.",
    "setting.copyright_text": "© {year} {site_name}. جميع الحقوق محفوظة.",
  },
  hi: {
    "setting.site_tagline": "अपटाइम मॉनिटरिंग और स्टेटस पेज",
    "setting.home_hero_title": "वेबसाइट डाउन होते ही तुरंत जानिए",
    "setting.home_hero_subtitle":
      "वेबसाइट, API, SSL सर्टिफिकेट, डोमेन और cron जॉब मॉनिटर कीजिए। ईमेल, Slack, Discord, Telegram या Webhook पर अलर्ट पाइए और पब्लिक स्टेटस पेज से ग्राहकों को अपडेट रखिए।",
    "setting.footer_text": "अपटाइम, SSL, डोमेन और cron मॉनिटरिंग, सुंदर पब्लिक स्टेटस पेज के साथ।",
    "setting.copyright_text": "© {year} {site_name}. सर्वाधिकार सुरक्षित।",
  },
};

interface LanguagePack {
  language: { code: string; name: string; native_name: string; direction: "ltr" | "rtl" };
  translations: Record<string, string>;
}

/** Install the bundled Hindi and Arabic packs on a demo site (once, guarded by a settings row). */
export async function seedDemoLanguages(db: Kysely<Database>): Promise<void> {
  try {
    await db.insertInto("settings").values({ key: "demo_languages_seeded_at", value: new Date().toISOString() }).execute();
  } catch {
    return;
  }
  const packs = [(await import("../../../languages/hi.json")).default, (await import("../../../languages/ar.json")).default] as LanguagePack[];
  for (const [index, pack] of packs.entries()) {
    const { code, name, native_name, direction } = pack.language;
    const exists = await db.selectFrom("languages").select("code").where("code", "=", code).executeTakeFirst();
    if (exists) continue;
    const rows = Object.entries({ ...pack.translations, ...SITE_TEXTS[code] }).map(([key, value]) => ({ lang: code, key, value }));
    await db.transaction().execute(async (trx) => {
      await trx.insertInto("languages").values({ code, name, native_name, direction, is_active: 1, sort_order: (index + 1) * 10 }).execute();
      for (let i = 0; i < rows.length; i += 200) await trx.insertInto("translations").values(rows.slice(i, i + 200)).execute();
    });
  }
}
