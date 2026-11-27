import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SkillsListView } from "./_components/SkillsListView";

/* Route: /skills (Skills grid, M2). Thin route entry — the view, its modals and
   helpers are colocated under _components/. */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("skills");
  return { title: t("meta.list") };
}

export default function SkillsPage() {
  return <SkillsListView />;
}
