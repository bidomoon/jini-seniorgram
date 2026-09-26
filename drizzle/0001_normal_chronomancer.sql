CREATE TABLE `generation_requests` (
	`user` text NOT NULL,
	`id` text NOT NULL,
	`state` text NOT NULL,
	`created` integer NOT NULL,
	PRIMARY KEY(`user`, `id`)
);
--> statement-breakpoint
CREATE INDEX `posts_feed_idx` ON `posts` (`hidden`,`created`);--> statement-breakpoint
CREATE INDEX `posts_owner_idx` ON `posts` (`owner`);