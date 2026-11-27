/* Shared test render: next-intl (every `messages/en` namespace) + a fresh
   QueryClient + ToastProvider, and a `userEvent` instance. Use it instead of
   building a NextIntlClientProvider wrapper per test file. */
import React from "react";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { ToastProvider } from "@/lib/toast";

function loadMessages(): AbstractIntlMessages {
  const dir = join(__dirname, "..", "..", "messages", "en");
  const out: Record<string, AbstractIntlMessages> = {};
  for (const file of readdirSync(dir)) {
    if (file.endsWith(".json")) {
      out[file.replace(/\.json$/, "")] = JSON.parse(readFileSync(join(dir, file), "utf8"));
    }
  }
  return out;
}

/** All `messages/en/*.json` namespaces, keyed by namespace (as in production). */
export const messages = loadMessages();

/** A QueryClient that never retries, so failed queries settle immediately. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
}

interface ProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  queryClient?: QueryClient;
}

export function renderWithProviders(ui: React.ReactElement, options: ProvidersOptions = {}) {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options;
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
  const user = userEvent.setup();
  return { user, queryClient, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
