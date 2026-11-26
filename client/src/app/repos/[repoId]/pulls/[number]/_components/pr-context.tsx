/* pr-context — the PR every component of the PR-detail screen works on.
   Provided once by PrDetailView, so the findings tree (FindingsTab →
   ReviewRunAccordion → FindingsPanel) no longer drills these props. */
"use client";

import React from "react";

export interface PrContextValue {
  /** The PR row's uuid (every PR API is keyed by it). */
  prId: string;
  /** "owner/repo"; null until the repo is loaded (no GitHub deep links yet). */
  repoFullName: string | null;
  /** Head commit, used to deep-link a finding's file:line to GitHub. */
  headSha: string | null;
}

const PrContext = React.createContext<PrContextValue | null>(null);

export function PrProvider({ value, children }: { value: PrContextValue; children: React.ReactNode }) {
  return <PrContext.Provider value={value}>{children}</PrContext.Provider>;
}

export function usePrContext(): PrContextValue {
  const ctx = React.useContext(PrContext);
  if (!ctx) throw new Error("usePrContext must be used within <PrProvider>");
  return ctx;
}
