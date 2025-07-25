## 🎯 PROJECT: Plateforme SaaS d'Intelligence Commerciale pour l'Immobilier Français

### 🔴 **MUST HAVE - Core MVP (Spr
## DOCUMENT 4: BLUEPRINT

```markdown
# BLUEPRINT - TECHNICAL ARCHITECTURE

##  SYSTEM ARCHITECTURE

```mermaid
graph TB
    subgraph "Frontend - Nuxt 3"
        UI[UI Components]
        Store[Pinia Store]
        RT[Realtime Subscriptions]
    end
    
    subgraph "Backend - NestJS"
        API[REST API]
        GQL[GraphQL API]
        WS[WebSocket Gateway]
        EventBus[Event Emitter]
        
        subgraph "Services"
            Auth[Auth Service]
            Prospects[Prospects Service]
            Intel[Intelligence Service]
            Email[Email Service]
        end
        
        subgraph "Event Handlers"
            EH1[Prospect Handlers]
            EH2[Email Handlers]
            EH3[Intelligence Handlers]
        end
    end
    
    subgraph "Data Layer - Supabase"
        PG[PostgreSQL]
        RLS[Row Level Security]
        Realtime[Realtime Engine]
        Storage[File Storage]
    end
    
    subgraph "External Services"
        OpenAI[OpenAI API]
        SendGrid[SendGrid API]
        Stripe[Stripe API]
        INSEE[INSEE API]
    end
    
    UI --> API
    UI --> RT
    RT --> Realtime
    API --> Services
    Services --> PG
    Services --> EventBus
    EventBus --> Event Handlers
    Intel --> OpenAI
    Email --> SendGrid
 SECURITY ARCHITECTURE
typescript
// Multi-tenant Security
interface SecurityContext {
  userId: string;
  companyId: string;
  role: 'owner' | 'director' | 'manager' | 'agent' | 'assistant';
  permissions: string[];
}

// NestJS Guard
@Injectable()
export class CompanyGuard implements CanActivate {
  async canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const companyId = request.params.companyId || request.body.companyId;
    
    // Verify user belongs to company
    return user.companyId === companyId;
  }
}

// Supabase RLS
CREATE POLICY "company_isolation" ON ALL TABLES
FOR ALL USING (company_id = auth.jwt() ->> 'company_id'::uuid);
 SCALABILITY DESIGN
typescript
// Event Processing at Scale
interface ScalabilityConfig {
  eventProcessing: {
    batchSize: 1000;
    parallelism: 10;
    retryPolicy: {
      maxAttempts: 3;
      backoffMultiplier: 2;
    };
  };
  caching: {
    provider: 'Redis';
    ttl: 3600;
    strategies: ['lazy-loading', 'write-through'];
  };
  database: {
    connectionPool: 100;
    readReplicas: 2;
    partitioning: 'by_company_id';
  };
}

## 📨 MESSAGE QUEUE ARCHITECTURE

### **Technology Choice: Redis Streams → Kafka Migration Path**

```typescript
interface QueueStrategy {
  // Phase 1 (MVP): Redis Streams
  mvp: {
    technology: 'Redis Streams';
    reasoning: [
      'Already in stack for caching',
      'Low operational overhead',
      'Good enough for <100k messages/day',
      'Built-in persistence'
    ];
  };
  
  // Phase 2 (Scale): Kafka
  scale: {
    technology: 'Apache Kafka';
    triggerPoint: '1M+ messages/day OR 500+ companies';
    reasoning: [
      'True distributed streaming',
      'Guaranteed message ordering',
      'Replay capability',
      'Multi-datacenter support'
    ];
  };
}
Redis Streams Implementation (MVP)
typescript
@Injectable()
export class RedisQueueService {
  private redis: Redis;
  private consumerGroup = 'ai-sales-assistant';
  
  constructor(private config: ConfigService) {
    this.redis = new Redis({
      host: config.get('REDIS_HOST'),
      port: config.get('REDIS_PORT'),
      maxRetriesPerRequest: 3
    });
    
    this.initializeStreams();
  }
  
  private async initializeStreams() {
    const streams = [
      'email:queue',
      'enrichment:queue',
      'ai:generation:queue',
      'webhook:queue'
    ];
    
    for (const stream of streams) {
      try {
        await this.redis.xgroup('CREATE', stream, this.consumerGroup, '$', 'MKSTREAM');
      } catch (err) {
        // Group already exists, ignore
      }
    }
  }
  
  // Producer
  async publishToQueue(queue: string, data: any, options?: QueueOptions): Promise<string> {
    const id = await this.redis.xadd(
      queue,
      '*', // Auto-generate ID
      'data', JSON.stringify(data),
      'timestamp', Date.now().toString(),
      'retries', '0',
      'priority', (options?.priority || 'normal')
    );
    
    return id;
  }
  
  // Consumer
  async consumeFromQueue(queue: string, callback: (data: any) => Promise<void>) {
    while (true) {
      try {
        const messages = await this.redis.xreadgroup(
          'GROUP', this.consumerGroup,
          'consumer-' + process.pid,
          'COUNT', 10,
          'BLOCK', 5000, // Block for 5 seconds
          'STREAMS', queue, '>'
        );
        
        if (messages && messages[0]) {
          const [stream, streamMessages] = messages[0];
          
          for (const message of streamMessages) {
            const [id, fields] = message;
            const data = JSON.parse(fields[1]); // fields = ['data', '{...}']
            
            try {
              await callback(data);
              await this.redis.xack(queue, this.consumerGroup, id);
            } catch (error) {
              await this.handleFailure(queue, id, fields, error);
            }
          }
        }
      } catch (error) {
        this.logger.error('Queue consumer error', error);
        await this.delay(5000);
      }
    }
  }
  
  private async handleFailure(queue: string, messageId: string, fields: string[], error: any) {
    const retries = parseInt(fields[5]) || 0; // fields[4] = 'retries', fields[5] = count
    
    if (retries < 3) {
      // Retry with exponential backoff
      const delay = Math.pow(2, retries) * 1000;
      setTimeout(() => {
        this.redis.xadd(
          queue,
          '*',
          'data', fields[1],
          'timestamp', fields[3],
          'retries', (retries + 1).toString(),
          'priority', fields[7],
          'original_id', messageId
        );
      }, delay);
    } else {
      // Move to dead letter queue
      await this.redis.xadd(
        `${queue}:dlq`,
        '*',
        'data', fields[1],
        'error', error.message,
        'failed_at', Date.now().toString(),
        'original_queue', queue
      );
    }
    
    // Acknowledge to prevent reprocessing
    await this.redis.xack(queue, this.consumerGroup, messageId);
  }
}
Queue Definitions & Priorities
typescript
enum QueueName {
  EMAIL_SEND = 'email:send',
  EMAIL_TRACK = 'email:track',
  AI_GENERATION = 'ai:generation',
  PROSPECT_ENRICHMENT = 'prospect:enrichment',
  WEBHOOK_DELIVERY = 'webhook:delivery',
  REPORT_GENERATION = 'report:generation',
  BULK_IMPORT = 'bulk:import'
}

enum QueuePriority {
  CRITICAL = 'critical',  // User-facing, sync operations
  HIGH = 'high',         // User-facing, async operations  
  NORMAL = 'normal',     // Background tasks
  LOW = 'low'           // Batch operations
}

interface QueueConfig {
  [QueueName.EMAIL_SEND]: {
    priority: QueuePriority.HIGH;
    maxRetries: 3;
    timeout: 30000; // 30s
    concurrency: 10;
  };
  
  [QueueName.AI_GENERATION]: {
    priority: QueuePriority.CRITICAL;
    maxRetries: 2;
    timeout: 60000; // 60s
    concurrency: 5; // Rate limit protection
  };
  
  [QueueName.PROSPECT_ENRICHMENT]: {
    priority: QueuePriority.NORMAL;
    maxRetries: 5;
    timeout: 120000; // 2min
    concurrency: 20;
  };
  
  [QueueName.BULK_IMPORT]: {
    priority: QueuePriority.LOW;
    maxRetries: 1;
    timeout: 600000; // 10min
    concurrency: 2;
  };
}
Worker Pool Management
typescript
@Injectable()
export class WorkerPoolService {
  private workers: Map<string, Worker[]> = new Map();
  
  async startWorkers() {
    const workerConfigs = [
      { queue: QueueName.EMAIL_SEND, count: 5, handler: EmailWorker },
      { queue: QueueName.AI_GENERATION, count: 3, handler: AIWorker },
      { queue: QueueName.PROSPECT_ENRICHMENT, count: 10, handler: EnrichmentWorker },
      { queue: QueueName.BULK_IMPORT, count: 2, handler: ImportWorker }
    ];
    
    for (const config of workerConfigs) {
      const workers = [];
      
      for (let i = 0; i < config.count; i++) {
        const worker = new config.handler(this.queueService);
        await worker.start();
        workers.push(worker);
      }
      
      this.workers.set(config.queue, workers);
    }
  }
  
  // Dynamic scaling based on queue size
  @Cron('*/30 * * * * *') // Every 30 seconds
  async autoScale() {
    for (const [queue, workers] of this.workers.entries()) {
      const queueSize = await this.queueService.getQueueSize(queue);
      const avgProcessingTime = await this.metrics.getAvgProcessingTime(queue);
      
      const optimalWorkers = Math.ceil(
        (queueSize * avgProcessingTime) / 30000 // Target 30s max wait
      );
      
      if (optimalWorkers > workers.length) {
        await this.scaleUp(queue, optimalWorkers - workers.length);
      } else if (optimalWorkers < workers.length - 2) {
        await this.scaleDown(queue, workers.length - optimalWorkers);
      }
    }
  }
}
Future Kafka Migration
typescript
// Kafka configuration for future scale
interface KafkaConfig {
  brokers: ['kafka1:9092', 'kafka2:9092', 'kafka3:9092'];
  
  topics: {
    'email.events': {
      partitions: 12,
      replicationFactor: 3,
      retentionMs: 604800000, // 7 days
    },
    'ai.generation': {
      partitions: 6,
      replicationFactor: 3,
      retentionMs: 86400000, // 1 day
    },
    'prospect.updates': {
      partitions: 24,
      replicationFactor: 3,
      retentionMs: 2592000000, // 30 days
    }
  };
  
  consumerGroups: {
    'email-processor': {
      sessionTimeout: 30000,
      rebalanceTimeout: 60000,
      maxPollRecords: 100
    },
    'ai-processor': {
      sessionTimeout: 60000,
      rebalanceTimeout: 120000,
      maxPollRecords: 10
    }
  };
}

// Migration strategy
class RedisToKafkaMigration {
  async migrate() {
    // Step 1: Dual publish
    this.enableDualPublish(); // Publish to both Redis and Kafka
    
    // Step 2: Migrate consumers gradually
    await this.migrateConsumers([
      { queue: 'email:send', topic: 'email.events', percentage: 10 },
      { queue: 'email:send', topic: 'email.events', percentage: 50 },
      { queue: 'email:send', topic: 'email.events', percentage: 100 }
    ]);
    
    // Step 3: Verify and switch
    await this.verifyKafkaProcessing();
    await this.disableRedisPublishing();
  }
}
Queue Monitoring
typescript
interface QueueMetrics {
  queueSize: Gauge;           // Current messages in queue
  processingTime: Histogram;   // Time to process message
  errorRate: Counter;         // Failed messages
  throughput: Counter;        // Messages/second
}

@Injectable()
export class QueueMonitoringService {
  async getQueueHealth(): Promise<QueueHealth> {
    const queues = Object.values(QueueName);
    const health = {};
    
    for (const queue of queues) {
      const size = await this.redis.xlen(queue);
      const oldestMessage = await this.redis.xrange(queue, '-', '+', 'COUNT', 1);
      const consumerInfo = await this.redis.xinfo('CONSUMERS', queue, this.consumerGroup);
      
      health[queue] = {
        size,
        oldestMessageAge: oldestMessage[0] 
          ? Date.now() - parseInt(oldestMessage[0][1][3]) 
          : 0,
        activeConsumers: consumerInfo.length,
        status: this.calculateStatus(size, oldestMessage)
      };
    }
    
    return health;
  }
  
  private calculateStatus(size: number, oldestMessage: any): 'healthy' | 'warning' | 'critical' {
    if (size > 10000) return 'critical';
    if (size > 1000) return 'warning';
    
    const age = oldestMessage[0] ? Date.now() - parseInt(oldestMessage[0][1][3]) : 0;
    if (age > 300000) return 'critical'; // >5 min
    if (age > 60000) return 'warning';   // >1 min
    
    return 'healthy';
  }
}
## 💰 OPENAI COST MANAGEMENT

### **Cost Control Architecture**

```typescript
interface OpenAICostConfig {
  // Model pricing (as of 2024)
  pricing: {
    'gpt-4-turbo': { input: 0.01, output: 0.03 }, // per 1K tokens
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 }
  };
  
  // Limits per plan
  limits: {
    trial: { dailyTokens: 10000, model: 'gpt-3.5-turbo' },
    starter: { dailyTokens: 50000, model: 'gpt-3.5-turbo' },
    growth: { dailyTokens: 200000, model: 'gpt-4-turbo' },
    scale: { dailyTokens: 1000000, model: 'gpt-4-turbo' }
  };
  
  // Cost targets
  targets: {
    maxCostPerMessage: 0.02, // €0.02 max
    maxCostPerCustomer: 5.00, // €5/month max
    marginTarget: 0.80 // 80% profit margin on AI costs
  };
}
Token Usage Tracking
typescript
@Injectable()
export class TokenTrackingService {
  constructor(
    private db: DatabaseService,
    private cache: CacheService
  ) {}
  
  async trackUsage(
    companyId: string,
    usage: {
      model: string;
      promptTokens: number;
      completionTokens: number;
      totalCost: number;
    }
  ): Promise<void> {
    // Real-time tracking
    await this.cache.increment(
      `tokens:daily:${companyId}:${this.getToday()}`,
      usage.promptTokens + usage.completionTokens
    );
    
    // Persistent storage
    await this.db.query(`
      INSERT INTO ai_usage (
        company_id, model, prompt_tokens, 
        completion_tokens, total_cost, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      companyId, usage.model, usage.promptTokens,
      usage.completionTokens, usage.totalCost
    ]);
    
    // Check limits
    await this.checkAndEnforceLimits(companyId);
  }
  
  async checkAndEnforceLimits(companyId: string): Promise<boolean> {
    const dailyUsage = await this.cache.get(
      `tokens:daily:${companyId}:${this.getToday()}`
    );
    
    const company = await this.getCompanyPlan(companyId);
    const limit = this.config.limits[company.plan].dailyTokens;
    
    if (dailyUsage >= limit) {
      await this.notifyLimitReached(companyId);
      return false; // Block further usage
    }
    
    if (dailyUsage >= limit * 0.8) {
      await this.notifyApproachingLimit(companyId);
    }
    
    return true;
  }
}
Smart Prompt Optimization
typescript
@Injectable()
export class PromptOptimizationService {
  // Compress prompts to reduce tokens
  optimizePrompt(originalPrompt: string): string {
    return originalPrompt
      // Remove redundant spaces
      .replace(/\s+/g, ' ')
      // Use abbreviations
      .replace(/For example/g, 'E.g.')
      .replace(/In other words/g, 'I.e.')
      // Remove filler words
      .replace(/\b(very|really|actually|basically)\b/g, '')
      // Compress instructions
      .replace(/Please make sure to/g, 'Must')
      .trim();
  }
  
  // Dynamic prompt templates based on cost
  async selectPromptStrategy(
    companyId: string,
    messageType: string
  ): Promise<PromptStrategy> {
    const monthlySpend = await this.getMonthlySpend(companyId);
    const budgetRemaining = await this.getBudgetRemaining(companyId);
    
    if (budgetRemaining < 10) {
      return {
        model: 'gpt-3.5-turbo',
        strategy: 'minimal',
        maxTokens: 150,
        temperature: 0.3,
        systemPrompt: this.getMinimalSystemPrompt()
      };
    }
    
    if (monthlySpend > 50) {
      return {
        model: 'gpt-3.5-turbo',
        strategy: 'balanced',
        maxTokens: 300,
        temperature: 0.7,
        systemPrompt: this.getBalancedSystemPrompt()
      };
    }
    
    return {
      model: 'gpt-4-turbo',
      strategy: 'premium',
      maxTokens: 500,
      temperature: 0.8,
      systemPrompt: this.getPremiumSystemPrompt()
    };
  }
  
  // Batch similar requests
  async batchSimilarPrompts(
    prompts: Array<{id: string; prompt: string}>
  ): Promise<Map<string, string>> {
    // Group by similarity
    const groups = this.groupBySimilarity(prompts);
    const results = new Map<string, string>();
    
    for (const group of groups) {
      if (group.length === 1) {
        // Single prompt, process normally
        const response = await this.processPrompt(group[0].prompt);
        results.set(group[0].id, response);
      } else {
        // Batch process
        const batchPrompt = this.createBatchPrompt(group);
        const batchResponse = await this.processPrompt(batchPrompt);
        const parsed = this.parseBatchResponse(batchResponse);
        
        group.forEach((item, index) => {
          results.set(item.id, parsed[index]);
        });
      }
    }
    
    return results;
  }
}
Cost-Effective Caching
typescript
@Injectable()
export class AIResponseCache {
  private readonly CACHE_VERSION = 'v1';
  
  async getCachedOrGenerate(
    prompt: string,
    context: any,
    generator: () => Promise<string>
  ): Promise<{ response: string; cached: boolean; cost: number }> {
    // Create cache key from prompt + context
    const cacheKey = this.generateCacheKey(prompt, context);
    
    // Check cache
    const cached = await this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      return {
        response: cached.response,
        cached: true,
        cost: 0
      };
    }
    
    // Check if similar prompt was recently processed
    const similar = await this.findSimilarResponse(prompt);
    if (similar && this.similarityScore(prompt, similar.prompt) > 0.9) {
      const adapted = this.adaptResponse(similar.response, context);
      return {
        response: adapted,
        cached: true,
        cost: 0
      };
    }
    
    // Generate new response
    const start = Date.now();
    const response = await generator();
    const duration = Date.now() - start;
    
    // Cache if generation was expensive
    if (duration > 1000 || this.estimateCost(prompt) > 0.01) {
      await this.cache.set(cacheKey, {
        prompt,
        response,
        context,
        version: this.CACHE_VERSION,
        createdAt: Date.now()
      }, 86400); // 24h cache
    }
    
    return {
      response,
      cached: false,
      cost: this.estimateCost(prompt)
    };
  }
  
  private generateCacheKey(prompt: string, context: any): string {
    const normalized = prompt
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    const contextKey = Object.keys(context)
      .sort()
      .map(k => `${k}:${context[k]}`)
      .join('|');
    
    return crypto
      .createHash('sha256')
      .update(`${normalized}|${contextKey}`)
      .digest('hex');
  }
}
Cost Monitoring Dashboard
typescript
interface CostMetrics {
  current: {
    todaySpend: number;
    monthSpend: number;
    avgCostPerMessage: number;
    avgTokensPerMessage: number;
  };
  
  projections: {
    monthEndEstimate: number;
    budgetBurnRate: number; // % per day
    daysUntilBudgetExhausted: number;
  };
  
  optimization: {
    cacheHitRate: number;
    promptCompressionRatio: number;
    batchingEfficiency: number;
  };
  
  byCompany: Array<{
    companyId: string;
    companyName: string;
    monthlySpend: number;
    messagesGenerated: number;
    avgCostPerMessage: number;
    plan: string;
    profitMargin: number;
  }>;
}

@Injectable()
export class CostMonitoringService {
  @Cron('0 * * * *') // Every hour
  async calculateMetrics(): Promise<void> {
    const metrics = await this.gatherMetrics();
    
    // Alert if burn rate too high
    if (metrics.projections.budgetBurnRate > 5) {
      await this.alertHighBurnRate(metrics);
    }
    
    // Auto-optimize if costs too high
    if (metrics.current.avgCostPerMessage > 0.02) {
      await this.enableCostSavingMode();
    }
    
    // Store metrics
    await this.storeMetrics(metrics);
  }
  
  async enableCostSavingMode(): Promise<void> {
    await this.config.update({
      defaultModel: 'gpt-3.5-turbo',
      maxTokensPerRequest: 200,
      aggressiveCaching: true,
      batchingEnabled: true,
      promptCompression: 'aggressive'
    });
    
    await this.notifyAdmins('Cost saving mode enabled due to high AI costs');
  }
}
Fallback Strategies
typescript
@Injectable()
export class AIFallbackService {
  async generateWithFallback(
    prompt: string,
    context: any
  ): Promise<string> {
    const strategies = [
      () => this.generateWithOpenAI(prompt, context),
      () => this.generateWithCachedTemplates(prompt, context),
      () => this.generateWithRules(prompt, context),
      () => this.generateBasicTemplate(context)
    ];
    
    for (const strategy of strategies) {
      try {
        return await strategy();
      } catch (error) {
        this.logger.warn(`Strategy failed: ${error.message}`);
        continue;
      }
    }
    
    throw new Error('All generation strategies failed');
  }
  
  private async generateWithCachedTemplates(
    prompt: string,
    context: any
  ): Promise<string> {
    // Use pre-generated templates with variable substitution
    const template = await this.findBestTemplate(context);
    return this.substituteVariables(template, context);
  }
  
  private generateWithRules(prompt: string, context: any): string {
    // Rule-based generation for common scenarios
    if (context.messageType === 'first_contact') {
      return this.firstContactTemplate(context);
    }
    
    if (context.messageType === 'follow_up') {
      return this.followUpTemplate(context);
    }
    
    return this.genericTemplate(context);
  }
}
Budget Allocation Algorithm
typescript
@Injectable()
export class AIBudgetAllocator {
  async allocateDailyBudget(): Promise<Map<string, number>> {
    const companies = await this.getActiveCompanies();
    const totalDailyBudget = 100; // €100/day for AI
    
    const allocations = new Map<string, number>();
    
    // Priority-based allocation
    const priorities = companies.map(company => ({
      companyId: company.id,
      score: this.calculatePriorityScore(company),
      requestedTokens: this.estimateDailyTokens(company)
    }));
    
    // Sort by priority
    priorities.sort((a, b) => b.score - a.score);
    
    let remainingBudget = totalDailyBudget;
    
    for (const item of priorities) {
      const companyBudget = Math.min(
        item.requestedTokens * 0.00002, // Estimated cost
        remainingBudget * (item.score / 100),
        5.00 // Max €5/day per company
      );
      
      allocations.set(item.companyId, companyBudget);
      remainingBudget -= companyBudget;
      
      if (remainingBudget <= 0) break;
    }
    
    return allocations;
  }
  
  private calculatePriorityScore(company: any): number {
    let score = 0;
    
    // Plan-based priority
    score += {
      'trial': 10,
      'starter': 30,
      'growth': 60,
      'scale': 100
    }[company.plan] || 0;
    
    // Activity-based boost
    if (company.lastActiveToday) score += 20;
    
    // Revenue-based boost
    score += Math.min(company.monthlyRevenue / 10, 50);
    
    return Math.min(score, 100);
  }
}
 PROJECT STRUCTURE
ai-sales-assistant/
 backend/
    src/
       common/
          decorators/
          filters/
          guards/
          pipes/
       modules/
          auth/
          companies/
          prospects/
          intelligence/
          messaging/
          campaigns/
          analytics/
       events/
          handlers/
          processors/
       database/
          migrations/
          seeds/
       app.module.ts
       main.ts
    test/
    package.json

 frontend/
    pages/
       index.vue
       dashboard.vue
       prospects/
       campaigns/
       settings/
    components/
       common/
       prospects/
       campaigns/
       analytics/
    composables/
       useAuth.ts
       useProspects.ts
       useRealtime.ts
    stores/
    plugins/
    nuxt.config.ts

 shared/
    types/
    constants/
    utils/

 docker/
    Dockerfile.backend
    Dockerfile.frontend
    docker-compose.yml

 docs/
     api/
     deployment/
     architecture/

## 🔀 DATABASE SHARDING STRATEGY

### **Sharding Architecture for 1M+ Prospects**

```typescript
// Sharding Strategy: Company-based partitioning
interface ShardingConfig {
  strategy: 'COMPANY_HASH';  // Shard by company_id
  shardCount: 16;            // Start with 16 shards
  replicationFactor: 2;      // Each shard replicated 2x
  
  // Shard distribution
  shardMap: {
    shard_00: { range: '00-0F', primary: 'db1', replica: 'db2' },
    shard_01: { range: '10-1F', primary: 'db2', replica: 'db3' },
    // ... etc
  };
}

// Shard Router
@Injectable()
export class ShardRouter {
  getShardForCompany(companyId: string): string {
    // Use last 2 chars of UUID for distribution
    const hash = companyId.slice(-2);
    const shardIndex = parseInt(hash, 16) % this.config.shardCount;
    return `shard_${shardIndex.toString().padStart(2, '0')}`;
  }
  
  async routeQuery(companyId: string, query: string): Promise<any> {
    const shard = this.getShardForCompany(companyId);
    const connection = await this.getConnection(shard);
    return connection.query(query);
  }
}

Table Partitioning Strategy 
-- Prospects table partitioned by company_id hash
CREATE TABLE prospects (
    -- columns as before
) PARTITION BY HASH (company_id);

-- Create 16 partitions
CREATE TABLE prospects_p00 PARTITION OF prospects
    FOR VALUES WITH (modulus 16, remainder 0);
CREATE TABLE prospects_p01 PARTITION OF prospects
    FOR VALUES WITH (modulus 16, remainder 1);
-- ... continue for all 16 partitions

-- Messages table partitioned by created_at (time-based)
CREATE TABLE messages (
    -- columns as before
) PARTITION BY RANGE (created_at);

-- Monthly partitions
CREATE TABLE messages_2024_01 PARTITION OF messages
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE messages_2024_02 PARTITION OF messages
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
-- Auto-create future partitions

-- Events table partitioned by occurred_at + company_id
CREATE TABLE events (
    -- columns as before
) PARTITION BY RANGE (occurred_at, company_id);

Cross-Shard Query Handling 
@Injectable()
export class CrossShardQueryService {
  async executeAcrossShards(query: string, params: any[]): Promise<any[]> {
    // For admin/analytics queries that span multiple shards
    const promises = this.shards.map(shard => 
      this.executeOnShard(shard, query, params)
    );
    
    const results = await Promise.all(promises);
    return this.mergeResults(results);
  }
  
  async getGlobalAnalytics(): Promise<GlobalStats> {
    // Use read replicas for analytics
    const stats = await this.executeAcrossShards(
      `SELECT 
        COUNT(DISTINCT company_id) as total_companies,
        COUNT(*) as total_prospects,
        AVG(lead_score) as avg_lead_score
      FROM prospects
      WHERE created_at > NOW() - INTERVAL '30 days'`,
      []
    );
    
    return this.aggregateStats(stats);
  }
}

Supabase-Specific Sharding 
// Since Supabase doesn't support native sharding,
// we implement application-level sharding

@Injectable()
export class SupabaseShardingService {
  private connections: Map<string, SupabaseClient> = new Map();
  
  constructor(private config: ConfigService) {
    this.initializeShards();
  }
  
  private initializeShards() {
    // For Supabase, we can use:
    // 1. Multiple projects (true sharding)
    // 2. Table prefixing (pseudo-sharding)
    // 3. Row-level partitioning
    
    // Option 1: Multiple Supabase projects
    const shardConfigs = [
      { url: process.env.SUPABASE_SHARD_1_URL, key: process.env.SUPABASE_SHARD_1_KEY },
      { url: process.env.SUPABASE_SHARD_2_URL, key: process.env.SUPABASE_SHARD_2_KEY },
      // ... more shards
    ];
    
    shardConfigs.forEach((config, index) => {
      const client = createClient(config.url, config.key);
      this.connections.set(`shard_${index}`, client);
    });
  }
  
  getShardClient(companyId: string): SupabaseClient {
    const shardKey = this.calculateShard(companyId);
    return this.connections.get(shardKey)!;
  }
  
  // Option 2: Logical sharding with table prefixes
  async queryWithPrefix(companyId: string, table: string, query: any) {
    const prefix = this.getTablePrefix(companyId);
    const prefixedTable = `${prefix}_${table}`;
    
    return this.supabase
      .from(prefixedTable)
      .select(query.select)
      .eq('company_id', companyId);
  }
}

Data Distribution Strategy 
interface DataDistribution {
  // Hot Data (Last 90 days) - Keep in primary shards
  hotDataStrategy: {
    tables: ['prospects', 'messages', 'tasks'],
    retention: 90, // days
    storage: 'SSD',
    replication: 'sync'
  };
  
  // Warm Data (90 days - 1 year) - Move to secondary storage
  warmDataStrategy: {
    tables: ['events', 'analytics_snapshots'],
    retention: 365, // days
    storage: 'HDD',
    replication: 'async',
    compression: 'enabled'
  };
  
  // Cold Data (>1 year) - Archive
  coldDataStrategy: {
    tables: ['audit_logs', 'historical_events'],
    retention: 'indefinite',
    storage: 'S3',
    access: 'on-demand'
  };
}

// Automated data lifecycle management
@Injectable()
export class DataLifecycleService {
  @Cron('0 2 * * *') // Run at 2 AM daily
  async moveDataToWarmStorage() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    
    // Move old messages to warm storage
    await this.db.query(`
      INSERT INTO messages_warm 
      SELECT * FROM messages 
      WHERE created_at < $1
    `, [cutoffDate]);
    
    // Delete from hot storage
    await this.db.query(`
      DELETE FROM messages 
      WHERE created_at < $1
    `, [cutoffDate]);
  }
}

Scaling Triggers 
# Automatic scaling rules
scaling_rules:
  prospects_table:
    trigger: "table_size > 100GB OR row_count > 10M"
    action: "add_partition"
    
  company_growth:
    trigger: "company_count > 1000"
    action: "evaluate_dedicated_shard"
    
  read_performance:
    trigger: "avg_query_time > 100ms"
    action: "add_read_replica"
    
  write_performance:
    trigger: "write_queue_size > 1000"
    action: "increase_connection_pool"

Migration Strategy 
// Zero-downtime migration to sharded architecture
class ShardingMigration {
  async execute() {
    // Phase 1: Dual-write
    await this.enableDualWrite(); // Write to both old and new
    
    // Phase 2: Backfill
    await this.backfillHistoricalData(); // Copy existing data
    
    // Phase 3: Verify
    await this.verifyDataConsistency(); // Ensure no data loss
    
    // Phase 4: Switch reads
    await this.switchReadsToShards(); // Start reading from shards
    
    // Phase 5: Stop dual-write
    await this.disableDualWrite(); // Write only to shards
    
    // Phase 6: Cleanup
    await this.cleanupOldTables(); // Remove old tables
  }
}

 EVENT-DRIVEN IMPLEMENTATION
Event Flow Architecture
typescript
// 1. Event Definition
export interface DomainEvent<T = any> {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: string;
  payload: T;
  metadata: EventMetadata;
  occurredAt: Date;
}

export interface EventMetadata {
  userId: string;
  companyId: string;
  correlationId: string;
  causationId: string;
  version: number;
}

// 2. Event Publisher
@Injectable()
export class EventPublisher {
  constructor(
    private eventEmitter: EventEmitter2,
    private eventStore: EventStoreService
  ) {}

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    // Save to event store
    await this.eventStore.append(event);
    
    // Emit for handlers
    this.eventEmitter.emit(event.type, event);
    
    // Emit wildcard for monitors
    this.eventEmitter.emit('*', event);
  }
}

// 3. Event Handler Example
@Injectable()
export class ProspectEnrichmentHandler {
  constructor(
    private intelligenceService: IntelligenceService,
    private eventPublisher: EventPublisher
  ) {}

  @OnEvent('prospect.created')
  async handleProspectCreated(event: DomainEvent<ProspectCreatedPayload>) {
    const { prospectId, companyId } = event.payload;
    
    try {
      // Enrich prospect
      const enrichment = await this.intelligenceService.enrichProspect(prospectId);
      
      // Publish success event
      await this.eventPublisher.publish({
        type: 'prospect.enriched',
        aggregateId: prospectId,
        aggregateType: 'prospect',
        payload: enrichment,
        metadata: {
          ...event.metadata,
          causationId: event.id
        }
      });
    } catch (error) {
      // Publish failure event
      await this.eventPublisher.publish({
        type: 'prospect.enrichment.failed',
        aggregateId: prospectId,
        aggregateType: 'prospect',
        payload: { error: error.message },
        metadata: {
          ...event.metadata,
          causationId: event.id
        }
      });
    }
  }
}
Event Store Implementation
typescript
@Injectable()
export class EventStoreService {
  constructor(private supabase: SupabaseService) {}

  async append(event: DomainEvent): Promise<void> {
    const { error } = await this.supabase.client
      .from('events')
      .insert({
        event_type: event.type,
        aggregate_id: event.aggregateId,
        aggregate_type: event.aggregateType,
        company_id: event.metadata.companyId,
        payload: event.payload,
        metadata: event.metadata,
        occurred_at: event.occurredAt
      });

    if (error) {
      throw new EventStoreError(`Failed to append event: ${error.message}`);
    }
  }

  async getEvents(
    aggregateId: string,
    options: { fromVersion: number; toVersion: number }
  ): Promise<DomainEvent[]> {
    let query = this.supabase.client
      .from('events')
      .select('*')
      .eq('aggregate_id', aggregateId)
      .order('occurred_at', { ascending: true });

    if (options.fromVersion) {
      query = query.gte('metadata->version', options.fromVersion);
    }

    if (options.toVersion) {
      query = query.lte('metadata->version', options.toVersion);
    }

    const { data, error } = await query;

    if (error) {
      throw new EventStoreError(`Failed to get events: ${error.message}`);
    }

    return data.map(this.toDomainEvent);
  }

  async replay(
    filter: { type: string; from: Date; to: Date },
    handler: (event: DomainEvent) => Promise<void>
  ): Promise<void> {
    // Implementation for event replay
  }
}

@Injectable()
export class BillingService {
  async checkPaymentStatus(): Promise<void> {
    // Cron job quotidien
    const overdueInvoices = await this.getOverdueInvoices();
    
    for (const invoice of overdueInvoices) {
      const daysPastDue = this.calculateDaysPastDue(invoice);
      const rule = await this.getApplicableRule(daysPastDue);
      
      switch (rule.action) {
        case 'send_reminder':
          await this.sendPaymentReminder(invoice);
          break;
        case 'suspend':
          await this.suspendAccount(invoice.company_id);
          break;
        case 'cancel':
          await this.cancelAccount(invoice.company_id);
          break;
      }
    }
  }
  
  async suspendAccount(companyId: string): Promise<void> {
    // Update subscription status
    await this.db.subscriptions.update({
      where: { company_id: companyId },
      data: { status: 'suspended' }
    });
    
    // Emit event
    this.eventBus.emit('account.suspended', { companyId });
    
    // Notify user
    await this.emailService.sendAccountSuspended(companyId);
  }
}

## 🛡️ ERROR HANDLING & RESILIENCE

### **Circuit Breaker Pattern**

```typescript
import { Injectable, ServiceUnavailableException } from '@nestjs/common';

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
}

@Injectable()
export class CircuitBreaker {
  private failures = 0;
  private successCount = 0;
  private lastFailTime: Date | null = null;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private readonly options: CircuitBreakerOptions = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      halfOpenRequests: 3
    }
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => T
  ): Promise<T> {
    // Check circuit state
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        if (fallback) return fallback();
        throw new ServiceUnavailableException('Service temporarily unavailable');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback) return fallback();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.options.halfOpenRequests) {
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailTime = new Date();
    
    if (this.failures >= this.options.failureThreshold) {
      this.state = 'OPEN';
      this.successCount = 0;
    }
  }

  private shouldAttemptReset(): boolean {
    return (
      this.lastFailTime &&
      Date.now() - this.lastFailTime.getTime() >= this.options.resetTimeout
    );
  }
}

@Injectable()
export class OpenAIService {
  private circuitBreaker: CircuitBreaker;
  
  constructor(
    private cache: CacheService,
    private config: ConfigService
  ) {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000,
      halfOpenRequests: 2
    });
  }

  async generateMessage(prompt: string): Promise<string> {
    // Check cache first
    const cacheKey = `ai:${this.hashPrompt(prompt)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // Execute with circuit breaker
    const result = await this.circuitBreaker.execute(
      async () => {
        return await this.callOpenAI(prompt);
      },
      () => {
        // Fallback to template-based generation
        return this.generateFallbackMessage(prompt);
      }
    );

    // Cache successful result
    await this.cache.set(cacheKey, result, 3600); // 1 hour
    return result;
  }

  private async callOpenAI(prompt: string): Promise<string> {
    try {
      const response = await openai.createCompletion({
        model: 'gpt-4',
        prompt,
        max_tokens: 500,
        temperature: 0.7
      });
      
      return response.choices[0].text;
    } catch (error) {
      // Log for monitoring
      this.logger.error('OpenAI API Error', {
        error: error.message,
        prompt: prompt.substring(0, 100)
      });
      throw error;
    }
  }

  private generateFallbackMessage(prompt: string): string {
    // Basic template-based fallback
    return `Bonjour, nous serions ravis de discuter de vos besoins. 
            Pouvons-nous planifier un appel cette semaine?`;
  }
}

@Injectable()
export class RetryService {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      initialDelay = 1000,
      maxDelay = 30000,
      exponentialBase = 2,
      shouldRetry = (error) => true
    } = options;

    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (!shouldRetry(error) || attempt === maxAttempts) {
          throw error;
        }

        const delay = Math.min(
          initialDelay * Math.pow(exponentialBase, attempt - 1),
          maxDelay
        );

        await this.delay(delay);
      }
    }

    throw lastError!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  exponentialBase?: number;
  shouldRetry?: (error: Error) => boolean;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: LoggerService,
    private readonly sentry: SentryService
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = this.getStatus(exception);
    const message = this.getMessage(exception);
    const errorId = uuidv4();

    // Log error
    this.logger.error({
      errorId,
      status,
      message,
      stack: exception instanceof Error ? exception.stack : undefined,
      request: {
        method: request.method,
        url: request.url,
        body: request.body,
        userId: request.user?.id,
        companyId: request.user?.companyId
      }
    });

    // Send to Sentry for critical errors
    if (status >= 500) {
      this.sentry.captureException(exception, {
        tags: { errorId },
        user: { id: request.user?.id },
        extra: { request: request.url }
      });
    }

    response.status(status).json({
      statusCode: status,
      message: this.getSafeMessage(status, message),
      errorId,
      timestamp: new Date().toISOString()
    });
  }

  private getStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getMessage(exception: unknown): string {
    if (exception instanceof Error) {
      return exception.message;
    }
    return 'Internal server error';
  }

  private getSafeMessage(status: number, message: string): string {
    // Don't expose internal errors to users
    if (status >= 500) {
      return 'An error occurred processing your request';
    }
    return message;
  }
}

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private redis: RedisHealthIndicator,
    private http: HttpHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Database
      () => this.db.pingCheck('database'),
      
      // Redis
      () => this.redis.pingCheck('redis'),
      
      // External APIs
      () => this.http.pingCheck('openai', 'https://api.openai.com/v1/models'),
      () => this.http.pingCheck('sendgrid', 'https://api.sendgrid.com/v3/health'),
      
      // Custom checks
      () => this.checkDiskSpace(),
      () => this.checkMemoryUsage(),
      () => this.checkQueueSize()
    ]);
  }

  private async checkDiskSpace(): Promise<HealthIndicatorResult> {
    const usage = await diskusage.check('/');
    const percentUsed = (usage.used / usage.total) * 100;
    
    return {
      disk: {
        status: percentUsed < 80 ? 'up' : 'down',
        percentUsed
      }
    };
  }
}

 REAL ESTATE INTELLIGENCE ENGINE
typescript
// Core Intelligence Service
@Injectable()
export class RealEstateIntelligenceService {
  constructor(
    private scraperService: ScraperService,
    private marketDataService: MarketDataService,
    private scoringService: ScoringService,
    private openAIService: OpenAIService
  ) {}

  async analyzeAgency(agencyId: string): Promise<AgencyIntelligence> {
    // 1. Get base data
    const agency = await this.getAgencyData(agencyId);
    
    // 2. Enrich with external data
    const enrichment = await this.enrichAgencyData(agency);
    
    // 3. Calculate scores
    const scores = await this.calculateScores(enrichment);
    
    // 4. Generate insights
    const insights = await this.generateInsights(enrichment, scores);
    
    // 5. Recommend actions
    const recommendations = await this.generateRecommendations(insights);
    
    return {
      agency,
      enrichment,
      scores,
      insights,
      recommendations,
      confidence: this.calculateConfidence(enrichment)
    };
  }

  private async enrichAgencyData(agency: Agency): Promise<AgencyEnrichment> {
    const [
      websiteData,
      portalPresence,
      marketData,
      competitorData
    ] = await Promise.all([
      this.scraperService.analyzeWebsite(agency.website),
      this.checkPortalPresence(agency),
      this.marketDataService.getLocalMarketData(agency.postalCode),
      this.analyzeCompetitors(agency)
    ]);

    return {
      digitalFootprint: {
        ...websiteData,
        portals: portalPresence,
        socialMedia: await this.checkSocialMedia(agency)
      },
      marketPosition: {
        localMarketShare: this.calculateMarketShare(agency, marketData),
        competitorAnalysis: competitorData,
        pricingPosition: this.analyzePricing(agency, marketData)
      },
      businessMetrics: {
        estimatedRevenue: this.estimateRevenue(agency),
        growthRate: this.calculateGrowthRate(agency),
        efficiency: this.calculateEfficiency(agency)
      }
    };
  }

  private async generateInsights(
    enrichment: AgencyEnrichment,
    scores: AgencyScores
  ): Promise<AgencyInsights> {
    const prompt = `
      Analyze this real estate agency data and provide strategic insights:
      
      Digital Presence: ${JSON.stringify(enrichment.digitalFootprint)}
      Market Position: ${JSON.stringify(enrichment.marketPosition)}
      Scores: ${JSON.stringify(scores)}
      
      Provide insights on:
      1. Main pain points
      2. Growth opportunities
      3. Competitive advantages
      4. Technology gaps
      5. Optimal approach strategy
    `;

    const completion = await this.openAIService.complete(prompt);
    
    return this.parseInsights(completion);
  }
}
 DEPLOYMENT ARCHITECTURE
yaml
# Production Infrastructure
production:
  frontend:
    provider: Vercel
    regions: [eu-west-1]
    cdn: true
    env:
      - NUXT_PUBLIC_SUPABASE_URL
      - NUXT_PUBLIC_SUPABASE_ANON_KEY
  
  backend:
    provider: Scaleway
    type: Kubernetes
    replicas:
      min: 2
      max: 10
    resources:
      cpu: 1
      memory: 2Gi
  
  database:
    provider: Supabase
    plan: Pro
    backup:
      frequency: daily
      retention: 30
  
  redis:
    provider: Upstash
    plan: Pay-as-you-go
    eviction: allkeys-lru
  
  monitoring:
    - Sentry (errors)
    - Plausible (analytics)
    - Better Stack (uptime)
 TESTING STRATEGY
typescript
// Testing Pyramid
const testingStrategy = {
  unit: {
    coverage: 80,
    tools: ['Jest', 'Testing Library'],
    focus: ['Services', 'Utils', 'Validators']
  },
  
  integration: {
    coverage: 60,
    tools: ['Supertest', 'Test Containers'],
    focus: ['API Endpoints', 'Database', 'Events']
  },
  
  e2e: {
    coverage: 40,
    tools: ['Playwright', 'Cypress'],
    focus: ['Critical Paths', 'User Journeys']
  },
  
  performance: {
    tools: ['k6', 'Artillery'],
    metrics: ['Response Time', 'Throughput', 'Error Rate']
  }
};
 CI/CD PIPELINE
yaml
# GitHub Actions Workflow
name: Deploy
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
      - name: Install deps
        run: npm ci
      - name: Lint
        run: npm run lint
      - name: Test
        run: npm run test:ci
      - name: Build
        run: npm run build

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy Backend
        run: |
          docker build -t backend .
          docker push registry/backend
          kubectl rollout restart deployment/backend
      
      - name: Deploy Frontend
        run: |
          vercel --prod
 MONITORING & OBSERVABILITY
typescript
// Structured Logging
interface LogContext {
  traceId: string;
  spanId: string;
  userId: string;
  companyId: string;
  event: string;
  duration: number;
  error: any;
}

// Metrics Collection
@Injectable()
export class MetricsService {
  private metrics = {
    prospects_imported: new Counter({
      name: 'prospects_imported_total',
      help: 'Total prospects imported',
      labelNames: ['company_id', 'source']
    }),
    
    messages_sent: new Counter({
      name: 'messages_sent_total',
      help: 'Total messages sent',
      labelNames: ['company_id', 'channel']
    }),
    
    api_duration: new Histogram({
      name: 'api_request_duration_seconds',
      help: 'API request duration',
      labelNames: ['method', 'endpoint', 'status']
    }),
    
    active_users: new Gauge({
      name: 'active_users',
      help: 'Currently active users',
      labelNames: ['plan']
    })
  };
  
  trackEvent(eventType: string, labels: Record<string, string>) {
    this.metrics.prospects_imported.inc(labels);
  }
}
 DEVELOPMENT WORKFLOW
yaml
# Development Pipeline
development:
  local:
    - npm run dev (frontend + backend)
    - Supabase local emulator
    - Hot reload enabled
  
  testing:
    - Unit tests (Jest)
    - Integration tests (Supertest)
    - E2E tests (Playwright)
    
  staging:
    - Automatic deployment on PR
    - Preview URLs
    - Smoke tests
    
  production:
    - Blue-green deployment
    - Health checks
    - Rollback capability

ERROR HANDLING & RESILIENCE 
// Circuit Breaker per API esterne
@Injectable()
export class CircuitBreaker {
  private failures = 0;
  private lastFailTime: Date;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN' && !this.shouldRetry()) {
      throw new ServiceUnavailableException();
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}

// Cache per ridurre dipendenze esterne
@Injectable()
export class IntelligenceCache {
  constructor(private redis: Redis) {}
  
  async getOrFetch(key: string, fetcher: () => Promise<any>): Promise<any> {
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);
    
    const data = await fetcher();
    await this.redis.setex(key, 3600, JSON.stringify(data));
    return data;
  }
}



BLUEPRINT
├── SYSTEM ARCHITECTURE
├── SECURITY ARCHITECTURE  
├── SCALABILITY DESIGN
├── PROJECT STRUCTURE
├── EVENT-DRIVEN IMPLEMENTATION
├── ERROR HANDLING & RESILIENCE  ← QUI (nuova sezione)
│   ├── Circuit Breaker Pattern
│   ├── External API Protection
│   ├── Multi-Level Caching Strategy
│   ├── Retry Logic with Exponential Backoff
│   ├── Global Error Handler
│   └── Health Check System
├── REAL ESTATE INTELLIGENCE ENGINE
├── DEPLOYMENT ARCHITECTURE
├── TESTING STRATEGY
├── CI/CD PIPELINE
├── MONITORING & OBSERVABILITY
└── DEVELOPMENT WORKFLOWint 1-4)**

#### **Infrastructure SaaS Multi-Tenant**
- **Architecture NestJS** avec TypeScript côté backend
- **Frontend Nuxt 3** avec Tailwind CSS
- **Supabase** pour base de données PostgreSQL + Realtime
- **Row Level Security** pour isolation des données par agence
- **Authentification** sécurisée avec Supabase Auth

#### **Intelligence Immobilière France**
- **Analyse des agences** : taille, spécialisation, performance digitale
- **Scoring intelligent** des prospects basé sur :
  - Maturité digitale actuelle
  - Volume de transactions
  - Présence sur portails (SeLoger, LeBonCoin, PAP)
  - Signaux d'achat (recherches, comparaisons CRM)
- **Détection des moments clés** :
  - Rentrée septembre (planification annuelle)
  - Janvier (nouveaux budgets)
  - Baisse du marché (besoin d'efficacité)

#### **Import et Enrichissement des Données**
- **Import CSV/Excel** des contacts agences
- **Enrichissement automatique** via APIs publiques :
  - SIREN/SIRET pour données entreprise
  - Scraping sites agences pour portfolio
  - Analyse présence digitale
- **Déduplication intelligente** par email/téléphone/SIRET

#### **Génération de Messages IA**
- **Templates spécifiques immobilier** :
  - Agents indépendants vs Agences
  - Résidentiel vs Commercial
  - Neuf vs Ancien
- **Personnalisation contextuelle** :
  - Référence aux biens en portefeuille
  - Mention des outils actuels
  - Adaptation au cycle immobilier
- **Multilingue** : Français prioritaire, Anglais pour luxe international

#### **Suivi ROI et Performance**
- **Dashboard temps réel** :
  - Taux d'ouverture par segment
  - Conversions prospect → demo → client
  - ROI calculé automatiquement
- **Attribution revenue** : quel message génère quelles ventes
- **Rapports hebdomadaires** automatiques par email

### 🟡 **SHOULD HAVE - Avantage Concurrentiel (Sprint 5-8)**

#### **Event-Driven Architecture**
- **Event Bus** avec Redis Streams
- **Event Store** dans Supabase pour historique complet
- **Processing asynchrone** des tâches lourdes
- **Webhooks** pour intégrations externes

#### **Intégrations Écosystème Immobilier**
- **Portails immobiliers** :
  - Export automatique vers SeLoger Pro
  - Synchronisation annonces
  - Import leads portails
- **CRM Immobilier** :
  - Apimo, Perizia, Hektor
  - Sync bidirectionnelle contacts
  - Historique interactions

#### **Intelligence Comportementale**
- **Lead scoring avancé** basé sur :
  - Interactions email/site web
  - Recherches effectuées
  - Demandes d'information
- **Prédiction** meilleur moment de contact
- **Recommandations** d'approche commerciale

#### **Campagnes Multi-Canal**
- **Email** : séquences automatisées
- **SMS** : rappels et alertes
- **LinkedIn** : messages personnalisés
- **Orchestration** intelligente des canaux

### 🟢 **COULD HAVE - Leadership Marché (Sprint 9-12)**

#### **Marketplace de Templates**
- **Bibliothèque** de messages performants
- **Partage** entre utilisateurs (opt-in)
- **Analytics** sur performance templates
- **Système de rewards** pour contributeurs

#### **Intelligence Marché Avancée**
- **Données marché** par ville/quartier :
  - Prix au m²
  - Délais de vente
  - Taux de commission
- **Analyse concurrentielle** locale
- **Tendances** et prédictions marché

#### **Features IA Avancées**
- **Coach IA** pour améliorer les messages
- **A/B testing** automatique
- **Optimisation** continue par ML
- **Chatbot** pour qualification leads

#### **Mobile et Intégrations**
- **App mobile** (PWA Nuxt)
- **API publique** RESTful
- **Webhooks** Zapier/Make
- **Widget** intégrable site agence

### ⚪ **WON'T HAVE - Hors Périmètre**

- **Gestion complète des biens** (ce n'est pas un logiciel de transaction)
- **Visite virtuelle** ou 3D
- **Signature électronique** de mandats/compromis
- **Comptabilité** d'agence
- **Téléphonie VOIP** intégrée
- **Gestion des diagnostics** immobiliers

## 📊 Métriques de Succès

### **KPIs Techniques**
- Uptime: 99.9%
- Temps de réponse API: <200ms
- Taux d'erreur: <0.1%
- Délai génération message IA: <3s

### **KPIs Business**
- Time-to-value: <24h
- Taux d'adoption: >80% après onboarding
- Churn mensuel: <5%
- NPS: >50

### **KPIs Immobilier**
- Taux de conversion prospect → client: >15%
- Augmentation leads qualifiés: +40%
- ROI moyen par agence: 5-10x
- Temps de cycle de vente: -30%