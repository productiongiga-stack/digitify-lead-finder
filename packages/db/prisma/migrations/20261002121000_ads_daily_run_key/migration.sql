ALTER TABLE ai_optimization_runs ADD COLUMN "runKey" TEXT;
CREATE UNIQUE INDEX "ai_optimization_runs_runKey_key" ON ai_optimization_runs("runKey");
