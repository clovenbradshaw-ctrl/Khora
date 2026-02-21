#!/usr/bin/env node
/**
 * build.js — Pre-compiles JSX in index.html so @babel/standalone is not needed at runtime.
 *
 * Usage:
 *   npm run build          # compile JSX → plain JS in index.html
 *   node build.js --check  # verify whether index.html needs compilation (exit 1 if stale)
 */

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const INDEX = path.join(__dirname, 'index.html');

// ── Regex to match <script type="text/babel">…</script> ──
const BABEL_SCRIPT_RE = /<script\s+type=["']text\/babel["']\s*>([\s\S]*?)<\/script>/;

// ── Tags to strip from production output ──
const BABEL_SRC_RE = /<script[^>]*src=["'][^"']*babel[^"']*\.js["'][^>]*><\/script>\s*/g;
const BABEL_PRELOAD_RE = /<link[^>]*href=["'][^"']*babel[^"']*\.js["'][^>]*>\s*/g;

function build() {
  let html = fs.readFileSync(INDEX, 'utf-8');

  const match = html.match(BABEL_SCRIPT_RE);
  if (!match) {
    console.log('✓ No <script type="text/babel"> found — already compiled or nothing to do.');
    return;
  }

  const jsx = match[1];
  console.log(`Compiling ${jsx.split('\n').length} lines of JSX…`);

  // Compile JSX → plain JS using React.createElement (classic runtime)
  const result = babel.transformSync(jsx, {
    presets: [['@babel/preset-react', { runtime: 'classic' }]],
    filename: 'app.jsx',
    sourceType: 'script',
    compact: false,
  });

  if (!result || !result.code) {
    console.error('✗ Babel compilation failed.');
    process.exit(1);
  }

  console.log(`Compiled to ${result.code.split('\n').length} lines of JS.`);

  // Replace <script type="text/babel"> with <script> (compiled JS)
  html = html.replace(BABEL_SCRIPT_RE, `<script>\n${result.code}\n</script>`);

  // Remove @babel/standalone <script src> and <link rel="preload"> tags
  html = html.replace(BABEL_SRC_RE, '');
  html = html.replace(BABEL_PRELOAD_RE, '');

  fs.writeFileSync(INDEX, html, 'utf-8');
  console.log(`✓ index.html updated — Babel standalone removed, JSX pre-compiled.`);
}

if (process.argv.includes('--check')) {
  const html = fs.readFileSync(INDEX, 'utf-8');
  if (BABEL_SCRIPT_RE.test(html)) {
    console.log('✗ index.html contains uncompiled JSX. Run: npm run build');
    process.exit(1);
  } else {
    console.log('✓ index.html is pre-compiled.');
    process.exit(0);
  }
} else {
  build();
}
