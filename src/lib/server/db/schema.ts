// db/schema.ts
import { pgTable, serial, text, timestamp, unique, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

//Cloud feature
export const folder = pgTable('folder', {
  id: serial('id').primaryKey(),
  path: text('path').notNull().unique(),      // normalized, e.g. '/family'
  label: text('label'),                        // optional friendly name for the admin UI
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const folderPermission = pgTable('folder_permission', {
  id: serial('id').primaryKey(),
  folderId: integer('folder_id').notNull().references(() => folder.id, { onDelete: 'cascade' }),
  tailscaleLogin: text('tailscale_login'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  access: text('access').notNull()
}, (t) => [unique().on(t.folderId, t.tailscaleLogin)]);

// A Folder Request: a Tailscale Identity asking for a Personal Folder under a name they chose.
// Approval (issue #8) is what provisions the directory, Folder row and edit Grant — not this table.
export const folderRequest = pgTable('folder_request', {
  id: serial('id').primaryKey(),
  tailscaleLogin: text('tailscale_login').notNull(),
  requestedName: text('requested_name').notNull(),
  status: text('status').notNull().default('pending'), // pending | approved | denied
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (t) => [
  // Partial unique index: only *pending* rows collide, so a login denied once can ask again.
  // This is the real guard against two concurrent submits both landing a pending row.
  uniqueIndex('folder_request_one_pending_per_login')
    .on(t.tailscaleLogin)
    .where(sql`${t.status} = 'pending'`)
]);
