"use client";

import React from "react";

let seq = 0;

/** Mermaid diagrams must start with a known graph keyword. Anything else
 *  (prose, JSON like {"type":"Buffer"...}, empty) is not a diagram → skip. */
const MERMAID_RE =
  /^\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|requirementDiagram|C4Context)\b/;

function looksLikeMermaid(src: string): boolean {
  return MERMAID_RE.test(src.trim());
}

/**
 * Renders a mermaid diagram string to inline SVG. mermaid is imported lazily
 * (client-only). We VALIDATE with mermaid.parse({suppressErrors}) before
 * rendering — mermaid otherwise injects a "Syntax error" bomb graphic into the
 * DOM on bad input instead of throwing. Junk/unparseable input renders nothing.
 */
export function MermaidDiagram({ chart }: { chart: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const src = (chart ?? "").trim();
  const isMermaid = looksLikeMermaid(src);
  // Async render result for one source; anything else is still pending.
  const [result, setResult] = React.useState<{ src: string; state: "ok" | "invalid" } | null>(null);
  const state = !isMermaid ? "invalid" : result?.src === src ? result.state : "pending";

  React.useEffect(() => {
    let cancelled = false;
    if (!isMermaid) return;
    const setState = (next: "ok" | "invalid") => setResult({ src, state: next });
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });
        // parse first; suppressErrors → returns false (no throw, no DOM bomb).
        const valid = await mermaid.parse(src, { suppressErrors: true });
        if (cancelled) return;
        if (!valid) {
          setState("invalid");
          return;
        }
        const { svg } = await mermaid.render(`dd-mermaid-${seq++}`, src);
        if (cancelled) return;
        if (ref.current) ref.current.innerHTML = svg;
        setState("ok");
      } catch {
        if (!cancelled) setState("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src, isMermaid]);

  // Not a (valid) diagram → render nothing rather than a broken box.
  if (state === "invalid") return null;

  return (
    <div
      ref={ref}
      style={{
        display: state === "ok" ? "flex" : "none",
        justifyContent: "center",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 12,
        overflowX: "auto",
      }}
    />
  );
}

