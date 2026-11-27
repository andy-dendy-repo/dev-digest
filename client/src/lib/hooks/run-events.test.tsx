import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

vi.mock("@/lib/toast", () => ({ notify: { error: vi.fn() } }));
vi.mock("@/lib/api", () => ({ API_BASE: "http://api.test", api: {} }));

import { useRunEvents } from "./reviews";

/** Minimal EventSource stand-in: tests push messages and close streams by hand. */
class FakeEventSource {
  static all: FakeEventSource[] = [];
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeEventSource.all.push(this);
  }
  addEventListener() {}
  close() {
    this.closed = true;
  }
  emit(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
  end() {
    this.onerror?.();
  }
}

beforeEach(() => {
  FakeEventSource.all = [];
  vi.stubGlobal("EventSource", FakeEventSource);
});
afterEach(() => vi.unstubAllGlobals());

describe("useRunEvents", () => {
  it("collects events and settles once, after every stream has closed", () => {
    const onSettled = vi.fn();
    const { result } = renderHook(() => useRunEvents(["r1", "r2"], { onSettled }));
    const [a, b] = FakeEventSource.all;
    expect(a!.url).toBe("http://api.test/runs/r1/events");

    act(() => a!.emit({ runId: "r1", seq: 1, kind: "info", msg: "start", t: "00.1" }));
    expect(result.current).toMatchObject({ running: true, events: [{ msg: "start" }] });

    act(() => a!.end());
    expect(onSettled).not.toHaveBeenCalled();

    act(() => b!.end());
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(result.current.running).toBe(false);
  });

  it("does not report a settle when the subscriber unmounts mid-run", () => {
    const onSettled = vi.fn();
    const { unmount } = renderHook(() => useRunEvents(["r1"], { onSettled }));
    unmount();
    expect(FakeEventSource.all[0]!.closed).toBe(true);
    expect(onSettled).not.toHaveBeenCalled();
  });
});
