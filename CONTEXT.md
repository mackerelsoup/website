# Website

A shared cloud drive backed by WebDAV, reachable only over the user's Tailscale network. Access is per-person and per-folder: the owner grants specific Tailscale identities view or edit rights to specific folders.

## Language

**Tailscale Identity**:
The `{ login, name }` pair extracted from the `Tailscale-User-Login` / `Tailscale-User-Name` request headers that `tailscale serve` injects. This is the sole notion of "who is making this request" — there is no separate account/credential system.
_Avoid_: User, account

**Admin**:
A Tailscale Identity whose `login` is in the hardcoded allowlist. Has edit access to every folder, bypassing grants entirely.
_Avoid_: Owner, superuser

**Folder**:
A path explicitly registered in the database as a grantable unit, distinct from a WebDAV directory — not every directory that exists in the drive is a Folder, only ones an admin has registered for permissioning.
_Avoid_: Directory (that's the raw WebDAV concept; Folder is the permission-boundary concept)

**Grant**:
A row giving one Tailscale Identity a specific access level on a specific Folder. Cascades to descendant folders (a grant on `/family` also covers `/family/photos`).
_Avoid_: Permission, share

**General Grant**:
A view-only Grant not tied to any specific Tailscale Identity — visible to any identified Tailscale user. Unlike a personal Grant, it applies only to the exact folder it's on and does not cascade to subfolders.
_Avoid_: Public grant, open folder

**Access Level**:
`view` or `edit`, ranked `edit` > `view`. When more than one Grant covers the same folder at the same specificity, the higher-ranked one wins; when Grants differ in specificity, the more specific folder path wins regardless of rank.

**Protected Root**:
`/` and `/cloud` — Folders that can never receive an edit Grant or be auto-provisioned onto directly. Both carry a General Grant so any Tailscale Identity can view the top-level listing, but editing or granting at this level is admin-only.
_Avoid_: Root folder

**Personal Folder**:
A Folder provisioned for exactly one Tailscale Identity, who holds `edit` on it. Created only after that identity's Folder Request is approved — never automatically on first visit.

**Folder Request**:
A pending ask from a Tailscale Identity for a Personal Folder under a name they chose, awaiting an Admin's approval or denial. Approval provisions the WebDAV directory, the Folder row, and the edit Grant together.
_Avoid_: Provisioning request 