# ERD - PLATEFORME SAAS ASSISTANT COMMERCIAL IA

## 🏗️ ARCHITECTURE MULTI-TENANT

### **ENTITÉS PRINCIPALES**

---

## 🏢 **COMPANIES** *(Clients SaaS)*
**Attributs :**
- `company_id` : UUID (PK) 
- `name` : VARCHAR(100) - Nom entreprise
- `domain` : VARCHAR(50) - Domaine email (@company.com)
- `subscription_plan` : ENUM(starter, business, enterprise)
- `subscription_status` : ENUM(active, suspended, cancelled)
- `language` : VARCHAR(5) - Langue interface (fr, en, it, es, de)
- `timezone` : VARCHAR(50) - Fuseau horaire
- `created_at` : TIMESTAMP
- `updated_at` : TIMESTAMP

---

## 🌍 **ADDRESSES** *(Addresses normalisées)*
**Attributs :**
- `address_id` : UUID (PK)
- `street_address` : VARCHAR(200)
- `city` : VARCHAR(100)
- `postal_code` : VARCHAR(20)
- `region` : VARCHAR(100) - État/Région
- `country` : VARCHAR(50)
- `created_at` : TIMESTAMP

---

## 👥 **USERS** *(Utilisateurs par entreprise)*
**Attributs :**
- `user_id` : UUID (PK)
- `company_id` : UUID (FK → Companies)
- `email` : VARCHAR(100) - Unique par company
- `password_hash` : VARCHAR(255)
- `first_name` : VARCHAR(50)
- `last_name` : VARCHAR(50)
- `role_id` : UUID (FK → Roles) - Rôle personnalisable
- `language` : VARCHAR(5) - Préférence personnelle
- `is_active` : BOOLEAN
- `last_login` : TIMESTAMP
- `created_at` : TIMESTAMP

---

## 🛍️ **PRODUCTS** *(Configuration produit/marché)*
**Attributs :**
- `product_id` : UUID (PK)
- `company_id` : UUID (FK → Companies)
- `name` : VARCHAR(100) - Nom du produit à vendre
- `description` : TEXT - Description détaillée
- `target_market` : VARCHAR(100) - Marché cible (immobilier, écoles...)
- `is_active` : BOOLEAN
- `created_at` : TIMESTAMP

---

## 💰 **PRODUCT_PRICING** *(Prix produits normalisé)*
**Attributs :**
- `pricing_id` : UUID (PK)
- `product_id` : UUID (FK → Products)
- `price_amount` : DECIMAL(10,2) - Prix numérique seulement
- `currency` : VARCHAR(3) - EUR, USD, GBP
- `price_type` : ENUM(fixed, range_min, range_max)
- `valid_from` : DATE
- `valid_until` : DATE
- `created_at` : TIMESTAMP

---

## 🎯 **PRODUCT_BENEFITS** *(Bénéfices produits normalisés)*
**Attributs :**
- `benefit_id` : UUID (PK)
- `product_id` : UUID (FK → Products)
- `benefit_text` : VARCHAR(200) - Un bénéfice par ligne
- `priority_order` : INTEGER - Ordre d'importance
- `created_at` : TIMESTAMP

---

## 👤 **PROSPECTS** *(Contacts à démarcher - 3NF)*
**Attributs :**
- `prospect_id` : UUID (PK)
- `company_id` : UUID (FK → Companies)
- `product_id` : UUID (FK → Products)
- `first_name` : VARCHAR(50)
- `last_name` : VARCHAR(50)
- `email` : VARCHAR(100)
- `phone` : VARCHAR(20)
- `job_title` : VARCHAR(100)
- `company_name` : VARCHAR(100)
- `company_size_id` : UUID (FK → Company_Sizes)
- `industry_id` : UUID (FK → Industries)
- `address_id` : UUID (FK → Addresses)
- `website` : VARCHAR(200)
- `linkedin_url` : VARCHAR(200)
- `twitter_url` : VARCHAR(200)
- `blog_url` : VARCHAR(200)
- `ai_score` : INTEGER(0-100) - Score IA
- `estimated_budget_amount` : DECIMAL(10,2)
- `estimated_budget_currency` : VARCHAR(3)
- `pain_points` : TEXT
- `tender_opportunities` : JSON - Bandi gara rilevanti per settore
- `tender_last_update` : TIMESTAMP - Ultimo aggiornamento bandi
- `competitive_intel` : JSON - Intelligence su competitors
- `status` : ENUM(nouveau, a_contacter, contacte, interesse, negocie, client, perdu)
- `source` : ENUM(import_csv, manual, api, enrichment)
- `notes` : TEXT
- `created_at` : TIMESTAMP
- `updated_at` : TIMESTAMP

---

## 🏭 **COMPANY_SIZES** *(Tailles entreprises normalisées)*
**Attributs :**
- `size_id` : UUID (PK)
- `size_range` : VARCHAR(20) - "1-10", "11-50", "51-200", "200+"
- `min_employees` : INTEGER
- `max_employees` : INTEGER - NULL pour "200+"
- `created_at` : TIMESTAMP

---

## 🏢 **INDUSTRIES** *(Secteurs d'activité normalisés)*
**Attributs :**
- `industry_id` : UUID (PK)
- `name` : VARCHAR(100) - "Immobilier", "Éducation", etc.
- `description` : TEXT
- `nace_codes` : JSON - Codes NACE européens
- `created_at` : TIMESTAMP

---

## 💬 **MESSAGES** *(Messages générés par IA)*
**Attributs :**
- `message_id` : UUID (PK)
- `prospect_id` : UUID (FK → Prospects)
- `channel` : ENUM(email, linkedin, sms)
- `subject` : VARCHAR(200) - Pour emails
- `content` : TEXT - Contenu du message
- `ai_prompt_used` : TEXT - Prompt OpenAI utilisé
- `language` : VARCHAR(5) - Langue du message
- `is_approved` : BOOLEAN
- `approved_by` : UUID (FK → Users)
- `approved_at` : TIMESTAMP
- `created_at` : TIMESTAMP

---

## ✅ **TASKS** *(Actions marketing)*
**Attributs :**
- `task_id` : UUID (PK)
- `prospect_id` : UUID (FK → Prospects)
- `assigned_to` : UUID (FK → Users)
- `message_id` : UUID (FK → Messages) - Optionnel
- `type` : ENUM(email, linkedin, call, meeting, follow_up)
- `priority` : ENUM(low, medium, high, urgent)
- `title` : VARCHAR(200)
- `description` : TEXT
- `due_date` : TIMESTAMP
- `status` : ENUM(pending, in_progress, completed, cancelled)
- `completed_at` : TIMESTAMP
- `notes` : TEXT
- `created_at` : TIMESTAMP

---

## 📊 **INTERACTIONS** *(Historique communications)*
**Attributs :**
- `interaction_id` : UUID (PK)
- `prospect_id` : UUID (FK → Prospects)
- `user_id` : UUID (FK → Users)
- `task_id` : UUID (FK → Tasks) - Optionnel
- `channel` : ENUM(email, linkedin, phone, meeting, other)
- `type` : ENUM(sent, received, call_made, meeting_held)
- `subject` : VARCHAR(200)
- `content` : TEXT
- `response_received` : BOOLEAN
- `response_content` : TEXT
- `response_sentiment` : ENUM(positive, neutral, negative) - Analysé par IA
- `interaction_date` : TIMESTAMP
- `created_at` : TIMESTAMP

## ⚡ **ENRICHMENTS** *(Arricchimenti automatici)*
**Attributs :**
- `enrichment_id` : UUID (PK)
- `prospect_id` : UUID (FK → Prospects)
- `enrichment_type` : ENUM(website, linkedin, twitter, company_info, email_validation)
- `source_api` : VARCHAR(50) - Hunter.io, Clearbit, etc.
- `original_value` : TEXT - Valore prima arricchimento
- `enriched_value` : TEXT - Valore dopo arricchimento
- `confidence_score` : DECIMAL(3,2) - Score affidabilità (0.00-1.00)
- `cost` : DECIMAL(6,4) - Costo API call
- `status` : ENUM(pending, completed, failed, expired)
- `created_at` : TIMESTAMP
- `expires_at` : TIMESTAMP

---

## 🔄 **IMPORT_JOBS** *(Gestione import schedulati)*
**Attributs :**
- `import_job_id` : UUID (PK)
- `company_id` : UUID (FK → Companies)
- `user_id` : UUID (FK → Users) - Chi ha creato
- `name` : VARCHAR(100) - Nome import personalizzato
- `source_type` : ENUM(csv, api, ftp, email_attachment)
- `source_config` : JSON - Configurazione connessione
- `schedule_cron` : VARCHAR(50) - Pianificazione cron
- `field_mapping` : JSON - Mapping campi CSV → DB
- `last_run` : TIMESTAMP
- `next_run` : TIMESTAMP
- `status` : ENUM(active, paused, failed, disabled)
- `records_processed` : INTEGER
- `records_succeeded` : INTEGER
- `records_failed` : INTEGER
- `error_log` : TEXT
- `created_at` : TIMESTAMP

---

## 🔐 **API_KEYS** *(Gestione chiavi API)*
**Attributs :**
- `api_key_id` : UUID (PK)
- `company_id` : UUID (FK → Companies)
- `service_name` : VARCHAR(50) - OpenAI, Hunter, Clearbit, etc.
- `key_value` : TEXT - Chiave crittografata
- `usage_limit_monthly` : INTEGER - Limite mensile
- `usage_current_month` : INTEGER - Uso corrente
- `cost_per_request` : DECIMAL(6,4)
- `is_active` : BOOLEAN
- `expires_at` : TIMESTAMP
- `created_at` : TIMESTAMP

---

## 📧 **EMAIL_CAMPAIGNS** *(Gestione campagne email)*
**Attributs :**
- `campaign_id` : UUID (PK)
- `company_id` : UUID (FK → Companies)
- `created_by` : UUID (FK → Users)
- `name` : VARCHAR(100)
- `template_id` : UUID (FK → Templates)
- `target_filter` : JSON - Criteri selezione prospects
- `schedule_type` : ENUM(immediate, scheduled, recurring)
- `scheduled_at` : TIMESTAMP
- `status` : ENUM(draft, scheduled, running, completed, paused)
- `total_recipients` : INTEGER
- `emails_sent` : INTEGER
- `emails_delivered` : INTEGER
- `emails_opened` : INTEGER
- `emails_clicked` : INTEGER
- `emails_replied` : INTEGER
- `created_at` : TIMESTAMP

---

## 🔍 **AUDIT_LOGS** *(Log audit e conformità)*
**Attributs :**
- `audit_id` : UUID (PK)
- `company_id` : UUID (FK → Companies)
- `user_id` : UUID (FK → Users) - Null per azioni sistema
- `table_name` : VARCHAR(50) - Tabella modificata
- `record_id` : UUID - ID record modificato
- `action` : ENUM(create, update, delete, export, login, logout)
- `old_values` : JSON - Valori prima modifica
- `new_values` : JSON - Valori dopo modifica
- `ip_address` : VARCHAR(45)
- `user_agent` : TEXT
- `gdpr_basis` : VARCHAR(50) - Base legale GDPR
- `created_at` : TIMESTAMP

---

## 🎛️ **SYSTEM_SETTINGS** *(Configurazioni sistema)*
**Attributs :**
- `setting_id` : UUID (PK)
- `company_id` : UUID (FK → Companies) - Null per impostazioni globali
- `category` : VARCHAR(50) - ai, email, security, etc.
- `key_name` : VARCHAR(100)
- `value` : TEXT
- `data_type` : ENUM(string, integer, boolean, json, encrypted)
- `is_user_configurable` : BOOLEAN
- `description` : TEXT
- `updated_by` : UUID (FK → Users)
- `updated_at` : TIMESTAMP

---

## 📈 **CONVERSION_FUNNEL** *(Tracking complet prospect → client)*
**Attributs :**
- `funnel_id` : UUID (PK)
- `prospect_id` : UUID (FK → Prospects)
- `company_id` : UUID (FK → Companies)
- `stage` : ENUM(nouveau, contacte, interesse, demo_programmee, proposition_envoyee, negociation, client, perdu)
- `stage_entered_at` : TIMESTAMP
- `stage_duration_hours` : INTEGER - Temps passé dans cette étape
- `conversion_probability` : DECIMAL(3,2) - Probabilité IA (0.00-1.00)
- `deal_value` : DECIMAL(10,2) - Valeur estimée/réelle
- `loss_reason` : VARCHAR(100) - Si perdu : prix, timing, concurrent, etc.
- `next_action` : VARCHAR(200) - Prochaine action suggérée
- `created_by` : UUID (FK → Users)
- `updated_at` : TIMESTAMP

---

## 📊 **SUCCESS_METRICS** *(Métriques de performance temps réel)*
**Attributs :**
- `metric_id` : UUID (PK)
- `company_id` : UUID (FK → Companies)
- `period_start` : DATE
- `period_end` : DATE
- `prospects_imported` : INTEGER
- `prospects_contacted` : INTEGER
- `responses_received` : INTEGER
- `meetings_scheduled` : INTEGER
- `proposals_sent` : INTEGER
- `deals_won` : INTEGER
- `deals_lost` : INTEGER
- `total_revenue` : DECIMAL(12,2)
- `avg_deal_size` : DECIMAL(10,2)
- `sales_cycle_days` : DECIMAL(5,2)
- `response_rate_percent` : DECIMAL(5,2)
- `conversion_rate_percent` : DECIMAL(5,2)
- `roi_calculated` : DECIMAL(8,2) - ROI vs coût plateforme
- `created_at` : TIMESTAMP

---

## 📧 **SUCCESS_REPORTS** *(Rapports automatiques performance)*
**Attributs :**
- `report_id` : UUID (PK)
- `company_id` : UUID (FK → Companies)
- `report_type` : ENUM(weekly, monthly, quarterly, on_demand)
- `report_period` : VARCHAR(20) - "2025-W05", "2025-01", etc.
- `key_metrics` : JSON - Métriques principales formatées
- `insights_generated` : JSON - Insights IA automatiques
- `recommendations` : JSON - Suggestions amélioration
- `benchmark_data` : JSON - Comparaison vs moyenne secteur
- `sent_to_emails` : JSON - Liste emails destinataires
- `internal_copy_sent` : BOOLEAN - Copie envoyée à notre équipe
- `generated_at` : TIMESTAMP
- `sent_at` : TIMESTAMP

---

## 🎯 **IMPROVEMENT_SUGGESTIONS** *(Suggestions IA pour optimisation)*
**Attributs :**
- `suggestion_id` : UUID (PK)
- `company_id` : UUID (FK → Companies)
- `suggestion_type` : ENUM(template_optimization, timing_adjustment, target_refinement, channel_mix)
- `current_performance` : JSON - Métriques actuelles
- `suggested_change` : TEXT - Changement recommandé
- `expected_improvement` : VARCHAR(100) - "Augmentation 15% taux réponse"
- `confidence_score` : DECIMAL(3,2) - Confiance IA (0.00-1.00)
- `ai_reasoning` : TEXT - Explication logique IA
- `status` : ENUM(pending, accepted, rejected, testing)
- `implemented_at` : TIMESTAMP
- `result_measured` : JSON - Résultats après implémentation
- `created_at` : TIMESTAMP
**Attributs :**
- `template_id` : UUID (PK)
- `company_id` : UUID (FK → Companies)
- `product_id` : UUID (FK → Products) - Optionnel
- `name` : VARCHAR(100)
- `channel` : ENUM(email, linkedin)
- `language` : VARCHAR(5)
- `subject_template` : VARCHAR(200)
- `content_template` : TEXT
- `variables` : JSON - Variables personnalisables
- `is_active` : BOOLEAN
- `created_at` : TIMESTAMP

---

## 📈 **ANALYTICS** *(Métriques et KPIs)*
**Attributs :**
- `analytics_id` : UUID (PK)
- `company_id` : UUID (FK → Companies)
- `date` : DATE
- `prospects_added` : INTEGER
- `messages_sent` : INTEGER
- `responses_received` : INTEGER
- `meetings_scheduled` : INTEGER
- `deals_closed` : INTEGER
- `revenue_generated` : DECIMAL(10,2)
- `response_rate` : DECIMAL(5,2) - Pourcentage
- `conversion_rate` : DECIMAL(5,2) - Pourcentage
- `created_at` : TIMESTAMP

---

## 🔗 **RELATIONS PRINCIPALES**

### **1-N (Un à plusieurs) :**
- **Companies** → **Users** *(Une entreprise a plusieurs utilisateurs)*
- **Companies** → **Prospects** *(Une entreprise a plusieurs prospects)*  
- **Companies** → **Products** *(Une entreprise vend plusieurs produits)*
- **Products** → **Prospects** *(Un produit cible plusieurs prospects)*
- **Prospects** → **Messages** *(Un prospect reçoit plusieurs messages)*
- **Prospects** → **Tasks** *(Un prospect génère plusieurs tâches)*
- **Prospects** → **Interactions** *(Un prospect a plusieurs interactions)*
- **Users** → **Tasks** *(Un user a plusieurs tâches assignées)*

### **N-N (Plusieurs à plusieurs) :**
- **Users** ↔ **Prospects** *(via Tasks - plusieurs users peuvent travailler sur un prospect)*

---

## 🔐 **SÉCURITÉ MULTI-TENANT**

### **Isolation des données :**
- Chaque requête DOIT inclure `company_id`
- Index composés sur `(company_id, autre_champ)`
- Middleware de sécurité pour vérifier les permissions

### **Exemple de requête sécurisée :**
```sql
SELECT * FROM prospects 
WHERE company_id = :current_user_company_id 
AND status = 'a_contacter'
```

### **INDEX COMPOSITI CRITICI :**
```sql
-- Performance multi-tenant
CREATE INDEX idx_prospects_company_status ON prospects(company_id, status);
CREATE INDEX idx_messages_company_created ON messages(company_id, created_at DESC);
CREATE INDEX idx_tasks_assigned_status ON tasks(assigned_to, status, due_date);

-- Ricerche frequenti
CREATE INDEX idx_prospects_email ON prospects(email);
CREATE INDEX idx_prospects_company_name ON prospects(company_name);
CREATE INDEX idx_interactions_prospect_date ON interactions(prospect_id, interaction_date DESC);

-- Analytics e reporting
CREATE INDEX idx_analytics_company_date ON analytics(company_id, date DESC);
CREATE INDEX idx_audit_logs_company_created ON audit_logs(company_id, created_at DESC);
```

### **PARTITIONING STRATEGY :**
```sql
-- Partitioning per grandi tabelle
-- AUDIT_LOGS partizionato per mese
-- INTERACTIONS partizionato per trimestre
-- ANALYTICS partizionato per anno
```

### **VINCOLI DI INTEGRITÀ :**
```sql
-- Soft deletes per GDPR compliance
ALTER TABLE prospects ADD COLUMN deleted_at TIMESTAMP NULL;
ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMP NULL;

-- Check constraints
ALTER TABLE prospects ADD CONSTRAINT chk_ai_score 
    CHECK (ai_score >= 0 AND ai_score <= 100);
ALTER TABLE api_keys ADD CONSTRAINT chk_usage 
    CHECK (usage_current_month <= usage_limit_monthly);
```

### **Par client SaaS moyen :**
- **Prospects** : 1.000 - 10.000
- **Messages** : 2.000 - 20.000  
- **Tasks** : 500 - 5.000
- **Interactions** : 1.000 - 15.000

### **Plateforme totale (100 clients) :**
- **Prospects** : 100.000 - 1.000.000
- **Messages** : 200.000 - 2.000.000
- **Performance** : Index optimisés requis

---

*Cette ERD constitue la base technique pour le développement avec Windsurf*