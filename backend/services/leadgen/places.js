/**
 * Google Places API (New) — Text Search.
 * https://developers.google.com/maps/documentation/places/web-service/text-search
 *
 * Billing: websiteUri / rating / phone fields put a call in the Enterprise SKU
 * tier. Keep the field mask minimal and set a daily quota cap in the Cloud
 * console. One call returns up to 20 results; pagination caps at 60.
 *
 * Env: GOOGLE_API_KEY (Places API New + PageSpeed Insights API enabled).
 */
const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'places.primaryType',
  'places.location',
  'places.googleMapsUri',
  'nextPageToken',
].join(',');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parsePlace(place, query, country) {
  const loc = place.location || {};
  return {
    place_id: place.id,
    name: place.displayName?.text || null,
    address: place.formattedAddress || null,
    country,
    phone: place.nationalPhoneNumber || null,
    phone_intl: place.internationalPhoneNumber || null,
    website: place.websiteUri || null,
    rating: place.rating ?? null,
    reviews: place.userRatingCount ?? null,
    business_status: place.businessStatus || null,
    primary_type: place.primaryType || null,
    lat: loc.latitude ?? null,
    lng: loc.longitude ?? null,
    maps_uri: place.googleMapsUri || null,
    search_query: query,
  };
}

/**
 * @returns {Promise<{ results: object[], calls: number }>}
 */
async function searchText(apiKey, query, country, maxResults = 60) {
  if (!apiKey) throw new Error('GOOGLE_API_KEY not configured');
  const headers = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': FIELD_MASK,
  };
  const body = { textQuery: query, pageSize: 20 };
  const results = [];
  let calls = 0;

  while (results.length < maxResults) {
    const resp = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body) });
    calls += 1;
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Places API ${resp.status}: ${text.slice(0, 300)}`);
    }
    const data = await resp.json();
    for (const place of data.places || []) {
      if (place?.id) results.push(parsePlace(place, query, country));
    }
    if (!data.nextPageToken || results.length >= maxResults) break;
    body.pageToken = data.nextPageToken;
    await sleep(2000); // nextPageToken needs a moment to become valid
  }

  return { results: results.slice(0, maxResults), calls };
}

module.exports = { searchText };
