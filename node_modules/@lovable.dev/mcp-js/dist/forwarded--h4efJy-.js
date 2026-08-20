//#region src/core/forwarded.ts
/**
* Rewrites a request's URL to the public origin a reverse proxy forwards via
* `X-Forwarded-*`, so SDK-derived OAuth `resource`/metadata/`WWW-Authenticate`
* URLs name the host the client actually connected to — not the internal
* backend origin the proxy rewrites `Host` to. Without this, an app on a custom
* domain advertises its internal `*.lovable.dev`/`*.supabase.co` host and every
* MCP call 401s on an audience the client can't satisfy.
*
* Each header is trusted independently, because a forwarded value is only as
* trustworthy as the proxy that sets it:
* - `X-Forwarded-Host` can redirect the advertised resource to an attacker
*   origin (the threat `auth/resource.ts` guards against), so it is honored only
*   when `trustForwardedHost` is set — enabled on emit paths that sit behind a
*   proxy which *overwrites* the header (Lovable's web-proxy does), never by a
*   bare SDK consumer.
* - `X-Forwarded-Proto` only selects http/https, so it is gated separately:
*   Supabase terminates TLS upstream and forwards over http with a
*   gateway-stamped proto, so that stack trusts it; the TanStack proxy does not
*   sanitize proto, so that stack leaves it alone.
*/
function applyForwardedOrigin(request, options) {
	const proto = options.trustForwardedProto ? firstForwardedValue(request, "x-forwarded-proto") : void 0;
	const host = options.trustForwardedHost ? firstForwardedValue(request, "x-forwarded-host") : void 0;
	if (proto === void 0 && host === void 0) return request;
	const url = new URL(request.url);
	let changed = false;
	if (proto !== void 0 && `${proto}:` !== url.protocol) {
		url.protocol = `${proto}:`;
		changed = true;
	}
	if (host !== void 0 && host !== url.host) {
		url.host = host;
		changed = true;
	}
	return changed ? new Request(url.href, request) : request;
}
function firstForwardedValue(request, header) {
	const value = request.headers.get(header)?.split(",")[0]?.trim();
	return value ? value : void 0;
}
//#endregion
export { applyForwardedOrigin as t };
