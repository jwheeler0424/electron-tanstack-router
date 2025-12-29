import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRouter,
  ErrorComponent,
  RouterProvider,
} from "@tanstack/react-router";
import { ThemeProvider } from "src/renderer/providers/theme.provider";

import { Spinner } from "../components/Spinner";
import { auth } from "../lib/auth";
import { routeTree } from "../routeTree.gen";

export const queryClient = new QueryClient();

const router = createRouter({
  routeTree,
  defaultPendingComponent: () => (
    <div className={`p-2 text-2xl`}>
      <Spinner />
    </div>
  ),
  defaultErrorComponent: ({ error }) => <ErrorComponent error={error} />,
  context: {
    auth: undefined!,
    queryClient,
  },
  defaultPreload: "intent",
  // Since we're using React Query, we don't want loader calls to ever be stale
  // This will ensure that the loader is always called when the route is preloaded or visited
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
});

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
