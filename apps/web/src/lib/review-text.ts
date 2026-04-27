export type ReviewTextField = {
  key: string;
  label: string;
  description: string;
  defaultValue: string;
};

export const REVIEW_TEXT_PLACEHOLDERS = [
  "{{clientName}}",
  "{{companyName}}",
  "{{platformLabel}}",
  "{{leadCompanyName}}",
  "{{selectedRating}}",
] as const;

export const REVIEW_PUBLIC_TEXT_FIELDS: ReviewTextField[] = [
  {
    key: "reviews.public_badge",
    label: "Badge bovenaan",
    description: "Klein label boven de titel op de publieke reviewpagina.",
    defaultValue: "Klantfeedback",
  },
  {
    key: "reviews.public_heading",
    label: "Hoofdtitel",
    description: "De grote titel bovenaan de reviewpagina.",
    defaultValue: "Hoe was uw ervaring met {{companyName}}?",
  },
  {
    key: "reviews.public_intro",
    label: "Intro tekst",
    description: "De eerste uitleg boven de sterren.",
    defaultValue:
      "Hallo {{clientName}}, bedankt voor de samenwerking met {{companyName}}. Geef hieronder aan hoe u de ervaring beoordeelt. Na uw keuze kunt u verdergaan. Bij 4 of 5 sterren krijgt u daarna de mogelijkheid om uw review publiek te plaatsen. Bij 1 tot 3 sterren vragen we eerst interne feedback.",
  },
  {
    key: "reviews.public_continue_positive_title",
    label: "Positieve tussenstap titel",
    description: "Titel na 4 of 5 sterren, voor de definitieve reviewknop.",
    defaultValue: "U koos een positieve score.",
  },
  {
    key: "reviews.public_continue_positive_body",
    label: "Positieve tussenstap tekst",
    description: "Uitleg na 4 of 5 sterren, voor de definitieve reviewknop.",
    defaultValue:
      "Klik op doorgaan om naar de laatste stap te gaan en daarna uw publieke review te plaatsen op {{platformLabel}}.",
  },
  {
    key: "reviews.public_continue_negative_title",
    label: "Negatieve tussenstap titel",
    description: "Titel na 1 tot 3 sterren, voor het feedbackformulier.",
    defaultValue: "U koos een lagere score.",
  },
  {
    key: "reviews.public_continue_negative_body",
    label: "Negatieve tussenstap tekst",
    description: "Uitleg na 1 tot 3 sterren, voor het feedbackformulier.",
    defaultValue: "Klik op doorgaan om naar het interne feedbackformulier te gaan.",
  },
  {
    key: "reviews.public_continue_button",
    label: "Doorgaan knop",
    description: "Tekst op de eerste knop na het kiezen van sterren.",
    defaultValue: "Doorgaan",
  },
  {
    key: "reviews.public_positive_title",
    label: "Positieve eindstap titel",
    description: "Titel wanneer iemand 4 of 5 sterren gaf.",
    defaultValue: "Bedankt voor uw positieve score.",
  },
  {
    key: "reviews.public_positive_body",
    label: "Positieve eindstap tekst",
    description: "Uitleg net voor de definitieve reviewknop.",
    defaultValue:
      "Klik hieronder om uw beoordeling definitief te verzenden en door te gaan naar de publieke reviewpagina. Na deze stap kan deze reviewlink niet meer opnieuw gebruikt worden, op geen enkel toestel.",
  },
  {
    key: "reviews.public_positive_cta",
    label: "Positieve knop",
    description: "Definitieve knoptekst voor 4 of 5 sterren.",
    defaultValue: "Plaats review op {{platformLabel}}",
  },
  {
    key: "reviews.public_feedback_title",
    label: "Feedback titel",
    description: "Titel boven het interne feedbackformulier.",
    defaultValue: "Bedankt voor uw eerlijkheid.",
  },
  {
    key: "reviews.public_feedback_body",
    label: "Feedback uitleg",
    description: "Uitleg boven het interne feedbackformulier.",
    defaultValue:
      "Geef kort mee wat beter kon. Deze feedback blijft intern en wordt niet publiek geplaatst. Na verzending is deze reviewaanvraag volledig afgerond en niet opnieuw bruikbaar.",
  },
  {
    key: "reviews.public_feedback_placeholder",
    label: "Feedback placeholder",
    description: "Placeholder in het tekstvak voor interne feedback.",
    defaultValue: "Wat kunnen we verbeteren?",
  },
  {
    key: "reviews.public_feedback_submit",
    label: "Feedback verzendknop",
    description: "Knoptekst om interne feedback te verzenden.",
    defaultValue: "Feedback verzenden",
  },
  {
    key: "reviews.public_feedback_success",
    label: "Feedback succesbericht",
    description: "Bericht na succesvolle interne feedback.",
    defaultValue: "Bedankt voor uw feedback. We nemen dit intern op en komen indien nodig bij u terug.",
  },
  {
    key: "reviews.public_redirect_message",
    label: "Doorstuurbericht",
    description: "Bericht vlak voor de doorstuur naar de publieke reviewpagina.",
    defaultValue: "Bedankt. U wordt nu doorgestuurd naar {{platformLabel}}.",
  },
  {
    key: "reviews.public_positive_done",
    label: "Afgerond positief zonder redirect",
    description: "Bericht als de beoordeling is afgerond zonder externe reviewlink.",
    defaultValue: "Bedankt voor uw beoordeling. Deze aanvraag is afgerond.",
  },
  {
    key: "reviews.public_completed_message",
    label: "Reeds afgerond bericht",
    description: "Bericht wanneer de reviewlink al gebruikt is.",
    defaultValue: "Bedankt. Deze reviewaanvraag is al afgerond.",
  },
];

export const REVIEW_EMBED_TEXT_FIELDS: ReviewTextField[] = [
  {
    key: "reviews.embed_prompt",
    label: "Embed score prompt",
    description: "Korte titel boven de sterren in de embed.",
    defaultValue: "Geef uw score",
  },
  {
    key: "reviews.embed_hint_initial",
    label: "Embed hint begin",
    description: "Tekst voordat iemand sterren kiest.",
    defaultValue: "Kies eerst het aantal sterren.",
  },
  {
    key: "reviews.embed_hint_positive",
    label: "Embed hint positief",
    description: "Tekst na 4 of 5 sterren.",
    defaultValue: "Top. Kies nu waar u uw review wilt plaatsen.",
  },
  {
    key: "reviews.embed_hint_negative",
    label: "Embed hint negatief",
    description: "Tekst na 1 tot 3 sterren.",
    defaultValue: "Dank u. Vertel kort wat beter kon.",
  },
  {
    key: "reviews.embed_continue_positive_title",
    label: "Embed positieve tussenstap titel",
    description: "Titel na 4 of 5 sterren, voor de definitieve reviewknop.",
    defaultValue: "U koos een positieve score.",
  },
  {
    key: "reviews.embed_continue_positive_body",
    label: "Embed positieve tussenstap tekst",
    description: "Tekst na 4 of 5 sterren, voor de definitieve reviewknop.",
    defaultValue: "Klik op doorgaan om naar de laatste stap te gaan en daarna uw reviewplatform te kiezen.",
  },
  {
    key: "reviews.embed_continue_negative_title",
    label: "Embed negatieve tussenstap titel",
    description: "Titel na 1 tot 3 sterren, voor het feedbackformulier.",
    defaultValue: "U koos een lagere score.",
  },
  {
    key: "reviews.embed_continue_negative_body",
    label: "Embed negatieve tussenstap tekst",
    description: "Tekst na 1 tot 3 sterren, voor het feedbackformulier.",
    defaultValue: "Klik op doorgaan om naar het interne feedbackformulier te gaan.",
  },
  {
    key: "reviews.embed_continue_button",
    label: "Embed doorgaan knop",
    description: "Knoptekst na het kiezen van sterren.",
    defaultValue: "Doorgaan",
  },
  {
    key: "reviews.embed_positive_title",
    label: "Embed positieve eindstap titel",
    description: "Titel boven de platformkeuze.",
    defaultValue: "Kies waar u uw review wilt plaatsen.",
  },
  {
    key: "reviews.embed_positive_body",
    label: "Embed positieve eindstap tekst",
    description: "Korte uitleg boven de platformkeuze.",
    defaultValue: "Kies hieronder het reviewplatform van uw voorkeur.",
  },
  {
    key: "reviews.embed_feedback_title",
    label: "Embed feedback titel",
    description: "Titel boven het embed feedbackformulier.",
    defaultValue: "Dank u voor uw eerlijkheid.",
  },
  {
    key: "reviews.embed_feedback_body",
    label: "Embed feedback uitleg",
    description: "Korte uitleg boven het embed feedbackformulier.",
    defaultValue: "Vertel kort wat beter kon. Deze feedback blijft intern.",
  },
  {
    key: "reviews.embed_missing_links",
    label: "Embed zonder reviewlinks",
    description: "Melding wanneer geen publieke reviewlinks zijn ingevuld.",
    defaultValue: "Voeg minstens één review-link toe in de embed-configuratie.",
  },
  {
    key: "reviews.embed_feedback_placeholder",
    label: "Embed feedback placeholder",
    description: "Placeholder in het embed feedbackveld.",
    defaultValue: "Wat kunnen we verbeteren?",
  },
  {
    key: "reviews.embed_feedback_submit",
    label: "Embed feedback knop",
    description: "Knoptekst om feedback in de embed te verzenden.",
    defaultValue: "Verstuur feedback",
  },
  {
    key: "reviews.embed_feedback_success",
    label: "Embed feedback succes",
    description: "Bericht na succesvolle feedback in de embed.",
    defaultValue: "Bedankt. Uw feedback werd intern doorgestuurd.",
  },
  {
    key: "reviews.embed_platform_cta",
    label: "Embed platform knop",
    description: "Label op de platformknop in de embed.",
    defaultValue: "Review openen",
  },
  {
    key: "reviews.embed_platform_opened",
    label: "Embed platform succes",
    description: "Bericht nadat een reviewplatform werd geopend.",
    defaultValue: "Bedankt. {{platformLabel}} wordt in een nieuw tabblad geopend.",
  },
];

export const REVIEW_ALL_TEXT_FIELDS = [...REVIEW_PUBLIC_TEXT_FIELDS, ...REVIEW_EMBED_TEXT_FIELDS];

export function getReviewTextDefault(key: string) {
  return REVIEW_ALL_TEXT_FIELDS.find((field) => field.key === key)?.defaultValue ?? "";
}
