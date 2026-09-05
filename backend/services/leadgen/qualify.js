/**
 * Stage 3.5 — qualification.
 *
 * Gemini reads the audit + a compact extract of the current site and returns
 * an advisory assessment (pursue/skip, confidence, $ value, angle, red flags).
 * The ROUTING decision is score-based:
 *
 *   effective_score = score_override ?? audit_score
 *   effective_score >  min_score(niche | global)  -> waiting_approval
 *   effective_score <= min_score                  -> disqualified
 *
 * Gemini's verdict is stored for the review queue but does not gate.
 */
const { z } = require('zod');
const { createAIClient } = require('../aiClient');
const gcs = require('../gcsStorage');
const store = require('./store');
const settings = require('./settings');

const SCHEMA = z.object({
  recommendation: z.enum(['pursue', 'skip']),
  confidence: z.number().min(0).max(1),
  estimated_value_usd: z.number().min(0).max(5000),
  pitch_angle: z.string().max(400),
  red_flags: z.array(z.string()).max(10),
  summary: z.string().max(600),
  // Outreach drafts, written once here so the admin never stares at a blank
  // compose box — reviewed/edited in the Contact card popups, never auto-sent.
  call_script: z.string().max(1200),
  email_subject: z.string().max(150),
  email_body: z.string().max(1500),
  whatsapp_message: z.string().max(500),
});

const SYSTEM = `You assess whether a local business is a good prospect for a freelance website redesign service, and draft the first outreach for it.
The service: a modern responsive redesign delivered in ~1 week for USD 200-1000.
Good prospects: an operating business with real customers whose current site is dated, slow, not mobile-friendly, on a weak builder, or missing entirely — and who can be reached.
Poor prospects: businesses that already have a strong modern site, national chains / franchises with in-house teams, closed businesses, or ones with no reachable contact.

Also draft three outreach pieces an admin can review, edit, and send themselves — never invent facts not given (no fake case studies, no guessing who answers the phone). Tone for all three: warm, personal, and human — like a founder genuinely reaching out, not a sales template. First person ("I"), never corporate ("we're excited to announce"). Open with something genuine and specific if the audit/current-site data supports it (their reviews, their work, what they clearly do well) — never a compliment you can't back up.
- call_script: a natural, spoken-language opener for a cold phone call — a friendly greeting, who's calling and why, the one-sentence pitch angle, and a soft ask to send the redesign over. No stage directions, just what to say.
- email_subject / email_body: a short, warm, plain-text email (no markdown, no bullet points, no "Dear ___" formality). Mention that a sample redesign is attached as a PDF, and that clicking the "Yes, I'm interested" button inside the PDF is how they tell us to follow up with a call — that button is the actual call to action, not "reply to this email". Sign off with the agency's name exactly as given below (never invent a person's name).
- whatsapp_message: one or two short, casual sentences — WhatsApp register, not an email in disguise.

Return ONLY JSON matching exactly:
{
  "recommendation": "pursue" | "skip",
  "confidence": 0.0-1.0,
  "estimated_value_usd": integer 200-1000,
  "pitch_angle": "one specific sentence you would open the outreach with",
  "red_flags": ["short phrases", ...],
  "summary": "2-3 sentences for the reviewer",
  "call_script": "...",
  "email_subject": "...",
  "email_body": "...",
  "whatsapp_message": "..."
}`;

async function readScrapeExtract(lead) {
  if (!lead.gcs_prefix || !gcs.isEnabled) return null;
  try {
    const root = lead.gcs_prefix.replace(/\/scrape$/, '');
    const data = await gcs.readJson(`${root}/scrape/data/scraped-data.json`);
    if (!data) return null;
    return {
      title: data.title, description: data.description,
      headings: (data.headings || []).slice(0, 12),
      sections: (data.sections || []).slice(0, 10),
      navLinks: (data.navLinks || []).map((n) => n.text || n).slice(0, 15),
    };
  } catch (_) {
    return null;
  }
}

function buildUserPrompt(lead, extract, signals, company) {
  return JSON.stringify({
    business: {
      name: lead.name, category: lead.category, city: lead.city, country: lead.country,
      rating: lead.rating, reviews: lead.reviews, business_status: lead.business_status,
      phone: lead.phone || null, email: lead.contact_email || null, website: lead.website || null,
    },
    audit: {
      opportunity_score: lead.audit_score,
      reasons: lead.audit_reasons,
      https: signals.https, mobile_viewport: signals.mobile_viewport,
      platform: signals.platform, reachable: signals.reachable,
      psi_performance: signals.psi_performance, psi_seo: signals.psi_seo,
      copyright_year: signals.copyright_year,
    },
    current_site: extract,
    agency: {
      name: company?.name || 'the agency', website: company?.website || null,
      price_per_page: company?.price_per_page ?? company?.price_min ?? 200,
    },
  });
}

async function qualifyLead(lead) {
  const cfg = await settings.get();
  const company = await settings.getCompany();
  const signals = lead.audit_signals || {};
  const extract = await readScrapeExtract(lead);

  let verdict = null;
  try {
    const client = createAIClient(cfg.gemini_model || 'vertex-gemini-2.5-flash');
    // gemini-2.5-flash is a thinking model on Vertex and thinking tokens count
    // against the output budget — give it room so the JSON isn't truncated.
    const raw = await client.complete(SYSTEM, buildUserPrompt(lead, extract, signals, company), 4000, { isJson: true });
    verdict = SCHEMA.parse(JSON.parse(raw));
  } catch (err) {
    console.warn(`[qualify] Gemini failed for ${lead.id}: ${err.message}`);
  }

  const effectiveScore = lead.score_override ?? lead.audit_score ?? 0;
  const threshold = await settings.minScoreFor(lead);
  const passes = effectiveScore > threshold;

  const patch = {
    status: passes ? 'waiting_approval' : 'disqualified',
    qualify_decision: passes ? 'qualified' : 'rejected',
    qualified_by: 'gemini',
    qualify_confidence: verdict?.confidence ?? null,
    qualify_value_usd: verdict?.estimated_value_usd ?? null,
    qualify_angle: verdict?.pitch_angle ?? null,
    qualify_raw: verdict || { error: 'gemini_unavailable' },
  };
  if (!passes) patch.disqualify_reason = `score ${effectiveScore} <= threshold ${threshold}`;

  await store.updateLead(lead.id, patch);
  await store.recordEvent(lead.id, lead.status, patch.status, {
    effectiveScore, threshold, gemini: verdict?.recommendation || 'unavailable',
  });
  return { status: patch.status, effectiveScore, threshold, verdict };
}

/**
 * Re-route a lead after its score is changed on manual review, without
 * re-calling Gemini. Moves between waiting_approval / disqualified.
 */
async function reevaluate(lead) {
  if (!['audited', 'qualifying', 'waiting_approval', 'disqualified'].includes(lead.status)) {
    return { status: lead.status, changed: false };
  }
  const effectiveScore = lead.score_override ?? lead.audit_score ?? 0;
  const threshold = await settings.minScoreFor(lead);
  const target = effectiveScore > threshold ? 'waiting_approval' : 'disqualified';
  if (target === lead.status) return { status: lead.status, changed: false, effectiveScore, threshold };

  await store.updateLead(lead.id, {
    status: target,
    qualify_decision: target === 'waiting_approval' ? 'qualified' : 'rejected',
    disqualify_reason: target === 'disqualified' ? `score ${effectiveScore} <= threshold ${threshold}` : null,
  });
  await store.recordEvent(lead.id, lead.status, target, { effectiveScore, threshold, manualScore: true });
  return { status: target, changed: true, effectiveScore, threshold };
}

module.exports = { qualifyLead, reevaluate };
