// db/schema.ts
import { pgTable, serial, text, timestamp, unique, integer } from 'drizzle-orm/pg-core';

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
