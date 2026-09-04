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

  // How many leads the cron tick advances per stage per run.
  TICK_LIMITS: {
    scrape: Number(process.env.TICK_SCRAPE_LIMIT || 5),
    audit: Number(process.env.TICK_AUDIT_LIMIT || 10),
    qualify: Number(process.env.TICK_QUALIFY_LIMIT || 10),
  },
};
