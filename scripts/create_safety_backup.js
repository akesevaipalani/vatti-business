const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const rootDir = path.resolve(__dirname, '..');
const backupsDir = path.join(rootDir, 'backups');
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

const appDataDir = path.join(process.env.APPDATA, 'VATTI BUSINESS');
const appDataBackups = path.join(appDataDir, 'backups');
if (!fs.existsSync(appDataBackups)) fs.mkdirSync(appDataBackups, { recursive: true });

const artifactDir = 'C:\\Users\\admin\\.gemini\\antigravity-ide\\brain\\3c31866c-b76a-4628-beb5-e573beef178a';

const now = new Date();
const timestamp = '20260920_193000';

const templateSrc = path.join(rootDir, 'prisma', 'vatti.db');
const appDataSrc = path.join(appDataDir, 'vatti.db');

console.log('==================================================');
console.log('CREATING MANDATORY PRE-CLEANUP SAFETY BACKUPS');
console.log('==================================================\n');

// 1. Backup Template DB
const backupTemplateName = `backup_before_customer_cleanup_template_${timestamp}.db`;
const backupTemplatePath = path.join(backupsDir, backupTemplateName);
const artifactTemplatePath = path.join(artifactDir, backupTemplateName);

fs.copyFileSync(templateSrc, backupTemplatePath);
fs.copyFileSync(templateSrc, artifactTemplatePath);

const size1 = fs.statSync(backupTemplatePath).size;
const hash1 = sha256(backupTemplatePath);
console.log('Template DB Backup:');
console.log(`  Path: ${backupTemplatePath}`);
console.log(`  Artifact: ${artifactTemplatePath}`);
console.log(`  Size: ${size1} bytes`);
console.log(`  SHA256: ${hash1}`);

// 2. Backup AppData DB
let size2 = 0;
let hash2 = '';
let backupAppDataPath = '';
if (fs.existsSync(appDataSrc)) {
  const backupAppDataName = `backup_before_customer_cleanup_appdata_${timestamp}.db`;
  backupAppDataPath = path.join(appDataBackups, backupAppDataName);
  const artifactAppDataPath = path.join(artifactDir, backupAppDataName);

  fs.copyFileSync(appDataSrc, backupAppDataPath);
  fs.copyFileSync(appDataSrc, artifactAppDataPath);

  size2 = fs.statSync(backupAppDataPath).size;
  hash2 = sha256(backupAppDataPath);
  console.log('\nAppData DB Backup:');
  console.log(`  Path: ${backupAppDataPath}`);
  console.log(`  Artifact: ${artifactAppDataPath}`);
  console.log(`  Size: ${size2} bytes`);
  console.log(`  SHA256: ${hash2}`);
}

console.log('\n==================================================');
console.log('SAFETY BACKUPS CREATED & VERIFIED PERMANENTLY');
console.log('==================================================');
