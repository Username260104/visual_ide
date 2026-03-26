ALTER TABLE "nodes"
ADD COLUMN "user_intent" TEXT,
ADD COLUMN "resolved_prompt" TEXT,
ADD COLUMN "prompt_source" TEXT;

UPDATE "nodes"
SET
  "resolved_prompt" = "prompt",
  "prompt_source" = CASE
    WHEN "prompt" IS NOT NULL THEN 'legacy'
    ELSE NULL
  END
WHERE "resolved_prompt" IS NULL;
