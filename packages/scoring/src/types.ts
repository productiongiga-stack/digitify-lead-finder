export interface ScoringWeightConfig {
  factorKey: string;
  label: string;
  weight: number;
  maxPoints: number;
  enabled: boolean;
  category: string | null;
}

export interface LeadData {
  companyName: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  gmbRating: number | null;
  gmbReviewCount: number | null;
  gmbCategories: string[];
  facebookUrl: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  tiktokUrl: string | null;
  youtubeUrl: string | null;
}

export interface EnrichmentPayload {
  website_analysis?: {
    hasSSL: boolean;
    isMobileFriendly: boolean;
    loadTimeMs: number;
    hasMetaTitle: boolean;
    hasMetaDescription: boolean;
    hasH1: boolean;
    hasStructuredData: boolean;
    hasFavicon: boolean;
    hasAnalytics: boolean;
    hasCTA: boolean;
    contentLength: number;
    lastModified: string | null;
    technologies: string[];
  };
  social_analysis?: {
    facebookFollowers: number | null;
    instagramFollowers: number | null;
    linkedinFollowers: number | null;
    lastPostDate: string | null;
  };
}

export interface FactorResult {
  rawValue: number;
  explanation: string;
  metadata?: Record<string, unknown>;
}

export interface ScoringFactorResult {
  factorKey: string;
  rawValue: number;
  weightedValue: number;
  explanation: string;
  metadata?: Record<string, unknown>;
}

export interface ScoringResult {
  overallScore: number;
  priority: "Hot" | "Warm" | "Low";
  factors: ScoringFactorResult[];
  painPoints: string[];
  suggestedServices: string[];
  bestNextAction: string;
  computedAt: Date;
}

export interface ScoringInput {
  lead: LeadData;
  enrichment: EnrichmentPayload;
  weights: ScoringWeightConfig[];
}

export type FactorFunction = (lead: LeadData, enrichment: EnrichmentPayload) => FactorResult;
