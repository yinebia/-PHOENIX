/**
 * Audited Northern Style Website Prototype Generator (V2)
 * - Uses strict safe DOM text rendering (textContent + createElement, ZERO innerHTML for customer content)
 * - Validates and safely constructs external https://wa.me/ WhatsApp links using encodeURIComponent
 * - Clearly labels customer inquiry form as a local prototype preview (never claims live submission/saving)
 * - Explicitly inventories all 8 placeholder fields needing real business details without fabrication
 */

export function buildNorthernStylePrototype(clarificationAnswers?: Record<string, string>): string {
  const answersText = clarificationAnswers
    ? Object.values(clarificationAnswers).join(' | ')
    : '';

  const extractAns = (keywordRegex: RegExp, fallback: string) => {
    if (!clarificationAnswers) return fallback;
    for (const [q, a] of Object.entries(clarificationAnswers)) {
      if (keywordRegex.test(q) && a.trim()) {
        return a.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
    }
    return fallback;
  };

  const businessLocation = extractAns(/location|city|address|where/i, '[BUSINESS_LOCATION]');
  const whatsappNumber = extractAns(/whatsapp|phone|number/i, '[WHATSAPP_NUMBER]');
  const contactInfo = extractAns(/email|contact/i, '[CONTACT_INFO]');
  const deliveryPolicy = extractAns(/delivery|return|shipping|policy/i, '[DELIVERY_AND_RETURN_POLICY]');
  const extraNote = answersText ? 'Operator clarifications applied where supplied; remaining unprovided details are marked as placeholders.' : 'All unprovided business details remain explicitly marked as placeholders.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Northern Style — Local Website Prototype (V2)</title>
  <style>
    :root {
      --bg: #0c0a14;
      --surface: #151224;
      --surface-alt: #1e1933;
      --border: #2f284d;
      --text: #f5f3ff;
      --muted: #b8b0d8;
      --accent: #d97706;
      --accent-soft: rgba(217, 119, 6, 0.16);
      --brand: #9333ea;
      --cyan: #22d3ee;
      --emerald: #10b981;
      --warn: #f59e0b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }
    a { color: inherit; text-decoration: none; }
    .container { max-width: 1120px; margin: 0 auto; padding: 0 1.25rem; }

    /* Prototype Notice Ribbon */
    .prototype-banner {
      background: #1f172b;
      border-bottom: 1px solid rgba(245, 158, 11, 0.45);
      color: #fde68a;
      font-size: 0.8125rem;
      padding: 0.55rem 1rem;
      text-align: center;
    }

    /* Responsive Navigation */
    header {
      position: sticky;
      top: 0;
      z-index: 40;
      background: rgba(12, 10, 20, 0.92);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border);
    }
    .nav-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 64px;
      gap: 1rem;
    }
    .brand {
      font-size: 1.2rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      color: #fff;
    }
    .brand span { color: var(--accent); }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      font-size: 0.9rem;
      color: var(--muted);
    }
    .nav-links a:hover, .nav-links a:focus-visible { color: #fff; }
    .mobile-toggle {
      display: none;
      background: var(--surface-alt);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.45rem 0.75rem;
      border-radius: 0.5rem;
      cursor: pointer;
      font-size: 0.85rem;
    }

    /* Sections */
    section { padding: 4rem 0; border-bottom: 1px solid rgba(47, 40, 77, 0.5); }
    .hero {
      padding: 5rem 0 4rem;
      background: radial-gradient(circle at top right, rgba(147, 51, 234, 0.22), transparent 55%),
                  radial-gradient(circle at bottom left, rgba(217, 119, 6, 0.14), transparent 45%);
    }
    .eyebrow {
      display: inline-block;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--cyan);
      margin-bottom: 0.75rem;
      font-weight: 700;
    }
    h1 { font-size: clamp(2rem, 4.5vw, 3.25rem); line-height: 1.15; margin-bottom: 1rem; }
    h2 { font-size: 1.75rem; margin-bottom: 0.5rem; }
    .subtitle { color: var(--muted); max-width: 640px; font-size: 1.05rem; margin-bottom: 1.75rem; }
    .cta-group { display: flex; flex-wrap: wrap; gap: 0.85rem; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.75rem 1.35rem;
      border-radius: 0.65rem;
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
      border: 1px solid transparent;
      transition: opacity 0.15s ease, transform 0.15s ease;
    }
    .btn-primary { background: linear-gradient(135deg, var(--brand), #4f46e5); color: #fff; }
    .btn-secondary { background: var(--surface-alt); border-color: var(--border); color: var(--text); }
    .btn:hover { opacity: 0.92; }

    /* Placeholder Inventory Box */
    .checklist-box {
      margin-top: 2rem;
      padding: 1.25rem;
      border-radius: 0.9rem;
      background: var(--surface);
      border: 1px solid rgba(245, 158, 11, 0.4);
    }
    .checklist-title { font-size: 0.9rem; font-weight: 700; color: #fde68a; margin-bottom: 0.6rem; }
    .checklist-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 0.55rem;
      list-style: none;
      font-size: 0.82rem;
      color: var(--muted);
    }
    .checklist-grid li {
      background: rgba(12, 10, 20, 0.65);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      padding: 0.45rem 0.65rem;
    }
    .placeholder-token {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      color: #fde68a;
      font-size: 0.78rem;
    }

    /* Category Filters & Catalogue */
    .filter-bar { display: flex; flex-wrap: wrap; gap: 0.6rem; margin: 1.5rem 0; }
    .filter-btn {
      padding: 0.5rem 1rem;
      border-radius: 0.55rem;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--muted);
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    .filter-btn[aria-pressed="true"] {
      background: var(--brand);
      border-color: #a855f7;
      color: #fff;
    }
    .catalogue-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.25rem;
    }
    .product-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 0.9rem;
      padding: 1.15rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 0.9rem;
    }
    .product-card.selected { border-color: var(--cyan); box-shadow: 0 0 0 1px var(--cyan); }
    .img-placeholder {
      height: 150px;
      border-radius: 0.6rem;
      border: 1px dashed var(--border);
      background: var(--surface-alt);
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 0.75rem;
      font-size: 0.8rem;
      color: var(--muted);
    }
    .card-meta { font-size: 0.75rem; color: var(--cyan); text-transform: uppercase; letter-spacing: 0.06em; }
    .price-tag { font-weight: 700; color: #fde68a; font-family: ui-monospace, monospace; font-size: 0.9rem; }

    /* Pricing Tiers */
    .pricing-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
      margin-top: 1.5rem;
    }
    .tier-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 0.9rem;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .tier-list { list-style: none; font-size: 0.88rem; color: var(--muted); display: grid; gap: 0.4rem; }

    /* About & Contact Form */
    .two-col {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
      gap: 1.75rem;
      margin-top: 1.5rem;
    }
    .panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 0.9rem;
      padding: 1.5rem;
    }
    label { display: block; font-size: 0.82rem; color: var(--muted); margin-bottom: 0.3rem; font-weight: 600; }
    input, select, textarea {
      width: 100%;
      padding: 0.65rem 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text);
      font-size: 0.9rem;
      margin-bottom: 0.9rem;
    }
    .error-msg { color: #fca5a5; font-size: 0.82rem; margin-bottom: 0.75rem; min-height: 1.1rem; }
    .preview-box {
      margin-top: 1rem;
      padding: 1rem;
      border-radius: 0.65rem;
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.35);
      display: none;
    }
    .preview-box.visible { display: block; }
    .preview-details { margin-top: 0.5rem; font-size: 0.85rem; color: #e2e8f0; white-space: pre-wrap; }
    .wa-warning { margin-top: 0.6rem; font-size: 0.8rem; color: #fde68a; }

    footer { padding: 2rem 0; font-size: 0.82rem; color: var(--muted); text-align: center; }

    @media (max-width: 768px) {
      .mobile-toggle { display: inline-flex; }
      .nav-links {
        display: none;
        position: absolute;
        top: 64px;
        left: 0;
        right: 0;
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        flex-direction: column;
        padding: 1rem 1.25rem;
        align-items: flex-start;
      }
      .nav-links.open { display: flex; }
    }
  </style>
</head>
<body>
  <div class="prototype-banner">
    LOCAL WEBSITE PROTOTYPE (V2 AUDITED) — Safe Inquiry Preview Mode Only · No Backend Server Connected · Replace [PLACEHOLDERS] Before Publishing
  </div>

  <header>
    <div class="container nav-row">
      <a href="#home" class="brand">Northern <span>Style</span></a>
      <button type="button" id="mobileNavBtn" class="mobile-toggle" aria-expanded="false" aria-controls="primaryNav">
        Menu
      </button>
      <nav id="primaryNav" class="nav-links" aria-label="Main navigation">
        <a href="#home">Home</a>
        <a href="#catalogue">Catalogue</a>
        <a href="#pricing">Pricing (USD)</a>
        <a href="#about">About</a>
        <a href="#contact">Contact &amp; Inquiry</a>
      </nav>
    </div>
  </header>

  <main>
    <section id="home" class="hero">
      <div class="container">
        <span class="eyebrow">Northern Style · Interactive Local Prototype</span>
        <h1>Authentic Style Rooted in Craft, Built as a Safe Preview Storefront</h1>
        <p class="subtitle">
          Browse Northern Style categories, review transparent US Dollar (USD) tier structures, and test a local customer inquiry preview. ${extraNote}
        </p>
        <div class="cta-group">
          <a href="#catalogue" class="btn btn-primary">Explore Catalogue</a>
          <a href="#contact" class="btn btn-secondary">Test Inquiry Preview</a>
        </div>

        <div class="checklist-box" aria-label="Missing Business Details Checklist">
          <div class="checklist-title">Placeholder Inventory Checklist (Requires Real Business Data Before Launch)</div>
          <ul class="checklist-grid">
            <li>1. Product names &amp; descriptions: <span class="placeholder-token">[PRODUCT_NAME]</span></li>
            <li>2. Product images: <span class="placeholder-token">[PRODUCT_IMAGE_URL]</span></li>
            <li>3. Prices in USD ($): <span class="placeholder-token">[PRICE_USD]</span></li>
            <li>4. Sizes available: <span class="placeholder-token">[SIZES_AVAILABLE]</span></li>
            <li>5. Business location: <span class="placeholder-token">${businessLocation}</span></li>
            <li>6. Contact information: <span class="placeholder-token">${contactInfo}</span></li>
            <li>7. WhatsApp number: <span class="placeholder-token">${whatsappNumber}</span></li>
            <li>8. Delivery &amp; return policies: <span class="placeholder-token">${deliveryPolicy}</span></li>
          </ul>
        </div>
      </div>
    </section>

    <section id="catalogue">
      <div class="container">
        <h2>Product Catalogue</h2>
        <p class="subtitle">Filter items by category or select a product to pre-fill the local inquiry preview form.</p>

        <div class="filter-bar" role="group" aria-label="Category filters">
          <button type="button" class="filter-btn" data-category="all" aria-pressed="true">All</button>
          <button type="button" class="filter-btn" data-category="smocks" aria-pressed="false">Smocks &amp; Fugu</button>
          <button type="button" class="filter-btn" data-category="textiles" aria-pressed="false">Woven Textiles</button>
          <button type="button" class="filter-btn" data-category="accessories" aria-pressed="false">Accessories</button>
        </div>

        <div id="catalogueGrid" class="catalogue-grid">
          <article class="product-card" data-category="smocks" data-product-id="ns-smock-01">
            <div>
              <div class="img-placeholder">Image Placeholder: <span class="placeholder-token">[PRODUCT_IMAGE_1]</span></div>
              <div class="card-meta" style="margin-top:0.75rem;">Smocks &amp; Fugu</div>
              <h3><span class="placeholder-token">[PRODUCT_NAME_1: Northern Handwoven Smock]</span></h3>
              <p style="font-size:0.85rem;color:var(--muted);margin-top:0.35rem;">Description: <span class="placeholder-token">[PRODUCT_DESCRIPTION_1]</span></p>
              <p style="font-size:0.82rem;color:var(--muted);margin-top:0.25rem;">Sizes: <span class="placeholder-token">[SIZES_AVAILABLE]</span></p>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
              <span class="price-tag">$[PRICE_USD_1]</span>
              <button type="button" class="btn btn-secondary select-product-btn" data-product="[PRODUCT_NAME_1: Northern Handwoven Smock]">Select Item</button>
            </div>
          </article>

          <article class="product-card" data-category="textiles" data-product-id="ns-textile-02">
            <div>
              <div class="img-placeholder">Image Placeholder: <span class="placeholder-token">[PRODUCT_IMAGE_2]</span></div>
              <div class="card-meta" style="margin-top:0.75rem;">Woven Textiles</div>
              <h3><span class="placeholder-token">[PRODUCT_NAME_2: Loom Woven Fabric Set]</span></h3>
              <p style="font-size:0.85rem;color:var(--muted);margin-top:0.35rem;">Description: <span class="placeholder-token">[PRODUCT_DESCRIPTION_2]</span></p>
              <p style="font-size:0.82rem;color:var(--muted);margin-top:0.25rem;">Sizes: <span class="placeholder-token">[SIZES_AVAILABLE]</span></p>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
              <span class="price-tag">$[PRICE_USD_2]</span>
              <button type="button" class="btn btn-secondary select-product-btn" data-product="[PRODUCT_NAME_2: Loom Woven Fabric Set]">Select Item</button>
            </div>
          </article>

          <article class="product-card" data-category="accessories" data-product-id="ns-acc-03">
            <div>
              <div class="img-placeholder">Image Placeholder: <span class="placeholder-token">[PRODUCT_IMAGE_3]</span></div>
              <div class="card-meta" style="margin-top:0.75rem;">Accessories</div>
              <h3><span class="placeholder-token">[PRODUCT_NAME_3: Crafted Hat &amp; Scarf]</span></h3>
              <p style="font-size:0.85rem;color:var(--muted);margin-top:0.35rem;">Description: <span class="placeholder-token">[PRODUCT_DESCRIPTION_3]</span></p>
              <p style="font-size:0.82rem;color:var(--muted);margin-top:0.25rem;">Sizes: <span class="placeholder-token">[SIZES_AVAILABLE]</span></p>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
              <span class="price-tag">$[PRICE_USD_3]</span>
              <button type="button" class="btn btn-secondary select-product-btn" data-product="[PRODUCT_NAME_3: Crafted Hat &amp; Scarf]">Select Item</button>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section id="pricing">
      <div class="container">
        <h2>Pricing Tiers (USD)</h2>
        <p class="subtitle">Explicit US Dollar ($) placeholders shown—confirm exact prices before going live.</p>
        <div class="pricing-grid">
          <div class="tier-card">
            <h3>Essential Piece</h3>
            <div class="price-tag">$[PRICE_USD_TIER_1]</div>
            <ul class="tier-list">
              <li>• Single ready-to-wear item</li>
              <li>• Sizes: [SIZES_AVAILABLE]</li>
              <li>• Delivery: ${deliveryPolicy}</li>
            </ul>
          </div>
          <div class="tier-card">
            <h3>Signature Set</h3>
            <div class="price-tag">$[PRICE_USD_TIER_2]</div>
            <ul class="tier-list">
              <li>• Paired attire + matching accessory</li>
              <li>• Sizes: [SIZES_AVAILABLE]</li>
              <li>• Delivery: ${deliveryPolicy}</li>
            </ul>
          </div>
          <div class="tier-card">
            <h3>Custom &amp; Group Orders</h3>
            <div class="price-tag">$[PRICE_USD_TIER_3]</div>
            <ul class="tier-list">
              <li>• Tailored event / group quantities</li>
              <li>• Lead time: [ESTIMATED_LEAD_TIME]</li>
              <li>• Terms: ${deliveryPolicy}</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section id="about">
      <div class="container">
        <h2>About Northern Style</h2>
        <div class="two-col">
          <div class="panel">
            <h3>Our Identity &amp; Craft</h3>
            <p style="color:var(--muted);margin-top:0.5rem;font-size:0.92rem;">
              Northern Style showcases heritage-inspired garments and woven textiles. Insert your verified brand story, artisan partnerships, and showroom hours in place of <span class="placeholder-token">[BRAND_STORY]</span> before launch.
            </p>
          </div>
          <div class="panel">
            <h3>Storefront Location &amp; Policies</h3>
            <p style="color:var(--muted);margin-top:0.5rem;font-size:0.92rem;">
              Location: <span class="placeholder-token">${businessLocation}</span><br />
              Contact: <span class="placeholder-token">${contactInfo}</span><br />
              WhatsApp: <span class="placeholder-token">${whatsappNumber}</span><br />
              Delivery &amp; Returns: <span class="placeholder-token">${deliveryPolicy}</span>
            </p>
          </div>
        </div>
      </div>
    </section>

    <section id="contact">
      <div class="container">
        <h2>Customer Inquiry Form (Local Prototype Preview)</h2>
        <p class="subtitle">
          Note: This prototype validates your input locally and builds a safe text preview. It does NOT submit, save, or transmit an order to a live backend.
        </p>
        <div class="two-col">
          <form id="inquiryForm" class="panel" novalidate>
            <label for="custName">Your Full Name *</label>
            <input id="custName" name="custName" type="text" required placeholder="Enter your name" maxlength="80" />

            <label for="custContact">Phone or Email *</label>
            <input id="custContact" name="custContact" type="text" required placeholder="Phone or email" maxlength="80" />

            <label for="custProduct">Selected Product / Tier *</label>
            <input id="custProduct" name="custProduct" type="text" required placeholder="Select a product above or type item" maxlength="120" />

            <label for="custSize">Preferred Size</label>
            <select id="custSize" name="custSize">
              <option value="[SIZES_AVAILABLE]">Select size (confirm [SIZES_AVAILABLE])</option>
              <option value="S">Small (S)</option>
              <option value="M">Medium (M)</option>
              <option value="L">Large (L)</option>
              <option value="XL">Extra Large (XL)</option>
            </select>

            <label for="custNotes">Delivery Notes</label>
            <textarea id="custNotes" name="custNotes" rows="3" maxlength="300" placeholder="Questions about delivery or sizing..."></textarea>

            <div id="formError" class="error-msg" role="alert"></div>
            <button type="submit" class="btn btn-primary" style="width:100%;">Generate Local Inquiry Preview</button>
          </form>

          <div class="panel">
            <h3>Inquiry Preview Output</h3>
            <p style="font-size:0.84rem;color:var(--muted);margin-top:0.35rem;">
              Customer text is rendered safely via DOM textContent (immune to HTML/XSS injection).
            </p>
            <div id="inquiryPreviewBox" class="preview-box" aria-live="polite">
              <strong style="color:#6ee7b7;font-size:0.88rem;">Local Prototype Preview Prepared (NOT Submitted or Saved Externally)</strong>
              <div id="inquiryPreviewText" class="preview-details"></div>
              <div style="margin-top:0.85rem;">
                <a id="waSafeLink" href="#contact" class="btn btn-secondary" rel="noopener noreferrer">WhatsApp Link Disabled (Placeholder Number)</a>
                <p id="waLinkNote" class="wa-warning"></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div class="container">
      Northern Style · Audited Local Website Prototype (V2) · Not Yet Publicly Deployed
    </div>
  </footer>

  <script>
    (function () {
      var configuredWaRaw = ${JSON.stringify(whatsappNumber)};
      var mobileBtn = document.getElementById('mobileNavBtn');
      var navMenu = document.getElementById('primaryNav');
      if (mobileBtn && navMenu) {
        mobileBtn.addEventListener('click', function () {
          var isOpen = navMenu.classList.toggle('open');
          mobileBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
      }

      // Safe Category Filtering
      var filterButtons = document.querySelectorAll('.filter-btn');
      var productCards = document.querySelectorAll('.product-card');
      filterButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var category = btn.getAttribute('data-category') || 'all';
          filterButtons.forEach(function (b) {
            b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
          });
          productCards.forEach(function (card) {
            var cardCat = card.getAttribute('data-category');
            card.style.display = (category === 'all' || cardCat === category) ? 'flex' : 'none';
          });
        });
      });

      // Product Selection -> Inquiry Form Pre-fill
      var productInput = document.getElementById('custProduct');
      document.querySelectorAll('.select-product-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var itemName = btn.getAttribute('data-product') || '';
          if (productInput) productInput.value = itemName;
          productCards.forEach(function (c) { c.classList.remove('selected'); });
          var parentCard = btn.closest('.product-card');
          if (parentCard) parentCard.classList.add('selected');
          var contactSection = document.getElementById('contact');
          if (contactSection && typeof contactSection.scrollIntoView === 'function') {
            contactSection.scrollIntoView({ behavior: 'smooth' });
          }
        });
      });

      function sanitizeWhatsAppDigits(raw) {
        var digits = String(raw || '').replace(/[^0-9]/g, '');
        if (digits.length >= 8 && digits.length <= 15) {
          return digits;
        }
        return '';
      }

      // Inquiry Form Validation & Safe DOM textContent Preview (ZERO innerHTML)
      var form = document.getElementById('inquiryForm');
      var errorEl = document.getElementById('formError');
      var previewBox = document.getElementById('inquiryPreviewBox');
      var previewText = document.getElementById('inquiryPreviewText');
      var waLink = document.getElementById('waSafeLink');
      var waNote = document.getElementById('waLinkNote');

      if (form) {
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          var nameVal = (document.getElementById('custName').value || '').trim();
          var contactVal = (document.getElementById('custContact').value || '').trim();
          var productVal = (document.getElementById('custProduct').value || '').trim();
          var sizeVal = (document.getElementById('custSize').value || '').trim();
          var notesVal = (document.getElementById('custNotes').value || '').trim();

          if (!nameVal || !contactVal || !productVal) {
            if (errorEl) errorEl.textContent = 'Please enter your name, phone/email, and selected item before generating a preview.';
            if (previewBox) previewBox.classList.remove('visible');
            return;
          }

          if (errorEl) errorEl.textContent = '';

          var summaryLines = [
            'Customer: ' + nameVal,
            'Contact: ' + contactVal,
            'Item: ' + productVal,
            'Size: ' + (sizeVal || '[SIZES_AVAILABLE]'),
            'Notes: ' + (notesVal || 'None'),
            'Status: LOCAL PROTOTYPE PREVIEW ONLY — Not submitted or saved to any backend.'
          ].join('\\n');

          // Strictly assign via textContent to prevent XSS / HTML injection
          if (previewText) {
            previewText.textContent = '';
            previewText.appendChild(document.createTextNode(summaryLines));
          }
          if (previewBox) {
            previewBox.classList.add('visible');
          }

          var validDigits = sanitizeWhatsAppDigits(configuredWaRaw);
          if (waLink && waNote) {
            if (validDigits) {
              var safeWaUrl = 'https://wa.me/' + validDigits + '?text=' + encodeURIComponent(summaryLines);
              waLink.setAttribute('href', safeWaUrl);
              waLink.setAttribute('target', '_blank');
              waLink.setAttribute('rel', 'noopener noreferrer');
              waLink.textContent = 'Open WhatsApp Inquiry Draft';
              waNote.textContent = 'Constructed validated external link for +' + validDigits + '. Clicking leaves this prototype.';
            } else {
              waLink.setAttribute('href', '#contact');
              waLink.removeAttribute('target');
              waLink.textContent = 'WhatsApp Number Required (' + configuredWaRaw + ')';
              waNote.textContent = 'External WhatsApp link disabled because a valid numeric business WhatsApp number has not been configured yet.';
            }
          }
        });
      }
    })();
  </script>
</body>
</html>`;
}
