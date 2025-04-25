UPDATE item SET type = 'file', extra = CONCAT('{"file":', extra->>'s3File', '}')::jsonb  WHERE type = 's3File';--> statement-breakpoint

UPDATE app_data SET data = CONCAT('{"file":', data->>'s3File', '}')::jsonb WHERE type = 'file';--> statement-breakpoint

UPDATE app_setting SET data = CONCAT('{"file":', data->>'s3File', '}')::jsonb  WHERE data->>'s3File' IS NOT NULL;--> statement-breakpoint