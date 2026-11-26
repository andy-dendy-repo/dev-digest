import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PrDetailView } from "./_components/PrDetailView";

/* Route: /repos/:repoId/pulls/:number (PR detail). Thin server entry — the view,
   its hook and helpers live under _components/PrDetailView. */

type Params = Promise<{ repoId: string; number: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { number } = await params;
  const t = await getTranslations("prReview");
  return { title: t("meta.detail", { number }) };
}

export default async function PRDetailPage({ params }: { params: Params }) {
  const { repoId, number } = await params;
  return <PrDetailView repoId={repoId} number={number} />;
}
