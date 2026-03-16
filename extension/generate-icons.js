#!/usr/bin/env node
/**
 * Generates WebSight extension icons (16, 48, 128px) as PNG files.
 * Run once: node generate-icons.js
 * Requires: npm install canvas (in extension folder)
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const SIZES = [16, 48, 128];
const OUT   = path.join(__dirname, 'icons');
fs.mkdirSync(OUT, { recursive: true });

SIZES.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx    = canvas.getContext('2d');
  const r      = size * 0.22; // corner radius

  // Background: violet
  ctx.fillStyle = '#7c6af7';
  roundRect(ctx, 0, 0, size, size, r);
  ctx.fill();

  // Cross lines
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth   = size * 0.12;
  ctx.lineCap     = 'round';
  const pad = size * 0.24;
  ctx.beginPath();
  ctx.moveTo(pad, size / 2); ctx.lineTo(size - pad, size / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(size / 2, pad); ctx.lineTo(size / 2, size - pad);
  ctx.stroke();

  // Center dot
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.12, 0, Math.PI * 2);
  ctx.fill();

  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(OUT, `icon${size}.png`), buf);
  console.log(`✓ icon${size}.png`);
});

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
