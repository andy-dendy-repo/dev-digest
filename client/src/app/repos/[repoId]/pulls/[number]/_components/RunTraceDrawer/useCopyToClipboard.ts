"use client";

import React from "react";

/**
 * Copy text and show a short "copied" confirmation. The reset timer is cleared
 * on unmount and when copying again, so a closed drawer never sets state.
 */
export function useCopyToClipboard(resetMs: number) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), resetMs);
  };

  return { copied, copy };
}
