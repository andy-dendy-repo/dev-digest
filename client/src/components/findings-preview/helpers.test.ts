import { describe, it, expect } from "vitest";
import { PANEL_MAX_HEIGHT, PANEL_WIDTH, panelPosition } from "./helpers";

const viewport = { width: 1400, height: 900 };

describe("panelPosition", () => {
  it("opens below the trigger, clamped inside the viewport's right edge", () => {
    const pos = panelPosition({ top: 100, bottom: 120, left: 1300 }, viewport);
    expect(pos).toMatchObject({ top: 126, width: PANEL_WIDTH, maxHeight: PANEL_MAX_HEIGHT });
    expect(pos.left + pos.width).toBeLessThanOrEqual(viewport.width - 8);
  });

  it("opens upward near the bottom of the viewport", () => {
    const pos = panelPosition({ top: 820, bottom: 840, left: 100 }, viewport);
    expect(pos.top).toBeUndefined();
    expect(pos.bottom).toBe(viewport.height - 820 + 6);
    expect(pos.maxHeight).toBe(PANEL_MAX_HEIGHT);
  });

  it("shrinks to a narrow viewport", () => {
    expect(panelPosition({ top: 10, bottom: 30, left: 50 }, { width: 300, height: 900 })).toMatchObject({
      left: 8,
      width: 284,
    });
  });
});
