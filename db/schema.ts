import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const tasks = sqliteTable('image_tasks', {
 id:text('id').primaryKey(), owner:text('owner').notNull(), digest:text('digest').notNull(),
 status:text('status').notNull(), created:integer('created').notNull(), result:text('result').notNull(),
});
export const counters = sqliteTable('request_counters', { id:text('id').primaryKey(), count:integer('count').notNull() });
