import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, waitFor } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import settings from "../../../../../../../../messages/en/settings.json";
import { SettingsApiKeys } from "./SettingsApiKeys";

/** S11 (security hardening) — a verified key leaves the input; a failed one stays for fixing. */

const mutateAsync = vi.fn();
vi.mock("@/lib/hooks/settings", () => ({
  useTestConnection: () => ({ mutateAsync, isPending: false }),
  useSecretsStatus: () => ({ data: { openai: true, anthropic: false, openrouter: false, github: false } }),
}));

function renderView() {
  return renderWithProviders(<SettingsApiKeys />);
}

afterEach(() => {
  cleanup();
  mutateAsync.mockReset();
});

async function typeAndTest(user: UserEvent, value: string) {
  const input = screen.getAllByPlaceholderText(settings.apiKeys.placeholder)[0] as HTMLInputElement;
  await user.type(input, value);
  await user.click(screen.getAllByRole("button", { name: settings.apiKeys.testConnection })[0]!);
  return input;
}

describe("SettingsApiKeys", () => {
  it("clears the input after the key is verified and saved", async () => {
    mutateAsync.mockResolvedValue({ provider: "openai", ok: true, message: "OK — 3 models available" });
    const { user } = renderView();
    const input = await typeAndTest(user, "sk-new");
    await screen.findByText("OK — 3 models available");
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ key: "sk-new" }));
    await waitFor(() => expect(input.value).toBe(""));
  });

  it("keeps the input when the check fails, so the typo can be fixed", async () => {
    mutateAsync.mockResolvedValue({ provider: "openai", ok: false, message: "401 — key not saved" });
    const { user } = renderView();
    const input = await typeAndTest(user, "sk-typo");
    await screen.findByText("401 — key not saved");
    expect(input.value).toBe("sk-typo");
  });
});
