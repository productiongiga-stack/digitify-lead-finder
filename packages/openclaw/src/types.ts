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
}

export interface OpenClawConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
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
