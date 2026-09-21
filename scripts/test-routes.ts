const routes = [
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
];

async function testRoutes() {
  console.log("Testing all 17 routes on http://localhost:3000...\n");
  const results: { route: string; status: number; ok: boolean; size: number }[] = [];
  
  for (const r of routes) {
    try {
      const res = await fetch("http://localhost:3000" + r);
      const text = await res.text();
      const hasError =
        text.includes("MODULE_NOT_FOUND") ||
        text.includes("Cannot find module") ||
        text.includes("Unexpected token") ||
        res.status >= 500;

      results.push({ route: r, status: res.status, ok: !hasError, size: text.length });
      const mark = !hasError && res.status === 200 ? "PASS" : "FAIL";
      console.log(`[${mark}] ${r.padEnd(22)} Status: ${res.status} | Size: ${text.length} bytes`);
      
      if (hasError) {
        console.error(`  Error in route ${r}:`);
        console.error(text.slice(0, 300));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[FAIL] ${r} Exception: ${msg}`);
      results.push({ route: r, status: 0, ok: false, size: 0 });
    }
  }

  const allPassed = results.every((r) => r.ok && r.status === 200);
  console.log(`\nRoute Health Summary: ${results.filter((r) => r.ok && r.status === 200).length} / ${routes.length} PASSED`);
  if (!allPassed) {
    process.exit(1);
  }
}

testRoutes();
