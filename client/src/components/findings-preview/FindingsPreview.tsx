/* FindingsPreview — severity icons + counts for one review run; clicking them
   opens a read-only panel with a brief version of that run's findings. Used on
   the Agent runs timeline and in the PR list Findings column.

   The panel is portalled to <body> with fixed positioning, because the PR list
   table clips overflow. React portal events still bubble through the React
   tree, so clicks are stopped here — otherwise a PR row would navigate. */
"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Icon, SEV, CategoryTag, ConfidenceNum, type Category } from "@devdigest/ui";
import { SEVERITIES, bySeverityThenConfidence, countBySeverity } from "@/lib/findings-severity";
import { lineRange, panelPosition, type FindingPreviewItem, type PanelPosition } from "./helpers";
import { s } from "./styles";

export function FindingsPreview({ findings }: { findings: FindingPreviewItem[] }) {
  const t = useTranslations("prReview");
  const [pos, setPos] = React.useState<PanelPosition | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const panelId = React.useId();
  const open = pos !== null;

  const place = React.useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPos(panelPosition(rect, { width: window.innerWidth, height: window.innerHeight }));
  }, []);

  // While open: follow the trigger on scroll/resize; close on outside press or Escape.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setPos(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setPos(null);
      triggerRef.current?.focus();
    };
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, place]);

  if (findings.length === 0) return null;

  const counts = countBySeverity(findings);
  const sorted = [...findings].sort(bySeverityThenConfidence);
  const header = t("findingsPreview.header", { count: findings.length });

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={t("findingsPreview.trigger", { count: findings.length })}
        onClick={(e) => {
          e.stopPropagation();
          if (open) setPos(null);
          else place();
        }}
        style={s.trigger}
      >
        {SEVERITIES.filter((sev) => counts[sev] > 0).map((sev) => {
          const I = Icon[SEV[sev].icon];
          return (
            <span key={sev} style={s.sevCount(SEV[sev].c)}>
              <I size={13} />
              <span className="tnum">{counts[sev]}</span>
            </span>
          );
        })}
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={header}
            onClick={(e) => e.stopPropagation()}
            style={s.panel(pos)}
          >
            <div style={s.header}>
              <Icon.FileText size={13} />
              {header}
            </div>
            <ul style={s.list}>
              {sorted.map((f) => {
                const I = Icon[SEV[f.severity].icon];
                return (
                  <li key={f.id} style={s.item}>
                    <div style={s.titleRow}>
                      <I size={14} style={{ color: SEV[f.severity].c, flexShrink: 0 }} />
                      <span style={s.title} title={f.title}>
                        {f.title}
                      </span>
                      <CategoryTag category={f.category as Category} />
                    </div>
                    <div style={s.metaRow}>
                      <span className="mono" style={s.location}>
                        {f.file}:{lineRange(f)}
                      </span>
                      <ConfidenceNum value={f.confidence} />
                    </div>
                    <div style={s.rationale}>{f.rationale}</div>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}
