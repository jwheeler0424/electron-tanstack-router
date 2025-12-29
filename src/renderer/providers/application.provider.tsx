import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { ThemeProvider } from "src/renderer/providers/theme.provider";

import { auth } from "../lib/auth";
import { getRouter } from "../lib/router";
import { queryClient } from "../lib/utils/query-client";

const router = getRouter();

// Register things for typesafety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function ApplicationProviders() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} context={{ auth }} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
