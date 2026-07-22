import en, { Dict } from "./en";
import id from "./id";

export type Lang = "en" | "id";

export const translations: Record<Lang, Dict> = { en, id };

export function translate(lang: Lang, key: keyof Dict): string {
  return translations[lang][key] || (key as string);
}
