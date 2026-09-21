import { en, Translations } from "./en";
import { ta } from "./ta";

export { en, ta };
export type { Translations };

export function getTranslations(lang: string = "en"): Translations {
  if (lang === "ta") {
    return ta;
  }
  return en;
}
