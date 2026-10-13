import { NotFound } from "@dev-template/client/not-found";
import { createRootRoute } from "@tanstack/react-router";
import { RootLayout } from "#app/root-layout.tsx";
import { RootDocument } from "#app/root-document.tsx";

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
});
