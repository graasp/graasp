-- public."oban_job_state" definition

-- DROP TYPE public."oban_job_state";

CREATE TYPE public."oban_job_state" AS ENUM (
	'available',
	'scheduled',
	'executing',
	'retryable',
	'completed',
	'discarded',
	'cancelled');

-- public.oban_jobs definition

-- Drop table

-- DROP TABLE public.oban_jobs;

CREATE TABLE public.oban_jobs (
	id bigserial NOT NULL,
	state public."oban_job_state" DEFAULT 'available'::oban_job_state NOT NULL,
	queue text DEFAULT 'default'::text NOT NULL,
	worker text NOT NULL,
	args jsonb DEFAULT '{}'::jsonb NOT NULL,
	errors _jsonb DEFAULT ARRAY[]::jsonb[] NOT NULL,
	attempt int4 DEFAULT 0 NOT NULL,
	max_attempts int4 DEFAULT 20 NOT NULL,
	inserted_at timestamp DEFAULT timezone('UTC'::text, now()) NOT NULL,
	scheduled_at timestamp DEFAULT timezone('UTC'::text, now()) NOT NULL,
	attempted_at timestamp NULL,
	completed_at timestamp NULL,
	attempted_by _text NULL,
	discarded_at timestamp NULL,
	priority int4 DEFAULT 0 NOT NULL,
	tags _text DEFAULT ARRAY[]::text[] NULL,
	meta jsonb DEFAULT '{}'::jsonb NULL,
	cancelled_at timestamp NULL,
	CONSTRAINT attempt_range CHECK (((attempt >= 0) AND (attempt <= max_attempts))),
	CONSTRAINT non_negative_priority CHECK ((priority >= 0)) NOT VALID,
	CONSTRAINT oban_jobs_pkey PRIMARY KEY (id),
	CONSTRAINT positive_max_attempts CHECK ((max_attempts > 0)),
	CONSTRAINT queue_length CHECK (((char_length(queue) > 0) AND (char_length(queue) < 128))),
	CONSTRAINT worker_length CHECK (((char_length(worker) > 0) AND (char_length(worker) < 128)))
);
CREATE INDEX oban_jobs_args_index ON public.oban_jobs USING gin (args);
CREATE INDEX oban_jobs_meta_index ON public.oban_jobs USING gin (meta);
CREATE INDEX oban_jobs_state_cancelled_at_index ON public.oban_jobs USING btree (state, cancelled_at);
CREATE INDEX oban_jobs_state_discarded_at_index ON public.oban_jobs USING btree (state, discarded_at);
CREATE INDEX oban_jobs_state_queue_priority_scheduled_at_id_index ON public.oban_jobs USING btree (state, queue, priority, scheduled_at, id);

-- public.oban_peers definition

-- Drop table

-- DROP TABLE public.oban_peers;

CREATE UNLOGGED TABLE public.oban_peers (
	"name" text NOT NULL,
	node text NOT NULL,
	started_at timestamp NOT NULL,
	expires_at timestamp NOT NULL,
	CONSTRAINT oban_peers_pkey PRIMARY KEY (name)
);

-- add migration in migration table for phoenix
INSERT INTO "schema_migrations" ("version", "inserted_at") VALUES
('20251103104204', '2025-11-05 10:28:02'),
('20251103143048', '2025-11-05 10:29:02');
