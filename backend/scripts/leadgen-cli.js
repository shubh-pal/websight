#!/usr/bin/env node
/**
 * Manual driver for the agency pipeline (local testing + Cloud Run Jobs later).
 *
 *   node scripts/leadgen-cli.js discover          # run the default grid
 *   node scripts/leadgen-cli.js discover ./grid.json
 *   node scripts/leadgen-cli.js tick              # advance leads one stage each
 *   node scripts/leadgen-cli.js summary           # counts by status
 *
 * Requires DATABASE_URL (and GOOGLE_API_KEY for discover). Loads backend/.env.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  const store = require('../services/leadgen/store');

  if (cmd === 'discover') {
    const { runDiscovery } = require('../services/leadgen/discover');
    const grid = arg ? JSON.parse(fs.readFileSync(path.resolve(arg), 'utf8')) : undefined;
    const r = await runDiscovery({ grid, requestedBy: 'cli' });
    console.log(JSON.stringify(r, null, 2));
  } else if (cmd === 'tick') {
    const pipeline = require('../services/leadgen/pipeline');
    const r = await pipeline.tick();
    console.log(JSON.stringify(r, null, 2));
  } else if (cmd === 'summary') {
    console.log(JSON.stringify(await store.summary(), null, 2));
  } else {
    console.log('usage: leadgen-cli.js <discover [grid.json] | tick | summary>');
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
