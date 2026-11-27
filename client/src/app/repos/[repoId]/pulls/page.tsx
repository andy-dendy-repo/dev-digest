import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PullsListView } from "./_components/PullsListView";

/* Route: /repos/:repoId/pulls (PR list). Thin server entry — the view lives under
   _components/PullsListView; filter/sort/count rules in ./helpers. */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("prReview");
  return { title: t("meta.list") };
}

export default async function PullsPage({ params }: { params: Promise<{ repoId: string }> }) {
  const { repoId } = await params;
  return <PullsListView repoId={repoId} />;
}
