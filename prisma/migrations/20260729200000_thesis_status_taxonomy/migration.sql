-- Replaces ThesisStatus's ad hoc ACTIVE/NEEDS_REVIEW/CLOSED taxonomy with
-- instructions.md §8's named statuses (unreviewed/on track/watch/weakened/
-- broken/exited). Zero real Thesis rows exist yet (verified directly
-- before writing this migration), so this is a clean type swap, not a
-- data migration — no USING-clause value mapping needed.

ALTER TYPE "ThesisStatus" RENAME TO "ThesisStatus_old";
CREATE TYPE "ThesisStatus" AS ENUM ('UNREVIEWED', 'ON_TRACK', 'WATCH', 'WEAKENED', 'BROKEN', 'EXITED');

ALTER TABLE "Thesis" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Thesis" ALTER COLUMN "status" TYPE "ThesisStatus" USING 'UNREVIEWED'::"ThesisStatus";
ALTER TABLE "Thesis" ALTER COLUMN "status" SET DEFAULT 'UNREVIEWED';

DROP TYPE "ThesisStatus_old";
