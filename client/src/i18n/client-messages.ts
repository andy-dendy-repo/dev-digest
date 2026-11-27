import type { AbstractIntlMessages } from "next-intl";

/**
 * Namespaces that client components read with `useTranslations`. Only these are
 * serialized into the page for `NextIntlClientProvider`; the other
 * `messages/en/*.json` files (kept for later milestones) stay on the server.
 * `client-messages.test.ts` fails when code uses a namespace missing here.
 */
export const CLIENT_NAMESPACES = ["agents", "common", "onboarding", "prReview", "runs", "settings", "shell"] as const;

/** The subset of `messages` the client needs. */
export function pickClientMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  return Object.fromEntries(
    CLIENT_NAMESPACES.filter((ns) => ns in messages).map((ns) => [ns, messages[ns]!]),
  );
}
