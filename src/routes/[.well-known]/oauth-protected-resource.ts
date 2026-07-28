import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/.well-known/oauth-protected-resource")({
  component: () => null,
});
