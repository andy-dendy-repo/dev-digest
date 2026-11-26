/* RunStatus — live SSE status for in-flight review runs. Subscribes to the
   run event streams and renders the shared LiveLogStream. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { LiveLogStream } from "@devdigest/ui";
import { useRunEvents } from "@/lib/hooks/reviews";
import { eventsToLog } from "../run-log";
import { LOG_HEIGHT } from "./constants";
import { s } from "./styles";

export function RunStatus({
  runIds,
  onDone,
}: {
  runIds: string[];
  onDone?: () => void;
}) {
  const t = useTranslations("prReview");
  const { events, running } = useRunEvents(runIds);
  const wasRunning = React.useRef(false);

  React.useEffect(() => {
    if (running) wasRunning.current = true;
    if (!running && wasRunning.current) onDone?.();
  }, [running, onDone]);

  if (runIds.length === 0) return null;

  return (
    <div style={s.wrap}>
      <LiveLogStream
        log={eventsToLog(events)}
        running={running}
        height={LOG_HEIGHT}
        elapsedLabel={running ? t("runStatus.elapsed", { count: runIds.length }) : undefined}
      />
    </div>
  );
}
