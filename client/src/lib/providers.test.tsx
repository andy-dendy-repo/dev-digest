import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { messages } from "@/test/render";

const { error } = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("./toast", async (importOriginal) => {
  const real = await importOriginal<typeof import("./toast")>();
  return { ...real, notify: { ...real.notify, error } };
});

import { Providers } from "./providers";

afterEach(() => {
  cleanup();
  error.mockClear();
});

function Failing({ errorToast }: { errorToast?: boolean }) {
  const m = useMutation({
    mutationFn: async () => {
      throw new Error("boom");
    },
    meta: errorToast === undefined ? undefined : { errorToast },
  });
  return (
    <button onClick={() => m.mutateAsync().catch(() => undefined)}>go</button>
  );
}

describe("Providers — global mutation error toast", () => {
  it("toasts a failed mutation exactly once", async () => {
    const user = userEvent.setup();
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <Providers>
          <Failing />
        </Providers>
      </NextIntlClientProvider>,
    );
    await user.click(screen.getByRole("button", { name: "go" }));
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith("boom");
  });

  it("stays silent for a mutation whose caller shows the error inline", async () => {
    const user = userEvent.setup();
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <Providers>
          <Failing errorToast={false} />
        </Providers>
      </NextIntlClientProvider>,
    );
    await user.click(screen.getByRole("button", { name: "go" }));
    expect(error).not.toHaveBeenCalled();
  });
});
