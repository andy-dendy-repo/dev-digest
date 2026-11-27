/** Editor tabs of a skill (M2 ships Config + Preview). */
const VALID_TABS: readonly string[] = ["config", "preview"];

/** The `?tab=` value if it names a known tab, else the Config tab. */
export function resolveTab(tab: string | null): string {
  return tab && VALID_TABS.includes(tab) ? tab : "config";
}
