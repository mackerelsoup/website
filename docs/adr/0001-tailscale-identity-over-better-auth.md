# Trust Tailscale identity headers instead of better-auth

This app is only reachable via `tailscale serve`, which injects `Tailscale-User-Login`/`Tailscale-User-Name` headers identifying the caller. We use those headers as the sole notion of identity (see `Tailscale Identity` in `CONTEXT.md`) and dropped `better-auth` rather than keeping it as a second, parallel credential system.

`better-auth` (Postgres-backed sessions, email/password + GitHub OAuth) was fully wired up at one point but is unused in the live request path — no `/login` route exists, and `hooks.server.ts` never calls it. We chose not to keep it for defense-in-depth: since the trust boundary is already "only reachable over the tailnet," a second login layer adds real complexity (user table, session handling, password/OAuth flows) without adding meaningful security, and risks drifting out of sync with the header-based identity everything else in the app relies on.

Consequence: if this app is ever exposed by any path other than `tailscale serve` (e.g. bound to a public interface, or reverse-proxied by something that doesn't strip/verify these headers), the headers become spoofable and the entire auth model breaks. Any change to how the app is deployed or exposed must preserve that headers can only originate from `tailscale serve`.
