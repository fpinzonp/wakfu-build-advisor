// Nombres oficiales de monstruos y familias en es/en/fr, sacados del cliente de Wakfu instalado en este PC
// (contents/i18n/i18n_{lang}.jar). Ankama no los publica en el CDN y la wiki solo los tiene en inglés, así que
// se guardan en data/mob-names.json y build-data los usa desde ahí. Ejecutar con `npm run mob-names`.
import { readFile, writeFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const CATEGORIES = { 7: 'monsters', 38: 'families' };

/** Archivo .properties de Java -> clave -> texto (con escapes \uXXXX resueltos). */
export function parseProperties(text) {
  const out = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimStart();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const value = line.slice(i + 1).trim()
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\(.)/g, '$1');
    out.set(line.slice(0, i).trim(), value);
  }
  return out;
}

/** Cruza los textos por id: nombre inglés -> { es, fr }. Si hay varias traducciones, gana la más frecuente. */
export function buildNames(en, es, fr) {
  const counts = { monsters: new Map(), families: new Map() };
  for (const [key, name] of en) {
    const m = /^content\.(\d+)\.\d+$/.exec(key);
    const kind = m && CATEGORIES[m[1]];
    if (!kind || !name) continue;
    if (!counts[kind].has(name)) counts[kind].set(name, { es: new Map(), fr: new Map() });
    const c = counts[kind].get(name);
    for (const [lang, texts] of [['es', es], ['fr', fr]]) {
      const v = texts.get(key);
      if (v) c[lang].set(v, (c[lang].get(v) ?? 0) + 1);
    }
  }
  const top = (m) => [...m].sort((a, b) => b[1] - a[1])[0]?.[0];
  const result = {};
  for (const [kind, byName] of Object.entries(counts)) {
    result[kind] = {};
    for (const [name, c] of [...byName].sort((a, b) => a[0].localeCompare(b[0]))) {
      const tr = { ...(top(c.es) && { es: top(c.es) }), ...(top(c.fr) && { fr: top(c.fr) }) };
      if (Object.keys(tr).length) result[kind][name] = tr;
    }
  }
  return result;
}

// Aclaraciones de la wiki que no forman parte del nombre ("Srambad (family)", "Nox (boss)"…).
const GENERIC = /^(family|monster|boss)$/i;

/**
 * Nombres de la wiki -> nombre en `lang` según data/mob-names.json. Sin coincidencia exacta se traduce el nombre
 * sin el paréntesis final, que se conserva si es una variante ("Jadarmed (36-50)" -> "Jadarmado (36-50)").
 * Solo se devuelven los que cambian.
 */
export function translateNames(dict, used, lang) {
  const out = {};
  for (const en of used) {
    let tr = dict?.[en]?.[lang];
    if (!tr) {
      const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(en);
      const base = m && dict?.[m[1]]?.[lang];
      if (base) tr = GENERIC.test(m[2]) ? base : `${base} (${m[2]})`;
    }
    if (tr && tr !== en) out[en] = tr;
  }
  return out;
}

/** Lector zip mínimo: devuelve el contenido del archivo `entry` dentro del .jar. */
function readZipEntry(buf, entry) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('no es un zip');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === entry) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      return method === 0 ? data : inflateRawSync(data);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${entry} no está en el zip`);
}

async function main() {
  const dir = process.argv[2] ?? `${process.env.LOCALAPPDATA}/Ankama/Wakfu/contents/i18n`;
  const texts = {};
  for (const lang of ['en', 'es', 'fr']) {
    const jar = await readFile(`${dir}/i18n_${lang}.jar`);
    texts[lang] = parseProperties(readZipEntry(jar, `texts_${lang}.properties`).toString('utf8'));
  }
  const names = buildNames(texts.en, texts.es, texts.fr);
  const out = new URL('../data/mob-names.json', import.meta.url);
  await writeFile(out, JSON.stringify({
    source: 'Cliente de Wakfu (contents/i18n)', extractedAt: new Date().toISOString().slice(0, 10), ...names,
  }, null, 1));
  console.log(`Nombres: ${Object.keys(names.monsters).length} monstruos y ${Object.keys(names.families).length} familias en data/mob-names.json`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
