/* Route: /agents/:id (Agent Editor). Thin entry — the view, its sidebar and
   helpers live under _components/AgentDetailView. */
"use client";

import { useParams } from "next/navigation";
import { AgentDetailView } from "./_components/AgentDetailView";

export default function AgentEditorPage() {
  const { id } = useParams<{ id: string }>();
  return <AgentDetailView id={id} />;
}
