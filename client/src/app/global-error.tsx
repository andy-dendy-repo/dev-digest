/* Last-resort boundary for errors in the root layout itself. It replaces the
   layout, so there is no NextIntlClientProvider: strings come straight from
   the message file. */
"use client";

import { ErrorState } from "@devdigest/ui";
import common from "../../messages/en/common.json";
import "./globals.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <ErrorState
          fullScreen
          title={common.errorBoundary.title}
          body={common.errorBoundary.body}
          onRetry={reset}
        />
      </body>
    </html>
  );
}
