INSERT INTO "ProjectMember" ("project_id", "user_id", "role")
SELECT "id", "owner_id", 'owner' FROM "Project"
ON CONFLICT DO NOTHING;

UPDATE "Task" t
SET "assignee_id" = p."owner_id"
FROM "Project" p
WHERE p."id" = t."project_id"
  AND (
    t."assignee_id" IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM "ProjectMember" m
      WHERE m."project_id" = t."project_id" AND m."user_id" = t."assignee_id"
    )
  );

ALTER TABLE "User"
  ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
  ALTER COLUMN "email" SET DATA TYPE VARCHAR(254);

ALTER TABLE "Project"
  ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
  ALTER COLUMN "description" SET DATA TYPE VARCHAR(1000);

ALTER TABLE "Task"
  ALTER COLUMN "title" SET DATA TYPE VARCHAR(200),
  ALTER COLUMN "description" SET DATA TYPE VARCHAR(5000),
  ALTER COLUMN "assignee_id" SET NOT NULL;

ALTER TABLE "Task" DROP CONSTRAINT "Task_assignee_id_fkey";

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_project_id_assignee_id_fkey"
  FOREIGN KEY ("project_id", "assignee_id")
  REFERENCES "ProjectMember" ("project_id", "user_id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE INDEX "Task_project_id_assignee_id_idx" ON "Task" ("project_id", "assignee_id");

ALTER TABLE "User" ADD CONSTRAINT "User_name_not_blank" CHECK (char_length(btrim("name")) >= 2);
ALTER TABLE "Project" ADD CONSTRAINT "Project_name_not_blank" CHECK (char_length(btrim("name")) >= 2);
ALTER TABLE "Task" ADD CONSTRAINT "Task_title_not_blank" CHECK (char_length(btrim("title")) >= 2);
