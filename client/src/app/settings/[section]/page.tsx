import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SettingsView } from "./_components/SettingsView";

/* Route: /settings/:section. Thin server entry — the view, its section panels,
   styles, constants and i18n are colocated under _components/SettingsView. */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("meta.title") };
}

export default async function SettingsPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <SettingsView section={section} />;
}
