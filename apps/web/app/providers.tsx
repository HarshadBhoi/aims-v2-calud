"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { type ReactNode, useState } from "react";
import superjson from "superjson";

import { getApiUrl } from "@/src/lib/api-url";
import { trpc } from "@/src/lib/trpc";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: getApiUrl(),
          transformer: superjson,
          // `credentials: "include"` sends our auth cookies to the API.
          // We filter out undefined signal to satisfy exactOptionalPropertyTypes
          // (DOM's RequestInit.signal is `AbortSignal | null`, not `| undefined`).
          fetch: (url, options) => {
            const { signal, ...rest } = options ?? {};
            return fetch(url, {
              ...rest,
              credentials: "include",
              ...(signal ? { signal } : {}),
            });
          },
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
