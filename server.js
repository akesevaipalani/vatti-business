const path = require('path');

// Ensure HOSTNAME binds to 0.0.0.0 in containerized environments (Railway, Docker)
// while allowing explicit 127.0.0.1 loopback overrides (such as Electron desktop app)
if (process.env.HOSTNAME !== '127.0.0.1' && process.env.HOSTNAME !== 'localhost') {
  process.env.HOSTNAME = '0.0.0.0';
}

const port = process.env.PORT || 3000;
console.log(`[VATTI Cloud Runtime] Starting server on ${process.env.HOSTNAME}:${port}...`);

// Execute the Next.js standalone server
require(path.resolve(__dirname, '.next/standalone/server.js'));
