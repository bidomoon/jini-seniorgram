import { sqliteTable,text,integer,primaryKey,index,uniqueIndex } from 'drizzle-orm/sqlite-core';
export const quota=sqliteTable('quota',{user:text('user').notNull(),month:text('month').notNull(),used:integer('used').notNull().default(0)},t=>[primaryKey({columns:[t.user,t.month]})]);
export const posts=sqliteTable('posts',{id:text('id').primaryKey(),owner:text('owner').notNull(),title:text('title').notNull(),object:text('object').notNull(),created:integer('created').notNull(),hidden:integer('hidden').notNull().default(0)},t=>[index('posts_feed_idx').on(t.hidden,t.created),index('posts_owner_idx').on(t.owner)]);
export const likes=sqliteTable('likes',{post:text('post').notNull(),user:text('user').notNull()},t=>[primaryKey({columns:[t.post,t.user]})]);
export const reports=sqliteTable('reports',{post:text('post').notNull(),user:text('user').notNull(),reason:text('reason').notNull()},t=>[primaryKey({columns:[t.post,t.user]})]);
export const blocks=sqliteTable('blocks',{user:text('user').notNull(),blocked:text('blocked').notNull()},t=>[primaryKey({columns:[t.user,t.blocked]})]);

export const generationRequests=sqliteTable('generation_requests',{user:text('user').notNull(),id:text('id').notNull(),state:text('state').notNull(),created:integer('created').notNull()},t=>[primaryKey({columns:[t.user,t.id]})]);

export const generationJobs=sqliteTable('generation_jobs',{
 id:text('id').primaryKey(),user:text('user').notNull(),requestId:text('request_id').notNull(),kind:text('kind').notNull(),prompt:text('prompt').notNull(),state:text('state').notNull(),providerId:text('provider_id'),object:text('object'),message:text('message'),created:integer('created').notNull(),checked:integer('checked').notNull().default(0),parentId:text('parent_id')
},t=>[uniqueIndex('generation_jobs_request_idx').on(t.user,t.requestId),index('generation_jobs_owner_idx').on(t.user,t.created)]);
