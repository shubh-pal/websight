/**
 * Google Cloud Storage wrapper for the agency pipeline.
 *
 * Mirrors the shape of services/s3Storage.js. Used only by internal /api/app
 * flows — the public product still uses S3 (s3Storage.js) and ZIP downloads.
 *
 * Auth: Application Default Credentials. On Cloud Run this is the service
 * account automatically; locally set GOOGLE_APPLICATION_CREDENTIALS or run
 * `gcloud auth application-default login`.
 *
 * Env:
 *   GCS_BUCKET             required to enable (e.g. "websight-leadgen")
 *   GOOGLE_CLOUD_PROJECT   optional; picked up from ADC otherwise
 *   GCS_SIGNER_EMAIL       optional; SA email to sign URLs as when the runtime
 *                          SA can't self-sign (needs Token Creator on itself)
 */

let StorageCtor = null;
try {
  ({ Storage: StorageCtor } = require('@google-cloud/storage'));
} catch (_) {
  // Dependency not installed yet — service stays disabled.
}

const BUCKET = process.env.GCS_BUCKET || '';
const isEnabled = !!(BUCKET && StorageCtor);

const storage = isEnabled
  ? new StorageCtor(
      process.env.GOOGLE_CLOUD_PROJECT
        ? { projectId: process.env.GOOGLE_CLOUD_PROJECT }
        : {}
    )
  : null;

function bucket() {
  if (!isEnabled) throw new Error('[gcs] GCS_BUCKET not configured or @google-cloud/storage missing');
  return storage.bucket(BUCKET);
}

/**
 * Upload a Buffer or string.
 * @param {string} key   object path, e.g. "companies/<id>/scrape/manifest.json"
 */
async function uploadFile(key, body, contentType = 'application/octet-stream') {
  if (!isEnabled) return null;
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
  await bucket().file(key).save(buf, {
    resumable: false,
    contentType,
    metadata: { cacheControl: 'private, max-age=0' },
  });
  return `gs://${BUCKET}/${key}`;
}

async function uploadJson(key, obj) {
  return uploadFile(key, JSON.stringify(obj, null, 2), 'application/json');
}

/**
 * Upload a list of { path, body, contentType } artifacts under a prefix.
 * Returns the prefix.
 */
async function uploadArtifacts(prefix, files) {
  if (!isEnabled) return null;
  const clean = prefix.replace(/\/+$/, '');
  await Promise.all(
    files.map((f) =>
      uploadFile(`${clean}/${f.path.replace(/^\/+/, '')}`, f.body, f.contentType)
    )
  );
  return clean;
}

async function downloadBuffer(key) {
  if (!isEnabled) return null;
  try {
    const [buf] = await bucket().file(key).download();
    return buf;
  } catch (err) {
    if (err.code === 404) return null;
    throw err;
  }
}

async function readJson(key) {
  const buf = await downloadBuffer(key);
  return buf ? JSON.parse(buf.toString('utf8')) : null;
}

async function exists(key) {
  if (!isEnabled) return false;
  const [ok] = await bucket().file(key).exists();
  return ok;
}

async function listFiles(prefix) {
  if (!isEnabled) return [];
  const [files] = await bucket().getFiles({ prefix });
  return files.map((f) => ({ key: f.name, size: Number(f.metadata.size || 0) }));
}

/**
 * V4 signed URL for reading an object (default 1 hour).
 * Needs the signing identity to have signBlob rights; pass GCS_SIGNER_EMAIL
 * when the runtime SA lacks self-sign.
 */
async function getSignedDownloadUrl(key, expiresInSeconds = 3600) {
  if (!isEnabled) return null;
  const opts = {
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiresInSeconds * 1000,
  };
  if (process.env.GCS_SIGNER_EMAIL) opts.signingEndpoint = undefined; // reserved
  const [url] = await bucket().file(key).getSignedUrl(opts);
  return url;
}

async function deletePrefix(prefix) {
  if (!isEnabled) return;
  await bucket().deleteFiles({ prefix, force: true });
}

module.exports = {
  isEnabled,
  bucketName: BUCKET,
  uploadFile,
  uploadJson,
  uploadArtifacts,
  downloadBuffer,
  readJson,
  exists,
  listFiles,
  getSignedDownloadUrl,
  deletePrefix,
};
