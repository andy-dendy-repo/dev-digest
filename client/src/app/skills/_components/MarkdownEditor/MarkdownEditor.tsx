/* MarkdownEditor — a skill body editor: file-name bar (+ "unsaved"), a line-number
   gutter and an approximate token count. The textarea grows with its content
   (no inner scroll), so the gutter and the text always line up. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon } from "@devdigest/ui";
import { estimateTokens } from "@/lib/skills";
import { s } from "./styles";

const MIN_ROWS = 12;

export function MarkdownEditor({
  value,
  onChange,
  filename,
  label,
  dirty = false,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  filename: string;
  /** Accessible name of the textarea. */
  label: string;
  dirty?: boolean;
  placeholder?: string;
}) {
  const t = useTranslations("skills");
  const lines = Math.max(value.split("\n").length, 1);
  const rows = Math.max(lines, MIN_ROWS);
  return (
    <div style={s.frame}>
      <div style={s.bar}>
        <Icon.FileText size={13} />
        <span className="mono" style={s.filename}>
          {filename}
        </span>
        {dirty && <Badge color="var(--text-muted)">{t("config.unsaved")}</Badge>}
        <span style={s.tokens}>{t("config.estimate", { count: estimateTokens(value) })}</span>
      </div>
      <div style={s.scroller}>
        <div className="mono" style={s.gutter} aria-hidden>
          {Array.from({ length: rows }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <textarea
          aria-label={label}
          className="mono"
          value={value}
          rows={rows}
          wrap="off"
          spellCheck={false}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={s.textarea}
        />
      </div>
    </div>
  );
}
