export interface WebsiteAnalysis {
  url: string;
  statusCode: number;
  hasSSL: boolean;
  isMobileFriendly: boolean;
  loadTimeMs: number;
  hasMetaTitle: boolean;
  metaTitle: string | null;
  hasMetaDescription: boolean;
  metaDescription: string | null;
  hasH1: boolean;
  h1Text: string | null;
  hasStructuredData: boolean;
  hasFavicon: boolean;
  hasAnalytics: boolean;
  hasCTA: boolean;
  contentLength: number;
  lastModified: string | null;
  technologies: string[];
  socialLinks: {
    facebook: string | null;
    instagram: string | null;
    linkedin: string | null;
    twitter: string | null;
    youtube: string | null;
    tiktok: string | null;
  };
  contactInfo: {
    emails: string[];
    phones: string[];
  };
  uxAudit: {
    linkCount: number;
    internalLinkCount: number;
    buttonCount: number;
    formCount: number;
    imagesTotal: number;
    imagesMissingAlt: number;
    pageProbes: {
      url: string;
      statusCode: number;
      ok: boolean;
      error?: string;
    }[];
    pagesChecked: number;
    pagesBroken: number;
  };
  errors: string[];
}

export interface ConnectorResult {
  source: string;
  data: Record<string, unknown>;
  fetchedAt: Date;
}
