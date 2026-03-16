const fs = require('fs');
const path = require('path');
const { createAIClient } = require('./aiClient');
const { buildProject } = require('./projectBuilder');
const { updateJob, addLog } = require('./jobStore');
const { createZip } = require('./zipper');

/**
 * Applies a text-based edit command to an existing project.
 */
async function applyEdit(jobId, job, command, onProgress = () => {}) {
  const ai = createAIClient(job.model || 'claude-opus-4-5');
  
  onProgress('Analyzing edit command…');
  
  // We send only the relevant files to save context, or everything if small.
  // For now, let's send the list of files and the command.
  const fileList = Object.keys(job.files).join('\n');
  
  const system = `You are an expert full-stack developer. You are editing an existing ${job.framework} project.
The user wants to make a change: "${command}".
Existing files in project:
${fileList}

Return ONLY a JSON object mapping file paths to their NEW complete contents. 
Only include files that need to be changed OR created.
Format: { "path/to/file.jsx": "complete code..." }
Return ONLY raw JSON, no markdown.`;

  onProgress('Consulting AI for changes…');
  
  const response = await ai.complete(system, `Command: ${command}\n\nExisting Design Tokens: ${JSON.stringify(job.tokens)}`, 4096);
  
  let updates;
  try {
    updates = JSON.parse(response.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, ''));
  } catch (err) {
    // Fallback: search for JSON in text
    const match = response.match(/\{[\s\S]*\}/);
    if (match) updates = JSON.parse(match[0]);
    else throw new Error('Failed to parse AI response as JSON updates.');
  }

  onProgress(`Applying ${Object.keys(updates).length} file changes…`);
  
  const newFiles = { ...job.files, ...updates };
  
  // Re-build and re-zip
  const { tree, fileList: newFileList, dir } = await buildProject(jobId, newFiles, job.projectName);
  const zipPath = await createZip(dir, job.projectName);
  
  updateJob(jobId, {
    files: newFiles,
    tree,
    fileList: newFileList,
    zipPath,
    status: 'done'
  });
  
  addLog(jobId, `Edit applied: ${command}`);
  return true;
}

module.exports = { applyEdit };
