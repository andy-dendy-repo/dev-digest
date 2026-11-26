/** Editor tabs the starter ships; later milestones add Skills/Evals/Stats/CI. */
const VALID_TABS: readonly string[] = ["config"];

/** The `?tab=` value if it names a known tab, else the Config tab. */
export function resolveTab(tab: string | null): string {
  return tab && VALID_TABS.includes(tab) ? tab : "config";
}
