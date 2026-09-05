/**
 * Design MCP — lets a design-capable MCP client (an agent session with image
 * generation, or a human copying prompts into ChatGPT/whatever they already
 * pay for) pick up "approved, needs a redesign image" leads, see a brief +
 * the current site, and hand back the finished mockup.
 *
 * This intentionally does NOT call any image-generation API itself and does
 * NOT automate the ChatGPT web app — it is a plain data hand-off. Whoever
 * (or whatever) generates the image is the caller's choice.
 *
 * Auth: bearer token (see mcp/design/index.js), NOT public like the scrape MCP.
 */
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const z = require('zod/v4');
const gcs = require('../../services/gcsStorage');
const store = require('../../services/leadgen/store');
const settings = require('../../services/leadgen/settings');
const designIntake = require('../../services/leadgen/designIntake');

async function readDesignSystem(lead) {
  if (!lead.gcs_prefix || !gcs.isEnabled) return null;
  const root = lead.gcs_prefix.replace(/\/scrape$/, '');
  try { return await gcs.readJson(`${root}/scrape/data/design-system.json`); } catch (_) { return null; }
}

function artDirectionPrompt(lead, designSystem, company) {
  const colors = designSystem?.colors || {};
  const fonts = designSystem?.fonts || {};
  const verdict = lead.qualify_raw && !lead.qualify_raw.error ? lead.qualify_raw : null;
  const palette = Object.entries(colors).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(', ');

  return [
    `Design a modern, high-converting one-page website mockup for "${lead.name}", a ${lead.category || 'local business'} in ${[lead.city, lead.country].filter(Boolean).join(', ')}.`,
    verdict?.pitch_angle ? `Positioning: ${verdict.pitch_angle}` : null,
    verdict?.summary ? `Context: ${verdict.summary}` : null,
    palette ? `Use this palette as inspiration (not literal): ${palette}.` : null,
    fonts.heading ? `Typography mood: ${fonts.heading} for headings, ${fonts.body || fonts.heading} for body text.` : null,
    'Show a realistic desktop browser mockup: hero section with a clear headline and CTA, a services/features section, and a footer with contact info.',
    'Clean, professional, mobile-friendly aesthetic. No placeholder "lorem ipsum" — use real, plausible copy for this business.',
    company?.tagline ? `This is a redesign pitch from an agency whose promise is: "${company.tagline}"` : null,
  ].filter(Boolean).join('\n');
}

function createDesignMcpServer() {
  const server = new McpServer({
    name: 'websight-design-intake',
    version: '1.0.0',
  }, {
    capabilities: { tools: {} },
    instructions:
      'Workflow, safe for a scheduled/unattended run: ' +
      '1) list_pending_designs — only ever returns untouched leads (approved_ready_for_ui); a lead another run has already claimed or that failed will not reappear here. ' +
      '2) For each leadId, IMMEDIATELY call set_status(leadId, "in_progress") to claim it before doing any generation work — this is what keeps a second/overlapping run from picking up the same lead. ' +
      '3) get_design_brief(leadId) for the business info, current screenshot, and a ready-to-use art-direction prompt (this also marks it in_progress if you skipped step 2). ' +
      '4) Generate the image however you have available. ' +
      '5) On success: submit_design(leadId, imageBase64, filename) — uploads it and automatically builds + queues the pitch PDF. ' +
      'On failure: set_status(leadId, "failed", note) so it is not retried in a loop; use set_status(leadId, "reset") later to make it eligible for list_pending_designs again.',
  });

  server.registerTool('list_pending_designs', {
    title: 'List pending designs',
    description: 'Leads that are approved and waiting on a redesign mockup image — excludes leads already claimed (in_progress) or marked failed.',
    inputSchema: { limit: z.number().int().min(1).max(100).optional() },
  }, async ({ limit }) => {
    const rows = await designIntake.listPending(limit || 25);
    const summary = rows.map((l) => ({
      leadId: l.id, name: l.name, category: l.category, niche_id: l.niche_id,
      city: l.city, country: l.country, website: l.website,
      approvedAt: l.approved_at,
    }));
    return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
  });

  server.registerTool('set_status', {
    title: 'Set design status',
    description: 'Claim a lead before working on it, mark it failed if generation didn\'t work out, or reset it back to pending. Only valid while the lead is in the design phase (approved_ready_for_ui or building_ui) — call this before spending time generating an image, not after.',
    inputSchema: {
      leadId: z.string().min(1),
      status: z.enum(['in_progress', 'failed', 'reset']),
      note: z.string().max(500).optional().describe('Why it failed, or any other short note — recorded on the lead.'),
    },
  }, async ({ leadId, status, note }) => {
    try {
      const result = await designIntake.setDesignStatus(leadId, status, note);
      return { content: [{ type: 'text', text: JSON.stringify({ ok: true, ...result }, null, 2) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text', text: `set_status failed: ${err.message}` }] };
    }
  });

  server.registerTool('get_design_brief', {
    title: 'Get design brief',
    description: 'Full brief for one lead: business info, audit findings, scraped design system, current screenshot (embedded image), and a ready-to-use art-direction prompt.',
    inputSchema: { leadId: z.string().min(1) },
  }, async ({ leadId }) => {
    const [lead] = await store.q(`SELECT * FROM leads WHERE id = $1`, [leadId]);
    if (!lead) return { isError: true, content: [{ type: 'text', text: `Lead ${leadId} not found` }] };
    if (!['approved_ready_for_ui', 'building_ui'].includes(lead.status)) {
      return { isError: true, content: [{ type: 'text', text: `Lead is '${lead.status}', expected 'approved_ready_for_ui' or 'building_ui'.` }] };
    }
    await designIntake.markBuildingUi(leadId); // first brief pull -> "actively being worked"

    const [designSystem, company] = await Promise.all([readDesignSystem(lead), settings.getCompany()]);
    const brief = {
      leadId: lead.id, name: lead.name, category: lead.category,
      city: lead.city, country: lead.country, website: lead.website,
      auditScore: lead.audit_score, auditReasons: lead.audit_reasons,
      geminiVerdict: lead.qualify_raw && !lead.qualify_raw.error ? lead.qualify_raw : null,
      designSystem: designSystem ? { colors: designSystem.colors, fonts: designSystem.fonts, category: designSystem.category } : null,
    };
    const prompt = artDirectionPrompt(lead, designSystem, company);
    const content = [
      { type: 'text', text: JSON.stringify(brief, null, 2) },
      { type: 'text', text: `\n--- ART DIRECTION PROMPT ---\n${prompt}` },
    ];

    const shotKey = (lead.manual_assets || {}).screenshot || (lead.audit_signals || {}).screenshot;
    if (shotKey && gcs.isEnabled) {
      try {
        const buf = await gcs.downloadBuffer(shotKey);
        if (buf) {
          const ext = shotKey.split('.').pop().toLowerCase();
          const mime = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }[ext] || 'image/png';
          content.push({ type: 'image', data: buf.toString('base64'), mimeType: mime });
        }
      } catch (_) { /* ignore */ }
    }

    return { content };
  });

  server.registerTool('submit_design', {
    title: 'Submit design',
    description: 'Upload the finished redesign mockup image for a lead. Automatically builds and queues the pitch PDF.',
    inputSchema: {
      leadId: z.string().min(1),
      imageBase64: z.string().min(1).describe('Raw base64 or a data: URL of the PNG/JPG/WEBP mockup image.'),
      filename: z.string().min(1).default('mockup.png'),
    },
  }, async ({ leadId, imageBase64, filename }) => {
    const ext = (filename.split('.').pop() || 'png').toLowerCase();
    const buf = Buffer.from(imageBase64.replace(/^data:[^,]+,/, ''), 'base64');
    try {
      const result = await designIntake.receiveMockup(leadId, buf, ext, { source: 'mcp' });
      return { content: [{ type: 'text', text: JSON.stringify({ ok: true, ...result }, null, 2) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text', text: `submit_design failed: ${err.message}` }] };
    }
  });

  return server;
}

module.exports = { createDesignMcpServer };
