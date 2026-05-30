export interface OpenClawMessage {
  role: "user" | "assistant";
  content: string;
}

export interface OpenClawContext {
  currentPage?: string;
  businessContext?: {
    companyDescription?: string;
    services?: string[];
    website?: string;
    contactEmail?: string;
    contactPhone?: string;
    niche?: string;
    responseStyle?: string;
    knowledgePages?: string[];
  };
  leadData?: {
    companyName: string;
    website: string | null;
    city: string | null;
    industry: string | null;
    overallScore: number | null;
    scorePriority: string | null;
    gmbRating: number | null;
    gmbReviewCount: number | null;
    painPoints?: string[];
    suggestedServices?: string[];
  };
  campaignData?: {
    name: string;
    niche: string | null;
    region: string | null;
    toneOfVoice: string | null;
  };
  settings?: {
    aggressiveness: string;
    tone: string;
    language: string;
    companyName?: string;
  };
  bookingsAssist?: {
    timezone: string;
    googleSyncEnabled: boolean;
    googleOAuthConnected: boolean;
    googleServiceAccountConfigured: boolean;
    calendarId: string;
    activeWeekdayLabels: string;
    durationMinutes: number;
    slotMinutes: number;
    minimumNoticeHours: number;
    maximumHorizonDays: number;
    publicTenantConfigured: boolean;
    defaultEventType: {
      slug: string;
      name: string;
      enabledRuleCount: number;
      rulesSyncedFromSettings: boolean;
    } | null;
    nextSevenDays: Array<{
      date: string;
      status: string;
      availableSlots: number;
      totalSlots: number;
    }>;
    googleCalendarProbe: {
      enabled: boolean;
      readable: boolean;
      upcomingEventsNext7Days: number;
    };
    checklist: string[];
  };
}

export type OpenClawProvider = "anthropic" | "openai" | "deepseek";

export interface OpenClawConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  provider?: OpenClawProvider;
}

export interface EmailDraftSuggestion {
  subject: string;
  body: string;
  reasoning: string;
}

export interface LeadAnalysis {
  summary: string;
  opportunities: string[];
  risks: string[];
  suggestedApproach: string;
  confidence: number;
}

export interface NicheSuggestion {
  niche: string;
  region: string;
  reasoning: string;
  estimatedOpportunity: "high" | "medium" | "low";
}
