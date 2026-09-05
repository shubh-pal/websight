/**
 * Default discovery grid + pipeline knobs. The dashboard can override `grid`
 * per run; these are the fallback defaults.
 */
module.exports = {
  DEFAULT_GRID: {
    countries: ['US', 'GB', 'AU'],
    min_reviews: 5,
    max_reviews: 1500,
    opportunity_threshold: 45,
    targets: [
      {
        country: 'US',
        cities: ['Los Angeles, CA', 'Austin, TX', 'Denver, CO'],
        categories: ['dentist', 'personal injury law firm', 'plumber', 'roofing contractor', 'med spa'],
      },
      {
        country: 'GB',
        cities: ['Manchester', 'Leeds', 'Bristol'],
        categories: ['dentist', 'solicitors', 'plumber', 'letting agent'],
      },
      {
        country: 'AU',
        cities: ['Brisbane', 'Perth'],
        categories: ['dentist', 'electrician', 'conveyancer'],
      },
    ],
  },

  // How many leads the cron tick advances per stage per run. `approve`
  // defaults to 0 — the main tick (scrape/audit/qualify) leaves it off; a
  // separate scheduled job calls /cron/tick with an explicit approve limit
  // on its own cadence (see docs/AGENCY_INFRA.md or DEPLOYMENT.md).
  TICK_LIMITS: {
    scrape: Number(process.env.TICK_SCRAPE_LIMIT || 5),
    audit: Number(process.env.TICK_AUDIT_LIMIT || 10),
    qualify: Number(process.env.TICK_QUALIFY_LIMIT || 10),
    approve: Number(process.env.TICK_APPROVE_LIMIT || 0),
    pdfRecover: Number(process.env.TICK_PDF_RECOVER_LIMIT || 3),
  },
};
