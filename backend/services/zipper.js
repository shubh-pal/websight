const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Zips a source directory and returns the path to the ZIP file.
 */
async function createZip(sourceDir, zipName) {
  const zipsDir = path.join(__dirname, '../../storage/projects/zips');
  if (!fs.existsSync(zipsDir)) fs.mkdirSync(zipsDir, { recursive: true });

  const zipPath = path.join(zipsDir, `${zipName}-${Date.now()}.zip`);

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(zipPath));
    output.on('error', reject);
    archive.on('error', reject);
    archive.on('warning', warn => {
      if (warn.code !== 'ENOENT') reject(warn);
    });

    archive.pipe(output);
    // Add directory contents under a named root folder
    archive.directory(sourceDir, zipName);
    archive.finalize();
  });
}

module.exports = { createZip };
