/* toast.tsx — A6 cross-cutting: system-level notifications.
   Error UX taxonomy: system errors → toast (here); form errors → inline;
   critical → full-screen (ErrorState fullScreen). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  toast: (message: string, kind?: ToastKind) => void;
  success: (m: string) => void;
  error: (m: string) => void;
  info: (m: string) => void;
}

const ToastCtx = React.createContext<ToastApi | null>(null);

/** How long a toast stays before it dismisses itself. */
export const TOAST_TTL_MS = 4000;

export function useToast(): ToastApi {
  const ctx = React.useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

/* Module-level bridge so non-React code (e.g. the React Query cache) can raise
   toasts without the hook. The mounted <ToastProvider> registers its pusher. */
type Pusher = (message: string, kind?: ToastKind) => void;
let activePusher: Pusher | null = null;
export const notify = {
  toast: (m: string, k?: ToastKind) => activePusher?.(m, k),
  success: (m: string) => activePusher?.(m, "success"),
  error: (m: string) => activePusher?.(m, "error"),
  info: (m: string) => activePusher?.(m, "info"),
};

const COLORS: Record<ToastKind, { bg: string; border: string; icon: string }> = {
  success: { bg: "var(--ok-bg)", border: "var(--ok)", icon: "✓" },
  error: { bg: "var(--crit-bg)", border: "var(--crit)", icon: "✕" },
  info: { bg: "var(--bg-elevated)", border: "var(--border-strong)", icon: "ℹ" },
};

const s = {
  stack: {
    position: "fixed",
    bottom: 20,
    right: 20,
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    maxWidth: 380,
  },
  toast: (c: (typeof COLORS)[ToastKind]): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    borderRadius: 9,
    background: c.bg,
    border: `1px solid ${c.border}`,
    color: "var(--text-primary)",
    fontSize: 14,
    boxShadow: "var(--shadow-toast)",
    animation: "ddToastIn .16s ease-out",
  }),
  icon: (c: (typeof COLORS)[ToastKind]): React.CSSProperties => ({ color: c.border, fontWeight: 700 }),
  message: { flex: 1 },
  dismiss: { background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16 },
} satisfies Record<string, React.CSSProperties | ((c: (typeof COLORS)[ToastKind]) => React.CSSProperties)>;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("common");
  const [items, setItems] = React.useState<Toast[]>([]);
  const seq = React.useRef(1);
  const timers = React.useRef(new Set<ReturnType<typeof setTimeout>>());

  // Auto-dismiss timers must not fire into an unmounted provider.
  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const id of pending) clearTimeout(id);
      pending.clear();
    };
  }, []);

  const push = React.useCallback((message: string, kind: ToastKind = "info") => {
    const id = seq.current++;
    setItems((prev) => [...prev, { id, kind, message }]);
    // auto-dismiss after 4s
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_TTL_MS);
    timers.current.add(timer);
  }, []);

  const api = React.useMemo<ToastApi>(
    () => ({
      toast: push,
      success: (m) => push(m, "success"),
      error: (m) => push(m, "error"),
      info: (m) => push(m, "info"),
    }),
    [push],
  );

  // Expose this provider's pusher to the module-level `notify` bridge.
  React.useEffect(() => {
    activePusher = push;
    return () => {
      if (activePusher === push) activePusher = null;
    };
  }, [push]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div style={s.stack} role="status" aria-live="polite">
        {items.map((item) => {
          const c = COLORS[item.kind];
          return (
            <div key={item.id} style={s.toast(c)}>
              <span style={s.icon(c)}>{c.icon}</span>
              <span style={s.message}>{item.message}</span>
              <button
                onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
                style={s.dismiss}
                aria-label={t("toast.dismiss")}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
