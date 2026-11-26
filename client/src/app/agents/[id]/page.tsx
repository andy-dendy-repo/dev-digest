import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AgentDetailView } from "./_components/AgentDetailView";

/* Route: /agents/:id (Agent Editor). Thin server entry — the view, its sidebar
   and helpers live under _components/AgentDetailView. */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agents");
  return { title: t("meta.detail") };
}

export default async function AgentEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgentDetailView id={id} />;
}
