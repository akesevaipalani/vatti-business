const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd) {
  console.log(`\n>>> Executing: ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
}

function copyFolderSync(from, to) {
  if (!fs.existsSync(from)) return;
  if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach((element) => {
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    if (fs.lstatSync(fromPath).isDirectory()) {
      copyFolderSync(fromPath, toPath);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  });
}

async function buildDesktop() {
  console.log('========================================================================');
  console.log('            BUILDING VATTI BUSINESS DESKTOP APPLICATION                 ');
  console.log('========================================================================\n');

  const rootDir = path.resolve(__dirname, '..');
  const standaloneDir = path.join(rootDir, '.next', 'standalone');

  // 1. Ensure icon is generated
  const iconPath = path.join(rootDir, 'build', 'icon.ico');
  if (!fs.existsSync(iconPath)) {
    console.log('[1/5] Generating Windows application icons...');
    run('node scripts/generate_icon.js');
  } else {
    console.log('[1/5] Application icon verified at build/icon.ico');
  }

  // 2. Build Next.js in standalone mode
  console.log('\n[2/5] Compiling Next.js Standalone bundle...');
  run('npm run build');

  // 3. Copy static assets to standalone
  console.log('\n[3/5] Copying static assets to standalone bundle...');
  const staticSrc = path.join(rootDir, '.next', 'static');
  const staticDest = path.join(standaloneDir, '.next', 'static');
  copyFolderSync(staticSrc, staticDest);
  console.log(`Copied .next/static to ${staticDest}`);

  const publicSrc = path.join(rootDir, 'public');
  const publicDest = path.join(standaloneDir, 'public');
  if (fs.existsSync(publicSrc)) {
    copyFolderSync(publicSrc, publicDest);
    console.log(`Copied public/ to ${publicDest}`);
  }

  // 4. Ensure Prisma client and Windows query engine are inside standalone
  console.log('\n[4/5] Verifying Prisma query engine in standalone bundle...');
  const prismaDestDir = path.join(standaloneDir, 'node_modules', '.prisma', 'client');
  if (!fs.existsSync(prismaDestDir)) {
    fs.mkdirSync(prismaDestDir, { recursive: true });
  }

  const engineSrc = path.join(rootDir, 'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node');
  const engineDest = path.join(prismaDestDir, 'query_engine-windows.dll.node');
  if (fs.existsSync(engineSrc)) {
    fs.copyFileSync(engineSrc, engineDest);
    console.log(`Verified query_engine-windows.dll.node in standalone bundle (${fs.statSync(engineDest).size} bytes)`);
  } else {
    console.warn(`[WARN] Query engine not found at ${engineSrc}`);
  }

  // Copy schema.prisma to standalone/prisma
  const schemaDestDir = path.join(standaloneDir, 'prisma');
  if (!fs.existsSync(schemaDestDir)) {
    fs.mkdirSync(schemaDestDir, { recursive: true });
  }
  fs.copyFileSync(
    path.join(rootDir, 'prisma', 'schema.prisma'),
    path.join(schemaDestDir, 'schema.prisma')
  );

  // 5. Package with electron-builder
  console.log('\n[5/5] Packaging Windows Desktop Installer & Portable executable via electron-builder...');
  run('npx electron-builder --win');

  console.log('\n========================================================================');
  console.log('             DESKTOP BUILD COMPLETED SUCCESSFULLY                       ');
  console.log('========================================================================\n');
  
  const distDir = path.join(rootDir, 'dist');
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir).filter(f => f.endsWith('.exe'));
    console.log('Generated Executables in dist/:');
    files.forEach(f => {
      const stats = fs.statSync(path.join(distDir, f));
      console.log(`  - ${f} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
    });
  }
}

buildDesktop().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
