import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { CookiesProvider } from "react-cookie";
import { auth } from "../lib/auth";
import { getRouter } from "../lib/router";
import { queryClient } from "../lib/utils/query-client";
import { ThemeProvider } from "./theme.provider";

const router = getRouter();

// Register things for typesafety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function ApplicationProviders() {
  return (
    <CookiesProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} context={{ auth }} />
        </QueryClientProvider>
      </ThemeProvider>
    </CookiesProvider>
  );
}
