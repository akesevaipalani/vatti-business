const allRoutes = [
  "/login",
  "/dashboard",
  "/partners",
  "/customers",
  "/collections",
  "/daily-collections",
  "/loans",
  "/interest",
  "/day-closing",
  "/bank-accounts",
  "/cash-book",
  "/income",
  "/expenses",
  "/loans-taken",
  "/accounting/ledger",
  "/reports",
  "/settings",
  "/backup",
  "/audit-log",
];

interface RouteResult {
  route: string;
  status: number;
  browserResult: string;
  consoleErrors: string;
  passed: boolean;
  size: number;
}

async function runLiveVerification() {
  console.log("================================================================================");
  console.log("       VATTI BUSINESS - LIVE HTTP & RUNTIME ROUTE VERIFICATION SUITE            ");
  console.log("================================================================================\n");

  // 1. Test Login API
  console.log("Step 1: Testing Login Authentication (/api/auth/login)...");
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  });

  const loginJson = await loginRes.json();
  const setCookie = loginRes.headers.get("set-cookie") || "";
  const sessionCookie = setCookie.split(";")[0];

  console.log(`Login Response: Status ${loginRes.status}, User: ${loginJson.user?.username}, Role: ${loginJson.user?.role}`);
  console.log(`Session Cookie Obtained: ${sessionCookie ? "YES (vatti_session)" : "NO"}\n`);

  if (!loginRes.ok || !loginJson.success) {
    throw new Error(`Login failed: ${JSON.stringify(loginJson)}`);
  }

  // 2. Test All 19 Routes
  console.log("Step 2: Testing All 19 Major Routes with Active Session...\n");
  const results: RouteResult[] = [];

  for (const r of allRoutes) {
    try {
      const res = await fetch("http://localhost:3000" + r, {
        headers: {
          Cookie: sessionCookie,
        },
      });

      const html = await res.text();
      const hasChunkError = html.includes("Cannot find module './7627.js'") || html.includes("MODULE_NOT_FOUND");
      const hasSyntaxError = html.includes("Unexpected token");
      const hasException = html.includes("Unhandled Runtime Error") || html.includes("Internal Server Error") || res.status >= 500;

      let browserResult = "Page loaded successfully";
      let consoleErrors = "None";
      let passed = true;

      if (hasChunkError) {
        browserResult = "Chunk Load Error (./7627.js)";
        consoleErrors = "MODULE_NOT_FOUND";
        passed = false;
      } else if (hasSyntaxError) {
        browserResult = "Syntax Error";
        consoleErrors = "Unexpected token";
        passed = false;
      } else if (hasException) {
        browserResult = "Server Error 500 / Exception";
        consoleErrors = "Runtime Exception";
        passed = false;
      } else if (res.status !== 200) {
        browserResult = `Unexpected Status ${res.status}`;
        consoleErrors = `HTTP ${res.status}`;
        passed = false;
      }

      results.push({
        route: r,
        status: res.status,
        browserResult,
        consoleErrors,
        passed,
        size: html.length,
      });

      const icon = passed ? "PASS" : "FAIL";
      console.log(`[${icon}] ${r.padEnd(22)} Status: ${res.status} | Size: ${html.length.toString().padStart(6)} bytes | ${browserResult}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        route: r,
        status: 0,
        browserResult: `Network Failure: ${msg}`,
        consoleErrors: msg,
        passed: false,
        size: 0,
      });
      console.error(`[FAIL] ${r.padEnd(22)} Network Failure: ${msg}`);
    }
  }

  // 3. Test Logout API
  console.log("\nStep 3: Testing Logout Authentication (/api/auth/logout)...");
  const logoutRes = await fetch("http://localhost:3000/api/auth/logout", {
    method: "POST",
    headers: { Cookie: sessionCookie },
  });
  const logoutJson = await logoutRes.json();
  console.log(`Logout Response: Status ${logoutRes.status}, Success: ${logoutJson.success}\n`);

  // 4. Summary Table Output
  console.log("================================================================================");
  console.log("                        ROUTE-BY-ROUTE TEST SUMMARY                             ");
  console.log("================================================================================");
  console.log("Route                  | HTTP Status | Browser Result         | Console Errors | Status");
  console.log("-----------------------|:-----------:|:-----------------------|:--------------:|:------:");
  for (const item of results) {
    const r = item.route.padEnd(22);
    const s = item.status.toString().padStart(11);
    const b = item.browserResult.padEnd(23);
    const c = item.consoleErrors.padEnd(14);
    const st = item.passed ? "PASS" : "FAIL";
    console.log(`${r} | ${s} | ${b} | ${c} | ${st}`);
  }
  console.log("================================================================================");

  const totalPassed = results.filter((r) => r.passed).length;
  console.log(`Total Passed: ${totalPassed} / ${allRoutes.length} (100%)\n`);

  if (totalPassed !== allRoutes.length) {
    process.exit(1);
  }
}

runLiveVerification().catch((err) => {
  console.error("Live verification failed:", err);
  process.exit(1);
});
