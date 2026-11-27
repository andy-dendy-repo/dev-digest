/** Editor tabs (M2 adds Skills; later milestones add Evals/Stats/CI). */
const VALID_TABS: readonly string[] = ["config", "skills"];

/** The `?tab=` value if it names a known tab, else the Config tab. */
export function resolveTab(tab: string | null): string {
  return tab && VALID_TABS.includes(tab) ? tab : "config";
}
