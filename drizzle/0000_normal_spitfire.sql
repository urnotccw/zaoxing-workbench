CREATE TABLE `request_counters` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `image_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`digest` text NOT NULL,
	`status` text NOT NULL,
	`created` integer NOT NULL,
	`result` text NOT NULL
);
