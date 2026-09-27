-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'rev_leader', 'manager', 'rep', 'read_only');

-- CreateEnum
CREATE TYPE "ConnectionMode" AS ENUM ('demo', 'live');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('not_configured', 'connected', 'error');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'retrying');

-- CreateEnum
CREATE TYPE "DealOutcome" AS ENUM ('open', 'won', 'lost');

-- CreateEnum
CREATE TYPE "DealSegment" AS ENUM ('enterprise', 'mid_market', 'smb');

-- CreateEnum
CREATE TYPE "ContactRole" AS ENUM ('champion', 'decision_maker', 'influencer', 'blocker', 'coach', 'end_user', 'unknown');

-- CreateEnum
CREATE TYPE "EvidenceSourceType" AS ENUM ('meeting', 'transcript', 'deal_activity', 'note', 'close_reason', 'stakeholder_data', 'salesperson_confirmation', 'other');

-- CreateEnum
CREATE TYPE "EvidenceStrength" AS ENUM ('weak', 'moderate', 'strong');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('high', 'medium', 'low', 'unknown');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('pending', 'processing', 'completed', 'needs_clarification', 'failed');

-- CreateEnum
CREATE TYPE "FactorCategory" AS ENUM ('product_capability_gap', 'integration_gap', 'pricing', 'packaging', 'competitor', 'security', 'compliance', 'privacy', 'legal', 'implementation', 'support', 'wrong_fit', 'missing_decision_maker', 'weak_champion', 'stakeholder_misalignment', 'poor_discovery', 'poor_demo', 'slow_followup', 'proposal_delay', 'communication', 'value_not_proven', 'roi_not_proven', 'timing', 'budget', 'priority_change', 'buyer_project_cancelled', 'procurement', 'internal_seller_delay', 'unknown', 'other');

-- CreateEnum
CREATE TYPE "FactorType" AS ENUM ('primary', 'secondary');

-- CreateEnum
CREATE TYPE "Preventability" AS ENUM ('preventable', 'potentially_preventable', 'not_preventable', 'unknown');

-- CreateEnum
CREATE TYPE "Department" AS ENUM ('sales', 'sales_engineering', 'product', 'engineering', 'pricing', 'finance', 'security', 'compliance', 'privacy', 'legal', 'operations', 'implementation', 'leadership');

-- CreateEnum
CREATE TYPE "PatternStrength" AS ENUM ('one_off', 'emerging_pattern', 'recurring_pattern', 'strong_pattern');

-- CreateEnum
CREATE TYPE "PatternStatus" AS ENUM ('active', 'resolved');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'rep',
    "hashed_password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph8_connections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "mode" "ConnectionMode" NOT NULL DEFAULT 'demo',
    "status" "ConnectionStatus" NOT NULL DEFAULT 'not_configured',
    "encrypted_api_key_ref" TEXT,
    "graph8_org_id" TEXT,
    "last_sync_at" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "graph8_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "graph8_deal_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "segment" "DealSegment" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "pipeline_id" TEXT,
    "stage_id" TEXT,
    "stage_name" TEXT,
    "owner_name" TEXT,
    "outcome" "DealOutcome" NOT NULL DEFAULT 'open',
    "close_reason_raw" TEXT,
    "opened_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "synced_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_snapshots" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "stage_name" TEXT NOT NULL,
    "entered_at" TIMESTAMP(3) NOT NULL,
    "exited_at" TIMESTAMP(3),

    CONSTRAINT "deal_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_contacts" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "role" "ContactRole" NOT NULL DEFAULT 'unknown',
    "engaged_at" TIMESTAMP(3),

    CONSTRAINT "deal_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_analyses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "analysis_version" INTEGER NOT NULL DEFAULT 1,
    "prompt_version" TEXT NOT NULL,
    "model_identifier" TEXT NOT NULL,
    "taxonomy_version" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "primary_factor_id" TEXT,
    "confidence" "ConfidenceLevel" NOT NULL DEFAULT 'unknown',
    "human_confirmation_required" BOOLEAN NOT NULL DEFAULT false,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'pending',
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_factors" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "deal_analysis_id" TEXT NOT NULL,
    "category" "FactorCategory" NOT NULL,
    "specific_issue" TEXT NOT NULL,
    "factor_type" "FactorType" NOT NULL,
    "confidence" "ConfidenceLevel" NOT NULL DEFAULT 'unknown',
    "preventability" "Preventability" NOT NULL DEFAULT 'unknown',
    "department" "Department" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "deal_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_evidence" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "analysis_id" TEXT,
    "factor_id" TEXT,
    "source_type" "EvidenceSourceType" NOT NULL,
    "source_external_id" TEXT,
    "source_timestamp" TIMESTAMP(3),
    "finding" TEXT NOT NULL,
    "excerpt" TEXT,
    "strength" "EvidenceStrength" NOT NULL DEFAULT 'moderate',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "human_feedback" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "analysis_id" TEXT NOT NULL,
    "user_id" TEXT,
    "feedback_type" TEXT NOT NULL,
    "selected_reason" TEXT,
    "override_category" "FactorCategory",
    "was_seller_controllable" BOOLEAN,
    "another_vendor_selected" BOOLEAN,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "human_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patterns" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "FactorCategory" NOT NULL,
    "segment_definition" JSONB NOT NULL,
    "lost_count" INTEGER NOT NULL DEFAULT 0,
    "won_count" INTEGER NOT NULL DEFAULT 0,
    "sample_size" INTEGER NOT NULL DEFAULT 0,
    "pattern_strength" "PatternStrength" NOT NULL DEFAULT 'one_off',
    "confidence" "ConfidenceLevel" NOT NULL DEFAULT 'low',
    "status" "PatternStatus" NOT NULL DEFAULT 'active',
    "narrative" TEXT NOT NULL,
    "first_detected_at" TIMESTAMP(3) NOT NULL,
    "last_detected_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pattern_occurrences" (
    "id" TEXT NOT NULL,
    "pattern_id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "deal_factor_id" TEXT,
    "outcome" TEXT NOT NULL,

    CONSTRAINT "pattern_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "pattern_id" TEXT NOT NULL,
    "department" "Department" NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "recommended_action" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_actions" (
    "id" TEXT NOT NULL,
    "recommendation_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "graph8_object_type" TEXT,
    "graph8_object_id" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "future_deal_warnings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "pattern_id" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "similarity_basis" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "future_deal_warnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "external_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "graph8_deal_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "processing_status" "WebhookProcessingStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "tools_used" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "log_metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "graph8_connections_organization_id_key" ON "graph8_connections"("organization_id");

-- CreateIndex
CREATE INDEX "deals_organization_id_idx" ON "deals"("organization_id");

-- CreateIndex
CREATE INDEX "deals_graph8_deal_id_idx" ON "deals"("graph8_deal_id");

-- CreateIndex
CREATE INDEX "deals_segment_idx" ON "deals"("segment");

-- CreateIndex
CREATE INDEX "deals_outcome_idx" ON "deals"("outcome");

-- CreateIndex
CREATE INDEX "deal_snapshots_deal_id_idx" ON "deal_snapshots"("deal_id");

-- CreateIndex
CREATE INDEX "deal_contacts_deal_id_idx" ON "deal_contacts"("deal_id");

-- CreateIndex
CREATE INDEX "deal_analyses_organization_id_idx" ON "deal_analyses"("organization_id");

-- CreateIndex
CREATE INDEX "deal_analyses_deal_id_idx" ON "deal_analyses"("deal_id");

-- CreateIndex
CREATE INDEX "deal_analyses_status_idx" ON "deal_analyses"("status");

-- CreateIndex
CREATE INDEX "deal_analyses_is_current_idx" ON "deal_analyses"("is_current");

-- CreateIndex
CREATE INDEX "deal_factors_organization_id_idx" ON "deal_factors"("organization_id");

-- CreateIndex
CREATE INDEX "deal_factors_deal_analysis_id_idx" ON "deal_factors"("deal_analysis_id");

-- CreateIndex
CREATE INDEX "deal_factors_category_idx" ON "deal_factors"("category");

-- CreateIndex
CREATE INDEX "deal_evidence_organization_id_idx" ON "deal_evidence"("organization_id");

-- CreateIndex
CREATE INDEX "deal_evidence_deal_id_idx" ON "deal_evidence"("deal_id");

-- CreateIndex
CREATE INDEX "deal_evidence_analysis_id_idx" ON "deal_evidence"("analysis_id");

-- CreateIndex
CREATE INDEX "deal_evidence_factor_id_idx" ON "deal_evidence"("factor_id");

-- CreateIndex
CREATE INDEX "human_feedback_organization_id_idx" ON "human_feedback"("organization_id");

-- CreateIndex
CREATE INDEX "human_feedback_deal_id_idx" ON "human_feedback"("deal_id");

-- CreateIndex
CREATE INDEX "human_feedback_analysis_id_idx" ON "human_feedback"("analysis_id");

-- CreateIndex
CREATE INDEX "patterns_organization_id_idx" ON "patterns"("organization_id");

-- CreateIndex
CREATE INDEX "patterns_category_idx" ON "patterns"("category");

-- CreateIndex
CREATE INDEX "patterns_status_idx" ON "patterns"("status");

-- CreateIndex
CREATE INDEX "pattern_occurrences_pattern_id_idx" ON "pattern_occurrences"("pattern_id");

-- CreateIndex
CREATE INDEX "pattern_occurrences_deal_id_idx" ON "pattern_occurrences"("deal_id");

-- CreateIndex
CREATE INDEX "recommendations_organization_id_idx" ON "recommendations"("organization_id");

-- CreateIndex
CREATE INDEX "recommendations_pattern_id_idx" ON "recommendations"("pattern_id");

-- CreateIndex
CREATE INDEX "recommendations_department_idx" ON "recommendations"("department");

-- CreateIndex
CREATE INDEX "recommendations_status_idx" ON "recommendations"("status");

-- CreateIndex
CREATE INDEX "recommendation_actions_recommendation_id_idx" ON "recommendation_actions"("recommendation_id");

-- CreateIndex
CREATE INDEX "recommendation_actions_status_idx" ON "recommendation_actions"("status");

-- CreateIndex
CREATE INDEX "future_deal_warnings_organization_id_idx" ON "future_deal_warnings"("organization_id");

-- CreateIndex
CREATE INDEX "future_deal_warnings_deal_id_idx" ON "future_deal_warnings"("deal_id");

-- CreateIndex
CREATE INDEX "future_deal_warnings_pattern_id_idx" ON "future_deal_warnings"("pattern_id");

-- CreateIndex
CREATE INDEX "future_deal_warnings_status_idx" ON "future_deal_warnings"("status");

-- CreateIndex
CREATE INDEX "webhook_events_external_event_id_idx" ON "webhook_events"("external_event_id");

-- CreateIndex
CREATE INDEX "webhook_events_graph8_deal_id_idx" ON "webhook_events"("graph8_deal_id");

-- CreateIndex
CREATE INDEX "webhook_events_processing_status_idx" ON "webhook_events"("processing_status");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_organization_id_external_event_id_key" ON "webhook_events"("organization_id", "external_event_id");

-- CreateIndex
CREATE INDEX "agent_runs_organization_id_idx" ON "agent_runs"("organization_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_idx" ON "audit_logs"("organization_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph8_connections" ADD CONSTRAINT "graph8_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_snapshots" ADD CONSTRAINT "deal_snapshots_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_contacts" ADD CONSTRAINT "deal_contacts_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_factors" ADD CONSTRAINT "deal_factors_deal_analysis_id_fkey" FOREIGN KEY ("deal_analysis_id") REFERENCES "deal_analyses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_evidence" ADD CONSTRAINT "deal_evidence_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "deal_factors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pattern_occurrences" ADD CONSTRAINT "pattern_occurrences_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "patterns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "patterns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_actions" ADD CONSTRAINT "recommendation_actions_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "recommendations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

