const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const { PassThrough } = require('stream');
const s3Storage = require('./s3Storage');

/**
 * Zips a source directory, saves locally, and uploads to S3.
 * Returns { zipPath, s3ZipKey }
 */
async function createZip(sourceDir, zipName) {
  const zipsDir = path.join(__dirname, '../../storage/projects/zips');
  if (!fs.existsSync(zipsDir)) fs.mkdirSync(zipsDir, { recursive: true });

  const zipPath = path.join(zipsDir, `${zipName}-${Date.now()}.zip`);
  const s3ZipKey = `zips/${path.basename(zipPath)}`;

  // Create the archive and pipe to both local file and S3 simultaneously
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const localStream = fs.createWriteStream(zipPath);
    const s3PassThrough = new PassThrough();

    let localDone = false;
    let s3Done = !s3Storage.isEnabled; // skip S3 wait if not enabled
    let s3Key = null;

    const maybeResolve = () => {
      if (localDone && s3Done) resolve({ zipPath, s3ZipKey: s3Key });
    };

    localStream.on('close', () => {
      localDone = true;
      maybeResolve();
    });
    localStream.on('error', reject);
    archive.on('error', reject);
    archive.on('warning', warn => {
      if (warn.code !== 'ENOENT') reject(warn);
    });

    // Pipe archive to local file
    archive.pipe(localStream);

    // Also pipe to S3 via PassThrough if enabled
    if (s3Storage.isEnabled) {
      archive.pipe(s3PassThrough);
      s3Storage.uploadStream(s3ZipKey, s3PassThrough, 'application/zip')
        .then(() => {
          s3Key = s3ZipKey;
          console.log(`[s3] Uploaded ZIP → s3://${process.env.AWS_S3_BUCKET}/${s3ZipKey}`);
          s3Done = true;
          maybeResolve();
        })
        .catch(err => {
          console.error('[s3] Failed to upload ZIP:', err.message);
          s3Done = true; // don't block on S3 failure
          maybeResolve();
        });
    }

    archive.directory(sourceDir, zipName);
    archive.finalize();
  });
}

module.exports = { createZip };
