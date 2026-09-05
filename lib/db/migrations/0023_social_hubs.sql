CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION current_chat_user_id()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF((current_setting('request.jwt.claims', true)::jsonb ->> 'chat_user_id'), '')::integer;
$$;

CREATE TABLE IF NOT EXISTS "social_hubs" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "icon" text,
  "cover_image" text,
  "category" text,
  "parent_hub_id" integer,
  "created_by" integer NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "privacy" text DEFAULT 'public' NOT NULL,
  "member_count" integer DEFAULT 0 NOT NULL,
  "post_count" integer DEFAULT 0 NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  CONSTRAINT "social_hubs_slug_unique" UNIQUE("slug"),
  CONSTRAINT "social_hubs_status_check" CHECK ("status" IN ('active', 'pending', 'suspended', 'archived')),
  CONSTRAINT "social_hubs_privacy_check" CHECK ("privacy" IN ('public', 'private'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "social_hubs_name_unique_idx"
  ON "social_hubs" (lower("name"));
CREATE INDEX IF NOT EXISTS "social_hubs_name_idx"
  ON "social_hubs" ("name");
CREATE INDEX IF NOT EXISTS "social_hubs_parent_idx"
  ON "social_hubs" ("parent_hub_id");
CREATE INDEX IF NOT EXISTS "social_hubs_category_idx"
  ON "social_hubs" ("category");
CREATE INDEX IF NOT EXISTS "social_hubs_status_privacy_idx"
  ON "social_hubs" ("status", "privacy");
CREATE INDEX IF NOT EXISTS "social_hubs_search_trgm_idx"
  ON "social_hubs" USING gin ((coalesce("name", '') || ' ' || coalesce("description", '') || ' ' || coalesce("slug", '') || ' ' || coalesce("category", '')) gin_trgm_ops);

ALTER TABLE "social_hubs"
  ADD CONSTRAINT "social_hubs_parent_fk"
  FOREIGN KEY ("parent_hub_id") REFERENCES "social_hubs"("id") ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "social_hub_aliases" (
  "id" serial PRIMARY KEY NOT NULL,
  "hub_id" integer NOT NULL,
  "alias" text NOT NULL,
  "created_at" bigint NOT NULL,
  CONSTRAINT "social_hub_aliases_unique" UNIQUE("hub_id", "alias")
);

ALTER TABLE "social_hub_aliases"
  ADD CONSTRAINT "social_hub_aliases_hub_fk"
  FOREIGN KEY ("hub_id") REFERENCES "social_hubs"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "social_hub_aliases_hub_idx"
  ON "social_hub_aliases" ("hub_id");
CREATE INDEX IF NOT EXISTS "social_hub_aliases_alias_idx"
  ON "social_hub_aliases" USING gin ("alias" gin_trgm_ops);

CREATE TABLE IF NOT EXISTS "social_hub_members" (
  "id" serial PRIMARY KEY NOT NULL,
  "hub_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "role" text DEFAULT 'member' NOT NULL,
  "joined_at" bigint NOT NULL,
  CONSTRAINT "social_hub_members_role_check" CHECK ("role" IN ('member', 'moderator', 'owner')),
  CONSTRAINT "social_hub_members_unique" UNIQUE("hub_id", "user_id")
);

ALTER TABLE "social_hub_members"
  ADD CONSTRAINT "social_hub_members_hub_fk"
  FOREIGN KEY ("hub_id") REFERENCES "social_hubs"("id") ON DELETE CASCADE;
ALTER TABLE "social_hub_members"
  ADD CONSTRAINT "social_hub_members_user_fk"
  FOREIGN KEY ("user_id") REFERENCES "chat_users"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "social_hub_members_hub_idx"
  ON "social_hub_members" ("hub_id");
CREATE INDEX IF NOT EXISTS "social_hub_members_user_idx"
  ON "social_hub_members" ("user_id");

CREATE TABLE IF NOT EXISTS "social_hub_posts" (
  "id" serial PRIMARY KEY NOT NULL,
  "hub_id" integer NOT NULL,
  "post_id" integer NOT NULL,
  "created_at" bigint NOT NULL,
  CONSTRAINT "social_hub_posts_unique" UNIQUE("hub_id", "post_id")
);

ALTER TABLE "social_hub_posts"
  ADD CONSTRAINT "social_hub_posts_hub_fk"
  FOREIGN KEY ("hub_id") REFERENCES "social_hubs"("id") ON DELETE CASCADE;
ALTER TABLE "social_hub_posts"
  ADD CONSTRAINT "social_hub_posts_post_fk"
  FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "social_hub_posts_hub_idx"
  ON "social_hub_posts" ("hub_id", "created_at");
CREATE INDEX IF NOT EXISTS "social_hub_posts_post_idx"
  ON "social_hub_posts" ("post_id");

CREATE OR REPLACE FUNCTION social_hubs_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := (extract(epoch from now()) * 1000)::bigint;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS social_hubs_touch_updated_at_trigger ON social_hubs;
CREATE TRIGGER social_hubs_touch_updated_at_trigger
BEFORE UPDATE ON social_hubs
FOR EACH ROW
EXECUTE FUNCTION social_hubs_touch_updated_at();

CREATE OR REPLACE FUNCTION social_hubs_refresh_counts(p_hub_id integer)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE social_hubs
  SET
    member_count = (SELECT count(*)::integer FROM social_hub_members WHERE hub_id = p_hub_id),
    post_count = (SELECT count(*)::integer FROM social_hub_posts WHERE hub_id = p_hub_id),
    updated_at = (extract(epoch from now()) * 1000)::bigint
  WHERE id = p_hub_id;
END;
$$;

CREATE OR REPLACE FUNCTION social_hub_members_refresh_counts_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM social_hubs_refresh_counts(COALESCE(NEW.hub_id, OLD.hub_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS social_hub_members_refresh_counts_after_change ON social_hub_members;
CREATE TRIGGER social_hub_members_refresh_counts_after_change
AFTER INSERT OR DELETE OR UPDATE OF hub_id ON social_hub_members
FOR EACH ROW
EXECUTE FUNCTION social_hub_members_refresh_counts_trigger();

CREATE OR REPLACE FUNCTION social_hub_posts_refresh_counts_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM social_hubs_refresh_counts(COALESCE(NEW.hub_id, OLD.hub_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS social_hub_posts_refresh_counts_after_change ON social_hub_posts;
CREATE TRIGGER social_hub_posts_refresh_counts_after_change
AFTER INSERT OR DELETE OR UPDATE OF hub_id ON social_hub_posts
FOR EACH ROW
EXECUTE FUNCTION social_hub_posts_refresh_counts_trigger();

ALTER TABLE social_hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_hub_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_hub_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_hub_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_hubs_select_policy ON social_hubs;
CREATE POLICY social_hubs_select_policy ON social_hubs
FOR SELECT
USING (
  (status = 'active' AND privacy = 'public')
  OR created_by = current_chat_user_id()
  OR EXISTS (
    SELECT 1
    FROM social_hub_members m
    WHERE m.hub_id = social_hubs.id
      AND m.user_id = current_chat_user_id()
  )
);

DROP POLICY IF EXISTS social_hubs_insert_policy ON social_hubs;
CREATE POLICY social_hubs_insert_policy ON social_hubs
FOR INSERT
WITH CHECK (
  current_chat_user_id() IS NOT NULL
  AND created_by = current_chat_user_id()
);

DROP POLICY IF EXISTS social_hubs_update_policy ON social_hubs;
CREATE POLICY social_hubs_update_policy ON social_hubs
FOR UPDATE
USING (
  created_by = current_chat_user_id()
  OR EXISTS (
    SELECT 1
    FROM social_hub_members m
    WHERE m.hub_id = social_hubs.id
      AND m.user_id = current_chat_user_id()
      AND m.role IN ('owner', 'moderator')
  )
)
WITH CHECK (
  created_by = social_hubs.created_by
);

DROP POLICY IF EXISTS social_hub_aliases_select_policy ON social_hub_aliases;
CREATE POLICY social_hub_aliases_select_policy ON social_hub_aliases
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM social_hubs h
    WHERE h.id = social_hub_aliases.hub_id
      AND ((h.status = 'active' AND h.privacy = 'public')
        OR h.created_by = current_chat_user_id()
        OR EXISTS (
          SELECT 1 FROM social_hub_members m
          WHERE m.hub_id = h.id AND m.user_id = current_chat_user_id()
        ))
  )
);

DROP POLICY IF EXISTS social_hub_aliases_write_policy ON social_hub_aliases;
CREATE POLICY social_hub_aliases_write_policy ON social_hub_aliases
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM social_hub_members m
    WHERE m.hub_id = social_hub_aliases.hub_id
      AND m.user_id = current_chat_user_id()
      AND m.role IN ('owner', 'moderator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM social_hub_members m
    WHERE m.hub_id = social_hub_aliases.hub_id
      AND m.user_id = current_chat_user_id()
      AND m.role IN ('owner', 'moderator')
  )
);

DROP POLICY IF EXISTS social_hub_members_select_policy ON social_hub_members;
CREATE POLICY social_hub_members_select_policy ON social_hub_members
FOR SELECT
USING (
  user_id = current_chat_user_id()
  OR EXISTS (
    SELECT 1
    FROM social_hubs h
    WHERE h.id = social_hub_members.hub_id
      AND h.status = 'active'
      AND h.privacy = 'public'
  )
);

DROP POLICY IF EXISTS social_hub_members_insert_policy ON social_hub_members;
CREATE POLICY social_hub_members_insert_policy ON social_hub_members
FOR INSERT
WITH CHECK (
  user_id = current_chat_user_id()
  AND role = 'member'
  AND EXISTS (
    SELECT 1
    FROM social_hubs h
    WHERE h.id = social_hub_members.hub_id
      AND h.status = 'active'
      AND h.privacy = 'public'
  )
);

DROP POLICY IF EXISTS social_hub_members_delete_policy ON social_hub_members;
CREATE POLICY social_hub_members_delete_policy ON social_hub_members
FOR DELETE
USING (
  user_id = current_chat_user_id()
  OR EXISTS (
    SELECT 1
    FROM social_hub_members m
    WHERE m.hub_id = social_hub_members.hub_id
      AND m.user_id = current_chat_user_id()
      AND m.role IN ('owner', 'moderator')
  )
);

DROP POLICY IF EXISTS social_hub_posts_select_policy ON social_hub_posts;
CREATE POLICY social_hub_posts_select_policy ON social_hub_posts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM social_hubs h
    WHERE h.id = social_hub_posts.hub_id
      AND (
        (h.status = 'active' AND h.privacy = 'public')
        OR h.created_by = current_chat_user_id()
        OR EXISTS (
          SELECT 1 FROM social_hub_members m
          WHERE m.hub_id = h.id AND m.user_id = current_chat_user_id()
        )
      )
  )
);

DROP POLICY IF EXISTS social_hub_posts_insert_policy ON social_hub_posts;
CREATE POLICY social_hub_posts_insert_policy ON social_hub_posts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM social_posts p
    WHERE p.id = social_hub_posts.post_id
      AND p.author_id = current_chat_user_id()
  )
  OR EXISTS (
    SELECT 1
    FROM social_hub_members m
    WHERE m.hub_id = social_hub_posts.hub_id
      AND m.user_id = current_chat_user_id()
      AND m.role IN ('owner', 'moderator')
  )
);

DROP POLICY IF EXISTS social_hub_posts_delete_policy ON social_hub_posts;
CREATE POLICY social_hub_posts_delete_policy ON social_hub_posts
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM social_posts p
    WHERE p.id = social_hub_posts.post_id
      AND p.author_id = current_chat_user_id()
  )
  OR EXISTS (
    SELECT 1
    FROM social_hub_members m
    WHERE m.hub_id = social_hub_posts.hub_id
      AND m.user_id = current_chat_user_id()
      AND m.role IN ('owner', 'moderator')
  )
);

WITH categories(name, slug, description) AS (
  VALUES
    ('Healthcare', 'healthcare', 'Healthcare professionals, students, and communities.'),
    ('Trades', 'trades', 'Skilled trades, transportation, and field work communities.'),
    ('Business', 'business', 'Business, entrepreneurship, and finance communities.'),
    ('Education', 'education', 'Student and education-focused communities.'),
    ('Technology', 'technology', 'Technology and software communities.'),
    ('Creative', 'creative', 'Creative and media-focused communities.'),
    ('Fitness', 'fitness', 'Fitness and sports communities.'),
    ('Food', 'food', 'Cooking and food-related communities.'),
    ('Lifestyle', 'lifestyle', 'Lifestyle, travel, and everyday communities.')
)
INSERT INTO social_hubs (name, slug, description, category, parent_hub_id, created_by, status, privacy, member_count, post_count, created_at, updated_at)
SELECT
  c.name,
  c.slug,
  c.description,
  c.name,
  NULL,
  0,
  'active',
  'public',
  0,
  0,
  (extract(epoch from now()) * 1000)::bigint,
  (extract(epoch from now()) * 1000)::bigint
FROM categories c
ON CONFLICT (slug) DO NOTHING;

WITH hub_seed(category, name) AS (
  VALUES
    ('Healthcare', 'Nursing'), ('Healthcare', 'Student Nurses'), ('Healthcare', 'Doctors'), ('Healthcare', 'Medical Students'), ('Healthcare', 'CRNA'), ('Healthcare', 'SRNA'), ('Healthcare', 'Physicians Assistants'), ('Healthcare', 'Pharmacy'), ('Healthcare', 'Pharmacy Students'), ('Healthcare', 'Dentistry'), ('Healthcare', 'Dental Students'), ('Healthcare', 'Dental Hygienists'), ('Healthcare', 'CNA'), ('Healthcare', 'Medical Assistants'), ('Healthcare', 'EMT'), ('Healthcare', 'Paramedics'), ('Healthcare', 'Respiratory Therapy'), ('Healthcare', 'Radiology'), ('Healthcare', 'Sonography'), ('Healthcare', 'Physical Therapy'), ('Healthcare', 'Occupational Therapy'), ('Healthcare', 'Veterinary'), ('Healthcare', 'Public Health'), ('Healthcare', 'Healthcare Administration'),
    ('Trades', 'Truck Drivers'), ('Trades', 'OTR Truck Drivers'), ('Trades', 'Owner Operators'), ('Trades', 'Electricians'), ('Trades', 'Plumbers'), ('Trades', 'HVAC'), ('Trades', 'Welding'), ('Trades', 'Construction'), ('Trades', 'Carpentry'), ('Trades', 'Mechanics'), ('Trades', 'Heavy Equipment'), ('Trades', 'Auto Technicians'),
    ('Business', 'Entrepreneurs'), ('Business', 'Startups'), ('Business', 'Small Business'), ('Business', 'Real Estate'), ('Business', 'Investing'), ('Business', 'E-Commerce'), ('Business', 'Amazon Sellers'), ('Business', 'Marketing'), ('Business', 'Sales'), ('Business', 'Freelancing'), ('Business', 'Creators'), ('Business', 'Personal Finance'),
    ('Education', 'College Students'), ('Education', 'High School Students'), ('Education', 'Graduate Students'), ('Education', 'Law Students'), ('Education', 'Engineering Students'), ('Education', 'Computer Science'), ('Education', 'Nursing School'), ('Education', 'Medical School'), ('Education', 'Study Groups'), ('Education', 'Test Prep'), ('Education', 'Language Learning'),
    ('Technology', 'Programming'), ('Technology', 'Software Engineering'), ('Technology', 'Web Development'), ('Technology', 'Mobile Development'), ('Technology', 'React Native'), ('Technology', 'AI'), ('Technology', 'Cybersecurity'), ('Technology', 'Cloud Computing'), ('Technology', 'Game Development'),
    ('Creative', 'Photography'), ('Creative', 'Videography'), ('Creative', 'Filmmaking'), ('Creative', 'Graphic Design'), ('Creative', 'Music'), ('Creative', 'Producers'), ('Creative', 'DJs'), ('Creative', 'Artists'), ('Creative', 'Writers'), ('Creative', 'Fashion'), ('Creative', 'Acting'),
    ('Fitness', 'Running'), ('Fitness', 'Marathon'), ('Fitness', 'Cycling'), ('Fitness', 'Weightlifting'), ('Fitness', 'Bodybuilding'), ('Fitness', 'Yoga'), ('Fitness', 'Basketball'), ('Fitness', 'Football'), ('Fitness', 'Soccer'), ('Fitness', 'Tennis'), ('Fitness', 'Swimming'),
    ('Food', 'Cooking'), ('Food', 'Baking'), ('Food', 'Restaurants'), ('Food', 'Foodies'), ('Food', 'Meal Prep'), ('Food', 'Coffee'),
    ('Lifestyle', 'Travel'), ('Lifestyle', 'Cars'), ('Lifestyle', 'Parenting'), ('Lifestyle', 'Pets'), ('Lifestyle', 'Gaming'), ('Lifestyle', 'Books'), ('Lifestyle', 'Movies'), ('Lifestyle', 'Beauty')
),
normalized AS (
  SELECT
    s.category,
    s.name,
    lower(regexp_replace(trim(s.name), '[^a-z0-9]+', '-', 'gi')) AS slug,
    c.id AS parent_hub_id
  FROM hub_seed s
  INNER JOIN social_hubs c ON c.name = s.category
)
INSERT INTO social_hubs (name, slug, description, category, parent_hub_id, created_by, status, privacy, member_count, post_count, created_at, updated_at)
SELECT
  n.name,
  n.slug,
  '',
  n.category,
  n.parent_hub_id,
  0,
  'active',
  'public',
  0,
  0,
  (extract(epoch from now()) * 1000)::bigint,
  (extract(epoch from now()) * 1000)::bigint
FROM normalized n
ON CONFLICT (slug) DO NOTHING;

INSERT INTO social_hub_aliases (hub_id, alias, created_at)
SELECT id, alias, (extract(epoch from now()) * 1000)::bigint
FROM (
  SELECT id, lower(name) AS alias FROM social_hubs
  UNION
  SELECT id, replace(lower(name), ' ', '') AS alias FROM social_hubs
  UNION
  SELECT id, replace(lower(name), 'nurses', 'nurse') AS alias FROM social_hubs WHERE lower(name) LIKE '%nurses%'
  UNION
  SELECT id, replace(lower(name), 'students', 'student') AS alias FROM social_hubs WHERE lower(name) LIKE '%students%'
) aliases
ON CONFLICT (hub_id, alias) DO NOTHING;
