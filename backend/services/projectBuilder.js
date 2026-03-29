const fs = require('fs');
const path = require('path');
const os = require('os');
const s3 = require('./s3Storage');

/**
 * Writes all generated files to local disk and uploads to S3.
 * Returns { dir, tree, fileList, s3Prefix }
 */
async function buildProject(jobId, files, projectName) {
  const projectsDir = path.join(__dirname, '../../storage/projects');
  if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir, { recursive: true });

  const projectDir = path.join(projectsDir, jobId);

  const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

  // Write to local disk (needed for ZIP creation)
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(projectDir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });

    const ext = path.extname(filePath).toLowerCase();
    if (IMAGE_EXTS.has(ext) && typeof content === 'string') {
      fs.writeFileSync(fullPath, Buffer.from(content, 'base64'));
    } else {
      fs.writeFileSync(fullPath, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf8');
    }
  }

  // Upload to S3 in parallel (non-blocking — don't fail the build if S3 is down)
  let s3Prefix = null;
  if (s3.isEnabled) {
    try {
      s3Prefix = await s3.uploadProjectFiles(jobId, files);
      console.log(`[s3] Uploaded ${Object.keys(files).length} files → s3://${process.env.AWS_S3_BUCKET}/${s3Prefix}/`);
    } catch (err) {
      console.error('[s3] Failed to upload project files:', err.message);
    }
  }

  const tree = buildTree(files);
  const IMAGE_EXTS_SET = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
  const fileList = Object.keys(files).map(f => {
    const ext = f.split('.').pop().toLowerCase();
    const content = files[f] || '';
    const size = IMAGE_EXTS_SET.has(ext) && typeof content === 'string'
      ? Math.round(content.length * 0.75)
      : Buffer.byteLength(content, 'utf8');
    return { path: f, name: f.split('/').pop(), ext, size };
  });

  return { dir: projectDir, tree, fileList, s3Prefix };
}

/**
 * Convert flat file paths to nested tree structure.
 * { 'src/components/Header.jsx': 'file' } →
 * { src: { components: { 'Header.jsx': 'file' } } }
 */
function buildTree(files) {
  const root = {};
  for (const filePath of Object.keys(files).sort()) {
    const parts = filePath.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!node[part] || typeof node[part] !== 'object') {
        node[part] = {};
      }
      node = node[part];
    }
    node[parts[parts.length - 1]] = 'file';
  }
  return root;
}

module.exports = { buildProject, buildTree };
