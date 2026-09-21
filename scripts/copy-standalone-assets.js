const fs = require('fs');
const path = require('path');

function copyFolderSync(from, to) {
  if (!fs.existsSync(from)) return;
  if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach((element) => {
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    try {
      if (fs.lstatSync(fromPath).isDirectory()) {
        copyFolderSync(fromPath, toPath);
      } else {
        fs.copyFileSync(fromPath, toPath);
      }
    } catch (err) {
      console.warn(`[WARN] Skipping locked/inaccessible file: ${fromPath} (${err.code || err.message})`);
    }
  });
}

function safeCopyFile(from, to) {
  try {
    const dir = path.dirname(to);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(from, to);
    return true;
  } catch (err) {
    console.warn(`[WARN] Skipping ${to}: ${err.code || err.message}`);
    return false;
  }
}

const rootDir = path.resolve(__dirname, '..');
const standaloneDir = path.join(rootDir, '.next', 'standalone');

if (!fs.existsSync(standaloneDir)) {
  console.log('[standalone-assets] Standalone directory not found, skipping sync.');
  process.exit(0);
}

console.log('[standalone-assets] Syncing static assets into .next/standalone...');

// 1. Copy .next/static
const staticSrc = path.join(rootDir, '.next', 'static');
const staticDest = path.join(standaloneDir, '.next', 'static');
copyFolderSync(staticSrc, staticDest);
console.log(`[standalone-assets] Synced .next/static -> ${staticDest}`);

// 2. Copy public directory
const publicSrc = path.join(rootDir, 'public');
const publicDest = path.join(standaloneDir, 'public');
if (fs.existsSync(publicSrc)) {
  copyFolderSync(publicSrc, publicDest);
  console.log(`[standalone-assets] Synced public/ -> ${publicDest}`);
}

// 3. Ensure Prisma Windows Query Engine
const engineSrc = path.join(rootDir, 'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node');
const engineDest = path.join(standaloneDir, 'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node');
if (fs.existsSync(engineSrc)) {
  safeCopyFile(engineSrc, engineDest);
  console.log(`[standalone-assets] Verified query_engine-windows.dll.node in standalone`);
}

// 4. Copy Prisma schema
const schemaSrc = path.join(rootDir, 'prisma', 'schema.prisma');
const schemaDest = path.join(standaloneDir, 'prisma', 'schema.prisma');
safeCopyFile(schemaSrc, schemaDest);
console.log(`[standalone-assets] Synced schema.prisma in standalone`);

// 5. Copy pristine template DB if exists
const dbSrc = path.join(rootDir, 'prisma', 'vatti.db');
const dbDest = path.join(standaloneDir, 'prisma', 'vatti.db');
if (fs.existsSync(dbSrc)) {
  safeCopyFile(dbSrc, dbDest);
  console.log(`[standalone-assets] Synced template vatti.db in standalone`);
}

console.log('[standalone-assets] Assets successfully synced to standalone runtime.\n');
