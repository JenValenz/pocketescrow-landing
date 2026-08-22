#!/usr/bin/env node
// Builds the static glossary pages (1 hub + 6 category pages) from the
// glossary_terms table in Supabase. Committed HTML, no runtime DB
// dependency — re-run this script and commit whenever terms change.
//
// Usage: node scripts/build-glossary.mjs

import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://linuomhsmsivavjnjtrs.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Zyjg10qyl1bcpUuJNdzUug_0EgCoZC4'

const SITE = 'https://www.pocketescrow.org'

// Chronological order through a transaction, not size order — this is
// the order a reader actually moves through escrow.
const CATEGORIES = [
  {
    slug: 'opening-escrow',
    name: 'Opening Escrow',
    icon: '🗂️',
    intro: `Escrow opens the moment a purchase agreement is signed and a neutral third
      party — the escrow holder — is named to hold funds and documents until every
      condition of the contract is met. This is where the paper trail starts: an
      escrow number is assigned, a contact sheet circulates to everyone on the
      transaction, and the buyer delivers an earnest money deposit as a show of good
      faith. Escrow instructions, drafted from the purchase agreement, become the
      rulebook the escrow holder follows for the rest of the transaction — they
      cannot release funds or documents outside of what those instructions say. Most
      of the terms below describe this setup phase: who's involved, what gets
      deposited, and what the escrow holder is authorized to do before a single
      contingency has been cleared.`,
  },
  {
    slug: 'contingencies',
    name: 'Contingencies',
    icon: '☑️',
    intro: `A contingency is a condition written into the purchase agreement that must
      be satisfied — or formally waived — before the sale can close. This is the
      buyer's due-diligence window: inspecting the property, securing loan approval,
      and confirming the appraisal supports the purchase price. Each contingency has
      its own removal deadline, and missing one without an extension can put the
      buyer's earnest money deposit at risk. An as-is sale strips out most
      condition-based contingencies up front, while liquidated damages clauses
      define what happens to the deposit if the deal falls apart after contingencies
      are removed. This is the shortest category in the glossary, but arguably the
      highest-stakes one — it's where most escrows fail if they're going to fail at
      all.`,
  },
  {
    slug: 'financing-loan-terms',
    name: 'Financing & Loan Terms',
    icon: '🏦',
    intro: `Once a buyer is financing the purchase, a parallel process runs alongside
      escrow: loan underwriting. This category covers the vocabulary a lender uses,
      from loan structures like adjustable-rate mortgages, bridge loans, and
      assumable loans, to the disclosures required along the way — the Loan
      Estimate, the Closing Disclosure, and the annual percentage rate that reflects
      the loan's true cost. Escrow doesn't originate the loan, but it can't close
      without the lender's funding, so escrow officers track loan contingency
      deadlines and wait on final loan documents before setting a closing date. If a
      term below sounds like it belongs to a bank rather than an escrow company,
      that's because it does — but escrow has to speak this language fluently to
      keep a financed transaction on schedule.`,
  },
  {
    slug: 'title-vesting',
    name: 'Title & Vesting',
    icon: '📜',
    intro: `While escrow holds the funds, a title company works in parallel to confirm
      the seller actually owns the property free of undisclosed claims, and to
      determine how the buyer will hold ownership once it transfers. Chain of title
      traces every past owner and recorded document; encumbrances and easements
      surface anything that limits what an owner can do with the property; CC&Rs
      spell out obligations that come with certain communities. Vesting — community
      property, joint tenancy with right of survivorship, and the other forms listed
      here — determines what happens to the property later, including at death or
      divorce, so getting it right at closing matters well beyond the closing date
      itself. The deed that ultimately transfers title is the single most important
      document this category produces.`,
  },
  {
    slug: 'closing-funding',
    name: 'Closing & Funding',
    icon: '💰',
    intro: `Closing is the final stretch: contingencies are removed, loan documents are
      signed, and the numbers on the closing statement are confirmed by everyone
      before money moves. The buyer completes a final walk-through, closing costs
      are itemized and paid, and once the lender wires funds and the escrow holder
      confirms good funds, disbursement pays out the seller, agents' commissions,
      and any liens against the property. A closing protection letter backs the
      escrow holder's handling of these funds. This category is where every earlier
      category converges — the contingencies are gone, the loan has funded, and
      title is ready to transfer — and it ends with the recording that makes the
      sale official.`,
  },
  {
    slug: 'post-close',
    name: 'Post-Close',
    icon: '🔑',
    intro: `Escrow's core job ends at recording, but a real estate transaction leaves a
      long tail of terms that matter afterward — which is why this is the largest
      category in the glossary. It spans routine post-closing servicing, like
      impound accounts for property tax and insurance, and specialized situations
      that only apply to some transactions: 1031 exchanges and their strict 45-day
      and 180-day windows, reconveyance when a loan is paid off, and the tax
      documents — like the 1099-S — that follow a sale into the next filing season.
      It also covers what happens when an owner dies or divorces after closing,
      through documents like an affidavit of death or affidavit of surviving
      spouse. If a question comes up months or years after your escrow closed,
      the answer is probably in this category.`,
  },
]

async function fetchTerms() {
  const url = `${SUPABASE_URL}/rest/v1/glossary_terms?select=term,definition,category,roles,warning_text&order=category,term`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  })
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status} ${await res.text()}`)
  return res.json()
}

function slugify(term) {
  return term
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function siteHeader(activePath) {
  return `<header class="site-header">
    <div class="container nav">
      <a href="/#top" class="logo" aria-label="Pocket Escrow App home">
        <svg width="32" height="32" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <path d="M14 30 L14 38 Q14 44 22 44 Q30 44 30 38 L30 14 Q30 6 22 6 Q14 6 14 14 L14 32" stroke="#1a2e4a" stroke-width="3.5" fill="none" stroke-linecap="round"/>
          <path d="M18 32 L18 14 Q18 12 22 12 Q26 12 26 14 L26 38 Q26 40 22 40 Q18 40 18 38 L18 34" stroke="#4db8b8" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        </svg>
        <span>Pocket Escrow App</span>
      </a>
      <nav class="nav-links">
        <a href="/#features">Features</a>
        <a href="/#pricing">Pricing</a>
        <a href="https://www.pocketescrow.org/glossary/">Glossary</a>
        <a href="https://www.pocketescrow.org/tutorials/welcome/">Tutorials</a>
        <a href="https://www.pocketescrow.org/about.html">About</a>
        <a href="https://app.pocketescrow.org" class="btn btn-secondary btn-sm">Open App</a>
      </nav>
    </div>
  </header>`
}

function siteFooter() {
  return `<footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand-col">
        <a href="/#top" class="logo logo-footer">
          <svg width="28" height="28" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <path d="M14 30 L14 38 Q14 44 22 44 Q30 44 30 38 L30 14 Q30 6 22 6 Q14 6 14 14 L14 32" stroke="#fdfaf5" stroke-width="3.5" fill="none" stroke-linecap="round"/>
            <path d="M18 32 L18 14 Q18 12 22 12 Q26 12 26 14 L26 38 Q26 40 22 40 Q18 40 18 38 L18 34" stroke="#4db8b8" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          </svg>
          <span>Pocket Escrow App</span>
        </a>
        <p class="footer-tagline">California escrow education, in your pocket.</p>
      </div>
      <div class="footer-links-col">
        <h4>Product</h4>
        <a href="https://app.pocketescrow.org">Open the App</a>
        <a href="/#features">Features</a>
        <a href="/#pricing">Pricing</a>
      </div>
      <div class="footer-links-col">
        <h4>Learn</h4>
        <a href="https://www.pocketescrow.org/glossary/">Glossary</a>
        <a href="https://www.pocketescrow.org/tutorials/welcome/">Tutorials</a>
        <a href="https://www.pocketescrow.org/about.html">About</a>
      </div>
      <div class="footer-links-col">
        <h4>Legal</h4>
        <a href="https://app.pocketescrow.org/?legal=terms">Terms of Service</a>
        <a href="https://app.pocketescrow.org/?legal=privacy">Privacy Policy</a>
      </div>
    </div>
    <div class="footer-bottom">
      <div class="container">
        <p>&copy; 2026 JLNV Consulting, LLC. Pocket Escrow App is an education platform — not legal, financial, or tax advice.</p>
      </div>
    </div>
  </footer>`
}

function termEntry(t, { withCategory = false } = {}) {
  const id = slugify(t.term)
  const warning = t.warning_text
    ? `<p class="term-warning"><strong>⚠ ${esc(t.warning_text)}</strong> <a href="https://www.pocketescrow.org/tutorials/wire-fraud-checklist/">See the Wire Fraud Checklist tutorial →</a></p>`
    : ''
  const cat = withCategory
    ? `<a class="term-category" href="https://www.pocketescrow.org/glossary/${slugify(t.category)}/">${esc(t.category)}</a>`
    : ''
  const roles = (t.roles || []).join(', ')
  return `<div class="term-entry" id="${id}" data-roles="${esc(roles)}">
        <dt>${esc(t.term)}${cat}</dt>
        <dd>${esc(t.definition)}${warning}</dd>
      </div>`
}

function definedTermSchema(pageUrl, name, description, terms) {
  return {
    '@type': 'DefinedTermSet',
    '@id': `${pageUrl}#glossary`,
    name,
    description,
    url: pageUrl,
    hasDefinedTerm: terms.map((t) => ({
      '@type': 'DefinedTerm',
      name: t.term,
      description: t.definition,
      inDefinedTermSet: `${pageUrl}#glossary`,
    })),
  }
}

function roleFilterUI() {
  const roles = ['Buyer', 'Seller', 'Borrower', 'Escrow Officer', 'Realtor', 'Loan Processor', 'Title Agent']
  return `<div class="role-filter">
        <span class="role-filter-label">Filter by role:</span>
        <button class="role-chip is-active" data-role="all">All</button>
        ${roles.map((r) => `<button class="role-chip" data-role="${esc(r)}">${esc(r)}</button>`).join('\n        ')}
      </div>
      <script>
        (function () {
          var chips = document.querySelectorAll('.role-chip');
          var entries = document.querySelectorAll('.term-entry');
          chips.forEach(function (chip) {
            chip.addEventListener('click', function () {
              chips.forEach(function (c) { c.classList.remove('is-active'); });
              chip.classList.add('is-active');
              var role = chip.dataset.role;
              entries.forEach(function (entry) {
                var roles = entry.dataset.roles || '';
                entry.style.display = (role === 'all' || roles.indexOf(role) !== -1) ? '' : 'none';
              });
            });
          });
        })();
      </script>`
}

function page({ title, description, canonical, ogImage, bodyHtml, schemaObjects, extraHead = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${canonical}" />
  <meta name="theme-color" content="#4db8b8" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Pocket Escrow App" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:locale" content="en_US" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${ogImage}" />

  <script async src="https://www.googletagmanager.com/gtag/js?id=G-VST5ZX252M"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-VST5ZX252M');
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css" />
  ${extraHead}

  <script type="application/ld+json">
  ${JSON.stringify({ '@context': 'https://schema.org', '@graph': schemaObjects }, null, 2)}
  </script>
</head>
<body>
${siteHeader()}
${bodyHtml}
${siteFooter()}
</body>
</html>
`
}

async function main() {
  const terms = await fetchTerms()
  if (!Array.isArray(terms) || terms.length === 0) {
    throw new Error('No terms returned from Supabase — refusing to overwrite existing pages with an empty glossary.')
  }

  const glossaryDir = join(ROOT, 'glossary')
  mkdirSync(glossaryDir, { recursive: true })

  // ---- Hub page ----
  const hubUrl = `${SITE}/glossary/`
  const az = [...new Set(terms.map((t) => t.term[0].toUpperCase()))].sort()
  const hubBody = `
  <section class="glossary-hero">
    <div class="container">
      <p class="eyebrow">Reference</p>
      <h1>California Escrow Glossary</h1>
      <p class="hero-subhead">${terms.length} escrow and real estate terms, in plain English, from a 30-year California escrow professional.</p>
    </div>
  </section>

  <section class="glossary-content">
    <div class="container">
      <nav class="glossary-categories" aria-label="Glossary categories">
        ${CATEGORIES.map((c) => `<a href="https://www.pocketescrow.org/glossary/${c.slug}/" class="glossary-category-link"><span>${c.icon}</span> ${esc(c.name)} <span class="term-count">${terms.filter((t) => t.category === c.name).length}</span></a>`).join('\n        ')}
      </nav>

      ${roleFilterUI()}

      <nav class="az-jump" aria-label="Jump to letter">
        ${az.map((l) => `<a href="#letter-${l}">${l}</a>`).join(' ')}
      </nav>

      <dl class="glossary-list">
        ${az
          .map((letter) => {
            const group = terms.filter((t) => t.term[0].toUpperCase() === letter)
            return `<h2 id="letter-${letter}" class="glossary-letter">${letter}</h2>\n        ${group.map((t) => termEntry(t, { withCategory: true })).join('\n        ')}`
          })
          .join('\n        ')}
      </dl>
    </div>
  </section>`

  writeFileSync(
    join(glossaryDir, 'index.html'),
    page({
      title: 'California Escrow Glossary — 177 Terms Defined | Pocket Escrow App',
      description: `A complete glossary of ${terms.length} California escrow and real estate terms, defined in plain English by a 30-year escrow professional. Filter by role.`,
      canonical: hubUrl,
      ogImage: `${SITE}/og-image.png`,
      bodyHtml: hubBody,
      schemaObjects: [
        definedTermSchema(hubUrl, 'California Escrow Glossary', `All ${terms.length} escrow terms used in Pocket Escrow App`, terms),
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
            { '@type': 'ListItem', position: 2, name: 'Glossary', item: hubUrl },
          ],
        },
      ],
    })
  )
  console.log(`Wrote glossary/index.html (${terms.length} terms)`)

  // ---- Category pages ----
  for (const cat of CATEGORIES) {
    const catTerms = terms.filter((t) => t.category === cat.name)
    const catUrl = `${SITE}/glossary/${cat.slug}/`
    const catDir = join(glossaryDir, cat.slug)
    mkdirSync(catDir, { recursive: true })

    const siblingLinks = CATEGORIES.filter((c) => c.slug !== cat.slug)
      .map((c) => `<a href="https://www.pocketescrow.org/glossary/${c.slug}/">${c.icon} ${esc(c.name)}</a>`)
      .join('\n        ')

    const body = `
  <section class="glossary-hero">
    <div class="container">
      <p class="eyebrow"><a href="https://www.pocketescrow.org/glossary/">Glossary</a> / ${esc(cat.name)}</p>
      <h1>${cat.icon} ${esc(cat.name)}</h1>
      <p class="hero-subhead">${catTerms.length} terms covering ${esc(cat.name.toLowerCase())} in a California escrow transaction.</p>
    </div>
  </section>

  <section class="glossary-content">
    <div class="container">
      <p class="category-intro">${cat.intro.trim().replace(/\s+/g, ' ')}</p>

      ${roleFilterUI()}

      <dl class="glossary-list">
        ${catTerms.map((t) => termEntry(t)).join('\n        ')}
      </dl>

      <nav class="glossary-sibling-nav" aria-label="Other glossary categories">
        <h3>Other categories</h3>
        <div class="glossary-sibling-links">
        ${siblingLinks}
        </div>
        <a href="https://www.pocketescrow.org/glossary/" class="btn btn-outline btn-sm">← All ${terms.length} terms</a>
      </nav>
    </div>
  </section>`

    writeFileSync(
      join(catDir, 'index.html'),
      page({
        title: `${cat.name} Glossary — ${catTerms.length} California Escrow Terms | Pocket Escrow App`,
        description: `${catTerms.length} California escrow terms related to ${cat.name.toLowerCase()}, defined in plain English by a 30-year escrow professional.`,
        canonical: catUrl,
        ogImage: `${SITE}/og-image.png`,
        bodyHtml: body,
        schemaObjects: [
          definedTermSchema(catUrl, `${cat.name} Glossary`, `${cat.name} terms used in a California escrow transaction`, catTerms),
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
              { '@type': 'ListItem', position: 2, name: 'Glossary', item: hubUrl },
              { '@type': 'ListItem', position: 3, name: cat.name, item: catUrl },
            ],
          },
        ],
      })
    )
    console.log(`Wrote glossary/${cat.slug}/index.html (${catTerms.length} terms)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
