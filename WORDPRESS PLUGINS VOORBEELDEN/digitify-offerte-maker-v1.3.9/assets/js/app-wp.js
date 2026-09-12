/* ═══════════════════════════════════════════════════════
   Digitify – Offerte Configurator  v3.0
   Vereenvoudigde cart · KM-vergoeding · Rijke vragen
   Inbegrepen diensten · Uitgebreide catalogus
════════════════════════════════════════════════════════ */
'use strict';

const DIGITIFY_APP_SETTINGS = (window.digitifyWP && window.digitifyWP.settings) ? window.digitifyWP.settings : {};
const HIDE_PRICES_UI = String(DIGITIFY_APP_SETTINGS.hide_prices_ui || '0') === '1';


const KM_RATE = 0.35; // €/km

const CAT_COLORS = {
  webdesign: '#ffaf51', media: '#7C3AED', marketing: '#2563EB', extras: '#059669',
};

const PROD_ICONS = {
  onepage:'📄', multipage:'📑', webshop_lite:'🛍️', webshop_full:'🏪', extra_func:'⚙️',
  promovideo:'🎥', social_video:'📱', advert_video:'📺', bedrijfsvideo:'🏢', aftermovie:'🎉', fotoshoot:'📸',
  google_ads:'🔍', meta_ads:'👥', social_beheer:'📲', drukwerk:'🖨️', salespitch:'📊', emailmarketing:'📧',
  hosting_domein:'🌐', seo:'🔎', onderhoud:'🔧', branding:'🎨', copywriting:'✍️',
  animatie:'🎞️', podcast:'🎙️', eventfoto:'📷', productfilm:'🎬',
  google_reviews:'⭐', whatsapp_biz:'💬',
  muziekvideo:'🎵',
};

// Producten met verplaatsing (tonen km-slider)
const ON_LOCATION = new Set([
  'promovideo','social_video','advert_video','bedrijfsvideo','aftermovie','fotoshoot',
  'eventfoto','productfilm','drukwerk','muziekvideo',
]);

const CATALOG = {
  webdesign: {
    label:'Webdesign', emoji:'💻', color:CAT_COLORS.webdesign,
    sub:'Websites & webshops op maat',
    products:{
      onepage:      { label:'Onepage Website',        emoji:'📄', sub:'Ideaal voor freelancers en kleine bedrijven',    optType:'web-package' },
      multipage:    { label:'Multipage Website',       emoji:'📑', sub:'Ideaal voor KMO\'s en groeiende bedrijven',      optType:'web-package' },
      webshop_lite: { label:'Simpele Webshop',         emoji:'🛍️', sub:'Perfect voor nicheproducten of starters',       optType:'web-package' },
      webshop_full: { label:'Full Webshop',             emoji:'🏪', sub:'Ideaal voor merken die online willen opschalen',optType:'web-package' },
      extra_func:   { label:'Extra Functionaliteiten', emoji:'⚙️', sub:'Boekingssysteem, chatbot, blog, CRM …',         optType:'web-extras-only' },
    }
  },
  media: {
    label:'Media', emoji:'🎬', color:CAT_COLORS.media,
    sub:'Video, foto & contentcreatie',
    products:{
      promovideo:    { label:'Promovideo / Brand film',     emoji:'🎥', sub:'Merkverhaal dat vertrouwen opbouwt',           optType:'video' },
      social_video:  { label:'Social Media Video\'s',        emoji:'📱', sub:'Reels, TikToks & Shorts',                      optType:'video' },
      advert_video:  { label:'Advertentievideo',             emoji:'📺', sub:'Conversiegericht voor Meta, Google, YouTube',  optType:'video' },
      bedrijfsvideo: { label:'Bedrijfs- & Corporatevideo',  emoji:'🏢', sub:'Voor website, presentaties & communicatie',    optType:'video' },
      aftermovie:    { label:'Aftermovie / Eventvideo',      emoji:'🎉', sub:'Sfeervolle samenvatting van uw event',         optType:'video' },
      fotoshoot:     { label:'Fotoshoot',                    emoji:'📸', sub:'Branding, product- of teamfotografie',         optType:'foto' },
      muziekvideo:   { label:'Muziekvideo / Videoclip',      emoji:'🎵', sub:'Professionele videoclip voor artiesten & bands', optType:'video' },
    }
  },
  marketing: {
    label:'Marketing', emoji:'📣', color:CAT_COLORS.marketing,
    sub:'Ads, social media & drukwerk',
    products:{
      google_ads:    { label:'Google Ads',                emoji:'🔍', sub:'Zoekcampagnes, display & MAX campagnes',       optType:'ads-package' },
      meta_ads:      { label:'Meta Ads',                  emoji:'👥', sub:'Facebook & Instagram advertenties',             optType:'ads-package' },
      social_beheer: { label:'Social Media Beheer',       emoji:'📲', sub:'Beheer van kanalen en content',                optType:'social-monthly' },
      drukwerk:      { label:'Drukwerk',                  emoji:'🖨️', sub:'Flyers, visitekaartjes, posters, brochures',   optType:'drukwerk' },
      salespitch:    { label:'Salespitch / Presentatie',  emoji:'📊', sub:'Professionele bedrijfspresentatie',             optType:'fixed' },
      whatsapp_biz:  { label:'WhatsApp Business Setup',   emoji:'💬', sub:'Business account + automatische antwoorden',   optType:'fixed' },
    }
  },
  extras: {
    label:'Extra\'s & Add-ons', emoji:'⚙️', color:CAT_COLORS.extras,
    sub:'Hosting, SEO, branding & meer',
    products:{
      hosting_domein:  { label:'Hosting & Domeinnaam',   emoji:'🌐', sub:'Webhosting + domeinnaam (.be of .com)',        optType:'hosting' },
      seo:             { label:'SEO Optimalisatie',       emoji:'🔎', sub:'Betere vindbaarheid in Google',               optType:'seo-package' },
      onderhoud:       { label:'Website Onderhoud',       emoji:'🔧', sub:'Updates, back-ups en technische support',     optType:'maintenance' },
      branding:        { label:'Logo & Huisstijl',        emoji:'🎨', sub:'Logo-ontwerp en volledige huisstijl',         optType:'branding' },
      copywriting:     { label:'Copywriting',             emoji:'✍️', sub:'Professionele teksten voor uw website',      optType:'copy' },
    }
  }
};

const PRICING = {
  webdesign: {
    onepage: {
      packages:[
        { id:'basis',  label:'Basis',   sub:'Tot 5 secties · contactformulier',                         price:750,  included:['SSL-certificaat','GDPR cookiebanner','Google Analytics 4','Mobiele weergave'] },
        { id:'pro',    label:'Pro',     sub:'Tot 8 secties · animaties · SEO-basis',                    price:1200, included:['Alles van Basis','SEO-basis optimalisatie','Paginasnelheid optimalisatie','1 revisieronde'] },
        { id:'custom', label:'Premium', sub:'Volledig op maat · animaties · SEO · 1m support',          price:1800, included:['Alles van Pro','Maatwerk animaties','1 maand gratis support','Google Search Console'] },
      ],
      questions:[
        { q:'Heeft u al een logo en huisstijl?', type:'choice', options:['Ja, volledig klaar','Enkel logo (+€150)','Nee – logo + huisstijl nodig (+€350–€750)'] },
        { q:'Zijn de teksten voor de website al klaar?', type:'choice', options:['Ja, volledig klaar','Gedeeltelijk klaar','Nee – copywriting nodig (+€95/pagina)'] },
        { q:'Heeft u al beeldmateriaal (foto\'s/video)?', type:'choice', options:['Ja, professioneel materiaal','Ja, eigen foto\'s','Nee – fotoshoot nodig (+€550)'] },
        { q:'Wenst u een meertalige website?', type:'choice', options:['Nee','NL + FR (+€50)','NL + EN (+€50)','NL + FR + EN (+€100)'] },
        { q:'Heeft u een specifieke lanceerdatum?', type:'text', placeholder:'bv. 15 maart 2025' },
        { q:'Bijzondere wensen of specifieke functies?', type:'text', placeholder:'bv. reserveringssysteem, chatbot, specifieke animaties…' },
      ],
    },
    multipage: {
      packages:[
        { id:'kmo',    label:'KMO',     sub:'Tot 5 pagina\'s · contactformulier · blog',               price:1600, included:['SSL-certificaat','GDPR cookiebanner','Google Analytics 4','Blog module','Mobiele weergave'] },
        { id:'pro',    label:'Pro',     sub:'Tot 10 pagina\'s · blog · SEO-basis',                     price:2800, included:['Alles van KMO','SEO-basis optimalisatie','Sitemap & robots.txt','2 revisierondes'] },
        { id:'custom', label:'Premium', sub:'Onbeperkt pagina\'s · maatwerk · SEO · 3m support',       price:4500, included:['Alles van Pro','Onbeperkte pagina\'s','3 maanden gratis support','Performance audit'] },
      ],
      questions:[
        { q:'Hoeveel pagina\'s heeft u nodig?', type:'choice', options:['1–3 pagina\'s','4–6 pagina\'s','7–10 pagina\'s','Meer dan 10 (+ bespreking)'] },
        { q:'Wenst u een meertalige website?', type:'choice', options:['Nee','NL + FR (+€50)','NL + EN (+€50)','NL + FR + EN (+€100)'] },
        { q:'Heeft u al teksten aangeleverd?', type:'choice', options:['Ja, alles klaar','Gedeeltelijk','Nee – copywriting nodig (+€95/pagina)'] },
        { q:'Heeft u al een logo en huisstijl?', type:'choice', options:['Ja, volledig klaar','Enkel logo (+€150)','Nee – branding nodig (+€350–€750)'] },
        { q:'Wenst u een CRM of boekhoudkoppeling?', type:'choice', options:['Nee','Teamleader (+€250)','Exact Online (+€250)','Andere (+€250)'] },
        { q:'Heeft u al beeldmateriaal (foto\'s/video)?', type:'choice', options:['Ja, professioneel','Ja, eigen foto\'s','Nee – fotoshoot nodig (+€550)'] },
        { q:'Heeft u een specifieke lanceerdatum?', type:'text', placeholder:'bv. 15 april 2025' },
        { q:'Bijzondere wensen of extra functies?', type:'text', placeholder:'bv. interactieve calculator, boekingssysteem…' },
      ],
    },
    webshop_lite: {
      packages:[
        { id:'starter', label:'Starter', sub:'1 kernproduct · betaling & checkout · WordPress',        price:1250, included:['WordPress + WooCommerce','SSL-certificaat','Veilig checkout','GDPR cookiebanner','Google Analytics 4','Mobiele weergave','1 revisieronde'] },
        { id:'pro',     label:'Pro',     sub:'1 product · premium functies · SEO · reviews · kortingscodes', price:1650, included:['Alles van Starter','Kortingscodes & vouchers','Productreviews & ratings','Geavanceerde zoekfunctie','SEO-basis optimalisatie','Conversie-optimalisatie','2 revisierondes'] },
      ],
      questions:[
        { q:'Hoeveel producten wilt u aanbieden?', type:'choice', options:['1 product (focus)','2–5 producten','6–20 producten','Meer dan 20 (+€200)'] },
        { q:'Welke betaalmethodes wilt u aanbieden?', type:'choice', options:['Bancontact + Mastercard','+ PayPal (+€0, standaard)','+ Klarna achteraf betalen (+€50)','Alles (+€50)'] },
        { q:'Heeft u al productfoto\'s klaar?', type:'choice', options:['Ja, professioneel','Ja, eigen foto\'s','Nee – fotoshoot nodig (+€450)'] },
        { q:'Heeft u al een logo en huisstijl?', type:'choice', options:['Ja, volledig klaar','Enkel logo','Nee – branding nodig (+€350)'] },
        { q:'Heeft u al teksten voor de productpagina\'s?', type:'choice', options:['Ja, volledig','Gedeeltelijk','Nee – copywriting nodig (+€95/pagina)'] },
        { q:'Wenst u een koppeling met boekhoudpakket?', type:'choice', options:['Nee','Yuki','Exact Online (+€80)','Andere (+€80)'] },
        { q:'Heeft u een specifieke lanceerdatum?', type:'text', placeholder:'bv. 1 juni 2025' },
      ],
    },
    webshop_full: {
      packages:[
        { id:'business', label:'Business', sub:'Tot 50 producten · WordPress + WooCommerce · voorraadbeheer',  price:2400, included:['WordPress + WooCommerce','Tot 50 producten','Kortingssysteem','Voorraadbeheer','SSL + GDPR','Google Analytics 4','Mobiele weergave','2 revisierondes'] },
        { id:'premium',  label:'Premium',  sub:'Tot 200 producten · maatwerk · SEO · 3m support',             price:3200, included:['Alles van Business','Tot 200 producten','SEO-basis optimalisatie','Geavanceerde filters','Productreviews','3 maanden support','Performance audit'] },
      ],
      note:'Meer dan 200 producten: +€5/product extra. Wij werken uitsluitend met WordPress + WooCommerce.',
      questions:[
        { q:'Hoeveel producten heeft u bij de start?', type:'choice', options:['1–20 producten','21–50 producten','51–200 producten','200+ producten (+€5/product)'] },
        { q:'Welke betaalmethodes wilt u aanbieden?', type:'choice', options:['Bancontact + Mastercard','+ PayPal (+€0)','+ Klarna achteraf betalen (+€50)','Alles (+€50)'] },
        { q:'Heeft u productfoto\'s klaar?', type:'choice', options:['Ja, professioneel','Ja, eigen foto\'s','Nee – productfotografie nodig (+€450)'] },
        { q:'Heeft u al een logo en huisstijl?', type:'choice', options:['Ja, volledig klaar','Enkel logo','Nee – branding nodig (+€350)'] },
        { q:'Wenst u een koppeling met boekhoudpakket?', type:'choice', options:['Nee','Yuki','Exact Online (+€80)','Andere (+€80)'] },
        { q:'Wenst u meertalige webshop?', type:'choice', options:['Nee','NL + FR (+€50)','NL + EN (+€50)','NL + FR + EN (+€100)'] },
        { q:'Heeft u bestaande productdata om te importeren?', type:'choice', options:['Nee','CSV/Excel bestand (inbegrepen)','Ander systeem (+€150 migratie)'] },
        { q:'Wenst u B2B-klantgroepen of aparte prijslijsten?', type:'choice', options:['Nee','Ja (+€250 B2B module)'] },
        { q:'Heeft u een specifieke lanceerdatum?', type:'text', placeholder:'bv. 1 september 2025' },
      ],
    },
    extra_func: {
      packages:[],
      questions:[
        { q:'Welke functionaliteit zoekt u?', type:'text', placeholder:'bv. reserveringssysteem, ledenzone, calculator…' },
        { q:'Is dit een uitbreiding op een bestaande site?', type:'yesno' },
        { q:'Platform voorkeur?', type:'choice', options:['WordPress','Shopify','Webflow','Geen voorkeur'] },
      ],
    },
    _webExtras:{
      hosting:    { label:'Hosting (1 jaar)',                    price:80,  note:'/jaar' },
      domein:     { label:'Domeinnaam (.be of .com)',             price:20,  note:'/jaar' },
      email_zak:  { label:'Zakelijk e-mailadres',                price:30,  note:'/jaar' },
      meertalig:  { label:'Meertalige ondersteuning',            price:50,  note:'eenmalig' },
      reservering:{ label:'Reserveringssysteem',                 price:120, note:'eenmalig' },
      boeking:    { label:'Online boekingssysteem',              price:120, note:'eenmalig' },
      catalogus:  { label:'Productcatalogus',                    price:80,  note:'eenmalig' },
      menu_rest:  { label:'Interactief restaurantmenu',          price:100, note:'eenmalig' },
      crm:        { label:'CRM-integratie',                      price:250, note:'eenmalig' },
      offerte_sys:{ label:'Offerte-aanvraagformulier',           price:100, note:'eenmalig' },
      chat:       { label:'Livechat / chatbot',                  price:180, note:'/jaar' },
      blog:       { label:'Blog of kennisbank',                  price:160, note:'eenmalig' },
      reviews:    { label:'Reviewsysteem',                       price:20,  note:'eenmalig' },
      social_int: { label:'Social media integratie',             price:30,  note:'eenmalig' },
      betalen:    { label:'Online betalingen',                   price:50,  note:'eenmalig' },
      workshop:   { label:'Workshop CMS-zelfbeheer',            price:350, note:'per sessie' },
      popup:      { label:'Popup / lead capture',               price:60,  note:'eenmalig' },
    },
  },

  media: {
    promovideo: {
      types:[
        { id:'2u',  label:'2 uur opname',  sub:'Compact shoot · 1 onderwerp · snel geleverd',     price:450,  included:['1 locatie','Kleurcorrectie','Muzieklicentie','1 revisieronde'] },
        { id:'4u',  label:'4 uur opname',  sub:'Halve dag · meerdere shots & scènes',              price:750,  included:['2 locaties','Kleurcorrectie','Sound design','Muzieklicentie','2 revisierondes'] },
        { id:'8u',  label:'8 uur opname',  sub:'Volledige dag · uitgebreide productie',            price:1200, included:['3 locaties','Kleurcorrectie','Sound design','Muzieklicentie','2 revisierondes'] },
        { id:'12u', label:'12 uur opname', sub:'Groot project · uitgebreide dag · complexe shoot', price:1800, included:['4 locaties','Kleurcorrectie','Sound design','Voice-over mogelijk','3 revisierondes'] },
      ],
      extras:{
        drone:    { label:'Drone-luchtbeelden',        price:350 },
        acteurs:  { label:'Acteur/model (per pers)',   price:120, perUnit:true },
        script:   { label:'Script & storyboard',       price:180 },
        voice:    { label:'Professionele voice-over',  price:120 },
        subtitles:{ label:'Ondertiteling',             price:80 },
      },
      questions:[
        { q:'Waar wordt er gefilmd?', type:'text', placeholder:'bv. Gentsesteenweg 42, Gent' },
        { q:'Zijn er meerdere locaties vereist?', type:'choice', options:['1 locatie','2 locaties (inbegrepen bij 4u+)','3 locaties (inbegrepen bij 8u+)','4+ locaties (+€150/extra locatie)'] },
        { q:'Heeft u al een concept of script?', type:'choice', options:['Ja, volledig klaar','Globaal idee','Nee – scriptwriting nodig (+€180)'] },
        { q:'Stijl van de video?', type:'choice', options:['Modern & dynamisch','Rustig & verhalend','Corporate & professioneel','Speels & humoristisch'] },
        { q:'Voor welk platform is de video bedoeld?', type:'choice', options:['Website','Instagram/TikTok','YouTube','LinkedIn','Meerdere platforms'] },
        { q:'Heeft u een specifieke deadline?', type:'text', placeholder:'bv. voor opening op 1 mei' },
      ],
    },
    social_video: {
      types:[
        { id:'2u',  label:'2 uur opname',  sub:'3–5 sociale clips · Reels, TikTok, Shorts',       price:450,  included:['3–5 clips geleverd','1 locatie','Montage','Muzieklicenties','Formaat voor 1 platform'] },
        { id:'4u',  label:'4 uur opname',  sub:'6–10 sociale clips · meerdere onderwerpen',       price:750,  included:['6–10 clips geleverd','2 locaties','Montage','Muzieklicenties','Formaat voor 2 platformen'] },
        { id:'8u',  label:'8 uur opname',  sub:'10–15 clips · contentbank voor 1 maand',          price:1200, included:['10–15 clips geleverd','3 locaties','Montage','Alle formaten','Contentkalender'] },
        { id:'12u', label:'12 uur opname', sub:'15–20 clips · uitgebreide contentproductie',      price:1800, included:['15–20 clips geleverd','4 locaties','Montage','Alle formaten','Contentkalender','Strategie'] },
      ],
      extras:{
        script:   { label:'Script per video',           price:60, perUnit:true },
        captions: { label:'Ondertiteling (alle clips)', price:80 },
        music:    { label:'Extra muzieklicenties',      price:50 },
        strategy: { label:'Content strategie rapport',  price:150 },
      },
      questions:[
        { q:'Waar worden de video\'s opgenomen?', type:'text', placeholder:'bv. winkel, kantoor, buitenlocatie…' },
        { q:'Zijn er meerdere locaties vereist?', type:'choice', options:['1 locatie','2 locaties (inbegrepen bij 4u+)','3 locaties (inbegrepen bij 8u+)','4+ locaties (+€150/extra locatie)'] },
        { q:'Op welke kanalen worden de video\'s geplaatst?', type:'choice', options:['Instagram','TikTok','Instagram + TikTok','LinkedIn + Instagram','Meerdere platformen'] },
        { q:'Heeft u al een huisstijl of visuele identiteit?', type:'choice', options:['Ja, volledig klaar','Gedeeltelijk','Nee – branding nodig (+€350)'] },
        { q:'Spreekt u zelf in beeld of liever voice-over?', type:'choice', options:['Zelf in beeld','Voice-over (+€120)','Combinatie','Enkel muziek & tekst'] },
        { q:'Wenst u vaste maandelijkse shoot-sessies?', type:'yesno' },
      ],
    },
    advert_video: {
      types:[
        { id:'2u',  label:'2 uur opname',  sub:'1–2 advertentievideo\'s · snel geleverd',          price:500,  included:['Script','Kleurcorrectie','1–2 formaten','Muzieklicentie','1 revisie'] },
        { id:'4u',  label:'4 uur opname',  sub:'3–4 advertentie-varianten · A/B testing',          price:850,  included:['Script','3–4 varianten','Kleurcorrectie','Meerdere formaten','2 revisies'] },
        { id:'8u',  label:'8 uur opname',  sub:'Full set · Square, Story, Landscape, Banner',      price:1300, included:['Script','4 formaten','Kleurcorrectie','Sound design','CTA overlay','3 revisies'] },
        { id:'12u', label:'12 uur opname', sub:'Uitgebreide campagne · meerdere boodschappen',     price:1900, included:['Script','6+ varianten','Kleurcorrectie','Sound design','CTA overlay','3 revisies'] },
      ],
      extras:{
        script:   { label:'Script & storyboard',                price:180 },
        acteurs:  { label:'Acteur/model (per pers)',            price:120, perUnit:true },
        music:    { label:'Extra muzieklicentie',               price:50 },
        captions: { label:'Ondertiteling / CTA-tekst overlay',  price:60 },
      },
      questions:[
        { q:'Waar worden de opnames gemaakt?', type:'text', placeholder:'bv. in studio, eigen locatie, buitenlocatie' },
        { q:'Zijn er meerdere locaties vereist?', type:'choice', options:['1 locatie','2 locaties (+€150)','3+ locaties (+€300)'] },
        { q:'Op welk platform lopen de advertenties?', type:'choice', options:['Meta (FB + IG)','Google / YouTube','LinkedIn','Meerdere platformen'] },
        { q:'Wat is het doel van de advertentie?', type:'choice', options:['Merkbekendheid','Websitebezoek','Leads genereren','Directe aankopen'] },
        { q:'Tone of voice van de advertentie?', type:'choice', options:['Professioneel & vertrouwen','Speels & energiek','Emotioneel & inspirerend','Urgent & actiegericht'] },
        { q:'Heeft u al bestaand beeldmateriaal om te verwerken?', type:'yesno' },
        { q:'Wenst u ook campagnebeheer na levering?', type:'choice', options:['Nee','Ja – Meta beheer (+€380/campagne)','Ja – Google beheer (+€380/setup)'] },
      ],
    },
    bedrijfsvideo: {
      types:[
        { id:'2u',  label:'2 uur opname',  sub:'Bedrijfsintro of interview · snel geleverd',        price:550,  included:['1 locatie','Script','Kleurcorrectie','Muzieklicentie','1 revisie'] },
        { id:'4u',  label:'4 uur opname',  sub:'Meerdere medewerkers of scènes',                    price:900,  included:['2 locaties','Script','Kleurcorrectie','Sound design','2 revisies'] },
        { id:'8u',  label:'8 uur opname',  sub:'Uitgebreide bedrijfsfilm',                          price:1400, included:['3 locaties','Script','Voice-over','Sound design','2 revisies'] },
        { id:'12u', label:'12 uur opname', sub:'Groot corporate project · meerdere locaties',       price:2000, included:['4 locaties','Script','Voice-over','Sound design','Drone mogelijk','3 revisies'] },
      ],
      extras:{
        drone:    { label:'Drone-luchtbeelden',  price:350 },
        script:   { label:'Script & voice-over', price:180 },
        subtitles:{ label:'Ondertiteling',       price:80 },
        extra_loc:{ label:'Extra locatie',       price:150 },
      },
      questions:[
        { q:'Waar wordt er gefilmd?', type:'text', placeholder:'bv. kantoor, fabriek, winkel – adres of omschrijving' },
        { q:'Zijn er meerdere locaties vereist?', type:'choice', options:['1 locatie','2 locaties (inbegrepen bij 4u+)','3 locaties (inbegrepen bij 8u+)','4+ locaties (+€150/extra locatie)'] },
        { q:'Gebruik van de video?', type:'choice', options:['Website hero-sectie','Sociale media','Intern / presentaties','Beurs / evenement'] },
        { q:'Hoeveel medewerkers zijn betrokken?', type:'choice', options:['1 persoon','2–3 personen','Team van 5+','Enkel sfeer & omgeving'] },
        { q:'Heeft u al een script of globaal idee?', type:'choice', options:['Ja, volledig uitgewerkt','Globaal idee','Nee – volledig door Digitify (+€180)'] },
        { q:'Wenst u fotografie te combineren met de shoot?', type:'choice', options:['Nee','Ja, halve dag fotoshoot erbij (+€550)','Ja, volledige dag erbij (+€950)'] },
      ],
    },
    aftermovie: {
      types:[
        { id:'2u',  label:'2 uur opname',  sub:'Kleine events · borrel, teamdag, mini-event',    price:550,  included:['1 cameraman','Kleurcorrectie','Muzieklicentie','2 revisies'] },
        { id:'4u',  label:'4 uur opname',  sub:'Halfdaagse events · seminaries, launches',       price:900,  included:['1 cameraman','Sound','Kleurcorrectie','Muzieklicentie','2 revisies'] },
        { id:'8u',  label:'8 uur opname',  sub:'Volledige dag evenement',                        price:1400, included:['1–2 cameramannen','Sound','Kleurcorrectie','Muziek','2 revisies'] },
        { id:'12u', label:'12 uur opname', sub:'Groot evenement of festival · meerdaags',        price:2000, included:['2 cameramannen','Drone','Sound design','Muziek','3 revisies'] },
      ],
      extras:{
        drone:     { label:'Drone-luchtbeelden',                price:350 },
        edits:     { label:'Extra social media edits (×3)',     price:250 },
        livestream:{ label:'Live streaming setup',              price:450 },
        photo:     { label:'Fotografie combinatie (volledige dag)', price:400 },
        teaser:    { label:'Teaser / aankondigingsvideo',       price:300 },
      },
      questions:[
        { q:'Datum en locatie van het evenement?', type:'text', placeholder:'bv. 15 juni 2025, Gent – naam van de locatie' },
        { q:'Zijn er meerdere locaties of ruimtes betrokken?', type:'choice', options:['1 locatie/ruimte','2–3 ruimtes (inbegrepen)','Meerdere locaties (+€150/locatie)'] },
        { q:'Type evenement?', type:'choice', options:['Bedrijfsevenement / seminarie','Festival / concert','Sportgebeurtenis','Privé evenement (huwelijk, …)'] },
        { q:'Hoeveel bezoekers worden er verwacht?', type:'choice', options:['Tot 50','50–200','200–1.000','1.000+'] },
        { q:'Wenst u ook een teaser/aankondigingsvideo?', type:'choice', options:['Nee','Ja (+€300)'] },
        { q:'Hoe snel heeft u de aftermovie nodig?', type:'choice', options:['Zelfde dag – highlight (+€200 spoedtarief)','Binnen 48u','Binnen 1 week','Geen haast'] },
      ],
    },
    fotoshoot: {
      types:[
        { id:'halfdag', label:'Halve dag (50 foto\'s)',      sub:'Branding, product of team',    price:550, included:['50 bewerkte foto\'s','Online galerij','Printklare bestanden','1 revisieronde'] },
        { id:'fulldag', label:'Volledige dag (100 foto\'s)', sub:'Uitgebreide shoot',             price:950, included:['100 bewerkte foto\'s','Online galerij','Printklare bestanden','2 revisierondes'] },
        { id:'product', label:'Productfotografie (20 items)',sub:'Webshop & catalogus',          price:450, included:['20 producten','Witte achtergrond','Kleur- & lichtkalibratie','Webshop-klaar'] },
      ],
      extras:{
        retouche: { label:'Extra retouchering (+10 foto\'s)', price:80 },
        drone:    { label:'Drone-luchtfoto\'s',               price:350 },
        locatie:  { label:'Locatiehuur (studio)',             price:200 },
        styling:  { label:'Styling / props advies',           price:100 },
        extra20:  { label:'+20 extra productfoto\'s',         price:200 },
      },
      questions:[
        { q:'Waar wordt de fotoshoot gehouden?', type:'text', placeholder:'bv. eigen kantoor, studio, buitenlocatie in Gent' },
        { q:'Zijn er meerdere locaties vereist?', type:'choice', options:['1 locatie','2 locaties (+€150)','3+ locaties (+€300)','Studio inboeken nodig (+€200)'] },
        { q:'Doel van de foto\'s?', type:'choice', options:['Website (hero/team)','Social media content','Productcatalogus / webshop','Perscommunicatie / drukwerk'] },
        { q:'Zijn er mensen betrokken bij de shoot?', type:'choice', options:['Nee (enkel producten/omgeving)','Ja, 1–2 personen','Ja, team van 3–5','Ja, groter team (+bespreking)'] },
        { q:'Heeft u al een logo en huisstijl als stijlreferentie?', type:'choice', options:['Ja, volledig klaar','Gedeeltelijk','Nee – moodboard samen opbouwen'] },
        { q:'Wenst u video te combineren met de fotoshoot?', type:'choice', options:['Nee','Ja – 2u video erbij (+€450)','Ja – 4u video erbij (+€750)'] },
      ],
    },
    muziekvideo: {
      types:[
        { id:'2u',  label:'2 uur opname',  sub:'Single clip · 1 artiest · simpele setup',           price:650,  included:['1 locatie','Kleurcorrectie','Sound sync','1 revisie'] },
        { id:'4u',  label:'4 uur opname',  sub:'Uitgebreide clip · meerdere scènes',                 price:1100, included:['2 locaties','Kleurcorrectie','Sound sync','2 revisies'] },
        { id:'8u',  label:'8 uur opname',  sub:'Professionele productie · meerdere looks',           price:1700, included:['3 locaties','Kleurcorrectie','Sound design','Drone mogelijk','2 revisies'] },
        { id:'12u', label:'12 uur opname', sub:'Volledige dagproductie · cinematic stijl',           price:2400, included:['Meerdere locaties','Kleurcorrectie','Sound design','Drone','BTS clip','3 revisies'] },
      ],
      extras:{
        drone:    { label:'Drone-luchtbeelden',      price:350 },
        bts:      { label:'Behind-the-scenes clip',  price:250 },
        teaser:   { label:'Teaser / 30 sec clip',    price:200 },
        extra_loc:{ label:'Extra locatie',           price:150 },
      },
      questions:[
        { q:'Naam van het nummer en artiest?', type:'text', placeholder:'bv. Artiest – Titel (genre)' },
        { q:'Stijl van de videoclip?', type:'choice', options:['Narrative / verhaal','Performance-based','Artistiek / abstract','Mix van stijlen'] },
        { q:'Aantal artiesten of acteurs?', type:'choice', options:['1 persoon','2–3 personen','4+ personen (+€120/pers)'] },
        { q:'Heeft u al een concept of moodboard?', type:'choice', options:['Ja, volledig uitgewerkt','Globaal idee','Nee – conceptontwikkeling door Digitify (+€180)'] },
        { q:'Deadline voor levering?', type:'text', placeholder:'bv. 1 augustus 2025' },
      ],
    },
  },

  marketing: {
    google_ads: {
      packages:[
        { id:'setup',   label:'Setup only', sub:'Campagne-opzet + tracking + conversiedoelen',       price:380,  included:['Google Ads account setup','Conversietracking','Doelgroepinstelling','Zoekwoordonderzoek'] },
        { id:'starter', label:'Starter',    sub:'Setup + beheer · budget tot €500/m',                price:380, pricePerMonth:280, included:['Setup inbegrepen','Maandelijks beheer','Maandrapport','Budget tot €500/m'] },
        { id:'growth',  label:'Growth',     sub:'Setup + beheer · budget tot €2.000/m',              price:380, pricePerMonth:550, included:['Setup inbegrepen','A/B testing','Retargeting','Maandrapport','Budget tot €2.000/m'] },
        { id:'premium', label:'Premium',    sub:'Setup + full service · onbeperkt budget',           price:380, pricePerMonth:950, included:['Setup inbegrepen','Full service beheer','Shopping-campagnes','Wekelijks rapport'] },
      ],
      hasDuration:true,
      questions:[
        { q:'Heeft u al een Google Ads-account?', type:'choice', options:['Ja, actief account','Ja, maar inactief','Nee – alles van nul (setup inbegrepen in prijs)'] },
        { q:'Wat is uw maandelijks advertentiebudget?', type:'choice', options:['Tot €300/m (Starter aanbevolen)','€300–€500/m (Starter)','€500–€2.000/m (Growth +€550/m)','€2.000+/m (Premium +€950/m)'] },
        { q:'Doel van de campagnes?', type:'choice', options:['Meer websitebezoek','Leads / aanvragen','Directe verkoop','Merkbekendheid'] },
        { q:'Heeft u al een landingspagina klaar?', type:'choice', options:['Ja, geoptimaliseerd','Ja, maar verouderd','Nee – webdesign nodig (+€750–€1.600)'] },
        { q:'In welke regio\'s wilt u adverteren?', type:'text', placeholder:'bv. Gent, Antwerpen, heel België…' },
        { q:'Heeft u concurrenten waarvan u weet dat ze adverteren?', type:'yesno' },
      ],
    },
    meta_ads: {
      packages:[
        { id:'campagne', label:'Per campagne', sub:'4 afbeeldingen + 2 video\'s + analyse', price:380, included:['Creatief ontwerp','Doelgroep instelling','Campagne-opzet','Resultatenrapport'] },
        { id:'monthly',  label:'Maandbeheer',  sub:'Continu campagnebeheer + optimalisatie', pricePerMonth:380, included:['Maandelijks beheer','A/B testing','Retargeting','Maandrapport'] },
      ],
      hasDuration:true,
      questions:[
        { q:'Heeft u al een Facebook Business Manager?', type:'choice', options:['Ja, volledig ingericht','Ja, maar niet optimaal','Nee – alles van nul (setup inbegrepen)'] },
        { q:'Wat is uw maandelijks advertentiebudget?', type:'choice', options:['Tot €300/m','€300–€1.000/m (Maandbeheer +€380/m)','€1.000–€3.000/m','€3.000+/m'] },
        { q:'Heeft u al beeldmateriaal voor de advertenties?', type:'choice', options:['Ja, professioneel','Ja, eigen foto\'s','Nee – mediashoot nodig (+€450–€750)'] },
        { q:'Doel van de advertenties?', type:'choice', options:['Merkbekendheid','Websiteverkeer','Leads genereren','Directe verkopen'] },
        { q:'Welke doelgroep wilt u bereiken?', type:'text', placeholder:'bv. vrouwen 25–40 in Gent, interesse in…' },
        { q:'Wenst u ook retargeting (bezoekers opnieuw bereiken)?', type:'yesno' },
      ],
    },
    social_beheer: {
      packages:[
        { id:'lite',     label:'Lite',     sub:'8 posts/m · 1 kanaal · maandrapport',       pricePerMonth:350, included:['8 posts per maand','1 kanaal beheer','Maandrapport','Reactiebeheer basis'] },
        { id:'standard', label:'Standard', sub:'16 posts/m · 2 kanalen · strategie',        pricePerMonth:550, included:['16 posts per maand','2 kanalen','Contentkalender','Maandstrategie','Stories'] },
        { id:'full',     label:'Full',     sub:'25+ posts/m · 3+ kanalen · advertenties',   pricePerMonth:850, included:['25+ posts/maand','3+ kanalen','Advertenties inbegrepen','Wekelijks overleg','Analytics'] },
      ],
      hasDuration:true,
      questions:[
        { q:'Op welke kanalen bent u actief?', type:'choice', options:['Alleen Instagram (1 kanaal)','Instagram + Facebook (2 kanalen – Standard+)','+ LinkedIn (3 kanalen – Full)','+ TikTok (3+ kanalen – Full)'] },
        { q:'Heeft u al een tone of voice of brand guidelines?', type:'choice', options:['Ja, volledig uitgewerkt','Gedeeltelijk','Nee – samen uitwerken (inbegrepen in onboarding)'] },
        { q:'Wenst u dat wij ook beeldmateriaal verzorgen?', type:'choice', options:['Nee – eigen beeldmateriaal','Ja, maandelijkse shoot (+€450–€750/shoot)','Ja, stockbeelden volstaan'] },
        { q:'Heeft u al een contentkalender of thema\'s?', type:'choice', options:['Ja, volledig plan','Enkele ideeën','Nee – volledig door Digitify (inbegrepen bij Standard+)'] },
        { q:'Wenst u maandelijkse rapportering?', type:'yesno' },
        { q:'Is reactiebeheer (DM\'s en comments) gewenst?', type:'yesno' },
      ],
    },
    drukwerk: {
      types:[
        { id:'flyers',      label:'Flyers & folders',   sub:'Digitaal ontwerp · productie apart',      price:250, included:['Ontwerp voor/achter','Print-ready bestand','2 revisies'] },
        { id:'visitekaart', label:'Visitekaartjes',      sub:'Professioneel kaartontwerp',              price:125, included:['Ontwerp voor/achter','Print-ready bestand','1 revisie'] },
        { id:'poster',      label:'Poster / affiche',   sub:'A3–A0 formaat ontwerp',                   price:200, included:['Ontwerp naar keuze formaat','Print-ready bestand','1 revisie'] },
        { id:'brochure',    label:'Brochure',            sub:'Meerdere pagina\'s, full colour',        price:350, included:['Ontwerp tot 8 pagina\'s','Print-ready bestand','2 revisies'] },
        { id:'roll_up',     label:'Roll-up banner',      sub:'Standaard formaat 85×200cm',             price:180, included:['Ontwerp','Print-ready bestand','1 revisie'] },
        { id:'verpakking',  label:'Verpakkingsontwerp',  sub:'Doosjes, zakken, etiketten',             price:450, included:['Ontwerp op maat','Dieline verwerkt','2 revisies'] },
        { id:'menukaart',   label:'Menukaart / prijslijst', sub:'Restaurant, café of salon',           price:175, included:['Ontwerp','Print-ready bestand','1 revisie'] },
        { id:'stickers',    label:'Stickers / etiketten', sub:'Productlabels of merkstickers',         price:150, included:['Ontwerp','Print-ready vector','1 revisie'] },
      ],
      questions:[
        { q:'Heeft u al een logo en huisstijl?', type:'choice', options:['Ja, volledige huisstijl','Enkel logo','Nee – interesse in branding'] },
        { q:'Wat is de gewenste oplage?', type:'choice', options:['Tot 100 stuks','100–500 stuks','500–1.000 stuks','1.000+ stuks'] },
        { q:'Wenst u dat wij ook de drukproductie regelen?', type:'choice', options:['Nee – enkel ontwerp','Ja, inclusief druk','Ja, inclusief levering'] },
        { q:'Heeft u een specifieke deadline?', type:'text', placeholder:'bv. klaar voor 1 april' },
        { q:'Heeft u al een tekst of inhoud klaar?', type:'choice', options:['Ja, volledig','Gedeeltelijk','Nee – interesse in copywriting'] },
      ],
    },
    salespitch: {
      packages:[
        { id:'basis',      label:'Basis',      sub:'Tot 10 slides · opmaak · 1 revisie',               price:750,  included:['Tot 10 slides','Professionele layout','Iconen & infographics','1 revisieronde'] },
        { id:'uitgebreid', label:'Uitgebreid', sub:'Tot 20 slides + animaties + speaker notes',         price:1200, included:['Tot 20 slides','Slide-animaties','Speaker notes','2 revisierondes'] },
        { id:'custom',     label:'Custom',     sub:'Op maat · strategie advies + presentatietraining',  price:2000, included:['Onbeperkt slides','Animaties','Strategie advies','Presentatiecoaching sessie'] },
      ],
      questions:[
        { q:'Voor welk publiek is de presentatie?', type:'choice', options:['Investeerders / pitch deck','Klanten (verkoop)','Intern / medewerkers','Conferentie / event'] },
        { q:'Heeft u al content of teksten klaar?', type:'choice', options:['Ja, volledig','Gedeeltelijk','Nee – interesse in copywriting'] },
        { q:'In welk formaat moet de presentatie?', type:'choice', options:['PowerPoint','Google Slides','Keynote','PDF'] },
        { q:'Wenst u hulp bij de inhoudelijke structuur?', type:'yesno' },
        { q:'Heeft u een deadline of presentatiemoment?', type:'text', placeholder:'bv. investeerdersmeeting op 10 mei' },
      ],
    },
    whatsapp_biz: {
      packages:[
        { id:'setup',    label:'Setup',    sub:'Business account + profiel + auto-antwoorden',  price:280, included:['Business account setup','Welkomstbericht','Afwezigheids-auto-antwoord','QR-code kaartje'] },
        { id:'advanced', label:'Advanced', sub:'+ Catalogus + flows + CRM-koppeling',           price:550, included:['Alles van Setup','Product catalogus','Message flows','CRM-integratie','2u training'] },
      ],
      questions:[
        { q:'Heeft u al een WhatsApp Business account?', type:'choice', options:['Ja, actief','Ja, maar niet optimaal','Nee'] },
        { q:'Voor welk doel wilt u WhatsApp Business?', type:'choice', options:['Klantenservice','Afspraken plannen','Bestellingen opvolgen','Leadgeneratie'] },
        { q:'Wenst u een koppeling met uw CRM of website?', type:'yesno' },
      ],
    },
  },

  extras: {
    hosting_domein: {
      packages:[
        { id:'domein',  label:'Domeinnaam only',  sub:'.be of .com · 1 jaar',                      pricePerYear:20,  included:['Domeinregistratie','1 jaar inbegrepen','Overdracht mogelijk'] },
        { id:'hosting', label:'Hosting only',      sub:'Snelle webhosting · 1 jaar · SSL',         pricePerYear:80,  included:['Webhosting 1 jaar','SSL-certificaat','Automatische back-ups','99.9% uptime'] },
        { id:'bundel',  label:'Hosting + Domein',  sub:'Hosting + domein + zakelijk e-mail',       pricePerYear:120, included:['Webhosting','Domeinnaam','1 zakelijk e-mailadres','SSL','Back-ups'] },
        { id:'premium', label:'Premium bundel',    sub:'Alles + dagelijkse back-ups + CDN',        pricePerYear:180, included:['Webhosting','Domeinnaam','3 e-mailadressen','SSL','CDN','Dagelijkse back-ups','Prioriteitssupport'] },
      ],
      questions:[
        { q:'Heeft u al een domeinnaam?', type:'choice', options:['Ja, wil verhuizen','Ja, houd ik','Nee – nieuw domein'] },
        { q:'Wenst u ook zakelijke e-mailadressen?', type:'choice', options:['Nee','1 adres','2–3 adressen','5+'] },
        { q:'Heeft u al hosting elders?', type:'choice', options:['Ja, wil migreren','Ja, houd ik','Nee – alles van nul'] },
      ],
    },
    seo: {
      packages:[
        { id:'basis',    label:'SEO Audit',       sub:'Technische check + rapport + aanbevelingen',       price:350,           included:['Technische SEO check','Zoekwoordanalyse','Concurrent analyse','Rapport met prioriteiten'] },
        { id:'kwartaal', label:'SEO / kwartaal',  sub:'Doorlopende optimalisatie per kwartaal',           pricePerQuarter:165, included:['On-page optimalisatie','Technische verbeteringen','Maandrapport','Zoekwoordmonitoring'] },
        { id:'blog',     label:'SEO Blogartikel', sub:'Professioneel SEO-artikel (1.000–1.500 woorden)',  price:95, perUnit:true, included:['Zoekwoordonderzoek','SEO-geoptimaliseerde tekst','Meta tags','Interne linking'] },
        { id:'local',    label:'Lokale SEO',      sub:'Google Bedrijfspagina + lokale optimalisatie',     price:280,           included:['Google Bedrijfspagina optimalisatie','Lokale zoekwoorden','NAP-consistentie','Reviewstrategie'] },
        { id:'linkbuild',label:'Linkbuilding',    sub:'Kwalitatieve backlinks via digitale PR',            price:450,           included:['5 kwalitatieve backlinks','Gastartikelen','DA 30+ websites','Rapport'] },
      ],
      hasQuantity:true,
      questions:[
        { q:'Op welke zoekwoorden wilt u gevonden worden?', type:'text', placeholder:'bv. webdesign Gent, loodgieter Antwerpen…' },
        { q:'Wat is uw huidige positie in Google?', type:'choice', options:['Pagina 1 (top 10)','Pagina 2–3','Pagina 4 of verder','Weet ik niet'] },
        { q:'Heeft u al Google Analytics en Search Console?', type:'choice', options:['Ja, beide','Enkel Analytics','Nog niet'] },
        { q:'In welke regio is uw doelgroep?', type:'choice', options:['Lokaal (1 gemeente)','Regionaal (provincie)','Heel België','Internationaal'] },
        { q:'Heeft u al een blog of contentplan?', type:'choice', options:['Ja, actief blog','Blog bestaat maar inactief','Nee'] },
      ],
    },
    onderhoud: {
      packages:[
        { id:'basis',   label:'Op afroep',     sub:'Updates op uurbasis · €50/uur',                   pricePerHour:50,  included:['Updates WordPress/plugins','Technische aanpassingen','Prioriteit binnen 48u'] },
        { id:'monthly', label:'Maandcontract', sub:'Prioriteitsonderhoud · 2u/m inbegrepen',           pricePerMonth:80, included:['2u werk/maand inbegrepen','Automatische updates','Maandelijkse back-up','Prioriteitssupport'] },
        { id:'full',    label:'Full service',  sub:'Onbeperkt updates + back-ups + monitoring 24/7',   pricePerMonth:150,included:['Onbeperkte updates','Dagelijkse back-ups','24/7 monitoring','Security scan','Maandrapport'] },
      ],
      questions:[
        { q:'Op welk CMS staat uw website?', type:'choice', options:['WordPress','Shopify','Webflow','Wix/Squarespace'] },
        { q:'Hoe vaak verwacht u updates of aanpassingen?', type:'choice', options:['Zelden (< 1/maand)','Regelmatig (1–2/maand)','Frequent (wekelijks)'] },
        { q:'Heeft u al back-ups ingesteld?', type:'choice', options:['Ja, automatisch','Ja, manueel','Nee'] },
        { q:'Heeft u al last gehad van hacks of downtime?', type:'yesno' },
      ],
    },
    branding: {
      packages:[
        { id:'logo',      label:'Logo ontwerp',   sub:'Professioneel logo + vectorbestanden + 2 varianten',  price:150,  included:['3 initiële concepten','Vectorbestand (AI/SVG)','PNG + JPG versies','Kleur- & zwart-wit variant'] },
        { id:'huisstijl', label:'Huisstijl',       sub:'Logo + kleurenpalet + typografie + brandguide',      price:350,  included:['Logo ontwerp','Kleurenpalet','Typografieselectie','Brandguide PDF','Social media templates'] },
        { id:'full',      label:'Full branding',   sub:'Alles + stationery + visitekaartje + stijlgids',    price:750,  included:['Huisstijl inbegrepen','Briefpapier','Visitekaartje ontwerp','Volledige stijlgids','E-mailhandtekening'] },
        { id:'rebrand',   label:'Rebranding',      sub:'Herpositionering + nieuw merkidentiteit',            price:1200, included:['Brand audit','Positionering sessie','Volledig nieuwe identiteit','Implementatiegids','3 revisierondes'] },
      ],
      questions:[
        { q:'Heeft u al een bestaand logo of huisstijl?', type:'choice', options:['Ja – wil verfijnen','Ja – volledig vernieuwen','Nee – van nul beginnen'] },
        { q:'Beschrijf uw bedrijf en doelgroep in één zin', type:'text', placeholder:'bv. duurzame kinderkleding voor bewuste ouders' },
        { q:'Welke stijl spreekt u aan?', type:'choice', options:['Modern & minimalistisch','Speels & kleurrijk','Klassiek & luxe','Industrieel & stoer'] },
        { q:'Heeft u kleurvoorkeuren?', type:'text', placeholder:'bv. blauw/wit, oranje als accent…' },
        { q:'Wenst u ook visitekaartjes of briefpapier?', type:'yesno' },
      ],
    },
    copywriting: {
      packages:[
        { id:'per_pagina', label:'Per webpagina',    sub:'SEO-geoptimaliseerde webtekst · 300–500 woorden', price:95, perUnit:true, included:['Zoekwoordverwerking','Meta title + description','Koppen & alinea\'s','1 revisie'] },
        { id:'pakket5',    label:'5 pagina\'s',       sub:'Samenhangende websiteteksten · SEO-focus',        price:425,             included:['5 pagina\'s webtekst','SEO voor elke pagina','Tone of voice afstemming','2 revisierondes'] },
        { id:'pakket10',   label:'10 pagina\'s',      sub:'Volledige website copy · SEO + tone of voice',    price:750,             included:['10 pagina\'s webtekst','SEO optimalisatie','Tone of voice document','3 revisierondes'] },
        { id:'blog_art',   label:'SEO Blog artikel',  sub:'1.000–1.500 woorden · zoekwoordfocus',            price:95, perUnit:true, included:['Zoekwoordonderzoek','SEO-artikel 1.000–1.500w','Meta tags','Interne linking'] },
      ],
      hasQuantity:true,
      questions:[
        { q:'Heeft u al een tone of voice bepaald?', type:'choice', options:['Ja, volledig uitgewerkt','Globaal idee','Nee – samen bepalen'] },
        { q:'Heeft u teksten die herschreven moeten worden?', type:'choice', options:['Nee – volledig nieuw','Ja, bestaande teksten','Combinatie'] },
        { q:'Voor welke pagina\'s heeft u teksten nodig?', type:'text', placeholder:'bv. homepage, over ons, diensten, contact…' },
        { q:'Zijn de zoekwoorden al bepaald?', type:'choice', options:['Ja','Nee – ook SEO-research doen','Niet van toepassing'] },
        { q:'Wenst u ook SEO meta-beschrijvingen?', type:'yesno' },
      ],
    },
  },
};

// ── STATE ──────────────────────────────────────────────
const S = {
  category:'', product:'',
  optPackage:'', optType:'',
  optQuantity:1, optDuration:3, optActeurs:1,
  optExtras:{},
  optKm:0,
  optCustomAmount:0,
  btw:21,
  fotos:[],
};
const CART = [];
const S_ANSWERS = {};
let _editRef = ''; // Referentie bij bewerken vanuit admin (leeg = nieuwe offerte)

// ── INIT ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Logo in header zetten via LOGO_B64 data-URI
  const logoImg = document.getElementById('cfg-logo-img');
  if (logoImg && typeof LOGO_B64 !== 'undefined') logoImg.src = LOGO_B64;
  initSignatureCanvas('sig-klant');
  initSignatureCanvas('sig-bm');

  // ── Edit-modus detectie (vanuit admin 'Bewerken' knop) ──────────────
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('digitify_edit') === '1') {
      const editData = JSON.parse(sessionStorage.getItem('digitify_edit_quote') || 'null');
      if (editData) {
        _editRef = editData.ref || '';
        // Bestaande cartItems herladen
        if (Array.isArray(editData.cartItems) && editData.cartItems.length) {
          CART.length = 0;
          editData.cartItems.forEach(item => CART.push(item));
        }
        // Klantgegevens invullen in stap 4
        const cl = editData.client || {};
        if (cl.name) {
          const parts = cl.name.trim().split(' ');
          const fn = document.getElementById('fname'); if (fn) fn.value = parts[0] || '';
          const ln = document.getElementById('lname'); if (ln) ln.value = parts.slice(1).join(' ') || '';
        }
        if (cl.bedrijf)  { const el = document.getElementById('bedrijf');  if (el) el.value = cl.bedrijf; }
        if (cl.email)    { const el = document.getElementById('email');    if (el) el.value = cl.email; }
        if (cl.telefoon) { const el = document.getElementById('telefoon'); if (el) el.value = cl.telefoon; }
        if (cl.adres)    { const el = document.getElementById('adres');    if (el) el.value = cl.adres; }
        if (cl.btw)      { const el = document.getElementById('btwklant'); if (el) el.value = cl.btw; }
        sessionStorage.removeItem('digitify_edit_quote');
        // Toon bewerk-banner indien aanwezig in HTML
        const editBanner = document.getElementById('edit-mode-banner');
        if (editBanner) {
          editBanner.style.display = 'flex';
          const refSpan = editBanner.querySelector('.emb-ref');
          if (refSpan) refSpan.textContent = _editRef;
        }
      }
    }
  } catch (e) { console.warn('Edit mode init fout:', e); }

  updateCalc();
  renderCart();
  updateBrandVisual(1);
});

// ── BRAND VISUAL: STEP CONTEXT ─────────────────────────
const STEP_ICONS = {
  1: { emoji:'🧭', label:'Stap 1 – Kies uw dienst',      color:'#ffaf51' },
  2: { emoji:'📦', label:'Stap 2 – Kies uw product',     color:'#ffaf51' },
  3: { emoji:'⚙️', label:'Stap 3 – Specificaties',       color:'#ffaf51' },
  4: { emoji:'✉️', label:'Stap 4 – Uw gegevens',         color:'#22c55e' },
};
function updateBrandVisual(step) {
  const wrap = document.getElementById('brand-visual-inner');
  if (!wrap) return;
  const cat = S.category ? CATALOG[S.category] : null;
  const prod = (S.category && S.product) ? CATALOG[S.category]?.products[S.product] : null;
  let emoji, label, color;
  if (step >= 3 && prod) { emoji=prod.emoji; label=prod.label; color=cat.color; }
  else if (step >= 2 && cat) { emoji=cat.emoji; label=cat.label; color=cat.color; }
  else { const si=STEP_ICONS[step]||STEP_ICONS[1]; emoji=si.emoji; label=si.label; color=si.color; }
  wrap.innerHTML = `
    <div class="bv-step-display" style="--bv-color:${color}">
      <div class="bv-emoji">${emoji}</div>
      <div class="bv-label">${label}</div>
      <div class="bv-step-dots">${[1,2,3,4].map(s=>`<span class="bv-dot${s<=step?' active':''}${s===step?' current':''}"></span>`).join('')}</div>
    </div>`;
}

// ── NAVIGATIE ──────────────────────────────────────────
function goStep(n) {
  if (n === 2 && !S.category) return;
  if (n === 3 && !S.product)  return;
  if (n === 4 && CART.length === 0 && !S.product) return;
  document.querySelectorAll('.step-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.cfg-step').forEach(s => {
    const sn = parseInt(s.dataset.s);
    s.classList.remove('active','done');
    if (sn < n) s.classList.add('done');
    if (sn === n) s.classList.add('active');
  });
  document.getElementById('sp-' + n).classList.add('active');
  window.scrollTo({ top:0, behavior:'smooth' });
  if (n === 2) renderProducts();
  if (n === 3) renderOptions();
  updateBrandVisual(n);
}

// ── STAP 1 ─────────────────────────────────────────────
function pickCategory(el) {
  document.querySelectorAll('.cat-tile').forEach(t => t.classList.remove('selected'));
  el.classList.add('selected');
  S.category = el.dataset.cat; S.product = '';
  S.optPackage = ''; S.optType = ''; S.optQuantity = 1; S.optDuration = 3; S.optExtras = {}; S.optKm = 0; S.optCustomAmount = 0;
  document.getElementById('btn-s1-next').disabled = false;
  const cat = CATALOG[S.category];
  const badge = document.getElementById('cat-badge-overlay');
  if(badge){ badge.style.display = 'flex'; badge.style.background = cat.color;
    document.getElementById('cat-badge-emoji').textContent = cat.emoji;
    document.getElementById('cat-badge-label').textContent = cat.label; }
  updateCalc();
  updateBrandVisual(1);
}

// ── STAP 2 ─────────────────────────────────────────────
function renderProducts() {
  if (!S.category) return;
  const cat = CATALOG[S.category];
  document.getElementById('s2-title').textContent = cat.label + ' – Kies uw product';
  document.getElementById('s2-sub').textContent   = cat.sub + ' · Selecteer het gewenste product';
  const startPrices = {
    webdesign:  { onepage:750, multipage:1600, webshop_lite:1250, webshop_full:2400, extra_func:0 },
    media:      { promovideo:450, social_video:450, advert_video:500, bedrijfsvideo:550, aftermovie:550, fotoshoot:450, eventfoto:400, productfilm:550 },
    marketing:  { google_ads:380, meta_ads:380, social_beheer:350, drukwerk:125, salespitch:750, whatsapp_biz:280 },
    extras:     { hosting_domein:20, seo:95, onderhoud:50, branding:150, copywriting:95 },
  };
  const grid = document.getElementById('product-grid');
  grid.innerHTML = Object.entries(cat.products).map(([id,p]) => {
    const sp = (startPrices[S.category] || {})[id];
    return `<button class="tile tile-product${id===S.product?' selected':''}" data-prod="${id}" onclick="pickProduct(this)">
      <div class="prod-emoji">${p.emoji}</div>
      <div class="prod-name">${p.label}</div>
      <div class="prod-sub">${p.sub}</div>
      ${sp ? `<small>${HIDE_PRICES_UI ? 'Prijs op aanvraag' : `Vanaf €${sp.toLocaleString('nl-BE')}`}</small>` : ''}
    </button>`;
  }).join('');
}

function pickProduct(el) {
  document.querySelectorAll('#product-grid .tile').forEach(t => t.classList.remove('selected'));
  el.classList.add('selected');
  S.product = el.dataset.prod; S.optPackage=''; S.optType='';
  S.optQuantity=1; S.optDuration=3; S.optActeurs=1; S.optExtras={}; S.optKm=0; S.optCustomAmount=0;
  document.getElementById('btn-s2-next').disabled = false;
  updateCalc();
  updateBrandVisual(2);
}

// ── STAP 3: RENDER OPTIONS ─────────────────────────────
function renderOptions() {
  if (!S.category || !S.product) return;
  const cat = CATALOG[S.category]; const prod = cat.products[S.product];
  document.getElementById('s3-title').textContent = prod.label + ' – Specificaties';
  document.getElementById('s3-sub').textContent   = prod.sub;
  const panel = document.getElementById('options-panel');
  const ot = prod.optType;
  let html = '';

  if (ot === 'web-package') {
    const p = PRICING.webdesign[S.product];
    if (p.packages.length) html += buildPackageSelector(p.packages, 'Pakket', true);
    html += buildWebExtrasSection();
    if (p.questions) html += buildQuestionsSection(p.questions);
  } else if (ot === 'web-extras-only') {
    html += buildWebExtrasSection();
    const p = PRICING.webdesign[S.product];
    if (p.questions) html += buildQuestionsSection(p.questions);
  } else if (ot === 'video') {
    const p = PRICING.media[S.product];
    html += buildTypeSelector(p.types, 'Type / Duur', true);
    if (p.extras) html += buildExtras(p.extras);
    if (p.extras && p.extras.acteurs && S.optExtras['acteurs']) html += buildActeursSlider();
    html += buildKmSlider();
    if (p.questions) html += buildQuestionsSection(p.questions);
  } else if (ot === 'foto') {
    const p = PRICING.media[S.product];
    html += buildTypeSelector(p.types, 'Type fotoshoot', true);
    if (p.extras) html += buildExtras(p.extras);
    html += buildKmSlider();
    if (p.questions) html += buildQuestionsSection(p.questions);
  } else if (ot === 'ads-package') {
    const p = PRICING.marketing[S.product];
    html += buildPackageSelector(p.packages, 'Pakket / Service', false);
    if (S.optPackage && S.optPackage !== 'setup' && S.optPackage !== 'campagne') html += buildDurationSlider(S.optDuration);
    if (p.questions) html += buildQuestionsSection(p.questions);
  } else if (ot === 'social-monthly') {
    const p = PRICING.marketing[S.product];
    html += buildPackageSelector(p.packages, 'Pakket', false);
    html += buildDurationSlider(S.optDuration);
    if (p.questions) html += buildQuestionsSection(p.questions);
  } else if (ot === 'drukwerk') {
    const p = PRICING.marketing[S.product];
    html += buildTypeSelector(p.types, 'Type drukwerk', true);
    html += buildQuantitySlider(1,10,S.optQuantity,'ontwerpen');
    if (p.questions) html += buildQuestionsSection(p.questions);
  } else if (ot === 'fixed') {
    const p = PRICING.marketing[S.product] || PRICING.extras[S.product];
    if (p.packages) html += buildPackageSelector(p.packages, 'Pakket', true);
    if (p.questions) html += buildQuestionsSection(p.questions);
  } else if (ot === 'email-pkg') {
    const p = PRICING.marketing[S.product];
    html += buildPackageSelector(p.packages, 'Pakket', true);
    if (S.optPackage === 'maand') html += buildDurationSlider(S.optDuration);
    if (p.questions) html += buildQuestionsSection(p.questions);
  } else if (ot === 'hosting') {
    const p = PRICING.extras[S.product];
    html += buildHostingSelector(p.packages);
    if (p.questions) html += buildQuestionsSection(p.questions);
  } else if (ot === 'seo-package') {
    const p = PRICING.extras[S.product];
    html += buildPackageSelector(p.packages, 'SEO-dienst', false);
    if (['blog','kwartaal','linkbuild'].includes(S.optPackage)) html += buildQuantitySlider(1,12,S.optQuantity, S.optPackage==='blog'?'artikels':S.optPackage==='linkbuild'?'maanden':'kwartalen');
    if (p.questions) html += buildQuestionsSection(p.questions);
  } else if (ot === 'maintenance') {
    const p = PRICING.extras[S.product];
    html += buildPackageSelector(p.packages, 'Onderhoud type', false);
    if (S.optPackage==='monthly'||S.optPackage==='full') html += buildDurationSlider(S.optDuration);
    else if (S.optPackage==='basis') html += buildQuantitySlider(1,20,S.optQuantity,'uren');
    if (p.questions) html += buildQuestionsSection(p.questions);
  } else if (ot === 'branding') {
    const p = PRICING.extras[S.product];
    html += buildPackageSelector(p.packages, 'Brandingpakket', true);
    if (p.questions) html += buildQuestionsSection(p.questions);
  } else if (ot === 'copy') {
    const p = PRICING.extras[S.product];
    html += buildPackageSelector(p.packages, 'Copywriting pakket', false);
    if (S.optPackage==='per_pagina'||S.optPackage==='blog_art') html += buildQuantitySlider(1,20,S.optQuantity,"pagina's");
    if (p.questions) html += buildQuestionsSection(p.questions);
  } else if (ot === 'webshop-mgmt') {
    const p = PRICING.extras[S.product];
    html += buildPackageSelector(p.packages, 'Pakket', false);
    html += buildDurationSlider(S.optDuration);
    if (p.questions) html += buildQuestionsSection(p.questions);
  }

  panel.innerHTML = html;
}

// ── BUILDERS ───────────────────────────────────────────
function buildPackageSelector(packages, legend, showIncluded) {
  return `<div class="opts-section">
    <label class="fg-label">${legend}</label>
    <div class="tile-grid tg-${Math.min(packages.length,3)}">
      ${packages.map(pkg => {
        let priceStr = '';
        if (pkg.pricePerMonth===true) priceStr = `€${(pkg.price||0).toLocaleString('nl-BE')}/aflevering`;
        else if (pkg.pricePerMonth)   priceStr = `€${pkg.pricePerMonth.toLocaleString('nl-BE')}/m`;
        else if (pkg.pricePerYear)    priceStr = `€${pkg.pricePerYear.toLocaleString('nl-BE')}/jaar`;
        else if (pkg.pricePerQuarter) priceStr = `€${pkg.pricePerQuarter.toLocaleString('nl-BE')}/kwartaal`;
        else if (pkg.pricePerHour)    priceStr = `€${pkg.pricePerHour.toLocaleString('nl-BE')}/uur`;
        else if (pkg.price)           priceStr = `€${pkg.price.toLocaleString('nl-BE')}`;
        const isSelected = pkg.id === S.optPackage;
        const includedHtml = (showIncluded && pkg.included && pkg.included.length)
          ? `<ul class="pkg-included">${pkg.included.map(i=>`<li>✓ ${i}</li>`).join('')}</ul>` : '';
        return `<button class="tile tile-option${isSelected?' selected':''}"
                  data-val="${pkg.id}" data-type="package" onclick="pickOptPackage(this)">
          <div class="opt-name">${pkg.label}</div>
          <div class="opt-sub">${pkg.sub}</div>
          <em class="opt-price">${HIDE_PRICES_UI ? 'Prijs op aanvraag' : priceStr}</em>
          ${includedHtml}
        </button>`;
      }).join('')}
    </div>
  </div>`;
}

function buildTypeSelector(types, legend, showIncluded) {
  return `<div class="opts-section">
    <label class="fg-label">${legend}</label>
    <div class="tile-grid tg-${Math.min(types.length,3)}">
      ${types.map(t => {
        const isSelected = t.id === S.optType;
        const includedHtml = (showIncluded && t.included && t.included.length)
          ? `<ul class="pkg-included">${t.included.map(i=>`<li>✓ ${i}</li>`).join('')}</ul>` : '';
        return `<button class="tile tile-option${isSelected?' selected':''}"
                data-val="${t.id}" data-type="mediatype" onclick="pickOptType(this)">
          <div class="opt-name">${t.label}</div>
          ${t.sub?`<div class="opt-sub">${t.sub}</div>`:''}
          <em class="opt-price">${HIDE_PRICES_UI ? 'Prijs op aanvraag' : `€${t.price.toLocaleString('nl-BE')}`}</em>
          ${includedHtml}
        </button>`;
      }).join('')}
    </div>
  </div>`;
}

function buildHostingSelector(packages) {
  return `<div class="opts-section">
    <label class="fg-label">Hosting / Domeinkeuze</label>
    <div class="tile-grid tg-${Math.min(packages.length,3)}">
      ${packages.map(pkg => {
        const isSelected = pkg.id === S.optPackage;
        const includedHtml = pkg.included ? `<ul class="pkg-included">${pkg.included.map(i=>`<li>✓ ${i}</li>`).join('')}</ul>` : '';
        return `<button class="tile tile-option${isSelected?' selected':''}"
                data-val="${pkg.id}" data-type="package" onclick="pickOptPackage(this)">
          <div class="opt-name">${pkg.label}</div>
          <div class="opt-sub">${pkg.sub}</div>
          <em class="opt-price">${HIDE_PRICES_UI ? 'Prijs op aanvraag' : `€${pkg.pricePerYear.toLocaleString('nl-BE')}/jaar`}</em>
          ${includedHtml}
        </button>`;
      }).join('')}
    </div>
  </div>`;
}

function buildExtras(extras) {
  return `<div class="opts-section">
    <label class="fg-label">Extra opties</label>
    <div class="chk-list">
      ${Object.entries(extras).map(([key,ex]) => `
        <label class="chk">
          <input type="checkbox" data-extra="${key}" ${S.optExtras[key]?'checked':''}
                 onchange="toggleExtra('${key}',this.checked)"/>
          <span></span>
          ${ex.label}
          <em>${HIDE_PRICES_UI ? 'Prijs op aanvraag' : (ex.perUnit?`+€${ex.price}/st.`:`+€${ex.price}`)}</em>
        </label>`).join('')}
    </div>
  </div>`;
}

function buildWebExtrasSection() {
  const exts = PRICING.webdesign._webExtras;
  const grouped = {
    'Hosting & Infrastructuur': ['hosting','domein','email_zak'],
    'Extra Functionaliteiten':  ['reservering','boeking','catalogus','menu_rest','crm','offerte_sys','chat','blog','reviews','social_int','betalen','meertalig','popup'],
    'Onderhoud & Opleiding':    ['workshop'],
  };
  let html = '';
  for (const [groupLabel,keys] of Object.entries(grouped)) {
    html += `<div class="opts-section">
      <label class="fg-label">${groupLabel}</label>
      <div class="chk-list">
        ${keys.map(key => {
          const ex = exts[key]; if (!ex) return '';
          const ps = ex.price === 0
            ? `<em style="color:var(--green);font-weight:700">${ex.note}</em>`
            : `<em>+€${ex.price} <small style="font-weight:400">${ex.note}</small></em>`;
          return `<label class="chk">
            <input type="checkbox" data-extra="${key}" ${S.optExtras[key]?'checked':''}
                   onchange="toggleExtra('${key}',this.checked)"/>
            <span></span>${ex.label}${ps}
          </label>`;
        }).join('')}
      </div>
    </div>`;
  }
  return html;
}

function buildKmSlider() {
  const km = S.optKm || 0;
  const billableKm = Math.max(0, km - 50);
  const kmCost = billableKm * KM_RATE * 2;
  let costStr = '';
  if (km > 0 && km <= 50) {
    costStr = '<em class="km-cost-inline km-free">✓ inbegrepen</em>';
  } else if (km > 50) {
    costStr = `<em class="km-cost-inline">${HIDE_PRICES_UI ? 'Prijs op aanvraag' : `+€${kmCost.toLocaleString('nl-BE',{minimumFractionDigits:2,maximumFractionDigits:2})} heen &amp; terug`}</em>`;
  }
  return `<div class="opts-section km-section">
    <label class="fg-label">
      📍 Verplaatsing
      <span class="fg-val" id="km-display">${km} km ${costStr}</span>
    </label>
    <div class="num-row">
      <button class="num-btn" onclick="nudgeKm(-10)">−</button>
      <input type="range" id="km-slider" min="0" max="1000" step="5" value="${km}" oninput="updateKm(this.value)"/>
      <button class="num-btn" onclick="nudgeKm(10)">+</button>
    </div>
    <div class="range-ticks"><span>0km</span><span>250km</span><span>500km</span><span>750km</span><span>1000km</span></div>
    <p class="km-note">Verplaatsingskosten: €${KM_RATE.toFixed(2)}/km · heen en terug · <strong>50km altijd inbegrepen</strong></p>
  </div>`;
}

function buildQuestionsSection(questions) {
  if (!questions || questions.length === 0) return '';
  const customAmt = S.optCustomAmount || 0;
  return `<div class="questions-dropdown">
    <button class="questions-toggle" type="button" onclick="toggleQuestions(this)" aria-expanded="false">
      <div class="questions-toggle-left">
        <span class="questions-toggle-icon">?</span>
        <div>
          <div class="questions-toggle-label">Vragen voor een nauwkeurige offerte</div>
          <div class="questions-toggle-sub">${questions.length} vragen · beantwoord voor een betere prijsopgave</div>
        </div>
      </div>
      <span class="questions-toggle-chevron" aria-hidden="true">&#8964;</span>
    </button>
    <div class="questions-body" aria-hidden="true">
      <div class="questions-list">
        ${questions.map((q,i) => buildQuestion(q,i)).join('')}
      </div>
      <div class="custom-amount-section">
        <div class="custom-amount-top">
          <div class="custom-amount-labels">
            <span class="custom-amount-title">Meerwerk of specifieke wensen</span>
            <span class="custom-amount-badge">Optioneel</span>
          </div>
          <p class="custom-amount-desc">Voeg een bedrag toe voor extra werk of maatwerk dat hierboven niet staat. Dit verschijnt als aparte regel in uw offerte.</p>
        </div>
        <div class="custom-amount-wrap">
          <span class="custom-amount-prefix">+ €</span>
          <input type="number" class="custom-amount-input" min="0" step="50"
                 placeholder="0" value="${customAmt > 0 ? customAmt : ''}"
                 oninput="updateCustomAmount(this.value)"/>
          <span class="custom-amount-suffix">excl. BTW</span>
        </div>
      </div>
    </div>
  </div>`;
}

function toggleQuestions(btn) {
  const body = btn.nextElementSibling;
  const isOpen = btn.getAttribute('aria-expanded') === 'true';
  const nowOpen = !isOpen;
  btn.setAttribute('aria-expanded', String(nowOpen));
  body.setAttribute('aria-hidden', String(!nowOpen));
  body.classList.toggle('is-open', nowOpen);
  btn.querySelector('.questions-toggle-chevron').classList.toggle('rotated', nowOpen);
}

function buildQuestion(q, i) {
  const key = `${S.category}_${S.product}_${i}`;
  const saved = S_ANSWERS[key] || '';
  if (q.type === 'choice') {
    return `<div class="question-item">
      <div class="q-label">${i+1}. ${q.q}</div>
      <div class="q-choices">
        ${q.options.map((opt,oi) => `
          <button class="q-choice-btn${saved===opt?' selected':''}"
                  onclick="setAnswer(${i},'${opt.replace(/'/g,"\\'")}',this)">${opt}</button>
        `).join('')}
      </div>
    </div>`;
  } else if (q.type === 'yesno') {
    return `<div class="question-item">
      <div class="q-label">${i+1}. ${q.q}</div>
      <div class="q-choices">
        <button class="q-choice-btn${saved==='Ja'?' selected':''}" onclick="setAnswer(${i},'Ja',this)">✓ Ja</button>
        <button class="q-choice-btn${saved==='Nee'?' selected':''}" onclick="setAnswer(${i},'Nee',this)">✗ Nee</button>
      </div>
    </div>`;
  } else {
    return `<div class="question-item">
      <div class="q-label">${i+1}. ${q.q}</div>
      <input class="q-answer-input" type="text" placeholder="${q.placeholder||'Uw antwoord…'}"
             value="${saved}" oninput="updateQuestionAnswer(${i},this.value)"/>
    </div>`;
  }
}

function buildQuantitySlider(min,max,val,unit) {
  return `<div class="opts-section">
    <label class="fg-label">Aantal ${unit} <span class="fg-val" id="qty-val">${val}</span></label>
    <div class="num-row">
      <button class="num-btn" onclick="nudgeQty(-1)">−</button>
      <input type="range" id="qty-slider" min="${min}" max="${max}" value="${val}" oninput="updateQty(this.value)"/>
      <button class="num-btn" onclick="nudgeQty(1)">+</button>
    </div>
    <div class="range-ticks"><span>${min}</span><span>${Math.round(max/4)}</span><span>${Math.round(max/2)}</span><span>${Math.round(max*3/4)}</span><span>${max}</span></div>
  </div>`;
}

function buildActeursSlider() {
  return `<div class="opts-section">
    <label class="fg-label">👤 Acteurs / modellen <span class="fg-val" id="act-val">${S.optActeurs}</span></label>
    <div class="num-row">
      <button class="num-btn" onclick="nudgeActeurs(-1)">−</button>
      <input type="range" id="act-slider" min="0" max="5" value="${S.optActeurs}" oninput="updateActeurs(this.value)"/>
      <button class="num-btn" onclick="nudgeActeurs(1)">+</button>
    </div>
    <div class="range-ticks"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>
    <p class="km-note">€120 per acteur/model</p>
  </div>`;
}

function buildDurationSlider(val) {
  return `<div class="opts-section">
    <label class="fg-label">Looptijd <span class="fg-val" id="dur-val">${val} maanden</span></label>
    <div class="num-row">
      <button class="num-btn" onclick="nudgeDur(-1)">−</button>
      <input type="range" id="dur-slider" min="1" max="12" value="${val}" oninput="updateDur(this.value)"/>
      <button class="num-btn" onclick="nudgeDur(1)">+</button>
    </div>
    <div class="range-ticks"><span>1m</span><span>3m</span><span>6m</span><span>9m</span><span>12m</span></div>
  </div>`;
}

// ── ANTWOORDEN ─────────────────────────────────────────
function setAnswer(idx, val, btn) {
  S_ANSWERS[`${S.category}_${S.product}_${idx}`] = val;
  const parent = btn.closest('.q-choices');
  if (parent) parent.querySelectorAll('.q-choice-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}
function updateQuestionAnswer(idx, val) { S_ANSWERS[`${S.category}_${S.product}_${idx}`] = val; }
function updateCustomAmount(val) { S.optCustomAmount = parseFloat(val) || 0; updateCalc(); }
function getAnswers(cat,prod,questions) {
  if (!questions) return [];
  return questions.map((q,i) => ({ question:q.q||q, answer:S_ANSWERS[`${cat}_${prod}_${i}`]||'' }));
}

// ── OPTIE-EVENTS ───────────────────────────────────────
function pickOptPackage(el) {
  document.querySelectorAll('[data-type="package"]').forEach(t => t.classList.remove('selected'));
  el.classList.add('selected'); S.optPackage = el.dataset.val;
  updateCalc(); renderOptions();
}
function pickOptType(el) {
  document.querySelectorAll('[data-type="mediatype"]').forEach(t => t.classList.remove('selected'));
  el.classList.add('selected'); S.optType = el.dataset.val; updateCalc();
  // For drukwerk, re-render so the quantity slider updates correctly
  if (S.product === 'drukwerk') renderOptions();
}
function toggleExtra(key, checked) {
  S.optExtras[key] = checked;
  updateCalc();
  if (key === 'acteurs') renderOptions();
}
function updateQty(val) { S.optQuantity=parseInt(val); const d=document.getElementById('qty-val'); if(d) d.textContent=val; updateCalc(); }
function nudgeQty(d2) { const sl=document.getElementById('qty-slider'); if(!sl) return; const n=Math.min(parseInt(sl.max),Math.max(parseInt(sl.min),S.optQuantity+d2)); sl.value=n; updateQty(n); }
function updateDur(val) { S.optDuration=parseInt(val); const d=document.getElementById('dur-val'); if(d) d.textContent=val+' maand'+(parseInt(val)>1?'en':''); updateCalc(); }
function nudgeDur(d2) { const sl=document.getElementById('dur-slider'); if(!sl) return; const n=Math.min(12,Math.max(1,S.optDuration+d2)); sl.value=n; updateDur(n); }
function updateActeurs(val) { S.optActeurs=parseInt(val); const d=document.getElementById('act-val'); if(d) d.textContent=val; updateCalc(); }
function nudgeActeurs(d2) { const sl=document.getElementById('act-slider'); if(!sl) return; const n=Math.min(5,Math.max(0,S.optActeurs+d2)); sl.value=n; updateActeurs(n); }
function updateKm(val) {
  S.optKm = parseInt(val);
  const km = S.optKm;
  const billableKm = Math.max(0, km - 50);
  const kmCost = billableKm * KM_RATE * 2;
  let costStr = '';
  if (km > 0 && km <= 50) {
    costStr = '<em class="km-cost-inline km-free">✓ inbegrepen</em>';
  } else if (km > 50) {
    costStr = `<em class="km-cost-inline">${HIDE_PRICES_UI ? 'Prijs op aanvraag' : `+€${kmCost.toLocaleString('nl-BE',{minimumFractionDigits:2,maximumFractionDigits:2})} heen &amp; terug`}</em>`;
  }
  const d = document.getElementById('km-display');
  if (d) d.innerHTML = `${km} km ${costStr}`;
  updateCalc();
}
function nudgeKm(d2) { const sl=document.getElementById('km-slider'); if(!sl) return; const n=Math.min(1000,Math.max(0,S.optKm+d2)); sl.value=n; updateKm(n); }
function setBTW(pct) { S.btw=pct; document.getElementById('btw21-btn').classList.toggle('active',pct===21); document.getElementById('btw0-btn').classList.toggle('active',pct===0); updateCalc(); }

// ── PRIJSBEREKENING ────────────────────────────────────
function calcPrice(state) {
  const ss = state || S;
  if (!ss.category || !ss.product) return { excl:0, btwAmt:0, total:0, items:[], includedItems:[] };
  let base = 0; const items = []; let includedItems = [];

  if (ss.category === 'webdesign') {
    const p = PRICING.webdesign[ss.product];
    if (p && p.packages && p.packages.length) {
      const pkg = p.packages.find(x => x.id === ss.optPackage);
      if (pkg) {
        items.push({ label:CATALOG.webdesign.products[ss.product].label+' – '+pkg.label, price:pkg.price });
        base += pkg.price;
        if (pkg.included) includedItems = pkg.included;
      }
    }
    const exts = PRICING.webdesign._webExtras;
    Object.entries(ss.optExtras||{}).forEach(([key,on]) => {
      if (on && exts[key]) {
        if (exts[key].price > 0) { items.push({ label:exts[key].label, price:exts[key].price }); base += exts[key].price; }
        else includedItems.push(exts[key].label+' (inbegrepen)');
      }
    });
  } else if (ss.category === 'media') {
    const p = PRICING.media[ss.product];
    const type = (p.types||[]).find(x => x.id===ss.optType);
    if (type) { items.push({ label:type.label, price:type.price }); base += type.price; if(type.included) includedItems = [...type.included]; }
    if (p.extras) {
      Object.entries(p.extras).forEach(([key,ex]) => {
        if (ss.optExtras[key]) {
          const ep = ex.perUnit ? ex.price*(key==='acteurs'?ss.optActeurs:ss.optQuantity) : ex.price;
          if (ep > 0) { items.push({ label:ex.label, price:ep }); base += ep; }
        }
      });
    }
  } else if (ss.category === 'marketing') {
    const p = PRICING.marketing[ss.product];
    if (ss.product === 'drukwerk') {
      const type = (p.types||[]).find(x => x.id===ss.optType);
      if (type) { const t=type.price*ss.optQuantity; items.push({ label:`${type.label} × ${ss.optQuantity}`, price:t }); base+=t; if(type.included) includedItems=[...type.included]; }
    } else {
      const pkg = (p.packages||[]).find(x => x.id===ss.optPackage);
      if (pkg) {
        if (pkg.included) includedItems = [...pkg.included];
        if (pkg.pricePerMonth && pkg.pricePerMonth !== true) {
          if (pkg.price) { items.push({ label:`${pkg.label} – Setup`, price:pkg.price }); base+=pkg.price; }
          const m=pkg.pricePerMonth*ss.optDuration;
          items.push({ label:`${pkg.label} – ${ss.optDuration}m beheer`, price:m }); base+=m;
        } else if (pkg.pricePerMonth === true) {
          const t=pkg.price*ss.optQuantity||pkg.price;
          items.push({ label:pkg.label, price:t }); base+=t;
        } else if (pkg.price) { items.push({ label:pkg.label, price:pkg.price }); base+=pkg.price; }
      }
    }
  } else if (ss.category === 'extras') {
    const p = PRICING.extras[ss.product];
    if (ss.product === 'hosting_domein') {
      const pkg=(p.packages||[]).find(x=>x.id===ss.optPackage);
      if (pkg) { items.push({ label:pkg.label, price:pkg.pricePerYear }); base+=pkg.pricePerYear; if(pkg.included) includedItems=[...pkg.included]; }
    } else if (ss.product === 'seo') {
      const pkg=(p.packages||[]).find(x=>x.id===ss.optPackage);
      if (pkg) {
        if(pkg.included) includedItems=[...pkg.included];
        if (pkg.pricePerQuarter) { const t=pkg.pricePerQuarter*ss.optQuantity; items.push({ label:`${pkg.label} × ${ss.optQuantity} kw.`, price:t }); base+=t; }
        else if (pkg.price&&pkg.perUnit) { const t=pkg.price*ss.optQuantity; items.push({ label:`${pkg.label} × ${ss.optQuantity}`, price:t }); base+=t; }
        else if (pkg.price) { items.push({ label:pkg.label, price:pkg.price }); base+=pkg.price; }
      }
    } else if (ss.product === 'onderhoud') {
      const pkg=(p.packages||[]).find(x=>x.id===ss.optPackage);
      if (pkg) {
        if(pkg.included) includedItems=[...pkg.included];
        if (pkg.pricePerHour) { const t=pkg.pricePerHour*ss.optQuantity; items.push({ label:`Onderhoud – ${ss.optQuantity}u`, price:t }); base+=t; }
        else if (pkg.pricePerMonth) { const t=pkg.pricePerMonth*ss.optDuration; items.push({ label:`${pkg.label} – ${ss.optDuration}m`, price:t }); base+=t; }
      }
    } else if (ss.product === 'copywriting') {
      const pkg=(p.packages||[]).find(x=>x.id===ss.optPackage);
      if (pkg) {
        if(pkg.included) includedItems=[...pkg.included];
        if (pkg.perUnit) { const t=pkg.price*ss.optQuantity; items.push({ label:`${pkg.label} × ${ss.optQuantity}`, price:t }); base+=t; }
        else if (pkg.price) { items.push({ label:pkg.label, price:pkg.price }); base+=pkg.price; }
      }
    } else {
      const pkg=(p.packages||[]).find(x=>x.id===ss.optPackage);
      if (pkg) {
        if(pkg.included) includedItems=[...pkg.included];
        if (pkg.price) { items.push({ label:pkg.label, price:pkg.price }); base+=pkg.price; }
      }
    }
  }

  // KM-vergoeding (heen & terug, eerste 50km gratis)
  const km = ss.optKm || 0;
  if (km > 50 && ON_LOCATION.has(ss.product)) {
    const billableKm = km - 50;
    const kmCost = billableKm * KM_RATE * 2;
    items.push({ label:`Verplaatsing ${km}km (50km inbegrepen, ${billableKm}km × €${KM_RATE}/km × 2)`, price:kmCost });
    base += kmCost;
  }

  // Aangepast bedrag voor extra werk
  const customAmt = ss.optCustomAmount || 0;
  if (customAmt > 0) {
    items.push({ label:'Extra werk / maatwerk', price:customAmt });
    base += customAmt;
  }

  const excl=base; const btwAmt=excl*ss.btw/100; const total=excl+btwAmt;
  return { excl, btwAmt, total, items, includedItems };
}

// ── CART ───────────────────────────────────────────────
function _showCartValidationError(msg) {
  const panel = document.getElementById('options-panel');
  if (panel) { panel.classList.add('cart-error-shake'); setTimeout(()=>panel.classList.remove('cart-error-shake'), 400); }
  let t = document.getElementById('cart-toast');
  if (!t) { t = document.createElement('div'); t.id = 'cart-toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'cart-toast cart-toast-show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('cart-toast-show'), 3200);
}

function addToCart() {
  // ── Pakket / type validatie ────────────────────────────────────────
  if (S.category && S.product) {
    const prod = CATALOG[S.category].products[S.product];
    const ot = prod.optType;
    const needsPkg  = ['web-package','ads-package','social-monthly','hosting','seo-package','maintenance','branding','copy'];
    const needsType = ['video','foto','drukwerk'];
    if (needsPkg.includes(ot) && !S.optPackage) {
      _showCartValidationError('⚠️ Kies eerst een pakket voordat u dit product toevoegt.');
      return;
    }
    if (needsType.includes(ot) && !S.optType) {
      _showCartValidationError('⚠️ Selecteer eerst een type / duur om verder te gaan.');
      return;
    }
  }
  const { items, excl, btwAmt, total, includedItems } = calcPrice();
  if (items.length === 0) {
    _showCartValidationError('⚠️ Selecteer de opties voor dit product om het toe te voegen.');
    return;
  }
  const cat  = CATALOG[S.category];
  const prod = cat.products[S.product];
  const pData = PRICING[S.category][S.product];
  const answers = getAnswers(S.category, S.product, pData?.questions);
  CART.push({
    id:Date.now(), category:S.category, product:S.product,
    catLabel:cat.label, prodLabel:prod.label, catEmoji:cat.emoji, catColor:cat.color,
    optPackage:S.optPackage, optType:S.optType, optQuantity:S.optQuantity,
    optDuration:S.optDuration, optActeurs:S.optActeurs, optKm:S.optKm, optCustomAmount:S.optCustomAmount,
    optExtras:{...S.optExtras}, btw:S.btw,
    comment:document.getElementById('commentaar')?.value||'',
    answers, items:[...items], includedItems:[...includedItems], excl, btwAmt, total,
  });
  showCartSuccess(prod.label);
  S.category=''; S.product=''; S.optPackage=''; S.optType='';
  S.optQuantity=1; S.optDuration=3; S.optActeurs=1; S.optExtras={}; S.optKm=0; S.optCustomAmount=0;
  document.querySelectorAll('.cat-tile').forEach(t=>t.classList.remove('selected'));
  const nb=document.getElementById('btn-s1-next'); if(nb) nb.disabled=true;
  const ce=document.getElementById('commentaar'); if(ce) ce.value='';
  renderCart(); updateCalc(); goStep(1);
}

function showCartSuccess(lbl) {
  let t=document.getElementById('cart-toast');
  if(!t){t=document.createElement('div');t.id='cart-toast';document.body.appendChild(t);}
  t.textContent=`✓ ${lbl} toegevoegd aan offerte`;
  t.className='cart-toast cart-toast-show';
  clearTimeout(t._timer); t._timer=setTimeout(()=>t.classList.remove('cart-toast-show'),2800);
}

function removeFromCart(id) {
  // Animeer item uit vóór verwijdering
  const cardEl = document.querySelector(`.cart-item[data-id="${id}"]`);
  if (cardEl) {
    cardEl.classList.add('removing');
    setTimeout(() => {
      const idx = CART.findIndex(c => c.id === id);
      if (idx > -1) CART.splice(idx, 1);
      renderCart(); updateCalc();
    }, 240);
  } else {
    const idx = CART.findIndex(c => c.id === id);
    if (idx > -1) CART.splice(idx, 1);
    renderCart(); updateCalc();
  }
}

function editCartItem(itemId) {
  const idx=CART.findIndex(c=>c.id===itemId);
  if(idx===-1) return;
  const item=CART[idx];
  // Verwijder tijdelijk uit cart
  CART.splice(idx,1);
  // Herstel state
  S.category     = item.category;
  S.product      = item.product;
  S.optPackage   = item.optPackage   || '';
  S.optType      = item.optType      || '';
  S.optDuration  = item.optDuration  || 3;
  S.optQuantity  = item.optQuantity  || 1;
  S.optActeurs   = item.optActeurs   || 1;
  S.optExtras    = item.optExtras    ? JSON.parse(JSON.stringify(item.optExtras)) : {};
  S.optKm        = item.optKm        || 0;
  S.optCustomAmount = item.optCustomAmount || 0;
  S.btw          = item.btw          || 21;
  // Markeer categorie-tegel
  document.querySelectorAll('.cat-tile').forEach(t=>t.classList.remove('selected'));
  const catTile=document.querySelector(`[data-cat="${item.category}"]`);
  if(catTile){ catTile.classList.add('selected'); document.getElementById('btn-s1-next').disabled=false; }
  renderCart(); updateCalc();
  goStep(3);
}

// ── RENDER CART – VEREENVOUDIGD ────────────────────────
function renderCart() {
  const section = document.getElementById('cart-section');
  const counter = document.getElementById('cart-count');
  const sticky  = document.getElementById('btn-finalize-sticky');
  const finalBtn= document.getElementById('btn-go-step4');
  if (!section) return;
  if (CART.length === 0) {
    section.style.display='none';
    if(counter) counter.style.display='none';
    if(sticky)  sticky.style.display='none';
    if(finalBtn) finalBtn.style.display='none';
    return;
  }
  section.style.display='block';
  if(counter)  { counter.textContent=CART.length; counter.style.display='inline-flex'; }
  if(sticky)   sticky.style.display='flex';
  if(finalBtn) finalBtn.style.display='inline-flex';

  const fmt = v=>HIDE_PRICES_UI ? 'Prijs op aanvraag' : `€${v.toLocaleString('nl-BE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const cartTotal = CART.reduce((s,c)=>s+c.total,0);

  section.innerHTML = `
    <div class="cart-header">
      <span class="cart-title">🛒 Mijn offerte <span class="cart-count-badge">${CART.length}</span></span>
      <span class="cart-grand-total">${fmt(cartTotal)}</span>
    </div>
    <div class="cart-items">
      ${CART.map(item=>`
        <div class="cart-item" data-id="${item.id}">
          <div class="ci-color-bar" style="background:${item.catColor}"></div>
          <div class="ci-icon-wrap" style="background:${item.catColor}18">
            <span class="ci-prod-emoji">${PROD_ICONS[item.product]||item.catEmoji}</span>
          </div>
          <div class="ci-body">
            <div class="ci-top">
              <div class="ci-names">
                <strong>${item.prodLabel}</strong>
                <small style="color:${item.catColor}">${item.catLabel}</small>
              </div>
              <div class="ci-right">
                <span class="ci-price">${fmt(item.total)}</span>
                <button class="ci-edit" onclick="editCartItem(${item.id})" title="Bewerken">🔧</button>
                <button class="ci-del" onclick="removeFromCart(${item.id})" title="Verwijderen">✕</button>
              </div>
            </div>
          </div>
        </div>`).join('')}
    </div>
    <div class="cart-total-row">
      <span>Totaal offerte (incl. BTW)</span>
      <span class="cart-total-amount">${fmt(cartTotal)}</span>
    </div>`;
}

// ── PRICE DISPLAY ──────────────────────────────────────
function updateCalc() {
  const { excl, btwAmt, total, items, includedItems } = calcPrice();
  const fmt = v=>HIDE_PRICES_UI ? 'Prijs op aanvraag' : (v>0?`€${v.toLocaleString('nl-BE',{minimumFractionDigits:2,maximumFractionDigits:2})}`:'—');
  document.getElementById('p-excl').textContent    = fmt(excl);
  document.getElementById('p-btw').textContent     = fmt(btwAmt);
  document.getElementById('p-btw-lbl').textContent = `BTW ${S.btw}%`;
  // Prijs animeren bij wijziging
  const totalEl   = document.getElementById('p-total');
  const prevTotal = totalEl.textContent;
  const newTotal  = fmt(total);
  totalEl.textContent = newTotal;
  if (!HIDE_PRICES_UI && total > 0 && newTotal !== prevTotal) {
    totalEl.classList.remove('price-pulse');
    void totalEl.offsetWidth; // reflow: animatie herstarten
    totalEl.classList.add('price-pulse');
  }
  const bd = document.getElementById('pc-breakdown');
  let bdHtml = items.length ? items.map(it=>`<div class="pc-breakdown-item"><span>${it.label}</span><span>${fmt(it.price)}</span></div>`).join('') : '';
  if (includedItems && includedItems.length) {
    bdHtml += `<div class="pc-included-header">Inbegrepen:</div>`;
    bdHtml += includedItems.map(inc=>`<div class="pc-included-item"><span>✓ ${inc}</span></div>`).join('');
  }
  bd.innerHTML = bdHtml;
  updateSummary();
}

function updateSummary() {
  const ph=document.getElementById('ss-placeholder');
  const ssi=document.getElementById('ss-items');
  const badge=document.getElementById('cat-badge-overlay');
  if (!S.category) {
    if(ph) ph.style.display='flex';
    if(ssi) ssi.style.display='none';
    if(badge && CART.length===0) badge.style.display='none';
    return;
  }
  if(ph) ph.style.display='none';
  if(ssi) ssi.style.display='block';
  const cat=CATALOG[S.category]; const prod=S.product?cat.products[S.product]:null;
  if(badge){ badge.style.display='flex'; badge.style.background=cat.color; }
  const badgeEmoji=document.getElementById('cat-badge-emoji');
  const badgeLabel=document.getElementById('cat-badge-label');
  if(badgeEmoji) badgeEmoji.textContent=cat.emoji;
  if(badgeLabel) badgeLabel.textContent=cat.label;
  if(!ssi) return;
  let html=`<div class="ss-item"><span class="ssi-label">Categorie</span><span class="ssi-val">${cat.label}</span></div>`;
  if(prod) html+=`<div class="ss-item"><span class="ssi-label">Product</span><span class="ssi-val">${prod.label}</span></div>`;
  ssi.innerHTML=html;
}


// ══════════════════════════════════════════════════════
// OFFERTE VERSTUREN + PDF GENERATIE  (WP versie)
// Opslaan via WP AJAX – geen localStorage
// ══════════════════════════════════════════════════════

// ── STAP 4 VALIDATIE ─────────────────────────────────
function validateStep4() {
  // Clear vorige fouten
  document.querySelectorAll('.cfg-field-error').forEach(el => el.remove());
  document.querySelectorAll('.cfg-field-invalid').forEach(el => el.classList.remove('cfg-field-invalid'));
  document.querySelectorAll('.cfg-validation-summary').forEach(el => el.remove());

  const errorMsgs = [];
  const errors = [];

  function markErr(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('cfg-field-invalid');
    const span = document.createElement('span');
    span.className = 'cfg-field-error';
    span.textContent = msg.replace('⚠ ', '');
    el.parentNode.insertBefore(span, el.nextSibling);
    errors.push(id);
    errorMsgs.push(msg.replace('⚠ ', ''));
  }

  const fname    = (document.getElementById('fname')?.value    || '').trim();
  const lname    = (document.getElementById('lname')?.value    || '').trim();
  const email    = (document.getElementById('email')?.value    || '').trim();
  const telefoon = (document.getElementById('telefoon')?.value || '').trim();

  if (!fname) markErr('fname', 'Voornaam is verplicht');
  if (!lname) markErr('lname', 'Achternaam is verplicht');
  if (!email) {
    markErr('email', 'E-mailadres is verplicht');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    markErr('email', 'Ongeldig e-mailadres (bv. naam@bedrijf.be)');
  }
  if (!telefoon) {
    markErr('telefoon', 'Telefoonnummer is verplicht');
  } else {
    const digits = telefoon.replace(/[\s\-().+]/g, '');
    if (!/^\d{9,13}$/.test(digits)) {
      markErr('telefoon', 'Ongeldig telefoonnummer (bv. +32 4xx xx xx xx of 04xx xx xx xx)');
    }
  }

  if (errors.length > 0) {
    // Toon samenvatting bovenaan het formulier
    const step4Form = document.getElementById('step-4');
    const paneTitle = step4Form?.querySelector('.pane-title');
    if (paneTitle && errorMsgs.length > 0) {
      const summary = document.createElement('div');
      summary.className = 'cfg-validation-summary';
      summary.innerHTML = `
        <div class="cfg-validation-summary-icon">⚠️</div>
        <div class="cfg-validation-summary-body">
          <div class="cfg-validation-summary-title">Controleer de volgende velden:</div>
          <ul class="cfg-validation-summary-list">${errorMsgs.map(m=>`<li>${m}</li>`).join('')}</ul>
        </div>`;
      paneTitle.parentNode.insertBefore(summary, paneTitle.nextSibling);
    }
    const firstEl = document.getElementById(errors[0]);
    if (firstEl) firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return errors.length === 0;
}

async function sendQuote() {
  // ── Valideer Gegevens-stap ────────────────────────
  if (!validateStep4()) return;

  const allItems = CART.length > 0 ? CART : null;
  if (!allItems && !S.product) { alert('Voeg eerst een dienst toe aan uw offerte.'); return; }

  // ── Formulierdata ophalen (nodig voor AJAX, ook bij PDF-fout) ────
  const now      = new Date();
  const dateStr  = now.toLocaleDateString('nl-BE',{day:'2-digit',month:'2-digit',year:'numeric'});
  const expDate  = new Date(now); expDate.setDate(expDate.getDate()+30);
  const expStr   = expDate.toLocaleDateString('nl-BE',{day:'2-digit',month:'2-digit',year:'numeric'});
  const refNr    = `DG-${Date.now().toString().slice(-6)}`;
  const fname    = document.getElementById('fname')?.value    || '—';
  const lname    = document.getElementById('lname')?.value    || '—';
  const bedrijf  = document.getElementById('bedrijf')?.value  || '';
  const adres    = document.getElementById('adres')?.value    || '';
  const emailVal = document.getElementById('email')?.value    || '';
  const telefoon = document.getElementById('telefoon')?.value || '';
  const btwklant = document.getElementById('btwklant')?.value || '';
  const opm      = document.getElementById('opmerkingen')?.value || '';
  const clientName    = `${fname} ${lname}`.trim().replace(/^—$/,'');
  const clientDisplay = bedrijf || clientName;

  // ── Verzend-knop uitschakelen vóór PDF-generatie ─────
  const sendBtn = document.getElementById('btn-send-quote');
  const _btnOrigText = sendBtn ? sendBtn.innerHTML : '';
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.classList.add('is-loading');
    sendBtn.setAttribute('data-orig', sendBtn.innerHTML);
  }

  // ── Grand total berekenen uit CART ─────────────────
  const grandTotal = CART.length > 0
    ? CART.reduce((s, c) => s + (parseFloat(c.total) || 0), 0)
    : (calcPrice().total || 0);

  // ── PDF genereren (met veiligheidsnet) ───────────────
  let pdfB64 = '';
  try {
    if (typeof window.jspdf === 'undefined') throw new Error('jsPDF niet geladen');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'mm', format:'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    // ── Font: Helvetica (ingebouwd in jsPDF, geen netwerk nodig) ──

    const C = {
      black:[17,17,17], orange:[255,175,81], orangeDk:[200,130,40],
      grey:[100,100,100], lgrey:[220,220,220], vlgrey:[245,245,245],
      white:[255,255,255], green:[16,163,74], blue:[37,99,235],
      purple:[124,58,237], teal:[5,150,105],
    };

    const f2  = v=>v.toLocaleString('nl-BE',{minimumFractionDigits:2,maximumFractionDigits:2});
    const fE  = v=>`€ ${f2(v)}`;
    // Hex → [R,G,B] helper (bijv. '#ffaf51' → [255,175,81])
    const h2r = hex => { const h=(hex||'#ffaf51').replace('#',''); return [parseInt(h.slice(0,2),16)||255,parseInt(h.slice(2,4),16)||175,parseInt(h.slice(4,6),16)||81]; };

    let pageNum = 1;

  function addPageHeader() {
    const HH = 20;
    // Achtergrond
    doc.setFillColor(...C.black); doc.rect(0,0,W,HH,'F');
    // Oranje linker accentbalk
    doc.setFillColor(...C.orange); doc.rect(0,0,5,HH,'F');
    // Donker rechter info-paneel
    doc.setFillColor(20,20,20); doc.rect(W-58,0,58,HH,'F');
    doc.setFillColor(38,38,38); doc.rect(W-59,0,1,HH,'F');
    // Logo (PNG, visueel gecentreerd in header)
    try { if(typeof LOGO_B64!=='undefined') doc.addImage(LOGO_B64,'PNG',8,4,11,11); } catch(e){}
    // Merknaam
    doc.setTextColor(...C.white); doc.setFontSize(9.5); doc.setFont(undefined,'bold');
    doc.text('DIGITIFY',22,10.5);
    // Tagline – hoger geplaatst (niet meer bijna op de lijn)
    doc.setFontSize(5.8); doc.setFont(undefined,'normal'); doc.setTextColor(...C.orange);
    doc.text('Partner in Digital Solutions',22,14.5);
    // Referentienummer (rechts)
    doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(210,210,210);
    doc.text(refNr,W-8,10.5,{align:'right'});
    // Datum + pagina (rechts)
    doc.setFontSize(6); doc.setFont(undefined,'normal'); doc.setTextColor(120,120,120);
    doc.text(`${dateStr}  ·  p.${pageNum}`,W-8,14.5,{align:'right'});
    // Oranje scheidingslijn onder header
    doc.setFillColor(...C.orange); doc.rect(5,HH,W-5,0.6,'F');
  }

  function addPageFooter() {
    doc.setFillColor(...C.black); doc.rect(0,H-10,W,10,'F');
    doc.setFillColor(...C.orange); doc.rect(0,H-10,4,10,'F');
    doc.setTextColor(140,140,140); doc.setFontSize(6.5);
    doc.text('contact@digitify.be · +32 (0) 465 83 72 64 · www.digitify.be · BTW: BE0742906469',W/2,H-4.5,{align:'center'});
  }

  function sectionTitle(label, y) {
    // Donkere achtergrondstrip – past bij Digitify-thema
    doc.setFillColor(22,22,22); doc.roundedRect(10,y,W-20,10,2,2,'F');
    // Oranje accent links – vol uitgevuld
    doc.setFillColor(...C.orange); doc.roundedRect(10,y,4,10,2,2,'F');
    doc.rect(12,y,2,10,'F'); // rechter hoek van accent afvullen
    // Label – wit, mooi verticaal gecentreerd
    doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(...C.white);
    doc.text(label,17.5,y+6.8);
    return y+14;
  }

  // ── PAGINA 1: COVER ──────────────────────────────────
  // Hero block — strak, modern, donker
  const heroH = 105;
  doc.setFillColor(10,10,10); doc.rect(0,0,W,heroH,'F');
  // Subtiel dot-grid decoratie in hero achtergrond
  doc.setFillColor(24,24,24);
  for(let gx=12;gx<W;gx+=12){ for(let gy=10;gy<heroH;gy+=12){ try{doc.circle(gx,gy,0.55,'F');}catch(e){} } }
  // Left orange accent bar
  doc.setFillColor(...C.orange); doc.rect(0,0,6,heroH,'F');
  // Right decoratief paneel – clean
  doc.setFillColor(16,16,16); doc.rect(W-52,0,52,heroH,'F');
  doc.setFillColor(...C.orange); doc.rect(W-52,0,3,heroH,'F');
  // Subtiele oranje ringen rechts – concentrisch premium effect
  // Gesimuleerde opaciteiten op donkere achtergrond (#101010):
  //   100% → [255,175,81]  50% → [136,93,46]  25% → [73,52,27]
  const rc=[W-30, heroH/2];
  const ringCols=[[255,175,81],[136,93,46],[73,52,27]];
  [14,21,28].forEach((r,ri)=>{
    doc.setDrawColor(...ringCols[ri]); doc.setLineWidth(ri===0?0.5:0.3);
    try{ doc.circle(rc[0],rc[1],r,'S'); }catch(e){}
  });
  // Logo gecentreerd boven in hero
  try { if(typeof LOGO_B64!=='undefined') doc.addImage(LOGO_B64,'PNG',W/2-14,10,28,28); } catch(e){}
  // Brand name
  doc.setTextColor(...C.white); doc.setFontSize(24); doc.setFont(undefined,'bold');
  doc.text('DIGITIFY',W/2,46,{align:'center'});
  // Subtitle
  doc.setFontSize(7.5); doc.setFont(undefined,'normal'); doc.setTextColor(...C.orange);
  doc.text('Partner in Digital Solutions',W/2,52.5,{align:'center'});
  // Oranje decoratielijn
  doc.setFillColor(...C.orange); doc.rect(W/2-22,56,44,0.5,'F');
  // OFFERTE card — strak donker kaartje met oranje header
  const cOX=W/2-32; const cOY=59; const cOW=64; const cOH=24;
  doc.setFillColor(20,20,20); doc.roundedRect(cOX,cOY,cOW,cOH,3,3,'F');
  doc.setDrawColor(...C.orange); doc.setLineWidth(0.3);
  doc.roundedRect(cOX,cOY,cOW,cOH,3,3,'S');
  doc.setFillColor(...C.orange); doc.roundedRect(cOX,cOY,cOW,9,3,3,'F');
  doc.rect(cOX,cOY+5,cOW,4,'F');
  doc.setTextColor(...C.black); doc.setFontSize(7.5); doc.setFont(undefined,'bold');
  doc.text('OFFERTE',W/2,cOY+7,{align:'center'});
  // Referentienummer
  doc.setTextColor(...C.orange); doc.setFontSize(11); doc.setFont(undefined,'bold');
  doc.text(refNr,W/2,cOY+18,{align:'center'});
  // Datum + geldigheid
  doc.setFontSize(5.5); doc.setFont(undefined,'normal'); doc.setTextColor(80,80,80);
  doc.text(`${dateStr}  ·  Geldig tot ${expStr}`,W/2,cOY+23,{align:'center'});
  // Separator + OPGESTELD VOOR
  doc.setFillColor(30,30,30); doc.rect(W/2-20,86,40,0.4,'F');
  doc.setFontSize(5.5); doc.setFont(undefined,'bold'); doc.setTextColor(65,65,65);
  doc.text('OPGESTELD VOOR',W/2,91,{align:'center'});
  // Klantnaam groot en gecentreerd
  doc.setFontSize(15); doc.setFont(undefined,'bold'); doc.setTextColor(...C.white);
  const cnDisplay=clientDisplay||'Uw bedrijf';
  const cnLines=doc.splitTextToSize(cnDisplay,W-32);
  cnLines.forEach((l,li)=>doc.text(l,W/2,99+li*8,{align:'center'}));

  let y = heroH + 10;
  const hw = (W-28)/2;
  const cardIH = 50; // kaartjeshoogte gelijk voor beide blokken
  const cardContentX = 6; // horizontale offset binnen kaartje

  // Klantblok
  const khMid = 10 + hw/2;
  doc.setFillColor(...C.vlgrey); doc.roundedRect(10,y,hw,cardIH,3,3,'F');
  doc.setFillColor(...C.orange); doc.roundedRect(10,y,hw,8.5,3,3,'F');
  doc.rect(10,y+4.5,hw,4,'F');
  doc.setFontSize(8); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black);
  doc.text('KLANTGEGEVENS', khMid, y+6.5, {align:'center'});
  let ky=y+15;
  doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black);
  doc.text(clientName||'—',10+cardContentX,ky); ky+=5.5;
  doc.setFont(undefined,'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.grey);
  if(bedrijf)  { doc.text(bedrijf,10+cardContentX,ky);  ky+=4.5; }
  if(adres)    { doc.text(adres,10+cardContentX,ky);    ky+=4.5; }
  if(emailVal) { doc.setTextColor(...C.blue); doc.text(emailVal,10+cardContentX,ky); ky+=4.5; doc.setTextColor(...C.grey); }
  if(telefoon) { doc.text(telefoon,10+cardContentX,ky); ky+=4.5; }
  if(btwklant) { doc.text(`BTW: ${btwklant}`,10+cardContentX,ky); }

  // Digitify blok
  const dx=10+hw+8;
  const dxMid = dx + hw/2;
  doc.setFillColor(...C.vlgrey); doc.roundedRect(dx,y,hw,cardIH,3,3,'F');
  doc.setFillColor(...C.black);  doc.roundedRect(dx,y,hw,8.5,3,3,'F');
  doc.rect(dx,y+4.5,hw,4,'F');
  doc.setFontSize(8); doc.setFont(undefined,'bold'); doc.setTextColor(...C.white);
  doc.text('DIGITIFY', dxMid, y+6.5, {align:'center'});
  let dy=y+15;
  doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black);
  doc.text('DIGITIFY',dx+cardContentX,dy); dy+=5.5;
  doc.setFont(undefined,'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.grey);
  ['Boekweitstraat 7, 9000 Gent','contact@digitify.be','+32 (0) 465 83 72 64','www.digitify.be','BTW: BE0742906469'].forEach(l=>{doc.text(l,dx+cardContentX,dy);dy+=4.5;});

  y += cardIH + 10;
  // Greeting section
  doc.setFillColor(...C.vlgrey); doc.roundedRect(10,y,W-20,0.6,0.3,0.3,'F');
  y += 8;
  // Gepersonaliseerde bedankingstekst met placeholders
  const prodNames=(allItems||[]).map(i=>i.prodLabel).join(', ')||'de geselecteerde diensten';
  doc.setFontSize(13); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black);
  doc.text(`Beste ${clientName||'klant'},`,10,y); y+=8;
  doc.setFontSize(8.5); doc.setFont(undefined,'normal'); doc.setTextColor(80,80,80);
  const p1=`Bedankt voor uw vertrouwen in Digitify${bedrijf?` en de interesse vanuit ${bedrijf}`:''}. Het stemt ons trots u deze offerte op maat voor te leggen voor: ${prodNames}. Na een zorgvuldige analyse van uw noden en doelstellingen hebben wij dit voorstel samengesteld dat perfect aansluit bij uw ambities.`;
  const w1=doc.splitTextToSize(p1,W-22);
  doc.text(w1,10,y); y+=w1.length*4.8+4;
  const p2=`Bij Digitify combineren we design, technologie en strategie tot digitale oplossingen die echt resultaat opleveren — meetbaar, duurzaam en volledig op uw maat. Van het eerste concept tot de finale oplevering staan wij garant voor kwaliteit, transparantie en een vlotte samenwerking.`;
  const w2=doc.splitTextToSize(p2,W-22);
  doc.text(w2,10,y); y+=w2.length*4.8+4;
  const contactStr=telefoon&&telefoon!=='—'?telefoon:'+32 (0) 465 83 72 64';
  const p3=`Deze offerte is geldig tot ${expStr}. Heeft u vragen of wenst u aanpassingen? Aarzel niet — contacteer ons via contact@digitify.be of ${contactStr}. Wij helpen u graag verder.`;
  const w3=doc.splitTextToSize(p3,W-22);
  doc.text(w3,10,y); y+=w3.length*4.8+6;
  // Klim block — zet y maximaal op H-26 zodat het niet over de footer valt
  if(y > H-26) y = H-26;
  doc.setFillColor(...C.vlgrey); doc.roundedRect(10,y,W-20,12,2,2,'F');
  doc.setFillColor(...C.orange); doc.roundedRect(10,y,4,12,2,2,'F'); doc.rect(12,y,2,12,'F');
  doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black);
  doc.text('Klim Gaikalov',17,y+5);
  doc.setFont(undefined,'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.grey);
  doc.text('Zaakvoerder · Creative Director · Digitify',17,y+9.5);
  addPageFooter();

  // ── PAGINA 2: DIENSTEN OVERZICHT ─────────────────────
  doc.addPage(); pageNum++;
  addPageHeader();
  y=25;
  y=sectionTitle('Onze diensten & aanpak',y);

  const serviceCards=[
    { color:C.orange, icon:'WEB', title:'Webdesign', desc:'Snelle, conversie-gerichte websites en webshops die uw merk weerspiegelen en bezoekers omzetten in klanten.', points:['Custom design in uw huisstijl','Responsive op alle apparaten','SEO-geoptimaliseerd','Gericht op conversie'] },
    { color:C.purple, icon:'MED', title:'Media', desc:'Sterke beelden maken het verschil. Van korte social clips tot uitgebreide brand films, fotoshoots en video.', points:['Professionele montage','Platform-specifieke formaten','Sound design & kleurcorrectie','Drone-beelden mogelijk'] },
    { color:C.blue,   icon:'MKT', title:'Marketing', desc:'Gerichte campagnes die meetbaar klanten en omzet opleveren. Google Ads, Meta Ads, social media en drukwerk.', points:['Data-gedreven aanpak','Transparante rapportering','Continue optimalisatie','Online & offline'] },
    { color:C.teal,   icon:'ADD', title:"Extra's & Add-ons", desc:"Aanvullende services: hosting, domeinnamen, SEO, onderhoud, branding en copywriting.", points:['Hosting & domeinnamen','SEO-optimalisatie','Onderhoud & updates','Logo & huisstijl'] },
  ];

  // Service cards – 2×2 raster, strak en mooi uitgelijnd
  const cardW=(W-26)/2; const cardH=48;
  serviceCards.forEach((card,i)=>{
    const col=i%2; const row=Math.floor(i/2);
    const cx=10+col*(cardW+6); const cy=y+row*(cardH+4);
    const cmid=cx+cardW/2;
    // Card background – lichte schaduw gesimuleerd via iets donkerdere rand
    doc.setFillColor(248,248,248); doc.roundedRect(cx,cy,cardW,cardH,3,3,'F');
    doc.setDrawColor(228,228,228); doc.setLineWidth(0.25);
    doc.roundedRect(cx,cy,cardW,cardH,3,3,'S');
    // Colored header – volledige breedte
    doc.setFillColor(...card.color); doc.roundedRect(cx,cy,cardW,10,3,3,'F');
    doc.rect(cx,cy+6,cardW,4,'F'); // rechte onderhoeken
    // Oranje accent-balk links in header
    doc.setFillColor(255,255,255,0.2); doc.rect(cx,cy,3,10,'F');
    // Card title – verticaal perfect gecentreerd in 10mm header
    doc.setTextColor(...C.white); doc.setFontSize(8.5); doc.setFont(undefined,'bold');
    doc.text(card.title,cmid,cy+6.8,{align:'center'});
    // Description – links uitgelijnd, betere leesbaarheid
    doc.setFontSize(6.8); doc.setFont(undefined,'normal'); doc.setTextColor(70,70,70);
    const descLines=doc.splitTextToSize(card.desc,cardW-10);
    descLines.slice(0,3).forEach((l,li)=>doc.text(l,cx+5,cy+15+li*4.0));
    // Subtiele scheidingslijn
    const divY=cy+14+descLines.slice(0,3).length*4.0+1;
    doc.setDrawColor(220,220,220); doc.setLineWidth(0.25);
    doc.line(cx+5,divY,cx+cardW-5,divY);
    // Feature points – links uitgelijnd, met kleurstip
    const ptGap = 4.2;
    const ptStartY = divY+5;
    card.points.forEach((pt,pi)=>{
      const py = ptStartY + pi * ptGap;
      doc.setFillColor(...card.color); doc.circle(cx+7,py-0.8,1,'F');
      doc.setTextColor(35,35,35); doc.setFontSize(6.8);
      doc.text(pt,cx+10.5,py);
    });
  });

  y+=2*(cardH+4)+6;
  // 50km van Gent gratis – strak pill-badge
  doc.setFillColor(228,250,236); doc.roundedRect(10,y,W-20,8.5,4.5,4.5,'F');
  doc.setDrawColor(16,120,60); doc.setLineWidth(0.2);
  doc.roundedRect(10,y,W-20,8.5,4.5,4.5,'S');
  doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(16,110,55);
  doc.text('\u{1F4CD}  50km verplaatsing altijd inbegrepen',18,y+5.8);
  doc.setFont(undefined,'normal'); doc.setFontSize(7); doc.setTextColor(40,130,70);
  const kmNote = 'Eerste 50km is altijd gratis inbegrepen bij alle diensten \u00B7 daarna \u20AC0.35/km (heen & terug).';
  doc.text(kmNote, 85, y+5.8);
  y+=13;
  y=sectionTitle('Ons proces – van idee tot resultaat',y);
  const steps=[
    {n:'01',title:'Discover',desc:'Kennismaking en briefing. We luisteren naar uw doelen en wensen.'},
    {n:'02',title:'Create',  desc:'Strategie omzetten naar concept, design en content op maat.'},
    {n:'03',title:'Build',   desc:'Bouwen, testen en live zetten als een samenhangend geheel.'},
    {n:'04',title:'Grow',    desc:'Meten, bijsturen en schalen op basis van data en resultaten.'},
  ];
  // 4 equal cards spanning full content width with 4mm gaps
  const sw=(W-20-3*4)/4;   // ≈ 43.5mm each
  const stepH=46;           // taller cards for breathing room
  steps.forEach((step,i)=>{
    const sx=10+i*(sw+4);
    const bx = sx + sw/2;            // horizontal centre of card
    // ── Card body (dark) ──────────────────────────────
    doc.setFillColor(22,22,22); doc.roundedRect(sx,y,sw,stepH,3,3,'F');
    // ── Orange header band ────────────────────────────
    doc.setFillColor(...C.orange); doc.roundedRect(sx,y,sw,13,3,3,'F');
    doc.rect(sx,y+9,sw,4,'F');        // fill rounded bottom of orange band
    // ── Step-number badge – perfectly centred ─────────
    doc.setFillColor(17,17,17); doc.circle(bx,y+6.5,5,'F');
    doc.setTextColor(...C.white); doc.setFontSize(8); doc.setFont(undefined,'bold');
    doc.text(step.n, bx, y+6.5, {align:'center', baseline:'middle'});
    // ── Step title – gecentreerd ──────────────────────
    doc.setTextColor(...C.white); doc.setFontSize(9.5); doc.setFont(undefined,'bold');
    doc.text(step.title, bx, y+23, {align:'center'});
    // ── Step description – gecentreerd ───────────────
    doc.setFont(undefined,'normal'); doc.setFontSize(6.8); doc.setTextColor(160,160,160);
    const dl=doc.splitTextToSize(step.desc, sw-8);
    dl.slice(0,3).forEach((l,li)=>doc.text(l, bx, y+31+li*4.5, {align:'center'}));
    // ── Arrow connector between steps ─────────────────
    if(i<steps.length-1){
      const gx=sx+sw;              // start of 4mm gap
      const ay=y+stepH/2;         // vertical centre of card
      // Horizontal shaft
      doc.setDrawColor(...C.orange); doc.setLineWidth(0.9);
      doc.line(gx+0.5, ay, gx+2.5, ay);
      // Arrowhead (triangle pointing right, fits within 4mm)
      doc.setFillColor(...C.orange);
      doc.triangle(gx+2, ay-2, gx+2, ay+2, gx+4, ay, 'F');
    }
  });
  addPageFooter();

  // ── PAGINA 3+: OFFERTE DETAILS (één pagina per dienst) ──
  const itemsToRender = allItems || [{
    ...S,
    catLabel:CATALOG[S.category]?.label,
    prodLabel:CATALOG[S.category]?.products[S.product]?.label,
    catEmoji:CATALOG[S.category]?.emoji,
    catColor:S.category?CAT_COLORS[S.category]:'#ffaf51',
    ...calcPrice(),
    answers:[], comment:document.getElementById('commentaar')?.value||''
  }];

  let grandExcl=0, grandBTW=0, pdfGrandTotal=0;

  itemsToRender.forEach((item)=>{
    grandExcl+=item.excl; grandBTW+=item.btwAmt; pdfGrandTotal+=item.total;

    // Nieuwe pagina per dienst
    doc.addPage(); pageNum++;
    addPageHeader();
    addPageFooter();
    let iy=25;
    // Per-dienst gekleurde sectietitel
    const iCol    = h2r(item.catColor||'#ffaf51');
    const iColDk  = [Math.max(0,iCol[0]-55), Math.max(0,iCol[1]-55), Math.max(0,iCol[2]-55)];
    // Heel lichte tint voor subtotaal-rijen (~12% mix met wit)
    const iColLight = [Math.round(255-(255-iCol[0])*0.12), Math.round(255-(255-iCol[1])*0.12), Math.round(255-(255-iCol[2])*0.12)];
    const isLightCat = iCol[0]>200 && iCol[1]>150; // oranje/geel → tekst donker
    // Gekleurde header-strip voor deze dienst
    doc.setFillColor(14,14,14); doc.roundedRect(10,iy,W-20,11,2,2,'F');
    doc.setFillColor(...iCol); doc.roundedRect(10,iy,5,11,2,2,'F'); doc.rect(13,iy,2,11,'F');
    // Emoji badge rechts in strip
    if(item.catEmoji){ doc.setFontSize(12); doc.text(item.catEmoji,W-15,iy+8,{align:'right'}); }
    doc.setFontSize(9); doc.setFont(undefined,'bold');
    doc.setTextColor(...iCol);
    doc.text(item.catLabel||'Dienst',18,iy+7.5);
    // prodLabel rechts uitgelijnd in de strip (vóór emoji indien aanwezig)
    doc.setFontSize(7.5); doc.setFont(undefined,'normal'); doc.setTextColor(160,160,160);
    const plX = item.catEmoji ? W-19 : W-13;
    doc.text(`› ${item.prodLabel||'Detail'}`, plX, iy+7.5, {align:'right'});
    iy+=15;

    const itemBody=[];

    const sub=CATALOG[item.category]?.products[item.product]?.sub;
    if(sub) itemBody.push([{
      content:sub, colSpan:3,
      styles:{ fontSize:7, fontStyle:'italic', fillColor:[38,38,38], textColor:[160,160,160],
               cellPadding:{top:1,bottom:2,left:10} }
    }]);

    // Prijsregels
    item.items.forEach(it=>{
      itemBody.push([
        { content:it.label, styles:{fontSize:8, cellPadding:{top:2,bottom:2,left:10,right:5}} },
        { content:'1', styles:{halign:'center',fontSize:8, cellPadding:{top:2,bottom:2,left:3,right:3}} },
        { content:fE(it.price), styles:{halign:'right',fontStyle:'bold',fontSize:8, cellPadding:{top:2,bottom:2,left:4,right:8}} }
      ]);
    });

    // Inbegrepen diensten
    if(item.includedItems && item.includedItems.length>0){
      itemBody.push([{
        content:'Inbegrepen in dit pakket:',
        colSpan:3,
        styles:{ fillColor:[232,252,240], textColor:[16,120,60], fontStyle:'bold', fontSize:7.5, cellPadding:{top:2,bottom:1,left:8} }
      }]);
      const chunkSize=2;
      for(let ci=0;ci<item.includedItems.length;ci+=chunkSize){
        const chunk=item.includedItems.slice(ci,ci+chunkSize);
        itemBody.push([{
          content:chunk.map(inc=>`+ ${inc}`).join('          '),
          colSpan:3,
          styles:{ fillColor:[242,255,248], textColor:[30,110,60], fontSize:7, cellPadding:{top:1,bottom:1,left:12} }
        }]);
      }
    }

    // Projectinformatie – links uitgelijnd, zelfde stijl als Inbegrepen
    if(item.answers && item.answers.length>0){
      const rel=item.answers.filter(a=>a.answer&&a.answer.trim());
      if(rel.length>0){
        itemBody.push([{
          content:'Projectinformatie:',
          colSpan:3,
          styles:{ fillColor:[255,246,230], textColor:[180,110,20], fontStyle:'bold', fontSize:7.5,
                   cellPadding:{top:2,bottom:1,left:8} }
        }]);
        rel.forEach(a=>{
          itemBody.push([{
            content:a.question,
            colSpan:3,
            styles:{ fillColor:[255,250,240], textColor:[100,100,100], fontSize:7, fontStyle:'bold',
                     cellPadding:{top:1,bottom:0,left:12} }
          }]);
          itemBody.push([{
            content:a.answer,
            colSpan:3,
            styles:{ fillColor:[255,250,240], textColor:[60,60,60], fontSize:7.5,
                     cellPadding:{top:1,bottom:2,left:12} }
          }]);
        });
      }
    }

    // Opmerking
    if(item.comment) itemBody.push([{
      content:`Opmerking: ${item.comment}`, colSpan:3,
      styles:{ fillColor:[255,252,235], textColor:C.grey, fontSize:7, fontStyle:'italic', cellPadding:{top:1,bottom:1,left:8} }
    }]);

    // Subtotaal rijen – lichte categorie-tint als achtergrond
    itemBody.push([{
      content:`Subtotaal ${item.prodLabel}`, colSpan:2,
      styles:{ fontStyle:'bold', fontSize:8, fillColor:iColLight, textColor:[30,30,30], cellPadding:{top:2,bottom:2,left:10} }
    },{ content:fE(item.excl), styles:{ fontStyle:'bold', fontSize:8, fillColor:iColLight, textColor:[30,30,30], halign:'right', cellPadding:{top:2,bottom:2,right:8} } }]);
    itemBody.push([{
      content:`BTW ${item.btw}%`, colSpan:2,
      styles:{ fontSize:7, fillColor:iColLight, textColor:[120,120,120], cellPadding:{top:1,bottom:2,left:10} }
    },{ content:fE(item.btwAmt), styles:{ fontSize:7, fillColor:iColLight, textColor:[120,120,120], halign:'right', cellPadding:{top:1,bottom:2,right:8} } }]);

    doc.autoTable({
      startY:iy,
      head:[['Omschrijving','St.','Prijs excl. BTW']],
      body:itemBody,
      theme:'plain',
      headStyles:{ fillColor:iColDk, textColor:C.white, fontStyle:'bold', fontSize:8, cellPadding:{top:4,bottom:4,left:8,right:5} },
      columnStyles:{
        0:{ cellWidth:'auto' },
        1:{ cellWidth:18, halign:'center', cellPadding:{top:3,bottom:3,left:3,right:3} },
        2:{ cellWidth:46, halign:'right', cellPadding:{top:3,bottom:3,left:4,right:10} },
      },
      styles:{ fontSize:8, cellPadding:{top:3,bottom:3,left:10,right:6}, lineColor:[230,230,230], lineWidth:0.25, font:F },
      alternateRowStyles:{ fillColor:[252,252,252] },
      margin:{ top:26, left:10, right:10, bottom:18 },
      // AutoTable roept didDrawPage ook op voor de 1e pagina van de tabel.
      // Daar staat de header al → anders krijg je een dubbele (kleine) header.
      didDrawPage:(data)=>{
        if (data && data.pageNumber && data.pageNumber > 1) {
          pageNum++; addPageHeader(); addPageFooter();
        }
      },
    });
  });

  // Totalen – na alle items; nieuwe pagina als er onvoldoende ruimte is
  const lastFinalY = doc.lastAutoTable.finalY;
  let totY;
  if(lastFinalY + 68 > H - 20){
    doc.addPage(); pageNum++; addPageHeader();
    totY = 28;
  } else {
    totY = lastFinalY + 12;
  }

  // ── Premium totalen-box (manueel getekend) ────────────
  const totW_b  = W - 20;
  const totX_b  = 10;
  const btwPct  = (allItems||[S])[0]?.btw || 21;
  const rH1     = 9;    // Subtotaal excl. BTW rij (mm)
  const rH2     = 7;    // BTW rij (mm)
  const rH3     = 14;   // TOTAAL INCL. BTW rij (mm)
  const totBoxH = rH1 + rH2 + rH3; // = 30mm

  // 1. Volledige donkere achtergrond met afgeronde hoeken
  doc.setFillColor(20,20,20);
  doc.roundedRect(totX_b, totY, totW_b, totBoxH, 3, 3, 'F');
  // 2. BTW-rij iets donkerder vlak (midden, geen afrondingsproblemen)
  doc.setFillColor(14,14,14);
  doc.rect(totX_b, totY+rH1, totW_b, rH2, 'F');
  // 3. Oranje TOTAAL-rij: roundedRect onderaan + plain rect om bovenhoeken recht te zetten
  doc.setFillColor(...C.orange);
  doc.roundedRect(totX_b, totY+rH1+rH2, totW_b, rH3, 3, 3, 'F');
  doc.rect(totX_b, totY+rH1+rH2, totW_b, 3, 'F');
  // 4. Subtiele scheidingslijn tussen rij 1 en 2
  doc.setDrawColor(34,34,34); doc.setLineWidth(0.3);
  doc.line(totX_b+4, totY+rH1, totX_b+totW_b-4, totY+rH1);
  // 5. Linker oranje accent-balk op donkere rijen
  doc.setFillColor(...C.orange);
  doc.roundedRect(totX_b, totY, 3, rH1+rH2, 1, 1, 'F');
  // 6. Tekst – rij 1: Subtotaal excl. BTW
  doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(155,155,155);
  doc.text('Subtotaal excl. BTW', totX_b+10, totY+5.5);
  doc.setTextColor(225,225,225);
  doc.text(fE(grandExcl), totX_b+totW_b-8, totY+5.5, {align:'right'});
  // 7. Tekst – rij 2: BTW
  doc.setFontSize(7); doc.setFont(undefined,'normal'); doc.setTextColor(90,90,90);
  doc.text(`BTW (${btwPct}%)`, totX_b+10, totY+rH1+4.5);
  doc.setTextColor(110,110,110);
  doc.text(fE(grandBTW), totX_b+totW_b-8, totY+rH1+4.5, {align:'right'});
  // 8. Tekst – rij 3: TOTAAL INCL. BTW (groot, donker op oranje)
  doc.setFontSize(11); doc.setFont(undefined,'bold'); doc.setTextColor(20,20,20);
  doc.text('TOTAAL INCL. BTW', totX_b+10, totY+rH1+rH2+9.2);
  doc.text(fE(pdfGrandTotal), totX_b+totW_b-8, totY+rH1+rH2+9.2, {align:'right'});

  const afterY = totY + totBoxH + 10;
  if(afterY < H - 45){
    doc.setFillColor(255,248,232); doc.roundedRect(10,afterY,W-20,26,3,3,'F');
    doc.setDrawColor(...C.orange); doc.setLineWidth(0.35);
    doc.roundedRect(10,afterY,W-20,26,3,3,'S');
    doc.setFillColor(...C.orange); doc.roundedRect(10,afterY,3,26,1.5,1.5,'F');
    doc.setFontSize(8); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black);
    doc.text('Betalingsvoorwaarden',17,afterY+8);
    doc.setDrawColor(240,200,100); doc.setLineWidth(0.25);
    doc.line(17,afterY+10,W-14,afterY+10);
    doc.setFont(undefined,'normal'); doc.setFontSize(7.5); doc.setTextColor(80,80,80);
    doc.text('50% bij ondertekening · 50% bij oplevering · Betaling via overschrijving',17,afterY+16);
    doc.setFontSize(7); doc.setTextColor(130,130,130);
    doc.text(`Factuur na oplevering · Geldig tot ${expStr} · BTW: BE0742906469`,17,afterY+22);
  }
  addPageFooter();

  // ── HANDTEKENINGEN ────────────────────────────────────
  doc.addPage(); pageNum++;
  addPageHeader();
  y=25;
  y=sectionTitle('Akkoord & handtekeningen',y);

  doc.setFillColor(...C.vlgrey); doc.roundedRect(10,y,W-20,24,3,3,'F');
  doc.setFillColor(...C.orange); doc.roundedRect(10,y,3,24,1.5,1.5,'F');
  doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black);
  doc.text('Offertesamenvatting',17,y+9);
  doc.setFont(undefined,'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.grey);
  doc.text(`Datum: ${dateStr} · Ref: ${refNr} · Geldig tot: ${expStr}`,17,y+16);
  doc.setFontSize(10); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black);
  doc.text(`${fE(pdfGrandTotal)} incl. BTW`,W-15,y+14,{align:'right'});
  y+=28;

  const sigW=(W-28)/2;
  const sigH=56;
  [{ label:'Voor akkoord – Klant', sub:clientDisplay||'—', canvas:'sig-klant', x:10 },
   { label:'Voor akkoord – Digitify', sub:'Klim Gaikalov – Creative Director', canvas:'sig-bm', x:10+sigW+8 }]
  .forEach(sig=>{
    doc.setFillColor(...C.vlgrey); doc.roundedRect(sig.x,y,sigW,sigH,3,3,'F');
    // Header band – volledig afgerond
    doc.setFillColor(...C.black); doc.roundedRect(sig.x,y,sigW,10,3,3,'F');
    doc.rect(sig.x,y+6,sigW,4,'F');
    // Label verticaal gecentreerd in 10mm header
    doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(...C.white);
    doc.text(sig.label, sig.x+sigW/2, y+7.5, {align:'center'});
    // Sub-label (naam/rol) net onder de header
    doc.setFontSize(6.8); doc.setFont(undefined,'normal'); doc.setTextColor(...C.grey);
    doc.text(sig.sub, sig.x+sigW/2, y+17, {align:'center'});
    // Naam + lijn
    doc.setFontSize(6.5); doc.setTextColor(...C.grey);
    doc.text('Naam:',sig.x+5,y+25);
    doc.setDrawColor(...C.lgrey); doc.setLineWidth(0.3);
    doc.line(sig.x+20,y+25,sig.x+sigW-5,y+25);
    // Handtekening
    const canvas=document.getElementById(sig.canvas);
    if(canvas&&!isCanvasEmpty(canvas)){
      try{ doc.addImage(canvas.toDataURL('image/png'),'PNG',sig.x+4,y+28,sigW-10,18); }catch(e){}
    }
    // Datum + lijn
    doc.setFontSize(6.5); doc.setTextColor(...C.grey);
    doc.text('Datum:',sig.x+5,y+50);
    doc.line(sig.x+20,y+50,sig.x+sigW-5,y+50);
    doc.setFontSize(7); doc.text(dateStr,sig.x+22,y+50);
  });

  y+=sigH+8;
  if(opm){
    y=sectionTitle('Bijkomende opmerkingen',y);
    const opLines=doc.splitTextToSize(opm,W-28);
    const opH=opLines.length*4.5+8;
    doc.setFillColor(255,252,244); doc.roundedRect(10,y,W-20,opH,3,3,'F');
    doc.setFontSize(8); doc.setFont(undefined,'normal'); doc.setTextColor(...C.grey);
    opLines.forEach((l,li)=>doc.text(l,15,y+7+li*4.5));
    y+=opH+6;
  }
  addPageFooter();

  // ── TIPS & TRICKS ─────────────────────────────────────
  doc.addPage(); pageNum++;
  addPageHeader();
  y=25;
  y=sectionTitle('Tips & tricks – haal het meeste uit uw investering',y);

  const allCats=[...new Set((allItems||[S]).map(i=>i.category))];
  const tipsLibrary={
    webdesign:[
      {title:'Snelheid = conversie',tip:'Een website die 1 seconde trager laadt verliest 7% conversie. Wij optimaliseren altijd voor maximale laadsnelheid.'},
      {title:'Mobile-first ontwerp',tip:'Meer dan 60% van het websiteverkeer komt van mobiel. Uw site werkt perfect op elk scherm en apparaat.'},
      {title:'Vertrouwen opbouwen',tip:'HTTPS, klantreviews en een professionele look verhogen het vertrouwen van bezoekers. Plan een review-moment na lancering.'},
      {title:'Meet alles van dag 1',tip:'Stel Google Analytics 4 en Search Console in voor de lancering. Zo weet u vanaf de eerste dag wat werkt.'},
      {title:'Call-to-action centraal',tip:'Elke pagina heeft een duidelijke call-to-action nodig. Vertel de bezoeker exact wat de volgende stap is.'},
      {title:'SEO = langetermijn groei',tip:'Organisch verkeer via Google bouwt zich op in de tijd. Begin vroeg met SEO en oogst op lange termijn.'},
    ],
    media:[
      {title:'Eerste 3 seconden tellen',tip:'Op sociale media beslist de kijker in 3 seconden of ze verder kijken. Start met een sterke openingszin of beeld.'},
      {title:'Consistentie wint',tip:'Wekelijks content plaatsen werkt beter dan één grote campagne per jaar. Maak een contentkalender.'},
      {title:'Hergebruik uw content',tip:'Een brand film kan hergebruikt worden als social clip, testimonial en website hero. Maximaliseer uw investering.'},
      {title:'Doelgroep centraal',tip:'Praat niet over uzelf maar over de problemen van uw klant. Content die helpt, converteert het best.'},
      {title:'Ondertiteling verhoogt bereik',tip:'80% van sociale media video\'s wordt zonder geluid bekeken. Ondertiteling verhoogt uw bereik significant.'},
      {title:'Formaat per platform',tip:'Een vierkante video werkt beter op Instagram, een landscape-variant op YouTube. Pas altijd aan per kanaal.'},
    ],
    marketing:[
      {title:'Start met retargeting',tip:'Bezoekers die uw site al bezochten converteren 3 tot 5 keer beter. Stel retargeting in van bij het begin.'},
      {title:'Test altijd A/B',tip:'Test minimaal 2 advertentievarianten tegelijkertijd. Kleine aanpassingen in tekst of beeld kunnen grote impact hebben.'},
      {title:'Budget slim verdelen',tip:'Zet 70% in op bewezen campagnes, 20% op groei-experimenten en 10% op nieuwe kanalen of formats.'},
      {title:'Review maandelijks',tip:'Vraag maandelijkse rapporten op. Goed campagnebeheer is continue bijsturing op basis van data.'},
      {title:'Lokale targeting werkt',tip:'Geografisch gerichte campagnes hebben gemiddeld 25% lagere kosten per conversie dan brede targeting.'},
      {title:'Combineer online & offline',tip:'Drukwerk in combinatie met online advertenties verhoogt de merkherkenning met tot 40%.'},
    ],
    extras:[
      {title:'Back-ups zijn uw vangnet',tip:'Stel dagelijkse automatische back-ups in. Dataverlies herstellen kost altijd meer dan preventie.'},
      {title:'Lokale SEO werkt snel',tip:'Een geoptimaliseerde Google Bedrijfspagina is de snelste manier om lokaal beter gevonden te worden.'},
      {title:'Consistente huisstijl',tip:'Gebruik altijd dezelfde kleuren, fonts en logo op alle kanalen. Herkenbaarheid bouwt vertrouwen op.'},
      {title:'GDPR = vertrouwen',tip:'Een correcte cookiebanner en privacyverklaring beschermen u en uw bezoekers. Verplicht, maar ook een troef.'},
      {title:'Domein = uw digitale adres',tip:'Registreer altijd zowel de .be als de .com variant van uw domeinnaam. Voorkomt verwarring en misbruik.'},
      {title:'Onderhoud voorkomt problemen',tip:'WordPress en plugins wekelijks updaten voorkomt 90% van alle beveiligingsproblemen op websites.'},
    ],
  };

  const activeTips=allCats.flatMap(c=>tipsLibrary[c]||[]);
  const tipsToShow=(activeTips.length?activeTips:Object.values(tipsLibrary).flat()).slice(0,6);
  const tipW=(W-26)/2; const tipH=38;
  tipsToShow.forEach((tip,i)=>{
    const col=i%2; const row=Math.floor(i/2);
    const tx=10+col*(tipW+6); const ty=y+row*(tipH+4);
    // Card bg – clean wit
    doc.setFillColor(250,250,250); doc.roundedRect(tx,ty,tipW,tipH,3,3,'F');
    doc.setDrawColor(228,228,228); doc.setLineWidth(0.2);
    doc.roundedRect(tx,ty,tipW,tipH,3,3,'S');
    // Oranje accent balk links
    doc.setFillColor(...C.orange); doc.roundedRect(tx,ty,3,tipH,1.5,1.5,'F');
    doc.rect(tx+1.5,ty,1.5,tipH,'F');
    // Title – donker, duidelijk, goed verticaal
    doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(18,18,18);
    const titleLines=doc.splitTextToSize(tip.title, tipW-14);
    titleLines.slice(0,1).forEach((l,li)=>doc.text(l,tx+7,ty+7+li*4.5));
    // Divider
    doc.setDrawColor(220,220,220); doc.setLineWidth(0.25);
    doc.line(tx+7, ty+10.5, tx+tipW-5, ty+10.5);
    // Tip text – compacter, past altijd in kaart
    doc.setFont(undefined,'normal'); doc.setFontSize(7); doc.setTextColor(70,70,70);
    doc.splitTextToSize(tip.tip,tipW-13).slice(0,4).forEach((l,li)=>doc.text(l,tx+7,ty+16+li*4.0));
  });

  y+=Math.ceil(tipsToShow.length/2)*(tipH+4)+8;
  y=sectionTitle('Volgende stappen',y);
  [
    {n:'1',text:'Lees de offerte door en stel uw vragen via contact@digitify.be'},
    {n:'2',text:'Onderteken digitaal of afgedrukt en stuur ons een kopie terug'},
    {n:'3',text:'Wij starten de onboarding en plannen uw project in'},
    {n:'4',text:'50% voorschot bij opstart · 50% bij succesvolle oplevering'},
  ].forEach((step,i)=>{
    const sy=y+i*10;
    // Cirkel met stapnummer
    doc.setFillColor(...C.orange); doc.circle(16,sy+3.5,4.5,'F');
    doc.setFontSize(8.5); doc.setFont(undefined,'bold'); doc.setTextColor(...C.black);
    doc.text(step.n,16,sy+3.5,{align:'center', baseline:'middle'});
    // Verbindingslijn
    if(i<3){ doc.setDrawColor(228,228,228); doc.setLineWidth(0.5); doc.line(16,sy+8,16,sy+10); }
    // Staptekst
    doc.setFont(undefined,'normal'); doc.setFontSize(8); doc.setTextColor(35,35,35);
    doc.text(step.text,24,sy+5);
  });
  y+=4*10+4;
  addPageFooter();

  // ── FOTO'S ────────────────────────────────────────────
  if(S.fotos&&S.fotos.length>0){
    doc.addPage(); pageNum++;
    addPageHeader();
    y=24;
    y=sectionTitle('Referentieafbeeldingen',y);
    let fx=10; let fy=y;
    S.fotos.forEach((src,i)=>{
      try{ doc.addImage(src,'JPEG',fx,fy,57,44); doc.setFontSize(6.5); doc.setTextColor(...C.grey); doc.text(`Afbeelding ${i+1}`,fx,fy+47); }catch(e){}
      fx+=63; if(fx>W-60){fx=10;fy+=54;}
    });
    addPageFooter();
  }

    // ── PDF als base64 (geen download – enkel e-mail + admin opslag) ─
    pdfB64 = doc.output('datauristring');

  } catch(pdfErr) {
    console.warn('PDF generatie mislukt, versturen zonder bijlage:', pdfErr);
  }

  // ── Items samenstellen voor opslag ───────────────────
  const itemsForStorage = (allItems || [{
    catLabel: CATALOG[S.category]?.label,
    prodLabel: CATALOG[S.category]?.products[S.product]?.label,
    ...calcPrice()
  }]);

  if (sendBtn) { sendBtn.classList.add('is-loading'); }

  // ── WP AJAX: offerte + PDF naar de server ─────────────
  jQuery.post(window.digitifyWP.ajaxUrl, {
    action:     'digitify_send_quote',
    nonce:      window.digitifyWP.nonce,
    publicToken: window.digitifyWP.publicToken || '',
    ref:        refNr,
    date:       dateStr,
    expDate:    expStr,
    grandTotal: grandTotal,
    client:     JSON.stringify({
      name:     clientName,
      bedrijf:  bedrijf,
      email:    emailVal,
      telefoon: telefoon,
      adres:    adres,
      btw:      btwklant,
    }),
    items:      JSON.stringify(itemsForStorage.map(it => ({
      catLabel:  it.catLabel,
      prodLabel: it.prodLabel,
      excl:      it.excl,
      btwAmt:    it.btwAmt,
      total:     it.total,
    }))),
    cartItems:  JSON.stringify(CART),
    editRef:    _editRef,
    pdfB64:     pdfB64,
  }, function(response) {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.classList.remove('is-loading');
      sendBtn.innerHTML = '<svg viewBox="0 0 20 20" fill="none" style="width:17px;height:17px"><path d="M3 10l14-7-7 14v-7L3 10z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Offerte versturen';
    }

    // Toast tonen
    let toast = document.getElementById('send-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'send-toast';
      document.body.appendChild(toast);
    }

    if (response.success) {
      // ── Toon bedankt-overlay – geen redirect, nooit ──
      const overlay = document.getElementById('thankyou-overlay');
      const refBox  = document.getElementById('thankyou-ref-box');
      if (refBox) refBox.innerHTML = `<span>Referentie: <strong>${refNr}</strong></span>`;
      if (overlay) overlay.style.display = 'flex';

      // Blokkeer versturen definitief (verberg de widget, overlay staat voor)
      if (sendBtn) { sendBtn.disabled = true; sendBtn.innerHTML = '✅ Verstuurd'; }

      // Verberg de cfg-widget achter de overlay – formulier is vergrendeld
      const widget = document.querySelector('.cfg-widget');
      if (widget) widget.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } else {
      toast.innerHTML = `<span style="font-size:1.3em">❌</span><div><strong>Fout bij versturen</strong><br><small>${response.data?.msg || 'Onbekende fout – probeer opnieuw.'}</small></div>`;
      toast.className = 'send-toast send-toast-show';
      clearTimeout(toast._timer);
      toast._timer = setTimeout(() => toast.classList.remove('send-toast-show'), 5000);
    }
  }).fail(function() {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.classList.remove('is-loading');
      sendBtn.innerHTML = '<svg viewBox="0 0 20 20" fill="none" style="width:17px;height:17px"><path d="M3 10l14-7-7 14v-7L3 10z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Offerte versturen';
    }
    alert('Verbindingsfout – probeer het opnieuw.');
  });
}

// ── HANDTEKENING CANVAS ────────────────────────────────
function initSignatureCanvas(id) {
  const canvas=document.getElementById(id); if(!canvas) return;
  const ctx=canvas.getContext('2d');
  let drawing=false,lx=0,ly=0;
  const pos=e=>{ const r=canvas.getBoundingClientRect(); const sx=canvas.width/r.width,sy=canvas.height/r.height; const src=e.touches?e.touches[0]:e; return[(src.clientX-r.left)*sx,(src.clientY-r.top)*sy]; };
  canvas.addEventListener('mousedown', e=>{e.preventDefault();drawing=true;[lx,ly]=pos(e);});
  canvas.addEventListener('mousemove', e=>{if(!drawing)return;e.preventDefault();const[x,y]=pos(e);ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(x,y);ctx.strokeStyle='#111';ctx.lineWidth=2;ctx.lineCap='round';ctx.stroke();[lx,ly]=[x,y];});
  canvas.addEventListener('mouseup',   ()=>drawing=false);
  canvas.addEventListener('mouseleave',()=>drawing=false);
  canvas.addEventListener('touchstart',e=>{e.preventDefault();drawing=true;[lx,ly]=pos(e);},{passive:false});
  canvas.addEventListener('touchmove', e=>{if(!drawing)return;e.preventDefault();const[x,y]=pos(e);ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(x,y);ctx.strokeStyle='#111';ctx.lineWidth=2;ctx.lineCap='round';ctx.stroke();[lx,ly]=[x,y];},{passive:false});
  canvas.addEventListener('touchend',  ()=>drawing=false);
}

function clearSig(id){ const c=document.getElementById(id); if(c) c.getContext('2d').clearRect(0,0,c.width,c.height); }
function isCanvasEmpty(c){ return !c.getContext('2d').getImageData(0,0,c.width,c.height).data.some(v=>v!==0); }

// ── FOTO UPLOAD ────────────────────────────────────────
function handleFileDrop(e){ e.preventDefault(); document.getElementById('upload-zone').classList.remove('drag-over'); addFiles(e.dataTransfer.files); }
function handleFileSelect(input){ addFiles(input.files); input.value=''; }
function addFiles(fileList){
  Array.from(fileList).forEach(file=>{
    if(S.fotos.length>=5||!file.type.startsWith('image/')||file.size>5*1024*1024) return;
    const reader=new FileReader();
    reader.onload=e=>{S.fotos.push(e.target.result);renderFotoPreview();};
    reader.readAsDataURL(file);
  });
}
function removeFoto(idx){ S.fotos.splice(idx,1); renderFotoPreview(); }
function renderFotoPreview(){
  const row=document.getElementById('foto-preview-row'); if(!row) return;
  row.innerHTML=S.fotos.map((src,i)=>`
    <div class="foto-thumb">
      <img src="${src}" alt="Afbeelding ${i+1}"/>
      <button class="foto-thumb-del" onclick="removeFoto(${i})">✕</button>
    </div>`).join('');
}
