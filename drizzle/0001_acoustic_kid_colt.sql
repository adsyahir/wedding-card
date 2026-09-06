CREATE TABLE `gallery_images` (
	`id` text PRIMARY KEY NOT NULL,
	`r2_key` text NOT NULL,
	`filename` text,
	`mime` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`alt` text NOT NULL,
	`sort_order` integer NOT NULL,
	`uploaded_at` integer NOT NULL,
	`uploaded_by` text
);
--> statement-breakpoint
CREATE INDEX `gallery_images_sort_order_idx` ON `gallery_images` (`sort_order`);