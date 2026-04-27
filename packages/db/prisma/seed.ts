import { PrismaClient, UserRole, LeadStatus, CampaignStatus, ActivityType } from "@prisma/client";
import { scryptSync, randomBytes } from "crypto";

const prisma = new PrismaClient();

function userSettingKey(userId: string, key: string) {
  return `user:${userId}:${key.trim()}`;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  console.log("Seeding database...");

  // Create owner user — explicit credentials are required to avoid accidental demo accounts.
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() || "";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD?.trim() || "";
  if (!adminEmail || !adminPassword) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required for db seed.");
  }
  if (adminPassword.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters.");
  }
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Admin",
      passwordHash: hashPassword(adminPassword),
      emailVerified: new Date(),
      role: UserRole.OWNER,
    },
  });

  // Create pipeline stages
  const stages = [
    { name: "New", color: "#6366f1", sortOrder: 0, isDefault: true },
    { name: "Reviewed", color: "#8b5cf6", sortOrder: 1 },
    { name: "Contacted", color: "#f59e0b", sortOrder: 2 },
    { name: "Responded", color: "#10b981", sortOrder: 3 },
    { name: "Qualified", color: "#06b6d4", sortOrder: 4 },
    { name: "Proposal Sent", color: "#3b82f6", sortOrder: 5 },
    { name: "Won", color: "#22c55e", sortOrder: 6 },
    { name: "Lost", color: "#ef4444", sortOrder: 7 },
  ];

  const createdStages: Record<string, string> = {};
  for (const stage of stages) {
    const s = await prisma.pipelineStage.upsert({
      where: { createdById_name: { createdById: admin.id, name: stage.name } },
      update: { ...stage, createdById: admin.id },
      create: { ...stage, createdById: admin.id },
    });
    createdStages[stage.name] = s.id;
  }

  // Create scoring weights
  const weights = [
    { factorKey: "has_website", label: "Has Website", description: "Whether the business has a website", weight: 1.5, maxPoints: 10, category: "web_presence", sortOrder: 0 },
    { factorKey: "website_quality", label: "Website Quality", description: "SSL, mobile-friendly, load speed", weight: 2.0, maxPoints: 10, category: "web_presence", sortOrder: 1 },
    { factorKey: "seo_basics", label: "SEO Basics", description: "Meta tags, H1, structured data", weight: 1.5, maxPoints: 10, category: "web_presence", sortOrder: 2 },
    { factorKey: "gmb_completeness", label: "GMB Completeness", description: "Google Business Profile filled out", weight: 1.0, maxPoints: 10, category: "reputation", sortOrder: 3 },
    { factorKey: "gmb_rating", label: "GMB Rating", description: "Google star rating (low = opportunity)", weight: 1.0, maxPoints: 10, category: "reputation", sortOrder: 4 },
    { factorKey: "review_count", label: "Review Count", description: "Number of reviews (low = opportunity)", weight: 1.0, maxPoints: 10, category: "reputation", sortOrder: 5 },
    { factorKey: "social_presence", label: "Social Presence", description: "Active social media profiles", weight: 0.8, maxPoints: 10, category: "social", sortOrder: 6 },
    { factorKey: "social_activity", label: "Social Activity", description: "Posting recency and frequency", weight: 0.5, maxPoints: 10, category: "social", sortOrder: 7 },
    { factorKey: "content_freshness", label: "Content Freshness", description: "Last blog/site update age", weight: 0.8, maxPoints: 10, category: "freshness", sortOrder: 8 },
    { factorKey: "local_seo", label: "Local SEO", description: "NAP consistency, local citations", weight: 1.0, maxPoints: 10, category: "web_presence", sortOrder: 9 },
  ];

  for (const w of weights) {
    await prisma.scoringWeight.upsert({
      where: { factorKey: w.factorKey },
      update: w,
      create: w,
    });
  }

  // Create tags
  const tags = [
    { name: "Hot Lead", color: "#ef4444" },
    { name: "Warm Lead", color: "#f59e0b" },
    { name: "Cold Lead", color: "#6b7280" },
    { name: "Webdesign", color: "#3b82f6" },
    { name: "SEO", color: "#8b5cf6" },
    { name: "Social Media", color: "#ec4899" },
    { name: "Google Ads", color: "#10b981" },
    { name: "Branding", color: "#f97316" },
    { name: "Horeca", color: "#14b8a6" },
    { name: "Bouw", color: "#a855f7" },
    { name: "Transport", color: "#06b6d4" },
    { name: "Retail", color: "#84cc16" },
  ];

  const createdTags: Record<string, string> = {};
  for (const t of tags) {
    const tag = await prisma.tag.upsert({
      where: { createdById_name: { createdById: admin.id, name: t.name } },
      update: { ...t, createdById: admin.id },
      create: { ...t, createdById: admin.id },
    });
    createdTags[t.name] = tag.id;
  }

  // Create default service catalog
  await prisma.serviceCatalog.createMany({
    data: [
      {
        createdById: admin.id,
        category: "webdesign",
        name: "Website basis",
        description: "Snelle, professionele website met sterke basisstructuur.",
        basePrice: 1490,
        unit: "per project",
        isActive: true,
        sortOrder: 0,
      },
      {
        createdById: admin.id,
        category: "marketing",
        name: "SEO kickstart",
        description: "Technische optimalisaties en lokale zichtbaarheid.",
        basePrice: 690,
        unit: "per maand",
        isActive: true,
        sortOrder: 1,
      },
      {
        createdById: admin.id,
        category: "extras",
        name: "Maandelijkse optimalisatie",
        description: "Doorlopende verbeteringen en rapportage.",
        basePrice: 290,
        unit: "per maand",
        isActive: true,
        sortOrder: 2,
      },
    ],
    skipDuplicates: true,
  });

  // Create campaigns
  const campaign1 = await prisma.campaign.create({
    data: {
      name: "Webdesign Gent",
      description: "Webdesign leads in de regio Gent",
      niche: "Webdesign",
      region: "Gent, Oost-Vlaanderen",
      targetAudience: "KMO's zonder moderne website",
      idealScore: 70,
      desiredServices: ["Website redesign", "Mobile optimization", "SEO basics"],
      toneOfVoice: "Professioneel maar toegankelijk",
      goal: "20 nieuwe leads per maand",
      status: CampaignStatus.ACTIVE,
      createdById: admin.id,
    },
  });

  const campaign2 = await prisma.campaign.create({
    data: {
      name: "SEO Antwerpen",
      description: "SEO leads in groot Antwerpen",
      niche: "SEO",
      region: "Antwerpen",
      targetAudience: "Bedrijven met website maar zwakke SEO",
      idealScore: 65,
      desiredServices: ["Technical SEO", "Content strategy", "Local SEO"],
      toneOfVoice: "Data-driven en resultaatgericht",
      goal: "15 gekwalificeerde leads per maand",
      status: CampaignStatus.ACTIVE,
      createdById: admin.id,
    },
  });

  const campaign3 = await prisma.campaign.create({
    data: {
      name: "Social Media Brusselse Horeca",
      description: "Social media management voor horeca in Brussel",
      niche: "Social Media",
      region: "Brussel",
      targetAudience: "Restaurants en cafés zonder actieve social media",
      idealScore: 60,
      desiredServices: ["Social media management", "Content creation", "Instagram marketing"],
      toneOfVoice: "Creatief en energiek",
      goal: "10 leads per maand",
      status: CampaignStatus.DRAFT,
      createdById: admin.id,
    },
  });

  // Create sample leads
  const leads = [
    {
      companyName: "Bakkerij Van Damme",
      website: "https://bakkerijvandamme.be",
      phone: "+32 9 123 45 67",
      email: "info@bakkerijvandamme.be",
      industry: "Horeca",
      city: "Gent",
      state: "Oost-Vlaanderen",
      country: "België",
      zipCode: "9000",
      gmbRating: 4.2,
      gmbReviewCount: 28,
      overallScore: 78,
      scorePriority: "Hot",
      status: LeadStatus.NEW,
      source: "google_maps",
      facebookUrl: "https://facebook.com/bakkerijvandamme",
    },
    {
      companyName: "Loodgieter Peeters",
      website: null,
      phone: "+32 3 234 56 78",
      email: "peeters.loodgieter@gmail.com",
      industry: "Bouw",
      city: "Antwerpen",
      state: "Antwerpen",
      country: "België",
      zipCode: "2000",
      gmbRating: 3.8,
      gmbReviewCount: 12,
      overallScore: 92,
      scorePriority: "Hot",
      status: LeadStatus.NEW,
      source: "google_maps",
    },
    {
      companyName: "Restaurant Le Petit Bruxellois",
      website: "https://lepetitbruxellois.be",
      phone: "+32 2 345 67 89",
      email: "contact@lepetitbruxellois.be",
      industry: "Horeca",
      city: "Brussel",
      state: "Brussel",
      country: "België",
      zipCode: "1000",
      gmbRating: 4.5,
      gmbReviewCount: 156,
      overallScore: 45,
      scorePriority: "Low",
      status: LeadStatus.QUALIFIED,
      source: "google_search",
      facebookUrl: "https://facebook.com/lepetitbruxellois",
      instagramUrl: "https://instagram.com/lepetitbruxellois",
    },
    {
      companyName: "Garage Janssens",
      website: "https://garagejanssens.be",
      phone: "+32 9 456 78 90",
      email: "info@garagejanssens.be",
      industry: "Automotive",
      city: "Gent",
      state: "Oost-Vlaanderen",
      country: "België",
      zipCode: "9000",
      gmbRating: 3.2,
      gmbReviewCount: 8,
      overallScore: 85,
      scorePriority: "Hot",
      status: LeadStatus.CONTACTED,
      source: "google_maps",
    },
    {
      companyName: "Kapsalon Belleza",
      website: null,
      phone: "+32 3 567 89 01",
      email: null,
      industry: "Beauty",
      city: "Antwerpen",
      state: "Antwerpen",
      country: "België",
      zipCode: "2018",
      gmbRating: 4.0,
      gmbReviewCount: 45,
      overallScore: 88,
      scorePriority: "Hot",
      status: LeadStatus.NEW,
      source: "google_maps",
      instagramUrl: "https://instagram.com/kapsalonbelleza",
    },
    {
      companyName: "Elektricien De Smet",
      website: "https://desmet-elektricien.be",
      phone: "+32 9 678 90 12",
      email: "info@desmet-elektricien.be",
      industry: "Bouw",
      city: "Aalst",
      state: "Oost-Vlaanderen",
      country: "België",
      zipCode: "9300",
      gmbRating: 4.8,
      gmbReviewCount: 67,
      overallScore: 52,
      scorePriority: "Warm",
      status: LeadStatus.RESEARCHING,
      source: "google_search",
      facebookUrl: "https://facebook.com/desmtelektricien",
    },
    {
      companyName: "Transport Maes",
      website: "https://transportmaes.be",
      phone: "+32 2 789 01 23",
      email: "dispatch@transportmaes.be",
      industry: "Transport",
      city: "Mechelen",
      state: "Antwerpen",
      country: "België",
      zipCode: "2800",
      gmbRating: 3.5,
      gmbReviewCount: 5,
      overallScore: 74,
      scorePriority: "Warm",
      status: LeadStatus.NEW,
      source: "google_search",
      linkedinUrl: "https://linkedin.com/company/transportmaes",
    },
    {
      companyName: "Immokantoor Verstraete",
      website: "https://immoverstraete.be",
      phone: "+32 9 890 12 34",
      email: "info@immoverstraete.be",
      industry: "Real Estate",
      city: "Brugge",
      state: "West-Vlaanderen",
      country: "België",
      zipCode: "8000",
      gmbRating: 4.1,
      gmbReviewCount: 23,
      overallScore: 67,
      scorePriority: "Warm",
      status: LeadStatus.RESPONDED,
      source: "google_maps",
      facebookUrl: "https://facebook.com/immoverstraete",
      linkedinUrl: "https://linkedin.com/company/immoverstraete",
    },
    {
      companyName: "Drukkerij Claes",
      website: null,
      phone: "+32 16 901 23 45",
      email: "info@drukkerijclaes.be",
      industry: "Print & Media",
      city: "Leuven",
      state: "Vlaams-Brabant",
      country: "België",
      zipCode: "3000",
      gmbRating: 3.0,
      gmbReviewCount: 3,
      overallScore: 91,
      scorePriority: "Hot",
      status: LeadStatus.NEW,
      source: "google_maps",
    },
    {
      companyName: "Advocatenkantoor Willems",
      website: "https://advocaatwillems.be",
      phone: "+32 3 012 34 56",
      email: "secretariaat@advocaatwillems.be",
      industry: "Legal",
      city: "Antwerpen",
      state: "Antwerpen",
      country: "België",
      zipCode: "2000",
      gmbRating: 4.6,
      gmbReviewCount: 34,
      overallScore: 41,
      scorePriority: "Low",
      status: LeadStatus.ARCHIVED,
      source: "google_search",
      linkedinUrl: "https://linkedin.com/company/advocaatwillems",
      facebookUrl: "https://facebook.com/advocaatwillems",
    },
    {
      companyName: "Tuinaanleg Vermeersch",
      website: null,
      phone: "+32 50 123 45 67",
      email: null,
      industry: "Tuinaanleg",
      city: "Kortrijk",
      state: "West-Vlaanderen",
      country: "België",
      zipCode: "8500",
      gmbRating: 4.3,
      gmbReviewCount: 19,
      overallScore: 86,
      scorePriority: "Hot",
      status: LeadStatus.NEW,
      source: "google_maps",
    },
    {
      companyName: "Fysiotherapie Centrum Gent",
      website: "https://fysiogent.be",
      phone: "+32 9 234 56 78",
      email: "afspraak@fysiogent.be",
      industry: "Healthcare",
      city: "Gent",
      state: "Oost-Vlaanderen",
      country: "België",
      zipCode: "9000",
      gmbRating: 4.7,
      gmbReviewCount: 89,
      overallScore: 38,
      scorePriority: "Low",
      status: LeadStatus.QUALIFIED,
      source: "google_search",
      facebookUrl: "https://facebook.com/fysiogent",
      instagramUrl: "https://instagram.com/fysiogent",
      linkedinUrl: "https://linkedin.com/company/fysiogent",
    },
    // Extra real-style Belgian leads
    {
      companyName: "Slagerij Demuynck",
      website: null,
      phone: "+32 56 21 34 56",
      email: null,
      industry: "Horeca",
      city: "Roeselare",
      state: "West-Vlaanderen",
      country: "België",
      zipCode: "8800",
      gmbRating: 4.4,
      gmbReviewCount: 31,
      overallScore: 89,
      scorePriority: "Hot",
      status: LeadStatus.NEW,
      source: "google_maps",
    },
    {
      companyName: "Schoonheidssalon Pure Glow",
      website: "https://pureglow.be",
      phone: "+32 3 830 12 45",
      email: "info@pureglow.be",
      industry: "Beauty",
      city: "Antwerpen",
      state: "Antwerpen",
      country: "België",
      zipCode: "2060",
      gmbRating: 4.9,
      gmbReviewCount: 112,
      overallScore: 42,
      scorePriority: "Low",
      status: LeadStatus.RESEARCHING,
      source: "google_maps",
      instagramUrl: "https://instagram.com/pureglowantwerp",
      facebookUrl: "https://facebook.com/pureglow.be",
    },
    {
      companyName: "Dakwerken Vandenberghe",
      website: null,
      phone: "+32 9 380 45 67",
      email: "dakwerkenvdb@gmail.com",
      industry: "Bouw",
      city: "Dendermonde",
      state: "Oost-Vlaanderen",
      country: "België",
      zipCode: "9200",
      gmbRating: 3.6,
      gmbReviewCount: 7,
      overallScore: 94,
      scorePriority: "Hot",
      status: LeadStatus.NEW,
      source: "google_maps",
    },
    {
      companyName: "Boekhouder Leysen & Partners",
      website: "https://leysenpartners.be",
      phone: "+32 14 58 90 12",
      email: "kantoor@leysenpartners.be",
      industry: "Financieel",
      city: "Turnhout",
      state: "Antwerpen",
      country: "België",
      zipCode: "2300",
      gmbRating: 4.1,
      gmbReviewCount: 15,
      overallScore: 71,
      scorePriority: "Warm",
      status: LeadStatus.NEW,
      source: "google_search",
      linkedinUrl: "https://linkedin.com/company/leysen-partners",
    },
    {
      companyName: "Pizzeria Da Marco",
      website: null,
      phone: "+32 2 512 34 56",
      email: null,
      industry: "Horeca",
      city: "Brussel",
      state: "Brussel",
      country: "België",
      zipCode: "1000",
      gmbRating: 4.3,
      gmbReviewCount: 203,
      overallScore: 76,
      scorePriority: "Hot",
      status: LeadStatus.NEW,
      source: "google_maps",
      facebookUrl: "https://facebook.com/damarcobrussels",
    },
    {
      companyName: "Rijschool TopDrive",
      website: "https://topdrive-rijschool.be",
      phone: "+32 15 42 78 90",
      email: "info@topdrive-rijschool.be",
      industry: "Onderwijs",
      city: "Mechelen",
      state: "Antwerpen",
      country: "België",
      zipCode: "2800",
      gmbRating: 3.9,
      gmbReviewCount: 54,
      overallScore: 68,
      scorePriority: "Warm",
      status: LeadStatus.NEW,
      source: "google_maps",
      facebookUrl: "https://facebook.com/topdrivemechelen",
    },
    {
      companyName: "Dierenarts Willockx",
      website: null,
      phone: "+32 52 21 56 78",
      email: "praktijk@willockx-vet.be",
      industry: "Healthcare",
      city: "Sint-Niklaas",
      state: "Oost-Vlaanderen",
      country: "België",
      zipCode: "9100",
      gmbRating: 4.6,
      gmbReviewCount: 38,
      overallScore: 83,
      scorePriority: "Hot",
      status: LeadStatus.NEW,
      source: "google_maps",
    },
    {
      companyName: "Fietsenmaker Velodroom",
      website: "https://velodroom.be",
      phone: "+32 9 225 67 89",
      email: "hallo@velodroom.be",
      industry: "Retail",
      city: "Gent",
      state: "Oost-Vlaanderen",
      country: "België",
      zipCode: "9000",
      gmbRating: 4.8,
      gmbReviewCount: 76,
      overallScore: 48,
      scorePriority: "Low",
      status: LeadStatus.RESEARCHING,
      source: "google_search",
      instagramUrl: "https://instagram.com/velodroom.gent",
      facebookUrl: "https://facebook.com/velodroomgent",
    },
  ];

  const createdLeads = [];
  for (const leadData of leads) {
    const lead = await prisma.lead.create({
      data: {
        ...leadData,
        createdById: admin.id,
        pipelineStageId: createdStages["New"],
        scoreComputedAt: new Date(),
      },
    });
    createdLeads.push(lead);
  }

  // Add leads to campaigns
  await prisma.campaignLead.createMany({
    data: [
      { campaignId: campaign1.id, leadId: createdLeads[0].id },
      { campaignId: campaign1.id, leadId: createdLeads[3].id },
      { campaignId: campaign2.id, leadId: createdLeads[1].id },
      { campaignId: campaign2.id, leadId: createdLeads[5].id },
      { campaignId: campaign3.id, leadId: createdLeads[2].id },
    ],
  });

  // Add tags to leads
  await prisma.leadTag.createMany({
    data: [
      { leadId: createdLeads[0].id, tagId: createdTags["Hot Lead"] },
      { leadId: createdLeads[0].id, tagId: createdTags["Horeca"] },
      { leadId: createdLeads[1].id, tagId: createdTags["Hot Lead"] },
      { leadId: createdLeads[1].id, tagId: createdTags["Bouw"] },
      { leadId: createdLeads[1].id, tagId: createdTags["Webdesign"] },
      { leadId: createdLeads[2].id, tagId: createdTags["Cold Lead"] },
      { leadId: createdLeads[2].id, tagId: createdTags["Horeca"] },
      { leadId: createdLeads[3].id, tagId: createdTags["Hot Lead"] },
      { leadId: createdLeads[4].id, tagId: createdTags["Hot Lead"] },
      { leadId: createdLeads[6].id, tagId: createdTags["Warm Lead"] },
      { leadId: createdLeads[6].id, tagId: createdTags["Transport"] },
      { leadId: createdLeads[8].id, tagId: createdTags["Hot Lead"] },
      { leadId: createdLeads[10].id, tagId: createdTags["Hot Lead"] },
    ],
  });

  // Create sample activities
  for (const lead of createdLeads.slice(0, 5)) {
    await prisma.activity.create({
      data: {
        leadId: lead.id,
        userId: admin.id,
        type: ActivityType.LEAD_CREATED,
        title: `Lead "${lead.companyName}" aangemaakt`,
      },
    });
  }

  // Create email templates
  await prisma.emailTemplate.upsert({
    where: { createdById_name: { createdById: admin.id, name: "Intro - Webdesign" } },
    update: {
      name: "Intro - Webdesign",
      subject: "Betere online zichtbaarheid voor {{companyName}}?",
      body: `Beste {{contactName}},\n\nIk kwam {{companyName}} tegen en merkte op dat er enkele kansen zijn om uw online aanwezigheid te versterken.\n\n{{painPoints}}\n\nBij {{senderCompany}} helpen we bedrijven zoals het uwe om meer klanten aan te trekken via een professionele website en sterke online zichtbaarheid.\n\nZou u openstaan voor een kort gesprek van 15 minuten om te bekijken hoe we u kunnen helpen?\n\nMet vriendelijke groeten,\n{{senderName}}\n{{senderCompany}}`,
      isGlobal: false,
    },
    create: {
      createdById: admin.id,
      name: "Intro - Webdesign",
      subject: "Betere online zichtbaarheid voor {{companyName}}?",
      body: `Beste {{contactName}},\n\nIk kwam {{companyName}} tegen en merkte op dat er enkele kansen zijn om uw online aanwezigheid te versterken.\n\n{{painPoints}}\n\nBij {{senderCompany}} helpen we bedrijven zoals het uwe om meer klanten aan te trekken via een professionele website en sterke online zichtbaarheid.\n\nZou u openstaan voor een kort gesprek van 15 minuten om te bekijken hoe we u kunnen helpen?\n\nMet vriendelijke groeten,\n{{senderName}}\n{{senderCompany}}`,
      isGlobal: false,
    }
  });

  await prisma.emailTemplate.upsert({
    where: { createdById_name: { createdById: admin.id, name: "Intro - SEO" } },
    update: {
      name: "Intro - SEO",
      subject: "{{companyName}} beter vindbaar in Google?",
      body: `Beste {{contactName}},\n\nIk deed wat onderzoek naar {{companyName}} en zag dat er mogelijkheden zijn om beter gevonden te worden in Google.\n\n{{painPoints}}\n\nBij {{senderCompany}} helpen we bedrijven in {{city}} om hoger te scoren in Google en meer relevante bezoekers aan te trekken.\n\nInteresse in een gratis SEO-analyse? Ik stuur ze graag door.\n\nGroeten,\n{{senderName}}\n{{senderCompany}}`,
      isGlobal: false,
    },
    create: {
      createdById: admin.id,
      name: "Intro - SEO",
      subject: "{{companyName}} beter vindbaar in Google?",
      body: `Beste {{contactName}},\n\nIk deed wat onderzoek naar {{companyName}} en zag dat er mogelijkheden zijn om beter gevonden te worden in Google.\n\n{{painPoints}}\n\nBij {{senderCompany}} helpen we bedrijven in {{city}} om hoger te scoren in Google en meer relevante bezoekers aan te trekken.\n\nInteresse in een gratis SEO-analyse? Ik stuur ze graag door.\n\nGroeten,\n{{senderName}}\n{{senderCompany}}`,
      isGlobal: false,
    },
  });

  await prisma.emailTemplate.upsert({
    where: { createdById_name: { createdById: admin.id, name: "Follow-up 1" } },
    update: {
      name: "Follow-up 1",
      subject: "Re: {{previousSubject}}",
      body: `Beste {{contactName}},\n\nIk wilde even opvolgen op mijn vorige mail. Ik begrijp dat het druk kan zijn.\n\nKort samengevat: ik zag enkele concrete verbeterpunten voor {{companyName}} online en zou die graag even toelichten.\n\nPast het om deze week even kort te bellen?\n\nMet vriendelijke groeten,\n{{senderName}}\n{{senderCompany}}`,
      isGlobal: false,
    },
    create: {
      createdById: admin.id,
      name: "Follow-up 1",
      subject: "Re: {{previousSubject}}",
      body: `Beste {{contactName}},\n\nIk wilde even opvolgen op mijn vorige mail. Ik begrijp dat het druk kan zijn.\n\nKort samengevat: ik zag enkele concrete verbeterpunten voor {{companyName}} online en zou die graag even toelichten.\n\nPast het om deze week even kort te bellen?\n\nMet vriendelijke groeten,\n{{senderName}}\n{{senderCompany}}`,
      isGlobal: false,
    },
  });

  // Create sample notes
  await prisma.note.create({
    data: {
      leadId: createdLeads[0].id,
      userId: admin.id,
      content: "Website is oud en niet mobiel-vriendelijk. Grote kans op webdesign project. Eigenaar lijkt actief op Facebook.",
      isPinned: true,
    },
  });

  await prisma.note.create({
    data: {
      leadId: createdLeads[1].id,
      userId: admin.id,
      content: "Geen website! Alleen een Google Business pagina. Perfecte kandidaat voor een volledig webdesign + SEO pakket.",
      isPinned: true,
    },
  });

  // Create default settings
  const defaultSettings = [
    { key: "branding.company_name", value: "" },
    { key: "branding.primary_color", value: "#f9ae5a" },
    { key: "branding.logo_url", value: "" },
    { key: "email.provider", value: "smtp" },
    { key: "email.from_name", value: "" },
    { key: "email.from_email", value: "" },
    { key: "email.daily_limit", value: "50" },
    { key: "email.send_window_start", value: "09:00" },
    { key: "email.send_window_end", value: "17:00" },
    { key: "openclaw.enabled", value: "true" },
    { key: "openclaw.model", value: "claude-sonnet-4-20250514" },
    { key: "openclaw.aggressiveness", value: "balanced" },
    { key: "openclaw.tone", value: "professional" },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: userSettingKey(admin.id, setting.key) },
      update: { value: setting.value },
      create: { key: userSettingKey(admin.id, setting.key), value: setting.value },
    });
  }

  console.log("Seed completed!");
  console.log(`  - 1 owner user (${adminEmail})`);
  console.log(`  - ${stages.length} pipeline stages`);
  console.log(`  - ${weights.length} scoring weights`);
  console.log(`  - ${tags.length} tags`);
  console.log(`  - 3 service catalog items`);
  console.log(`  - 3 campaigns`);
  console.log(`  - ${leads.length} leads`);
  console.log(`  - 3 email templates`);
  console.log(`  - ${defaultSettings.length} settings`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
