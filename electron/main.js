const { app, BrowserWindow, utilityProcess } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');
const { fork } = require('child_process');

// Enforce single instance lock so two copies don't contend for SQLite lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow = null;
let serverProcess = null;
let activePort = 3000;

// Resolve safe writable data directory in %APPDATA%/VATTI BUSINESS
function getAppDataPaths() {
  const appData = app.getPath('appData');
  const userDataDir = path.join(appData, 'VATTI BUSINESS');
  const dbPath = path.join(userDataDir, 'vatti.db');
  const backupsDir = path.join(userDataDir, 'backups');
  const configFile = path.join(userDataDir, 'cloud-config.json');

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  let centralServerUrl = process.env.CENTRAL_SERVER_URL || '';
  if (!centralServerUrl && fs.existsSync(configFile)) {
    try {
      const conf = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      if (conf.centralServerUrl) centralServerUrl = conf.centralServerUrl;
    } catch {}
  }

  return { userDataDir, dbPath, backupsDir, centralServerUrl };
}

// Ensure initial database is safely placed in %APPDATA% without overwriting existing data
function ensureInitialDatabase(dbPath) {
  if (!fs.existsSync(dbPath)) {
    console.log(`[VATTI] No existing database at ${dbPath}. Initializing from template...`);
    let templateDbPath = '';
    if (app.isPackaged) {
      templateDbPath = path.join(process.resourcesPath, 'server', 'prisma', 'vatti.db');
    } else {
      templateDbPath = path.resolve(__dirname, '..', 'prisma', 'vatti.db');
    }

    if (fs.existsSync(templateDbPath)) {
      fs.copyFileSync(templateDbPath, dbPath);
      console.log(`[VATTI] Successfully copied template database to ${dbPath}`);
    } else {
      console.warn(`[VATTI] Warning: Template database not found at ${templateDbPath}`);
    }
  } else {
    console.log(`[VATTI] Verified database already exists at ${dbPath}. Preserving user data.`);
  }
}

// Find an available TCP port (defaulting to 3000 if free)
function findAvailablePort(startPort = 3000) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => {
      // If startPort is taken, let OS assign a free port
      const randomTester = net.createServer();
      randomTester.once('error', () => resolve(3001));
      randomTester.listen(0, '127.0.0.1', () => {
        const port = randomTester.address().port;
        randomTester.close(() => resolve(port));
      });
    });
    tester.listen(startPort, '127.0.0.1', () => {
      tester.close(() => resolve(startPort));
    });
  });
}

// Wait for Next.js HTTP server to start responding
function waitForServer(port, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        // Any HTTP response (including 200, 307 redirect to /login) means the server is ready
        if (res.statusCode) {
          resolve(true);
        } else {
          retry();
        }
      });

      req.on('error', () => retry());
      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startTime > timeoutMs) {
        reject(new Error(`Server startup timed out after ${timeoutMs}ms on port ${port}`));
      } else {
        setTimeout(check, 250);
      }
    };

    check();
  });
}

// Start embedded Next.js standalone server
function startNextServer(port, dbPath, backupsDir) {
  const databaseUrl = `file:${dbPath.replace(/\\/g, '/')}`;
  
  const serverEnv = {
    ...process.env,
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    DATABASE_URL: databaseUrl,
    VATTI_BACKUP_DIR: backupsDir,
    NODE_ENV: 'production',
  };

  let serverScript = '';
  if (app.isPackaged) {
    serverScript = path.join(process.resourcesPath, 'server', 'server.js');
  } else {
    // In local development test
    serverScript = path.resolve(__dirname, '..', '.next', 'standalone', 'server.js');
  }

  console.log(`[VATTI] Starting standalone server from: ${serverScript}`);
  console.log(`[VATTI] Port: ${port} | DATABASE_URL: ${databaseUrl}`);

  if (!fs.existsSync(serverScript)) {
    throw new Error(`Next.js standalone server script not found at ${serverScript}`);
  }

  // Use Electron utilityProcess if available, otherwise fork
  if (utilityProcess && typeof utilityProcess.fork === 'function') {
    serverProcess = utilityProcess.fork(serverScript, [], {
      env: serverEnv,
      stdio: 'pipe',
    });

    if (serverProcess.stdout) {
      serverProcess.stdout.on('data', (data) => console.log(`[SERVER] ${data}`));
    }
    if (serverProcess.stderr) {
      serverProcess.stderr.on('data', (data) => console.error(`[SERVER ERR] ${data}`));
    }
    serverProcess.on('exit', (code) => {
      console.log(`[SERVER] Process exited with code ${code}`);
    });
  } else {
    serverProcess = fork(serverScript, [], {
      env: { ...serverEnv, ELECTRON_RUN_AS_NODE: '1' },
      stdio: 'pipe',
    });

    serverProcess.stdout.on('data', (data) => console.log(`[SERVER] ${data}`));
    serverProcess.stderr.on('data', (data) => console.error(`[SERVER ERR] ${data}`));
  }
}

// Create the main desktop application window
function createMainWindow(port, customUrl) {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.resolve(__dirname, '..', 'build', 'icon.ico');

  mainWindow = new BrowserWindow({
    title: 'VATTI BUSINESS',
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#f8fafc',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: true,
    show: false, // Show once ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  const targetUrl = customUrl || `http://127.0.0.1:${port}`;
  console.log(`[VATTI] Loading window URL: ${targetUrl}`);
  mainWindow.loadURL(targetUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Prevent external navigation from leaving app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://wa.me') || url.startsWith('http://wa.me')) {
      require('electron').shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

// App lifecycle
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  try {
    const { userDataDir, dbPath, backupsDir, centralServerUrl } = getAppDataPaths();
    console.log(`[VATTI] User data directory: ${userDataDir}`);

    if (centralServerUrl) {
      console.log(`[VATTI] Connecting Desktop to Central Cloud Server: ${centralServerUrl}`);
      createMainWindow(null, centralServerUrl);
    } else {
      ensureInitialDatabase(dbPath);

      activePort = await findAvailablePort(3000);
      console.log(`[VATTI] Allocated port: ${activePort}`);

      startNextServer(activePort, dbPath, backupsDir);

      console.log('[VATTI] Waiting for internal server ready...');
      await waitForServer(activePort, 30000);
      console.log('[VATTI] Internal server is ready!');

      createMainWindow(activePort);
    }
  } catch (err) {
    console.error('[VATTI FATAL]', err);
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'VATTI BUSINESS Startup Error',
      `Failed to start application:\n\n${err.message || err}`
    );
    app.quit();
  }
});

// Graceful termination
function stopServerProcess() {
  if (serverProcess) {
    console.log('[VATTI] Stopping internal server process...');
    try {
      serverProcess.kill();
    } catch {
      // Process might already be dead
    }
    serverProcess = null;
  }
}

app.on('before-quit', () => {
  stopServerProcess();
});

app.on('window-all-closed', () => {
  stopServerProcess();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
