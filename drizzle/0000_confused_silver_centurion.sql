CREATE TABLE `admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL,
	`iterations` integer NOT NULL,
	`created_at` integer NOT NULL,
	`last_login_at` integer,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_username_unique` ON `admin_users` (`username`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`ts` integer NOT NULL,
	`admin_user_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text
);
--> statement-breakpoint
CREATE INDEX `audit_log_ts_idx` ON `audit_log` (`ts`);--> statement-breakpoint
CREATE TABLE `daily_stats` (
	`day` text PRIMARY KEY NOT NULL,
	`views` integer NOT NULL,
	`uniques` integer NOT NULL,
	`by_country` text,
	`by_referrer` text,
	`by_device` text
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`ts` integer NOT NULL,
	`name` text NOT NULL,
	`visitor_hash` text NOT NULL,
	`meta` text
);
--> statement-breakpoint
CREATE INDEX `events_name_ts_idx` ON `events` (`name`,`ts`);--> statement-breakpoint
CREATE TABLE `music_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`source` text NOT NULL,
	`r2_key` text,
	`storage_path` text,
	`filename` text,
	`mime` text,
	`size_bytes` integer,
	`uploaded_at` integer NOT NULL,
	`uploaded_by` text
);
--> statement-breakpoint
CREATE TABLE `page_views` (
	`id` text PRIMARY KEY NOT NULL,
	`ts` integer NOT NULL,
	`path` text NOT NULL,
	`country` text,
	`region` text,
	`city` text,
	`referrer_host` text,
	`device_type` text,
	`os` text,
	`browser` text,
	`visitor_hash` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `page_views_ts_idx` ON `page_views` (`ts`);--> statement-breakpoint
CREATE INDEX `page_views_visitor_hash_idx` ON `page_views` (`visitor_hash`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rsvps` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`attending` integer NOT NULL,
	`adults` integer NOT NULL,
	`children` integer DEFAULT 0 NOT NULL,
	`message` text,
	`created_at` integer NOT NULL,
	`visitor_hash` text NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `rsvps_created_at_idx` ON `rsvps` (`created_at`);--> statement-breakpoint
CREATE INDEX `rsvps_attending_idx` ON `rsvps` (`attending`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_user_id` text NOT NULL,
	`csrf_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`idle_expires_at` integer NOT NULL,
	`absolute_expires_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_admin_user_id_idx` ON `sessions` (`admin_user_id`);--> statement-breakpoint
CREATE TABLE `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text
);
--> statement-breakpoint
CREATE TABLE `wishes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`moderated_at` integer,
	`moderated_by` text,
	`visitor_hash` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wishes_status_created_at_idx` ON `wishes` (`status`,`created_at`);