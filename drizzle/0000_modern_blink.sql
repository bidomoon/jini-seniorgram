CREATE TABLE `blocks` (
	`user` text NOT NULL,
	`blocked` text NOT NULL,
	PRIMARY KEY(`user`, `blocked`)
);
--> statement-breakpoint
CREATE TABLE `likes` (
	`post` text NOT NULL,
	`user` text NOT NULL,
	PRIMARY KEY(`post`, `user`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`object` text NOT NULL,
	`created` integer NOT NULL,
	`hidden` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quota` (
	`user` text NOT NULL,
	`month` text NOT NULL,
	`used` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user`, `month`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`post` text NOT NULL,
	`user` text NOT NULL,
	`reason` text NOT NULL,
	PRIMARY KEY(`post`, `user`)
);
