/* useFindingShortcuts — j/k navigation + a/d accept/dismiss for ONE panel.
   Several FindingsPanels can be open at once (one per expanded review run),
   and each would otherwise act on its own focused finding for the same key
   press. Only the "owner" panel handles keys: the one most recently mounted,
   or the one the user last clicked / focused into. */
"use client";

import React from "react";
import type { FindingActionKind } from "@devdigest/shared";
import { KEY_TO_ACTION } from "./constants";
import { isPlainShortcut } from "./helpers";

// Stack of mounted panels; the last entry owns the keyboard.
const owners: string[] = [];
const release = (id: string) => {
  const i = owners.indexOf(id);
  if (i !== -1) owners.splice(i, 1);
};
const claim = (id: string) => {
  release(id);
  owners.push(id);
};
const isOwner = (id: string) => owners[owners.length - 1] === id;

interface Options {
  count: number;
  focusIdx: number;
  setFocusIdx: React.Dispatch<React.SetStateAction<number>>;
  onAction: (index: number, action: FindingActionKind) => void;
}

/** Returns props to spread on the panel root so interacting with it claims the keyboard. */
export function useFindingShortcuts({ count, focusIdx, setFocusIdx, onAction }: Options) {
  const id = React.useId();

  React.useEffect(() => {
    claim(id);
    return () => release(id);
  }, [id]);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isOwner(id) || !isPlainShortcut(e)) return;
      if (e.key === "j") setFocusIdx((i) => Math.min(i + 1, count - 1));
      else if (e.key === "k") setFocusIdx((i) => Math.max(i - 1, 0));
      else {
        const action = KEY_TO_ACTION[e.key];
        if (action && focusIdx < count) onAction(focusIdx, action);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [id, count, focusIdx, setFocusIdx, onAction]);

  const claimKeyboard = React.useCallback(() => claim(id), [id]);
  return { onPointerDown: claimKeyboard, onFocus: claimKeyboard };
}
