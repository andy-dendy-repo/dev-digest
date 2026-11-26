/* Route: /repos/:repoId/pulls (PR list). Thin entry — the view lives under
   _components/PullsListView; filter/sort/count rules in ./helpers. */
"use client";

import { useParams } from "next/navigation";
import { PullsListView } from "./_components/PullsListView";

export default function PullsPage() {
  const { repoId } = useParams<{ repoId: string }>();
  return <PullsListView repoId={repoId} />;
}
