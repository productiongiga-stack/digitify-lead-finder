-- RLS coverage for meta/google ads, booking children, analytics, openclaw, and lead children.

-- meta_ad_accounts
ALTER TABLE "meta_ad_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meta_ad_accounts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "meta_ad_accounts";
CREATE POLICY workspace_isolation ON "meta_ad_accounts"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());

-- meta_ad_plans
ALTER TABLE "meta_ad_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meta_ad_plans" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "meta_ad_plans";
CREATE POLICY workspace_isolation ON "meta_ad_plans"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());

-- google_ad_accounts
ALTER TABLE "google_ad_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "google_ad_accounts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "google_ad_accounts";
CREATE POLICY workspace_isolation ON "google_ad_accounts"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());

-- google_ad_plans
ALTER TABLE "google_ad_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "google_ad_plans" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "google_ad_plans";
CREATE POLICY workspace_isolation ON "google_ad_plans"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());

-- service_catalog
ALTER TABLE "service_catalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_catalog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "service_catalog";
CREATE POLICY workspace_isolation ON "service_catalog"
  USING (app_rls_bypass() OR "createdById" IS NULL OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" IS NULL OR "createdById" = app_workspace_id());

-- booking_event_types
ALTER TABLE "booking_event_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_event_types" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "booking_event_types";
CREATE POLICY workspace_isolation ON "booking_event_types"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());

-- booking_availability_rules via event type
ALTER TABLE "booking_availability_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_availability_rules" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "booking_availability_rules";
CREATE POLICY workspace_isolation ON "booking_availability_rules"
  USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "booking_event_types" et
      WHERE et.id = "booking_availability_rules"."eventTypeId" AND et."createdById" = app_workspace_id()
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "booking_event_types" et
      WHERE et.id = "booking_availability_rules"."eventTypeId" AND et."createdById" = app_workspace_id()
    )
  );

-- booking_questions via event type
ALTER TABLE "booking_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_questions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "booking_questions";
CREATE POLICY workspace_isolation ON "booking_questions"
  USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "booking_event_types" et
      WHERE et.id = "booking_questions"."eventTypeId" AND et."createdById" = app_workspace_id()
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "booking_event_types" et
      WHERE et.id = "booking_questions"."eventTypeId" AND et."createdById" = app_workspace_id()
    )
  );

-- booking_question_answers via booking
ALTER TABLE "booking_question_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_question_answers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "booking_question_answers";
CREATE POLICY workspace_isolation ON "booking_question_answers"
  USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "bookings" b
      WHERE b.id = "booking_question_answers"."bookingId" AND b."createdById" = app_workspace_id()
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "bookings" b
      WHERE b.id = "booking_question_answers"."bookingId" AND b."createdById" = app_workspace_id()
    )
  );

-- booking_analytics_events
ALTER TABLE "booking_analytics_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_analytics_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "booking_analytics_events";
CREATE POLICY workspace_isolation ON "booking_analytics_events"
  USING (app_rls_bypass() OR "createdById" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "createdById" = app_workspace_id());

-- workspace_analytics_events
ALTER TABLE "workspace_analytics_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_analytics_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "workspace_analytics_events";
CREATE POLICY workspace_isolation ON "workspace_analytics_events"
  USING (app_rls_bypass() OR "workspaceId" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "workspaceId" = app_workspace_id());

-- lead_contacts via lead
ALTER TABLE "lead_contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lead_contacts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "lead_contacts";
CREATE POLICY workspace_isolation ON "lead_contacts"
  USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "leads" l
      WHERE l.id = "lead_contacts"."leadId" AND l."createdById" = app_workspace_id()
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "leads" l
      WHERE l.id = "lead_contacts"."leadId" AND l."createdById" = app_workspace_id()
    )
  );

-- lead_scoring_factors via lead
ALTER TABLE "lead_scoring_factors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lead_scoring_factors" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "lead_scoring_factors";
CREATE POLICY workspace_isolation ON "lead_scoring_factors"
  USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "leads" l
      WHERE l.id = "lead_scoring_factors"."leadId" AND l."createdById" = app_workspace_id()
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "leads" l
      WHERE l.id = "lead_scoring_factors"."leadId" AND l."createdById" = app_workspace_id()
    )
  );

-- quote_items via quote
ALTER TABLE "quote_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quote_items" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "quote_items";
CREATE POLICY workspace_isolation ON "quote_items"
  USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "quotes" q
      WHERE q.id = "quote_items"."quoteId" AND q."createdById" = app_workspace_id()
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "quotes" q
      WHERE q.id = "quote_items"."quoteId" AND q."createdById" = app_workspace_id()
    )
  );

-- custom_field_values via lead
ALTER TABLE "custom_field_values" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "custom_field_values" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "custom_field_values";
CREATE POLICY workspace_isolation ON "custom_field_values"
  USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "leads" l
      WHERE l.id = "custom_field_values"."leadId" AND l."createdById" = app_workspace_id()
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM "leads" l
      WHERE l.id = "custom_field_values"."leadId" AND l."createdById" = app_workspace_id()
    )
  );

-- openclaw_logs (user-scoped workspace owner)
ALTER TABLE "openclaw_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "openclaw_logs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "openclaw_logs";
CREATE POLICY workspace_isolation ON "openclaw_logs"
  USING (app_rls_bypass() OR "userId" = app_workspace_id())
  WITH CHECK (app_rls_bypass() OR "userId" = app_workspace_id());

-- openclaw_suggestions via lead (nullable leadId allows global suggestions through bypass only)
ALTER TABLE "openclaw_suggestions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "openclaw_suggestions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON "openclaw_suggestions";
CREATE POLICY workspace_isolation ON "openclaw_suggestions"
  USING (
    app_rls_bypass()
    OR (
      "leadId" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "leads" l
        WHERE l.id = "openclaw_suggestions"."leadId" AND l."createdById" = app_workspace_id()
      )
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR (
      "leadId" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "leads" l
        WHERE l.id = "openclaw_suggestions"."leadId" AND l."createdById" = app_workspace_id()
      )
    )
  );
