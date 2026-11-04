// Idioma de la interfaz (español, inglés, francés). Los textos están en src/locales; los nombres de los
// datos del juego (objetos, runas, hechizos…) vienen de public/data/lang/{lang}.json.
import { createContext, useContext } from 'react';
import es from '../locales/es';
import en from '../locales/en';
import fr from '../locales/fr';

export type Lang = 'es' | 'en' | 'fr';
export type Dict = typeof es;
export type TKey = keyof Dict;

export const LANGS: { id: Lang; label: string; locale: string }[] = [
  { id: 'es', label: 'Español', locale: 'es-ES' },
  { id: 'en', label: 'English', locale: 'en-GB' },
  { id: 'fr', label: 'Français', locale: 'fr-FR' },
];

const DICTS: Record<Lang, Partial<Dict>> = { es, en, fr };
const STORE_KEY = 'wba.lang';

export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORE_KEY) as Lang | null;
    if (saved && saved in DICTS) return saved;
  } catch { /* sin almacenamiento local */ }
  const nav = (navigator.language || 'es').slice(0, 2);
  return nav === 'fr' ? 'fr' : nav === 'en' ? 'en' : 'es';
}

let current: Lang = initialLang();

export function setLang(lang: Lang) {
  current = lang;
  document.documentElement.lang = lang;
  try { localStorage.setItem(STORE_KEY, lang); } catch { /* sin almacenamiento local */ }
}
export const getLang = () => current;
export const locale = () => LANGS.find((l) => l.id === current)!.locale;

/** Texto traducido; `{nombre}` se sustituye por vars.nombre. Si falta la traducción se usa el español. */
export function t(key: TKey, vars?: Record<string, string | number>): string {
  let s = DICTS[current][key] ?? es[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Igual que t() pero con una clave construida en tiempo de ejecución (p. ej. `stat.${key}`). */
export const tk = (key: string, vars?: Record<string, string | number>) =>
  key in es ? t(key as TKey, vars) : key;

export const fmt = (n: number) => Math.round(n).toLocaleString(locale());
export const pct = (n: number) =>
  `${n > 0 ? '+' : ''}${n.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

// Fuerza el re-render al cambiar de idioma.
export const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: current, setLang: () => undefined });
export const useLang = () => useContext(LangContext);

// ---------- Nombres de los datos del juego ----------

export interface LangData {
  items: Record<number, string>;
  ingredients: Record<number, string>;
  jobs: Record<number, string>;
  shards: Record<number, string>;
  subs: Record<number, [name: string, text: string[], source?: string]>;
  spells: Record<number, [name: string, text: string[]]>;
}

let names: LangData | null = null;
export const setNames = (d: LangData) => { names = d; };
export const jobName = (id: number) => names?.jobs[id] ?? `#${id}`;
