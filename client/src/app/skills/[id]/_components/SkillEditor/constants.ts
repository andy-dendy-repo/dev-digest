import type { IconName } from "@devdigest/ui";

/** Skill editor tabs. `labelKey` resolves under the `skills` namespace. */
export const TABS: readonly { key: string; labelKey: string; icon: IconName }[] = [
  { key: "config", labelKey: "detail.tabs.config", icon: "Settings" },
  { key: "preview", labelKey: "detail.tabs.preview", icon: "Eye" },
];
