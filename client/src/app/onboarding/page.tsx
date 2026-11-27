import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AddRepoView } from "./_components/AddRepoView";

/* Add-repository route — /onboarding. Thin server entry; the screen lives in
   _components/AddRepoView. */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("meta.title") };
}

export default function AddRepoPage() {
  return <AddRepoView />;
}
