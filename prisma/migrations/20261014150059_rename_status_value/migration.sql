/*
  Warnings:

  - The values [LOW,MEDIUM,HIGH] on the enum `TaskPriority` will be removed. If these variants are still used in the database, this will fail.
  - The values [TODO,IN_PROGRESS,REVIEW,DONE] on the enum `TaskStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TaskPriority_new" AS ENUM ('low', 'medium', 'high');
ALTER TABLE "public"."Task" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "priority" TYPE "TaskPriority_new" USING ("priority"::text::"TaskPriority_new");
ALTER TYPE "TaskPriority" RENAME TO "TaskPriority_old";
ALTER TYPE "TaskPriority_new" RENAME TO "TaskPriority";
DROP TYPE "public"."TaskPriority_old";
ALTER TABLE "Task" ALTER COLUMN "priority" SET DEFAULT 'medium';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TaskStatus_new" AS ENUM ('todo', 'in_progress', 'review', 'done');
ALTER TABLE "public"."Task" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "status" TYPE "TaskStatus_new" USING ("status"::text::"TaskStatus_new");
ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";
ALTER TYPE "TaskStatus_new" RENAME TO "TaskStatus";
DROP TYPE "public"."TaskStatus_old";
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'todo';
COMMIT;

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "priority" SET DEFAULT 'medium',
ALTER COLUMN "status" SET DEFAULT 'todo';
