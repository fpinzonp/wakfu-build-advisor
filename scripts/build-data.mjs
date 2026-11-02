// Descarga los datos oficiales de Wakfu (CDN de Ankama) y genera public/data/items.json,
// un archivo compacto con solo el equipamiento y sus estadísticas ya interpretadas.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseLuaTable } from './lua-table.mjs';

const CDN = 'https://wakfu.cdn.ankama.com/gamedata';
const OUT_DIR = new URL('../public/data/', import.meta.url);

// itemTypeId -> ranura de la app
const TYPE_SLOT = {
  134: 'head', 120: 'neck', 136: 'chest', 132: 'back', 138: 'shoulders', 133: 'belt',
  119: 'legs', 103: 'ring', 646: 'accessory', 582: 'pet', 849: 'pet', 611: 'mount',
  // armas a una mano
  108: 'weapon1', 110: 'weapon1', 113: 'weapon1', 115: 'weapon1', 219: 'weapon1', 254: 'weapon1', 518: 'weapon1',
  // armas a dos manos (bloquean la segunda mano)
  101: 'weapon2h', 111: 'weapon2h', 114: 'weapon2h', 117: 'weapon2h', 223: 'weapon2h', 253: 'weapon2h', 519: 'weapon2h',
  // segunda mano
  112: 'offhand', 189: 'offhand', 520: 'offhand',
};

// Los objetos que suben de nivel (mascotas, monturas) se evalúan a su nivel máximo.
const SCALING_LEVEL = { 582: 50, 849: 50, 611: 50 };

// actionId -> [stat, signo]
const ACTIONS = {
  20: ['hp', 1], 21: ['hp', -1],
  31: ['ap', 1], 56: ['ap', -1],
  41: ['mp', 1], 57: ['mp', -1],
  191: ['wp', 1], 193: ['wp', 1], 192: ['wp', -1],
  160: ['range', 1], 161: ['range', -1],
  120: ['mastElem', 1], 130: ['mastElem', -1],
  122: ['mastFire', 1], 132: ['mastFire', -1],
  123: ['mastEarth', 1], 124: ['mastWater', 1], 125: ['mastAir', 1],
  1052: ['mastMelee', 1], 1059: ['mastMelee', -1],
  1053: ['mastDist', 1], 1060: ['mastDist', -1],
  1055: ['mastBerserk', 1], 1061: ['mastBerserk', -1],
  149: ['mastCrit', 1], 1056: ['mastCrit', -1],
  180: ['mastBack', 1], 181: ['mastBack', -1],
  26: ['mastHeal', 1],
  150: ['crit', 1], 168: ['crit', -1],
  875: ['block', 1], 876: ['block', -1],
  80: ['resElem', 1], 90: ['resElem', -1], 100: ['resElem', -1],
  82: ['resFire', 1], 97: ['resFire', -1],
  83: ['resWater', 1], 98: ['resWater', -1],
  84: ['resEarth', 1], 96: ['resEarth', -1],
  85: ['resAir', 1],
  988: ['resCrit', 1], 1062: ['resCrit', -1],
  71: ['resBack', 1], 1063: ['resBack', -1],
  171: ['init', 1], 172: ['init', -1],
  173: ['tackle', 1], 174: ['tackle', -1],
  175: ['dodge', 1], 176: ['dodge', -1],
  177: ['will', 1],
  162: ['prospection', 1], 166: ['wisdom', 1],
  183: ['armorGiven', 1], 185: ['armorReceived', 1],
};
// actionId 39/40: "característica pasada en parámetro" (params[4])
const PARAM_CHARACS = { 120: 'armorGiven', 121: 'armorReceived' };

const EXCLUDED_PROPERTIES = new Set([23, 24]); // excluidos de listas / enciclopedia
const SHOP_ITEM = 7;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} al descargar ${url}`);
  return res.json();
}

const { version } = await getJson(`${CDN}/config.json`);
console.log(`Versión de datos: ${version}`);
const get = (name) => getJson(`${CDN}/${version}/${name}.json`);
const [items, recipes, recipeResults, recipeIngredients, recipeCategories, jobsItems, blueprints, gameStates] = await Promise.all([
  get('items'), get('recipes'), get('recipeResults'), get('recipeIngredients'),
  get('recipeCategories'), get('jobsItems'), get('blueprints'), get('states'),
]);

// Nombres e imágenes de recursos/ingredientes (jobsItems los contiene todos)
const resourceInfo = new Map();
for (const j of jobsItems) {
  const t = j.title ?? {};
  resourceInfo.set(j.definition.id, { name: t.es || t.en || t.fr, gfx: j.definition.graphicParameters?.gfxId });
}
for (const i of items) {
  const id = i.definition.item.id;
  if (!resourceInfo.has(id)) {
    const t = i.title ?? {};
    resourceInfo.set(id, { name: t.es || t.en || t.fr, gfx: i.definition.item.graphicParameters.gfxId });
  }
}
// La rareza solo se guarda para el equipamiento (p. ej. el objeto base de una mejora).
for (const i of items) {
  const def = i.definition.item;
  if (TYPE_SLOT[def.baseParameters.itemTypeId]) resourceInfo.get(def.id).rarity = def.baseParameters.rarity;
}
const jobName = new Map(recipeCategories.map((c) => [c.definition.id, c.title?.es || c.title?.en]));
const recipeById = new Map(recipes.map((r) => [r.id, r]));
const planByRecipe = new Map();
for (const b of blueprints) for (const rid of b.recipeId) planByRecipe.set(rid, b.blueprintId);
const ingredientsByRecipe = new Map();
for (const ing of recipeIngredients) {
  if (!ingredientsByRecipe.has(ing.recipeId)) ingredientsByRecipe.set(ing.recipeId, []);
  ingredientsByRecipe.get(ing.recipeId).push(ing);
}
// itemId -> recetas que lo producen
const recipesByItem = new Map();
for (const res of recipeResults) {
  const r = recipeById.get(res.recipeId);
  if (!r) continue;
  if (!recipesByItem.has(res.productedItemId)) recipesByItem.set(res.productedItemId, []);
  recipesByItem.get(res.productedItemId).push({ ...r, yield: res.productedItemQuantity });
}

const out = [];
const recipesOut = {};
const ingredientsOut = {};

const registerIngredient = (id) => {
  const info = resourceInfo.get(id);
  ingredientsOut[id] ??= [info?.name ?? `#${id}`, info?.gfx ?? 0, ...(info?.rarity !== undefined ? [info.rarity] : [])];
};

const mapRecipes = (itemRecipes) => itemRecipes.map((r) => {
  const ing = (ingredientsByRecipe.get(r.id) ?? [])
    .sort((a, b) => a.ingredientOrder - b.ingredientOrder)
    .map(({ itemId, quantity }) => {
      registerIngredient(itemId);
      return [itemId, quantity];
    });
  const plan = planByRecipe.get(r.id);
  if (plan) registerIngredient(plan);
  return {
    job: jobName.get(r.categoryId) ?? '?',
    lvl: r.level,
    ing,
    ...(r.yield > 1 && { yield: r.yield }),
    ...(plan && { plan }),
    ...(r.isUpgrade && { upgradeOf: r.upgradeItemId }),
  };
});
for (const raw of items) {
  const def = raw.definition.item;
  const typeId = def.baseParameters.itemTypeId;
  const slot = TYPE_SLOT[typeId];
  if (!slot) continue;
  if (def.properties.some((p) => EXCLUDED_PROPERTIES.has(p))) continue;

  const effLevel = SCALING_LEVEL[typeId] ?? def.level;
  const stats = {};
  let multiMast = null;
  let multiRes = null;
  for (const { effect } of raw.definition.equipEffects) {
    const { actionId, params } = effect.definition;
    const value = Math.floor((params[0] ?? 0) + (params[1] ?? 0) * effLevel);
    if (actionId === 1068) { multiMast = { v: value, n: params[2] }; continue; }
    if (actionId === 1069) { multiRes = { v: value, n: params[2] }; continue; }
    let key, sign;
    if (actionId === 39 || actionId === 40) {
      key = PARAM_CHARACS[params[4]];
      sign = actionId === 39 ? 1 : -1;
    } else if (ACTIONS[actionId]) {
      [key, sign] = ACTIONS[actionId];
    }
    if (!key || !value) continue;
    stats[key] = (stats[key] ?? 0) + sign * value;
  }

  // Fuente: receta oficial, tienda o "drop / otros" (Ankama no publica drops).
  const itemRecipes = recipesByItem.get(def.id) ?? [];
  const src = itemRecipes.length ? 'craft' : def.properties.includes(SHOP_ITEM) ? 'shop' : 'other';
  let craft;
  if (itemRecipes.length) {
    const first = itemRecipes[0];
    craft = { job: jobName.get(first.categoryId) ?? '?', lvl: first.level };
    recipesOut[def.id] = mapRecipes(itemRecipes);
  }

  const t = raw.title ?? {};
  out.push({
    id: def.id,
    name: t.es || t.en || t.fr || `#${def.id}`,
    lvl: def.level,
    type: typeId,
    slot,
    rarity: def.baseParameters.rarity,
    gfx: def.graphicParameters.gfxId,
    stats,
    ...(def.baseParameters.maximumShardSlotNumber > 0 && { sockets: def.baseParameters.maximumShardSlotNumber }),
    src,
    ...(craft && { craft }),
    ...(multiMast && { multiMast }),
    ...(multiRes && { multiRes }),
  });
}

// Recetas de los ingredientes intermedios (recursivo), para desglosar hasta materias primas.
const pending = Object.values(recipesOut).flatMap((rs) => rs.flatMap((r) => r.ing.map(([id]) => id)));
while (pending.length) {
  const id = pending.pop();
  if (recipesOut[id] || !recipesByItem.has(id)) continue;
  recipesOut[id] = mapRecipes(recipesByItem.get(id));
  for (const r of recipesOut[id]) for (const [ingId] of r.ing) pending.push(ingId);
}

// ---------- Runas y sublimaciones ----------

// Posición de equipamiento del juego -> ranura de la app (para el bonus doble de las runas)
const POSITION_SLOT = { 0: 'head', 3: 'shoulders', 4: 'neck', 5: 'chest', 7: 'ring', 8: 'ring', 10: 'belt', 12: 'legs', 13: 'back', 15: 'weapon' };
const RUNE_TYPE = 811;
const SUBLIMATION_TYPE = 812;

const shards = [];
for (const raw of items) {
  const def = raw.definition.item;
  if (def.baseParameters.itemTypeId !== RUNE_TYPE) continue;
  const effects = raw.definition.equipEffects.map((e) => e.effect.definition);
  const stat = ACTIONS[effects[0]?.actionId]?.[0];
  if (!stat) continue; // dominio objetivo único / zona: no se modelan
  const sp = def.shardsParameters;
  shards.push({
    id: def.id,
    name: raw.title?.es ?? raw.title?.en,
    stat,
    color: sp.color,                       // 1 rojo, 2 verde, 3 azul
    per: effects[1]?.params[1] ?? effects[0].params[0],
    double: [...new Set(sp.doubleBonusPosition.map((p) => POSITION_SLOT[p]).filter(Boolean))],
    req: sp.shardLevelRequirement,        // nivel de objeto necesario para cada nivel de runa
  });
}

// Textos de efectos: wakfu.wiki.gg (CC BY-SA). Se guarda una copia local en data/wiki-cache.json
// para no depender de la wiki: solo se vuelve a descargar con `npm run data -- --refresh-wiki`
// (o si aún no existe la copia). Si la descarga falla, se usa la copia anterior.
const WIKI = 'https://wakfu.wiki.gg';
const WIKI_CACHE = new URL('../data/wiki-cache.json', import.meta.url);
const wikiHeaders = { 'User-Agent': 'WakfuBuildAdvisor/0.1 (herramienta personal)' };

async function readWikiCache() {
  try { return JSON.parse(await readFile(WIKI_CACHE, 'utf-8')); } catch { return null; }
}

async function fetchWiki() {
  const lua = await (await fetch(`${WIKI}/index.php?title=Module:Wakfu_tooltip/states&action=raw`, { headers: wikiHeaders })).text();
  const allStates = parseLuaTable(lua);
  const list = await (await fetch(`${WIKI}/api.php?action=parse&page=List_of_Sublimations&prop=wikitext&format=json`, { headers: wikiHeaders })).json();
  const sources = {};
  for (const row of list.parse.wikitext['*'].split('\n|-\n').slice(1)) {
    const cells = row.split('\n').map((l) => l.replace(/^\|+/, '').trim()).filter((l) => l && !l.startsWith('|}'));
    if (cells.length >= 2) sources[cells[0].toLowerCase()] = cells[cells.length - 1];
  }
  // Solo se guardan los estados de las sublimaciones y los que sus efectos mencionan ({{st|id}}).
  const wanted = new Set(items
    .filter((i) => i.definition.item.baseParameters.itemTypeId === SUBLIMATION_TYPE)
    .map((i) => String(i.definition.equipEffects[0]?.effect.definition.params[0])));
  const states = {};
  const add = (id, depth) => {
    const st = allStates[id];
    if (!st || states[id]) return;
    states[id] = { name: st.name, cumulative: !!st.cumulative, max_level: st.max_level ?? null, effects: Object.values(st.effects ?? {}) };
    if (depth > 0) for (const e of states[id].effects) for (const m of String(e).matchAll(/\{\{st\|(\d+)/g)) add(m[1], depth - 1);
  };
  for (const id of wanted) add(id, 1);
  return { source: WIKI, license: 'CC BY-SA', fetchedAt: new Date().toISOString(), states, sources };
}

let wiki = process.argv.includes('--refresh-wiki') ? null : await readWikiCache();
if (wiki) {
  console.log(`Wiki: usando copia local del ${wiki.fetchedAt.slice(0, 10)} (actualiza con --refresh-wiki)`);
} else {
  try {
    wiki = await fetchWiki();
    await mkdir(new URL('../data/', import.meta.url), { recursive: true });
    await writeFile(WIKI_CACHE, JSON.stringify(wiki, null, 1));
    console.log(`Wiki: descargados ${Object.keys(wiki.states).length} estados y ${Object.keys(wiki.sources).length} fuentes; copia guardada en data/wiki-cache.json`);
  } catch (e) {
    wiki = await readWikiCache();
    console.warn(`No se pudo leer la wiki (${e.message}); ${wiki ? 'se usa la copia local anterior' : 'las sublimaciones irán sin descripción'}.`);
  }
}
const wikiStates = wiki?.states ?? {};
const wikiSources = wiki?.sources ?? {};

// Traducción propia al español de los textos de la wiki (clave: texto original en inglés).
// Si la wiki cambia un texto y aún no está traducido, se muestra en inglés.
const wikiEs = JSON.parse(await readFile(new URL('../data/wiki-es.json', import.meta.url), 'utf8'));
const untranslated = new Set();
const toEs = (text) => {
  const es = wikiEs.effects[text];
  if (es === undefined) untranslated.add(text);
  return es ?? text;
};
// Nombres oficiales de los estados en español (Ankama los publica; las descripciones no)
const stateNameEs = new Map(gameStates.map((st) => [st.definition.id, st.title?.es]));

// Convierte las plantillas de la wiki en texto plano para un nivel dado.
function renderEffect(text, level) {
  let s = String(text);
  for (let guard = 0; guard < 20 && s.includes('{{'); guard++) {
    s = s.replace(/\{\{([^{}]*)\}\}/g, (_, body) => {
      const [name, ...args] = body.split('|');
      const kv = Object.fromEntries(args.filter((a) => a.includes('=')).map((a) => a.split('=').map((x) => x.trim())));
      const pos = args.filter((a) => !a.includes('='));
      switch (name.trim()) {
        case 'se': return String(Math.floor(Number(kv.base ?? 0) + Number(kv.scale ?? 0) * (level - 1)));
        case 'st': return stateNameEs.get(Number(pos[0])) ?? wikiStates[pos[0]]?.name ?? '';
        case 'he': {
          if (kv.hidden && level < Number(kv.hidden)) return '';
          if (kv.hide && level >= Number(kv.hide)) return '';
          return pos[0] ?? '';
        }
        default: return ''; // iconos (gui), áreas, etc.
      }
    });
  }
  return s.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/'''?/g, '').replace(/\s+/g, ' ').trim();
}

const sublimations = [];
for (const raw of items) {
  const def = raw.definition.item;
  if (def.baseParameters.itemTypeId !== SUBLIMATION_TYPE) continue;
  const p = raw.definition.equipEffects[0]?.effect.definition.params ?? [];
  const stateId = p[0];
  const level = p[2] || 1;
  const sp = def.sublimationParameters;
  const st = wikiStates[stateId];
  const nameEn = raw.title?.en ?? '';
  const baseEn = nameEn.replace(/\s+(I|II|III|IV)$/, '').toLowerCase();
  sublimations.push({
    id: def.id,
    name: raw.title?.es ?? nameEn,
    nameEn,
    kind: sp.isEpic ? 'epic' : sp.isRelic ? 'relic' : 'normal',
    pattern: sp.slotColorPattern,
    level,
    maxLevel: st?.max_level ?? null,
    stackable: !!st?.cumulative,
    effect: st ? Object.values(st.effects ?? {}).map((e) => renderEffect(toEs(String(e)), level)).filter(Boolean) : [],
    ...(wikiSources[baseEn] && wikiEs.sources[wikiSources[baseEn]] !== '' && {
      source: renderEffect(wikiEs.sources[wikiSources[baseEn]] ?? wikiSources[baseEn], 1),
    }),
    gfx: def.graphicParameters.gfxId,
  });
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(new URL('enchant.json', OUT_DIR), JSON.stringify({ version, shards, sublimations }));
console.log(`${shards.length} runas y ${sublimations.length} sublimaciones escritas en public/data/enchant.json`,
  `(${sublimations.filter((s) => s.effect.length).length} con efecto descrito)`);
if (untranslated.size) console.warn(`Aviso: ${untranslated.size} textos de la wiki sin traducir en data/wiki-es.json (se muestran en inglés).`);
await writeFile(new URL('items.json', OUT_DIR), JSON.stringify({ version, items: out }));
await writeFile(new URL('recipes.json', OUT_DIR), JSON.stringify({ version, recipes: recipesOut, ingredients: ingredientsOut }));
const bySrc = out.reduce((acc, i) => ({ ...acc, [i.src]: (acc[i.src] ?? 0) + 1 }), {});
console.log(`${out.length} objetos de equipamiento escritos en public/data/items.json`, bySrc);
console.log(`${Object.keys(recipesOut).length} recetas escritas en public/data/recipes.json`);
