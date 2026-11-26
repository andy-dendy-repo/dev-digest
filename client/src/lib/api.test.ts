import { describe, it, expect, vi, afterEach } from "vitest";
import { api, ApiError, API_BASE } from "./api";

function respond(status: number, body?: unknown, statusText = "") {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, statusText });
}

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("GETs JSON from the API base without a content-type", async () => {
    const fetch = vi.fn(async () => respond(200, [{ id: "r1" }]));
    vi.stubGlobal("fetch", fetch);

    await expect(api.get("/repos")).resolves.toEqual([{ id: "r1" }]);
    expect(fetch).toHaveBeenCalledWith(`${API_BASE}/repos`, { headers: {} });
  });

  it("declares a JSON body only when one is sent", async () => {
    const fetch = vi.fn(async () => respond(200, { ok: true }));
    vi.stubGlobal("fetch", fetch);

    await api.post("/repos", { url: "x" });
    await api.post("/repos/1/refresh");

    expect(fetch.mock.calls[0]).toEqual([
      `${API_BASE}/repos`,
      { method: "POST", body: '{"url":"x"}', headers: { "content-type": "application/json" } },
    ]);
    expect(fetch.mock.calls[1]).toEqual([`${API_BASE}/repos/1/refresh`, { method: "POST", body: undefined, headers: {} }]);
  });

  it("returns undefined for 204", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respond(204)));
    await expect(api.del("/agents/1")).resolves.toBeUndefined();
  });

  it("turns the error envelope into an ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond(404, { error: { code: "not_found", message: "No such repo", details: { id: 1 } } })),
    );
    const err = await api.get("/repos/1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, code: "not_found", message: "No such repo", details: { id: 1 } });
  });

  it("falls back to the status line for a non-JSON error body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("oops", { status: 502, statusText: "Bad Gateway" })));
    await expect(api.get("/x")).rejects.toMatchObject({ status: 502, message: "502 Bad Gateway" });
  });

  it("reports an unreachable engine as a network error (status 0)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(api.get("/x")).rejects.toMatchObject({ status: 0, code: "network_error" });
  });
});
