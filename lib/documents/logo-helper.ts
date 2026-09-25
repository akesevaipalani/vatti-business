import fs from "fs";
import path from "path";

let cachedLogoBase64: string | null = null;

export function getLogoBase64(): string {
  if (cachedLogoBase64) return cachedLogoBase64;

  try {
    // In Node.js environment
    if (typeof process !== "undefined" && process.cwd) {
      const candidates = [
        path.join(process.cwd(), "public", "logo.png"),
        path.join(process.cwd(), "logo.png"),
        path.resolve(__dirname, "../../public/logo.png"),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          const buffer = fs.readFileSync(p);
          cachedLogoBase64 = `data:image/png;base64,${buffer.toString("base64")}`;
          return cachedLogoBase64;
        }
      }
    }
  } catch {
    // Ignore and fallback
  }

  return "";
}
