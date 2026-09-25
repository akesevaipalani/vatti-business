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

// 3. Ensure Prisma Client and Windows Query Engine
const clientSrc = path.join(rootDir, 'node_modules', '.prisma', 'client');
const clientDest = path.join(standaloneDir, 'node_modules', '.prisma', 'client');
if (fs.existsSync(clientSrc)) {
  copyFolderSync(clientSrc, clientDest);
  console.log(`[standalone-assets] Synced .prisma/client -> ${clientDest}`);
}

const engineSrc = path.join(rootDir, 'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node');
const engineDest = path.join(standaloneDir, 'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node');
if (fs.existsSync(engineSrc)) {
  safeCopyFile(engineSrc, engineDest);
  console.log(`[standalone-assets] Verified query_engine-windows.dll.node in standalone`);
}

// 4. Copy Prisma schema (enforce SQLite for standalone runtime)
const sqliteSchemaPath = path.join(rootDir, 'prisma', 'schema.sqlite.prisma');
const schemaSrc = fs.existsSync(sqliteSchemaPath) ? sqliteSchemaPath : path.join(rootDir, 'prisma', 'schema.prisma');
const schemaDest = path.join(standaloneDir, 'prisma', 'schema.prisma');
safeCopyFile(schemaSrc, schemaDest);
console.log(`[standalone-assets] Synced SQLite schema.prisma in standalone`);

const clientSchemaDest = path.join(standaloneDir, 'node_modules', '.prisma', 'client', 'schema.prisma');
safeCopyFile(schemaSrc, clientSchemaDest);
console.log(`[standalone-assets] Synced SQLite schema.prisma into .prisma/client`);

// 5. Copy pristine template DB if exists
const dbSrc = path.join(rootDir, 'prisma', 'vatti.db');
const dbDest = path.join(standaloneDir, 'prisma', 'vatti.db');
if (fs.existsSync(dbSrc)) {
  safeCopyFile(dbSrc, dbDest);
  console.log(`[standalone-assets] Synced template vatti.db in standalone`);
}

// 6. Ensure standalone server binds to 0.0.0.0 on container hosts
const standaloneServerPath = path.join(standaloneDir, 'server.js');
if (fs.existsSync(standaloneServerPath)) {
  let content = fs.readFileSync(standaloneServerPath, 'utf-8');
  content = content.replace(
    /const hostname = process\.env\.HOSTNAME \|\| '0\.0\.0\.0'/,
    "const hostname = (process.env.HOSTNAME === '127.0.0.1' || process.env.HOSTNAME === 'localhost') ? process.env.HOSTNAME : '0.0.0.0'"
  );
  fs.writeFileSync(standaloneServerPath, content);
  console.log('[standalone-assets] Ensured standalone server binds to 0.0.0.0 on container hosts');
}

// 7. Sanitize standalone .env to prevent any PostgreSQL DATABASE_URL leakage
const standaloneEnvPath = path.join(standaloneDir, '.env');
if (fs.existsSync(standaloneEnvPath)) {
  let lines = fs.readFileSync(standaloneEnvPath, 'utf-8').split(/\r?\n/);
  lines = lines.filter((line) => !line.trim().startsWith('DATABASE_URL='));
  fs.writeFileSync(standaloneEnvPath, lines.join('\n'));
  console.log('[standalone-assets] Sanitized .next/standalone/.env (stripped DATABASE_URL for local SQLite isolation)');
}

// 8. Remove any unwanted backups directory from standalone
const standaloneBackupsDir = path.join(standaloneDir, 'backups');
if (fs.existsSync(standaloneBackupsDir)) {
  fs.rmSync(standaloneBackupsDir, { recursive: true, force: true });
  console.log('[standalone-assets] Removed extraneous backups directory from standalone bundle');
}

console.log('[standalone-assets] Assets successfully synced to standalone runtime.\n');

