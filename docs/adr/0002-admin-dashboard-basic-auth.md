# Admin dashboard uses its own Basic-auth credentials, not Tailscale identity

The `/cloud/admin` dashboard is gated by a single HTTP Basic credential pair (`ADMIN_USERNAME` / `ADMIN_PASSWORD`, checked in `hooks.server.ts`), deliberately independent of Tailscale Identity and the `isAdmin()` allowlist. This is a narrow exception to [0001](0001-tailscale-identity-over-better-auth.md): there is still no user table, session store or login UI, and it does not feed `locals.tailscaleIdentity`.

We chose this so that a spoofable or misattributed Tailscale header (see 0001's consequence) cannot by itself reach the tool that provisions folders and grants access, and so dashboard access is not coupled to which logins are on the allowlist.

The gate matches on `event.route.id`, not the raw URL path, so percent-encoded paths (`/cloud/%61dmin`) cannot skip it. If the env vars are unset the dashboard is locked entirely.
