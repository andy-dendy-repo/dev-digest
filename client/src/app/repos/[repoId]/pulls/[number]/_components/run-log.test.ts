import { describe, it, expect } from "vitest";
import { eventsToLog, traceLog } from "./run-log";

describe("run-log", () => {
  it("maps live run events to log lines", () => {
    expect(
      eventsToLog([{ runId: "r1", seq: 1, t: "00.31", kind: "tool", msg: "read_file" } as never]),
    ).toEqual([{ t: "00.31", k: "tool", m: "read_file" }]);
  });

  it("maps a persisted trace log, and nothing before it loads", () => {
    expect(traceLog({ log: [{ t: "01.00", kind: "error", msg: "boom" }] })).toEqual([
      { t: "01.00", k: "error", m: "boom" },
    ]);
    expect(traceLog(undefined)).toEqual([]);
  });
});
