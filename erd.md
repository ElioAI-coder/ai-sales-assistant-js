DOCUMENT 2: ERD - DATABASE SCHEMA
sql
-- ============================================
-- ERD - AI SALES ASSISTANT REAL ESTATE FRANCE
-- Database: PostgreSQL (Supabase)
-- ============================================

-- ============================================
-- CORE TABLES - MULTI-TENANT FOUNDATION
-- ============================================

-- Companies (Real Estate Agencies)
CREATE TABLE companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    -- Basic Info
    name VARCHAR(200) NOT NULL,
    commercial_name VARCHAR(200), -- Nom commercial si différent
    domain VARCHAR(100) UNIQUE,
    
    -- French Business Info
    siret VARCHAR(14) UNIQUE,
    siren VARCHAR(9),
    naf_code VARCHAR(10), -- 6831Z pour agences immobilières
    tva_number VARCHAR(20),
    
    -- Subscription
    subscription_plan VARCHAR(20) DEFAULT 'trial' 
        CHECK (subscription_plan IN ('trial', 'starter', 'growth', 'scale')),
    subscription_status VARCHAR(20) DEFAULT 'active'
        CHECK (subscription_status IN ('active', 'suspended', 'cancelled')),
    trial_ends_at TIMESTAMPTZ,
    
    -- Settings
    language VARCHAR(5) DEFAULT 'fr_FR',
    timezone VARCHAR(50) DEFAULT 'Europe/Paris',
    settings JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (Agents immobiliers)
CREATE TABLE users (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    company_id UUID REFERENCES companies(id) NOT NULL,
    
    -- User Info
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    mobile VARCHAR(20),
    
    -- Professional Info
    carte_pro_number VARCHAR(50), -- Carte professionnelle
    role VARCHAR(30) DEFAULT 'agent'
        CHECK (role IN ('owner', 'director', 'manager', 'agent', 'assistant')),
    specializations TEXT[], -- ['residential', 'commercial', 'luxury', 'rental']
    
    -- Settings
    is_active BOOLEAN DEFAULT true,
    notification_preferences JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    
    UNIQUE(company_id, email)
);

-- ============================================
-- REAL ESTATE SPECIFIC TABLES
-- ============================================

-- Real Estate Agencies Details
CREATE TABLE agency_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) UNIQUE NOT NULL,
    
    -- Agency Classification
    agency_type VARCHAR(30) DEFAULT 'independent'
        CHECK (agency_type IN ('independent', 'franchise', 'network', 'online')),
    franchise_name VARCHAR(100), -- Century21, Orpi, etc.
    established_year INTEGER,
    
    -- Size & Activity
    agents_count INTEGER DEFAULT 1,
    offices_count INTEGER DEFAULT 1,
    active_listings INTEGER DEFAULT 0,
    avg_monthly_transactions INTEGER,
    avg_transaction_value DECIMAL(12,2),
    
    -- Specializations
    property_types TEXT[], -- ['apartment', 'house', 'commercial', 'land']
    transaction_types TEXT[], -- ['sale', 'rental', 'seasonal', 'viager']
    geographical_zones TEXT[], -- ['Paris 8ème', 'Neuilly', 'Hauts-de-Seine']
    
    -- Digital Presence
    website_url VARCHAR(500),
    website_quality_score INTEGER CHECK (website_quality_score BETWEEN 0 AND 100),
    social_media JSONB DEFAULT '{}', -- {facebook: url, instagram: url}
    
    -- Portals Subscriptions
    portal_subscriptions JSONB DEFAULT '[]', 
    /* [{
        name: 'SeLoger',
        plan: 'Premium',
        monthly_cost: 299,
        active: true
    }] */
    
    -- Current Tools
    crm_system VARCHAR(100),
    other_tools TEXT[],
    
    -- Market Position
    market_share_estimation DECIMAL(5,2), -- % in their zone
    main_competitors TEXT[],
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROSPECT & INTELLIGENCE TABLES
-- ============================================

-- Prospects (Contacts in agencies to approach)
CREATE TABLE prospects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) NOT NULL,
    
    -- Contact Info
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    mobile VARCHAR(20),
    
    -- Professional Info
    job_title VARCHAR(100), -- Directeur, Responsable commercial, etc.
    decision_power VARCHAR(20) 
        CHECK (decision_power IN ('decision_maker', 'influencer', 'user', 'unknown')),
    
    -- Agency Info
    agency_name VARCHAR(200),
    agency_siret VARCHAR(14),
    agency_type VARCHAR(30),
    agency_size VARCHAR(20), -- '1-5', '6-20', '21-50', '50+'
    
    -- Location
    address VARCHAR(300),
    city VARCHAR(100),
    postal_code VARCHAR(5),
    department VARCHAR(3), -- 75, 92, etc.
    region VARCHAR(100),
    
    -- Digital Footprint
    linkedin_url VARCHAR(500),
    has_website BOOLEAN,
    website_url VARCHAR(500),
    digital_maturity_score INTEGER CHECK (digital_maturity_score BETWEEN 0 AND 100),
    
    -- Intelligence Scores
    lead_score INTEGER DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
    intent_score INTEGER DEFAULT 0 CHECK (intent_score BETWEEN 0 AND 100),
    engagement_score INTEGER DEFAULT 0 CHECK (engagement_score BETWEEN 0 AND 100),
    budget_score INTEGER DEFAULT 0 CHECK (budget_score BETWEEN 0 AND 100),
    
    -- Status & Tags
    status VARCHAR(30) DEFAULT 'new'
        CHECK (status IN ('new', 'contacted', 'engaged', 'qualified', 'opportunity', 'customer', 'lost')),
    lost_reason VARCHAR(100),
    tags TEXT[],
    
    -- Custom Fields
    custom_fields JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ,
    
    UNIQUE(company_id, email)
);

CREATE INDEX idx_prospects_company_status ON prospects(company_id, status);
CREATE INDEX idx_prospects_scores ON prospects(company_id, lead_score DESC);
CREATE INDEX idx_prospects_location ON prospects(department, city);

-- Real Estate Market Intelligence
CREATE TABLE market_intelligence (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Location
    department VARCHAR(3) NOT NULL,
    city VARCHAR(100) NOT NULL,
    district VARCHAR(100), -- Arrondissement ou quartier
    
    -- Market Metrics
    avg_price_sqm_sale DECIMAL(10,2), -- Prix moyen au m² vente
    avg_price_sqm_rent DECIMAL(10,2), -- Prix moyen au m² location
    price_trend_3m DECIMAL(5,2), -- Evolution % sur 3 mois
    price_trend_12m DECIMAL(5,2), -- Evolution % sur 12 mois
    
    -- Activity Metrics
    transactions_count_monthly INTEGER,
    avg_days_on_market INTEGER, -- Délai moyen de vente
    inventory_months DECIMAL(4,2), -- Stock en mois
    demand_supply_ratio DECIMAL(4,2), -- Ratio demande/offre
    
    -- Competition
    total_agencies INTEGER,
    agencies_per_10k_habitants DECIMAL(6,2),
    market_concentration DECIMAL(5,2), -- Index Herfindahl
    
    -- Update Info
    data_source VARCHAR(100), -- 'insee', 'notaires', 'portals'
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(department, city, district)
);

-- ============================================
-- MESSAGING & CAMPAIGNS
-- ============================================

-- AI Generated Messages
CREATE TABLE messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) NOT NULL,
    prospect_id UUID REFERENCES prospects(id),
    campaign_id UUID REFERENCES campaigns(id),
    
    -- Content
    channel VARCHAR(20) NOT NULL 
        CHECK (channel IN ('email', 'sms', 'linkedin')),
    subject VARCHAR(500),
    content TEXT NOT NULL,
    preview_text VARCHAR(200),
    
    -- AI Generation
    ai_model VARCHAR(50) DEFAULT 'gpt-4',
    ai_prompt TEXT,
    template_id UUID,
    personalization_level INTEGER CHECK (personalization_level BETWEEN 1 AND 5),
    
    -- Status & Tracking
    status VARCHAR(30) DEFAULT 'draft'
        CHECK (status IN ('draft', 'scheduled', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced')),
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    
    -- Metrics
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaigns
CREATE TABLE campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) NOT NULL,
    
    -- Campaign Info
    name VARCHAR(200) NOT NULL,
    description TEXT,
    campaign_type VARCHAR(30) DEFAULT 'standard'
        CHECK (campaign_type IN ('standard', 'nurture', 'reactivation', 'event')),
    
    -- Targeting
    target_filters JSONB NOT NULL DEFAULT '{}',
    /* {
        agency_size: ['1-5', '6-20'],
        departments: ['75', '92', '93'],
        digital_maturity: { min: 0, max: 50 },
        property_types: ['residential']
    } */
    
    -- Configuration
    channels TEXT[] DEFAULT '{email}',
    messages_sequence JSONB DEFAULT '[]',
    
    -- Schedule
    status VARCHAR(20) DEFAULT 'draft'
        CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed')),
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    
    -- Performance
    total_recipients INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    messages_opened INTEGER DEFAULT 0,
    messages_clicked INTEGER DEFAULT 0,
    replies_received INTEGER DEFAULT 0,
    meetings_booked INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EVENT DRIVEN ARCHITECTURE
-- ============================================

-- Event Store (Immutable)
CREATE TABLE events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Event Info
    event_type VARCHAR(100) NOT NULL, -- 'prospect.created', 'email.sent', etc.
    event_version INTEGER DEFAULT 1,
    
    -- Aggregate Info
    aggregate_id UUID NOT NULL,
    aggregate_type VARCHAR(50) NOT NULL, -- 'prospect', 'campaign', etc.
    company_id UUID REFERENCES companies(id) NOT NULL,
    
    -- Event Data
    payload JSONB NOT NULL,
    metadata JSONB DEFAULT '{}', -- user_id, correlation_id, etc.
    
    -- Processing
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,
    
    occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_type_time ON events(event_type, occurred_at DESC);
CREATE INDEX idx_events_aggregate ON events(aggregate_type, aggregate_id);
CREATE INDEX idx_events_unprocessed ON events(processed) WHERE processed = false;

-- Failed Events (Dead Letter Queue)
CREATE TABLE failed_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES events(id),
    
    -- Error Info
    error_type VARCHAR(100),
    error_message TEXT NOT NULL,
    error_stack TEXT,
    
    -- Retry Info
    attempt_count INTEGER DEFAULT 1,
    max_attempts INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    
    -- Resolution
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'retrying', 'failed', 'resolved', 'ignored')),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ANALYTICS & INTELLIGENCE
-- ============================================

-- Behavioral Patterns
CREATE TABLE behavioral_patterns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Pattern Identity
    pattern_type VARCHAR(100) NOT NULL, -- 'email_engagement', 'best_contact_time', etc.
    pattern_name VARCHAR(200) NOT NULL,
    vertical VARCHAR(50) DEFAULT 'real_estate',
    
    -- Pattern Rules
    conditions JSONB NOT NULL,
    /* {
        agency_size: ['1-5'],
        time_of_day: [9, 10, 11],
        day_of_week: ['tuesday', 'thursday'],
        season: ['september', 'january']
    } */
    
    -- Pattern Performance
    success_rate DECIMAL(5,2),
    confidence_score DECIMAL(3,2),
    sample_size INTEGER,
    
    -- Actions
    recommended_actions JSONB DEFAULT '[]',
    
    -- Validity
    is_active BOOLEAN DEFAULT true,
    valid_from DATE,
    valid_until DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks and Activities
CREATE TABLE tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) NOT NULL,
    prospect_id UUID REFERENCES prospects(id),
    assigned_to UUID REFERENCES users(id),
    
    -- Task Info
    type VARCHAR(30) NOT NULL
        CHECK (type IN ('call', 'email', 'meeting', 'follow_up', 'property_visit')),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Scheduling
    due_date DATE,
    due_time TIME,
    reminder_minutes INTEGER,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    
    -- Completion
    completed_at TIMESTAMPTZ,
    completion_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Revenue Tracking
CREATE TABLE deals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) NOT NULL,
    prospect_id UUID REFERENCES prospects(id) NOT NULL,
    
    -- Deal Info
    name VARCHAR(200),
    description TEXT,
    
    -- Value
    monthly_value DECIMAL(10,2), -- Abonnement mensuel
    setup_fee DECIMAL(10,2), -- Frais de mise en place
    contract_months INTEGER DEFAULT 12,
    total_value DECIMAL(12,2), -- Calculé
    
    -- Status
    stage VARCHAR(50) DEFAULT 'qualification'
        CHECK (stage IN ('qualification', 'demo', 'proposal', 'negotiation', 'won', 'lost')),
    probability INTEGER DEFAULT 10,
    
    -- Dates
    expected_close_date DATE,
    closed_at TIMESTAMPTZ,
    
    -- Attribution
    first_touch_campaign UUID REFERENCES campaigns(id),
    last_touch_campaign UUID REFERENCES campaigns(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MONITORING & OBSERVABILITY
-- ============================================

-- API Usage Tracking
CREATE TABLE api_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) NOT NULL,
    user_id UUID REFERENCES users(id),
    
    -- Request Details
    endpoint VARCHAR(200) NOT NULL,
    method VARCHAR(10) NOT NULL,
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    
    -- Performance
    response_time_ms INTEGER NOT NULL,
    status_code INTEGER NOT NULL,
    
    -- Error Tracking
    error_type VARCHAR(100),
    error_message TEXT,
    
    -- Context
    ip_address INET,
    user_agent VARCHAR(500),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_usage_company_time ON api_usage(company_id, created_at DESC);
CREATE INDEX idx_api_usage_endpoint ON api_usage(endpoint, created_at DESC);
CREATE INDEX idx_api_usage_errors ON api_usage(company_id, status_code) WHERE status_code >= 400;

-- Resource Usage Limits & Tracking
CREATE TABLE usage_limits (
    company_id UUID REFERENCES companies(id) PRIMARY KEY,
    
    -- Daily Limits
    emails_sent_today INTEGER DEFAULT 0,
    emails_limit_daily INTEGER DEFAULT 1000,
    
    api_calls_today INTEGER DEFAULT 0,
    api_calls_limit_daily INTEGER DEFAULT 10000,
    
    -- Monthly Limits
    prospects_imported_month INTEGER DEFAULT 0,
    prospects_limit_monthly INTEGER DEFAULT 5000,
    
    ai_tokens_used_month INTEGER DEFAULT 0,
    ai_tokens_limit_monthly INTEGER DEFAULT 100000,
    
    -- Reset Tracking
    daily_reset_at TIMESTAMPTZ DEFAULT CURRENT_DATE + INTERVAL '1 day',
    monthly_reset_at TIMESTAMPTZ DEFAULT DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month',
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Health Metrics
CREATE TABLE health_checks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Component Status
    component VARCHAR(50) NOT NULL, -- 'database', 'redis', 'openai', 'sendgrid'
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
    
    -- Metrics
    response_time_ms INTEGER,
    success_rate DECIMAL(5,2), -- Last 100 checks
    
    -- Details
    details JSONB DEFAULT '{}',
    error_message TEXT,
    
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_health_checks_component ON health_checks(component, checked_at DESC);

-- Performance Metrics (Time Series)
CREATE TABLE performance_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Metric Identity
    metric_name VARCHAR(100) NOT NULL, -- 'cpu_usage', 'memory_usage', 'queue_size'
    metric_value DECIMAL(10,2) NOT NULL,
    
    -- Dimensions
    tags JSONB DEFAULT '{}', -- {server: 'api-1', region: 'eu-west'}
    
    -- Timestamp
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_performance_metrics_name_time ON performance_metrics(metric_name, recorded_at DESC);

-- Audit Log (Sensitive Operations)
CREATE TABLE audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES companies(id),
    user_id UUID REFERENCES users(id),
    
    -- Action Details
    action VARCHAR(100) NOT NULL, -- 'export_data', 'delete_prospect', 'change_plan'
    resource_type VARCHAR(50),
    resource_id UUID,
    
    -- Context
    ip_address INET,
    user_agent VARCHAR(500),
    
    -- Changes
    old_values JSONB,
    new_values JSONB,
    
    -- Result
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_company ON audit_logs(company_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);

-- External Service Status
CREATE TABLE external_service_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    service_name VARCHAR(50) NOT NULL, -- 'openai', 'sendgrid', 'stripe'
    
    -- Current Status
    is_operational BOOLEAN DEFAULT true,
    last_error TEXT,
    consecutive_failures INTEGER DEFAULT 0,
    
    -- Circuit Breaker State
    circuit_state VARCHAR(20) DEFAULT 'closed' CHECK (circuit_state IN ('closed', 'open', 'half_open')),
    circuit_opened_at TIMESTAMPTZ,
    
    -- Stats
    total_requests_today INTEGER DEFAULT 0,
    failed_requests_today INTEGER DEFAULT 0,
    avg_response_time_ms INTEGER,
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cost Tracking (OpenAI, SendGrid, etc)
CREATE TABLE cost_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) NOT NULL,
    
    -- Service & Cost
    service VARCHAR(50) NOT NULL, -- 'openai', 'sendgrid', 'sms'
    resource_type VARCHAR(50), -- 'gpt4_tokens', 'email_sent', 'sms_sent'
    quantity INTEGER NOT NULL,
    unit_cost DECIMAL(10,4) NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    
    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cost_tracking_company_period ON cost_tracking(company_id, period_start DESC);

-- ============================================
-- MONITORING FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update usage limits
CREATE OR REPLACE FUNCTION increment_usage(
    p_company_id UUID,
    p_usage_type VARCHAR,
    p_amount INTEGER DEFAULT 1
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_usage INTEGER;
    v_limit INTEGER;
BEGIN
    -- Get current usage and limit
    EXECUTE format('SELECT %I, %I FROM usage_limits WHERE company_id = $1', 
                   p_usage_type, p_usage_type || '_limit') 
    INTO v_current_usage, v_limit
    USING p_company_id;
    
    -- Check if limit exceeded
    IF v_current_usage + p_amount > v_limit THEN
        RETURN FALSE;
    END IF;
    
    -- Increment usage
    EXECUTE format('UPDATE usage_limits SET %I = %I + $1 WHERE company_id = $2', 
                   p_usage_type, p_usage_type)
    USING p_amount, p_company_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Scheduled job to reset daily limits (run at midnight)
CREATE OR REPLACE FUNCTION reset_daily_limits() RETURNS void AS $$
BEGIN
    UPDATE usage_limits 
    SET 
        emails_sent_today = 0,
        api_calls_today = 0,
        daily_reset_at = CURRENT_DATE + INTERVAL '1 day'
    WHERE daily_reset_at <= NOW();
END;
$$ LANGUAGE plpgsql;

-- Scheduled job to reset monthly limits
CREATE OR REPLACE FUNCTION reset_monthly_limits() RETURNS void AS $$
BEGIN
    UPDATE usage_limits 
    SET 
        prospects_imported_month = 0,
        ai_tokens_used_month = 0,
        monthly_reset_at = DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    WHERE monthly_reset_at <= NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SUPABASE SPECIFIC CONFIGURATION
-- ============================================

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE prospects;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;

-- Row Level Security Policies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies Examples
CREATE POLICY "Users can view own company" ON companies
    FOR ALL USING (id = auth.jwt() ->> 'company_id'::uuid);

CREATE POLICY "Users can manage own prospects" ON prospects
    FOR ALL USING (company_id = auth.jwt() ->> 'company_id'::uuid);

-- Functions
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_agency_profiles_updated_at
    BEFORE UPDATE ON agency_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

## 🏦 SYSTÈME DE BILLING - INTÉGRATION NÉCESSAIRE

Voici ce que je propose d'ajouter aux documents:

### **NOUVELLES TABLES ERD**
```sql
-- ============================================
-- BILLING & SUBSCRIPTION MANAGEMENT
-- ============================================

CREATE TABLE subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) UNIQUE NOT NULL,
    
    -- Plan Details
    plan_id VARCHAR(50) NOT NULL,
    plan_name VARCHAR(100) NOT NULL,
    price_monthly DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
    
    -- Dates
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancelled_at TIMESTAMPTZ,
    
    -- Payment
    payment_method VARCHAR(50), -- 'card', 'sepa', 'invoice'
    stripe_subscription_id VARCHAR(100),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) NOT NULL,
    subscription_id UUID REFERENCES subscriptions(id),
    
    -- Invoice Details
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('draft', 'pending', 'paid', 'overdue', 'cancelled')),
    
    -- Dates
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    due_date DATE NOT NULL,
    paid_at TIMESTAMPTZ,
    
    -- Payment
    payment_method VARCHAR(50),
    stripe_invoice_id VARCHAR(100),
    
    -- PDF
    pdf_url VARCHAR(500),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payment_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) NOT NULL,
    invoice_id UUID REFERENCES invoices(id),
    
    -- Event Details
    event_type VARCHAR(50) NOT NULL, -- 'payment_succeeded', 'payment_failed', etc.
    amount DECIMAL(10,2),
    
    -- Context
    stripe_event_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automated Suspension Rules
CREATE TABLE billing_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    rule_type VARCHAR(50) NOT NULL,
    days_after_due INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'send_reminder', 'suspend', 'cancel'
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default rules
INSERT INTO billing_rules (rule_type, days_after_due, action) VALUES
('first_reminder', 3, 'send_reminder'),
('second_reminder', 7, 'send_reminder'),
('suspension_warning', 10, 'send_warning'),
('suspend_account', 15, 'suspend'),
('final_notice', 30, 'send_final_notice'),
('cancel_account', 45, 'cancel');

-- API Usage Tracking
CREATE TABLE api_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) NOT NULL,
    endpoint VARCHAR(200) NOT NULL,
    method VARCHAR(10) NOT NULL,
    response_time_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resource Limits
CREATE TABLE usage_limits (
    company_id UUID REFERENCES companies(id) PRIMARY KEY,
    emails_sent_today INTEGER DEFAULT 0,
    api_calls_today INTEGER DEFAULT 0,
    prospects_imported_month INTEGER DEFAULT 0,
    last_reset_at TIMESTAMPTZ DEFAULT NOW()
);