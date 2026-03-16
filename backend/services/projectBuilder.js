const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Writes all generated files to a temp directory.
 * Returns { dir, tree, fileList }
 */
async function buildProject(jobId, files, projectName) {
  const projectsDir = path.join(__dirname, '../../storage/projects');
  if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir, { recursive: true });

  const projectDir = path.join(projectsDir, jobId);
  if (fs.existsSync(projectDir)) {
    // If it exists, we might be updating it
    // For now, let's clear it or just overwrite
  }

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(projectDir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf8');
  }

  const tree = buildTree(files);
  const fileList = Object.keys(files).map(f => ({
    path: f,
    name: f.split('/').pop(),
    ext: f.split('.').pop(),
    size: Buffer.byteLength(files[f] || '', 'utf8'),
  }));

  return { dir: projectDir, tree, fileList };
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
