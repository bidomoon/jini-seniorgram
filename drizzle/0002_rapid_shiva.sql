CREATE TABLE `generation_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`request_id` text NOT NULL,
	`kind` text NOT NULL,
	`prompt` text NOT NULL,
	`state` text NOT NULL,
	`provider_id` text,
	`object` text,
	`message` text,
	`created` integer NOT NULL,
	`checked` integer DEFAULT 0 NOT NULL,
	`parent_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `generation_jobs_request_idx` ON `generation_jobs` (`user`,`request_id`);--> statement-breakpoint
CREATE INDEX `generation_jobs_owner_idx` ON `generation_jobs` (`user`,`created`);