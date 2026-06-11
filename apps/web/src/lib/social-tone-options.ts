export const SOCIAL_TONE_OPTIONS = [
  {
    value: "warm en professioneel",
    label: "Warm & professioneel",
    description: "Vertrouwd en toegankelijk — ideaal voor B2B en KMO",
  },
  {
    value: "kort en krachtig",
    label: "Kort & krachtig",
    description: "Punchy hooks, weinig woorden, sterke CTA",
  },
  {
    value: "vriendelijk en toegankelijk",
    label: "Vriendelijk & toegankelijk",
    description: "Menselijk, laagdrempelig en conversationeel",
  },
  {
    value: "zakelijk en betrouwbaar",
    label: "Zakelijk & betrouwbaar",
    description: "Formeel, geloofwaardig en resultaatgericht",
  },
  {
    value: "inspirerend en motiverend",
    label: "Inspirerend & motiverend",
    description: "Energiek, positief en forward-looking",
  },
  {
    value: "speels en creatief",
    label: "Speels & creatief",
    description: "Luchtig, onderscheidend en social-first",
  },
  {
    value: "direct en actiegericht",
    label: "Direct & actiegericht",
    description: "Geen omwegen — focus op actie en conversie",
  },
  {
    value: "premium en exclusief",
    label: "Premium & exclusief",
    description: "Verfijnd, high-end en selectief",
  },
  {
    value: "educatief en informatief",
    label: "Educatief & informatief",
    description: "Tips, uitleg en thought leadership",
  },
  {
    value: "lokaal en persoonlijk",
    label: "Lokaal & persoonlijk",
    description: "Belgisch, nabij en community-gevoel",
  },
] as const;

export type SocialTone = (typeof SOCIAL_TONE_OPTIONS)[number]["value"];

export const DEFAULT_SOCIAL_TONE: SocialTone = "warm en professioneel";
