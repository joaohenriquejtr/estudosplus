import { createFileRoute } from "@tanstack/react-router";

// The Lovable MCP server targets Cloudflare Workers. It is disabled for Vercel.
export const Route = createFileRoute("/.mcp/invoke-tool/$tool")({
  component: () => null,
});
