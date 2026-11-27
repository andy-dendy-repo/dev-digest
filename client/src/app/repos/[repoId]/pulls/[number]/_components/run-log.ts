/* run-log — map run events (live SSE events or a persisted trace's log) to the
   LogLine shape LiveLogStream renders. Shared by RunStatus and RunTraceDrawer. */
import type { LogLine } from "@devdigest/ui";
import type { RunLogLine, RunTrace } from "@devdigest/shared";

/** Map run-bus events (a RunEvent is a RunLogLine plus ids) to LiveLogStream lines. */
export function eventsToLog(events: readonly RunLogLine[]): LogLine[] {
  return events.map((e) => ({ t: e.t, k: e.kind, m: e.msg }));
}

/** Map a persisted trace's log to LiveLogStream lines (empty until it loads). */
export function traceLog(trace: Pick<RunTrace, "log"> | undefined): LogLine[] {
  return eventsToLog(trace?.log ?? []);
}
