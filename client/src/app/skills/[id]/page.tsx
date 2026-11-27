import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SkillDetailView } from "./_components/SkillDetailView";

/* Route: /skills/:id (Skill editor, M2). Thin server entry — the view, its
   sidebar and the editor live under _components/. */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("skills");
  return { title: t("meta.detail") };
}

export default async function SkillEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SkillDetailView id={id} />;
}
