<?php
/**
 * Template: Offerte Configurator
 * Included from digitify_render_configurator_page() (admin) of digitify_render_shortcode() (frontend).
 */
defined('ABSPATH') || exit;

// $digitify_is_shortcode wordt gezet door digitify_render_shortcode()
$_cfg_is_embed = !empty($digitify_is_shortcode);
$_cfg_wrap_cls = $_cfg_is_embed ? 'digitify-cfg-wrap digitify-frontend-embed' : 'wrap digitify-cfg-wrap';
?>
<div class="<?php echo esc_attr($_cfg_wrap_cls); ?>">
<div class="cfg-widget">

  <!-- EDIT-MODE BANNER (verborgen; zichtbaar wanneer bewerken van bestaande offerte) -->
  <div id="edit-mode-banner" class="edit-mode-banner" style="display:none">
    <span class="emb-icon">✏️</span>
    <span>U bewerkt offerte</span>
    <span class="emb-ref"></span>
    <span style="color:var(--dg-grey-40);font-weight:400">– alle wijzigingen worden overschreven bij opslaan</span>
  </div>

  <!-- HEADER -->
  <div class="cfg-header">
    <div class="cfg-logo">
      <img id="cfg-logo-img" class="cfg-logo-img" alt="Digitify" style="display:none" onload="this.style.display='block'"/>
      <div class="logo-text">
        <div class="logo-name">Digitify</div>
        <div class="logo-slogan">Partner in Digital Solutions</div>
      </div>
    </div>
    <div class="header-right">
      <span class="cart-count-header" id="cart-count" style="display:none">0</span>
    </div>
  </div>

  <!-- STEPPER -->
  <div class="cfg-stepper">
    <div class="cfg-step active" data-s="1"><div class="cs-dot"><span>1</span></div><div class="cs-lbl">Dienst</div></div>
    <div class="cs-line"></div>
    <div class="cfg-step" data-s="2"><div class="cs-dot"><span>2</span></div><div class="cs-lbl">Product</div></div>
    <div class="cs-line"></div>
    <div class="cfg-step" data-s="3"><div class="cs-dot"><span>3</span></div><div class="cs-lbl">Specificaties</div></div>
    <div class="cs-line"></div>
    <div class="cfg-step" data-s="4"><div class="cs-dot"><span>4</span></div><div class="cs-lbl">Gegevens</div></div>
  </div>

  <!-- BODY -->
  <div class="cfg-body">
    <div class="cfg-form">

      <!-- ══════════════ STEP 1: DIENST ══════════════ -->
      <div class="step-pane active" id="sp-1">
        <h2 class="pane-title">Welke dienst zoekt u?</h2>
        <p class="pane-sub">Selecteer een categorie om uw offerte op te bouwen</p>

        <div class="cat-grid">
          <button class="cat-tile" data-cat="webdesign" onclick="pickCategory(this)">
            <div class="cat-emoji">💻</div>
            <div class="cat-info">
              <strong>Webdesign</strong>
              <span>Websites, webshops, landingspagina's en extra functionaliteiten op maat</span>
            </div>
          </button>
          <button class="cat-tile" data-cat="media" onclick="pickCategory(this)">
            <div class="cat-emoji">🎬</div>
            <div class="cat-info">
              <strong>Media</strong>
              <span>Videoproductie, fotografie, social media edits, bedrijfsvideo's en aftermovies</span>
            </div>
          </button>
          <button class="cat-tile" data-cat="marketing" onclick="pickCategory(this)">
            <div class="cat-emoji">📣</div>
            <div class="cat-info">
              <strong>Marketing</strong>
              <span>Google Ads, Meta Ads, social media beheer, drukwerk en strategiegesprekken</span>
            </div>
          </button>
          <button class="cat-tile" data-cat="extras" onclick="pickCategory(this)">
            <div class="cat-emoji">⚙️</div>
            <div class="cat-info">
              <strong>Extra's & Add-ons</strong>
              <span>SEO, hosting, domeinnaam, onderhoud, branding, copywriting en meer</span>
            </div>
          </button>
        </div>

        <div class="step1-actions">
          <button class="btn-next" id="btn-s1-next" onclick="goStep(2)" disabled>
            Volgende: Product kiezen
            <svg viewBox="0 0 16 16" fill="none"><path d="M6 12l4-4-4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
          <button class="btn-go-step4-link" id="btn-go-step4" onclick="goStep(4)" style="display:none">
            <svg viewBox="0 0 16 16" fill="none"><path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Offerte afronden
          </button>
        </div>
      </div>

      <!-- ══════════════ STEP 2: PRODUCT ══════════════ -->
      <div class="step-pane" id="sp-2">
        <h2 class="pane-title" id="s2-title">Kies uw product</h2>
        <p class="pane-sub" id="s2-sub">Selecteer het gewenste product of de gewenste dienst</p>

        <div class="tile-grid tg-3" id="product-grid">
          <!-- Filled by JS: renderProducts() -->
        </div>

        <div class="step-nav">
          <button class="btn-back" onclick="goStep(1)">
            <svg viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            Terug
          </button>
          <button class="btn-next" id="btn-s2-next" onclick="goStep(3)" disabled>
            Volgende: Specificaties
            <svg viewBox="0 0 16 16" fill="none"><path d="M6 12l4-4-4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>

      <!-- ══════════════ STEP 3: OPTIES ══════════════ -->
      <div class="step-pane" id="sp-3">
        <h2 class="pane-title" id="s3-title">Specificaties</h2>
        <p class="pane-sub" id="s3-sub">Stel uw product in voor een nauwkeurige prijsraming</p>

        <div id="options-panel">
          <!-- Filled by JS: renderOptions() -->
        </div>

        <!-- BTW -->
        <div class="fg" style="margin-top:20px">
          <label class="fg-label">BTW-tarief</label>
          <div class="seg-ctrl" style="width:fit-content">
            <button class="seg active" id="btw21-btn" onclick="setBTW(21)">21%</button>
            <button class="seg" id="btw0-btn"  onclick="setBTW(0)">0%</button>
          </div>
        </div>

        <div class="fg">
          <label class="fg-label">Opmerkingen / bijzonderheden</label>
          <textarea id="commentaar" rows="2" placeholder="Extra info, specifieke wensen of vragen…"></textarea>
        </div>

        <div class="step-nav step3-nav">
          <button class="btn-back" onclick="goStep(2)">
            <svg viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            Terug
          </button>
          <div class="step3-btn-group">
            <button class="btn-add-to-cart" onclick="addToCart()">
              <svg viewBox="0 0 20 20" fill="none"><path d="M3 4h1.5l2.5 8h8l1.5-5H6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="16" r="1.2" fill="currentColor"/><circle cx="15" cy="16" r="1.2" fill="currentColor"/></svg>
              Toevoegen aan offerte
            </button>
          </div>
        </div>
      </div>

      <!-- ══════════════ STEP 4: GEGEVENS ══════════════ -->
      <div class="step-pane" id="sp-4">
        <h2 class="pane-title">Uw gegevens</h2>
        <p class="pane-sub">Voor uw persoonlijke offerte op maat</p>

        <div class="fg-row">
          <div class="fg half"><label class="fg-label">Voornaam *</label><input type="text" id="fname" placeholder="Jan"/></div>
          <div class="fg half"><label class="fg-label">Achternaam *</label><input type="text" id="lname" placeholder="Janssen"/></div>
        </div>
        <div class="fg-row">
          <div class="fg half"><label class="fg-label">E-mailadres *</label><input type="email" id="email" placeholder="jan@voorbeeld.be"/></div>
          <div class="fg half"><label class="fg-label">Telefoonnummer *</label><input type="tel" id="telefoon" placeholder="+32 4xx xx xx xx"/></div>
        </div>
        <div class="fg"><label class="fg-label">Bedrijfsnaam <span class="fg-opt">(optioneel)</span></label><input type="text" id="bedrijf" placeholder="Mijn Bedrijf BV"/></div>
        <div class="fg"><label class="fg-label">Adres</label><input type="text" id="adres" placeholder="Straat 1, 9000 Gent"/></div>
        <div class="fg"><label class="fg-label">BTW-nummer <span class="fg-opt">(optioneel – voor bedrijven)</span></label><input type="text" id="btwklant" placeholder="BE 0xxx.xxx.xxx"/></div>
        <div class="fg"><label class="fg-label">Bijkomende opmerkingen</label><textarea id="opmerkingen" rows="2" placeholder="Bijkomende informatie of specifieke wensen…"></textarea></div>

        <!-- Handtekeningen -->
        <div class="fg">
          <label class="fg-label">Handtekeningen</label>
          <div class="sig-wrap">
            <div class="sig-block">
              <div class="sig-label">Klant</div>
              <canvas id="sig-klant" class="sig-canvas" width="320" height="110"></canvas>
              <button class="sig-clear" onclick="clearSig('sig-klant')">✕ Wissen</button>
            </div>
            <div class="sig-block">
              <div class="sig-label">Digitify</div>
              <canvas id="sig-bm" class="sig-canvas" width="320" height="110"></canvas>
              <button class="sig-clear" onclick="clearSig('sig-bm')">✕ Wissen</button>
            </div>
          </div>
        </div>

        <div class="step-nav">
          <button class="btn-back" onclick="goStep(1)">
            <svg viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            Terug
          </button>
          <button class="btn-generate" id="btn-send-quote" onclick="sendQuote()">
            <svg viewBox="0 0 20 20" fill="none"><path d="M3 10l14-7-7 14v-7L3 10z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Offerte versturen
          </button>
        </div>
      </div>

    </div><!-- /cfg-form -->

    <!-- ══════════════ RIGHT PANEL ══════════════ -->
    <div class="cfg-preview">
      <div class="preview-sticky">

        <!-- ══ CART SECTION ══ -->
        <div id="cart-section" style="display:none" class="cart-section">
          <!-- Filled by renderCart() -->
        </div>

        <!-- Selection summary -->
        <div class="sel-summary">
          <div class="ss-placeholder" id="ss-placeholder">
            <p>👆 Selecteer een dienst en product</p>
          </div>
          <div id="ss-items" style="display:none">
            <!-- Filled by updateSummary() -->
          </div>
        </div>

        <!-- Price card -->
        <div class="price-card">
          <div class="pc-breakdown" id="pc-breakdown">
            <!-- Filled by updateCalc() -->
          </div>
          <div class="pc-divider"></div>
          <div class="pc-row"><span>Subtotaal excl. BTW</span><span id="p-excl">—</span></div>
          <div class="pc-row"><span id="p-btw-lbl">BTW 21%</span><span id="p-btw">—</span></div>
          <div class="pc-row pc-total"><span>Totaal incl. BTW</span><span id="p-total">—</span></div>
        </div>

        <!-- Indicatieve prijs / geldigheid (aparte box) -->
        <div class="pc-note-box" aria-label="Indicatieve prijs">
          <div class="pc-note-title">Indicatieve prijs · Definitieve offerte op aanvraag</div>
          <div class="pc-note-sub">Geldigheidsduur offerte: 30 dagen</div>
        </div>

      </div>
    </div>

  </div><!-- /cfg-body -->

  <div class="cfg-footer">
    <div class="cff-left"><strong>Digitify</strong> – Partner in Digital Solutions</div>
    <div class="cff-right">
      ✉️ <a href="mailto:contact@digitify.be">contact@digitify.be</a>
      &nbsp;·&nbsp;
      📞 <a href="tel:+32465837264">+32 (0) 465 83 72 64</a>
      &nbsp;·&nbsp;
      🌐 <a href="https://www.digitify.be" target="_blank">www.digitify.be</a>
    </div>
    <?php if (current_user_can('manage_options')): ?>
    <a href="<?php echo esc_url(admin_url('admin.php?page=digitify-offertes-admin')); ?>" class="cff-admin-wrench" title="Offertes beheren">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </a>
    <?php endif; ?>
  </div>


  <!-- ══════════════ BEDANKT OVERLAY ══════════════ -->
  <div id="thankyou-overlay" class="thankyou-overlay" style="display:none">
    <div class="thankyou-box">
      <div class="thankyou-checkmark">
        <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="26" cy="26" r="25" stroke="#16a34a" stroke-width="2"/>
          <path d="M14 26l8 8 16-16" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="thankyou-inner">
        <h2 class="thankyou-title">Bedankt voor uw aanvraag!</h2>
        <p class="thankyou-msg">Uw offerte is succesvol ingediend. Wij nemen zo snel mogelijk contact met u op.</p>

        <div class="thankyou-meta">
          <div class="thankyou-meta-label">Referentie</div>
          <div class="thankyou-ref-box" id="thankyou-ref-box"></div>
        </div>

        <div class="thankyou-contact">
          <a href="mailto:contact@digitify.be" class="thankyou-contact-item">
            <span class="thankyou-contact-ico">✉️</span>
            <span>contact@digitify.be</span>
          </a>
          <a href="tel:+32465837264" class="thankyou-contact-item">
            <span class="thankyou-contact-ico">📞</span>
            <span>+32 (0) 465 83 72 64</span>
          </a>
        </div>
      </div>
    </div>
  </div>

</div><!-- /cfg-widget -->
</div><!-- /wrap -->
