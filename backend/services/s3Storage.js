const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined, // Fall back to instance profile / env if keys not set
});

const BUCKET = process.env.AWS_S3_BUCKET || 'websight-projects';

const isEnabled = !!(process.env.AWS_S3_BUCKET);

/**
 * Upload a Buffer or string to S3.
 * key: e.g. "projects/{jobId}/src/App.jsx"
 */
async function uploadFile(key, body, contentType = 'application/octet-stream') {
  if (!isEnabled) return;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

/**
 * Upload a readable stream to S3 using multipart upload.
 * Ideal for large files like ZIPs.
 */
async function uploadStream(key, stream, contentType = 'application/octet-stream') {
  if (!isEnabled) return;
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: stream,
      ContentType: contentType,
    },
  });
  await upload.done();
}

/**
 * Download an object from S3 and return its body as a Buffer.
 */
async function downloadFileBuffer(key) {
  if (!isEnabled) return null;
  try {
    const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    // Convert ReadableStream to Buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (err) {
    if (err.name === 'NoSuchKey') return null;
    throw err;
  }
}

/**
 * Get a pre-signed URL for downloading an object (default 1 hour expiry).
 */
async function getSignedDownloadUrl(key, expiresIn = 3600) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}

/**
 * List all objects under a prefix.
 */
async function listFiles(prefix) {
  if (!isEnabled) return [];
  const response = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
  return response.Contents || [];
}

/**
 * Delete all objects whose keys start with a given prefix.
 */
async function deletePrefix(prefix) {
  if (!isEnabled) return;
  const files = await listFiles(prefix);
  if (files.length === 0) return;
  await s3.send(new DeleteObjectsCommand({
    Bucket: BUCKET,
    Delete: { Objects: files.map(f => ({ Key: f.Key })) },
  }));
}

/**
 * Upload all files for a project to S3.
 * files: { 'src/App.jsx': 'content', ... }
 * Returns the S3 prefix used: "projects/{jobId}/"
 */
async function uploadProjectFiles(jobId, files) {
  if (!isEnabled) return null;
  const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
  const prefix = `projects/${jobId}`;

  await Promise.all(
    Object.entries(files).map(([filePath, content]) => {
      const ext = filePath.split('.').pop().toLowerCase();
      const isImage = IMAGE_EXTS.has(`.${ext}`);
      const body = isImage && typeof content === 'string'
        ? Buffer.from(content, 'base64')
        : Buffer.from(typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf8');
      const contentType = getContentType(filePath);
      return uploadFile(`${prefix}/${filePath}`, body, contentType);
    })
  );

  return prefix;
}

/**
 * Download all project files from S3 for a given jobId.
 * Returns { 'src/App.jsx': 'content', ... } or null if no files found.
 */
async function downloadProjectFiles(jobId) {
  if (!isEnabled) return null;
  const prefix = `projects/${jobId}/`;
  const objects = await listFiles(prefix);
  if (objects.length === 0) return null;

  const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
  const files = {};

  await Promise.all(objects.map(async ({ Key }) => {
    const relativePath = Key.slice(prefix.length); // strip "projects/{jobId}/"
    if (!relativePath) return;
    const buf = await downloadFileBuffer(Key);
    if (!buf) return;
    const ext = relativePath.split('.').pop().toLowerCase();
    files[relativePath] = IMAGE_EXTS.has(ext)
      ? buf.toString('base64')
      : buf.toString('utf8');
  }));

  return Object.keys(files).length > 0 ? files : null;
}

function getContentType(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  const map = {
    js: 'application/javascript', jsx: 'application/javascript',
    ts: 'application/typescript', tsx: 'application/typescript',
    css: 'text/css', html: 'text/html', json: 'application/json',
    md: 'text/markdown', svg: 'image/svg+xml',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    webp: 'image/webp', gif: 'image/gif',
    zip: 'application/zip',
  };
  return map[ext] || 'application/octet-stream';
}

module.exports = {
  isEnabled,
  uploadFile,
  uploadStream,
  downloadFileBuffer,
  getSignedDownloadUrl,
  listFiles,
  deletePrefix,
  uploadProjectFiles,
  downloadProjectFiles,
};
