// Descarga los datos oficiales de Wakfu (CDN de Ankama) y genera public/data/items.json,
// un archivo compacto con solo el equipamiento y sus estadísticas ya interpretadas.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { linkDrops } from './drops.mjs';
import { parseLuaTable } from './lua-table.mjs';
import { parseInfobox, parseMob, parseSpellCast, pickSpellPage, spellTitleCandidates } from './wiki-parse.mjs';

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

// Idiomas de la interfaz. Cada uno recibe public/data/lang/{idioma}.json con los nombres del juego.
const LANGS = ['es', 'en', 'fr'];
const titleIn = (title, lang) => title?.[lang] || title?.en || title?.fr || title?.es;

// Nombres e imágenes de recursos/ingredientes (jobsItems los contiene todos)
const resourceInfo = new Map();
for (const j of jobsItems) {
  resourceInfo.set(j.definition.id, { title: j.title ?? {}, name: titleIn(j.title, 'es'), gfx: j.definition.graphicParameters?.gfxId });
}
for (const i of items) {
  const id = i.definition.item.id;
  if (!resourceInfo.has(id)) {
    resourceInfo.set(id, { title: i.title ?? {}, name: titleIn(i.title, 'es'), gfx: i.definition.item.graphicParameters.gfxId });
  }
}
// La rareza solo se guarda para el equipamiento (p. ej. el objeto base de una mejora).
for (const i of items) {
  const def = i.definition.item;
  if (TYPE_SLOT[def.baseParameters.itemTypeId]) resourceInfo.get(def.id).rarity = def.baseParameters.rarity;
}
const jobTitles = new Map(recipeCategories.map((c) => [c.definition.id, c.title ?? {}]));
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
    job: r.categoryId,
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
    craft = { job: first.categoryId, lvl: first.level };
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
  const spells = await fetchSpells();
  return {
    source: WIKI, license: 'CC BY-SA', fetchedAt: new Date().toISOString(), states, sources,
    spells, conditions: await fetchConditions(),
    spellPages: await fetchSpellPages(spells), mobs: await fetchMobs(), drops: await fetchDrops(),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Petición a la wiki con un reintento; si vuelve a fallar, la descarga entera falla y se conserva la copia anterior.
async function wikiJson(url) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: wikiHeaders });
      if (!res.ok) throw new Error(`${res.status} al pedir ${url.slice(0, 120)}`);
      return await res.json();
    } catch (e) {
      if (attempt >= 1) throw e;
      await sleep(2000);
    }
  }
}

// Wikitext de varias páginas, en lotes de 50 títulos y con pausa entre lotes. Devuelve título pedido -> wikitext
// (las páginas que no existen no aparecen).
async function fetchWikitext(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    if (i) await sleep(400);
    const batch = titles.slice(i, i + 50);
    const params = new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', prop: 'revisions', rvprop: 'content', rvslots: 'main',
      titles: batch.join('|'),
    });
    const res = await wikiJson(`${WIKI}/api.php?${params}`);
    if (!res.query) throw new Error(res.error?.info ?? 'respuesta inesperada de la consulta de páginas');
    // La wiki normaliza los títulos (mayúscula inicial, guiones bajos): se vuelve al título pedido.
    const asked = new Map(batch.map((t) => [t, t]));
    for (const n of res.query.normalized ?? []) if (asked.has(n.from)) asked.set(n.to, n.from);
    for (const p of res.query.pages ?? []) {
      const text = p.revisions?.[0]?.slots?.main?.content;
      const title = asked.get(p.title);
      if (!p.missing && text !== undefined && title !== undefined) out.set(title, text);
    }
  }
  return out;
}

// Ficha {{Spell}} de cada hechizo activo (por nombre inglés). Solo se guardan sus campos.
const SPELL_FIELDS = ['class', 'AP', 'target', 'range', 'los', 'mod', 'effects', 'criteffects', 'conditions'];
async function fetchSpellPages(spells) {
  let pending = spells.filter((s) => s.type !== 'Passive');
  const pages = {}; // título de la wiki -> campos de la ficha
  // Primero el nombre a secas; a los que no tienen ficha de su clase (el título es un objeto, una redirección o
  // una desambiguación) se les prueba "<nombre> (spell)" y "<nombre> (<clase>)".
  for (let i = 0; i < 3 && pending.length; i++) {
    const titles = [...new Set(pending.map((s) => spellTitleCandidates(s.spell, s.class)[i]))];
    if (i) await sleep(400);
    for (const [title, text] of await fetchWikitext(titles)) {
      const f = parseInfobox(text, 'Spell');
      if (!Object.keys(f).length) continue;
      pages[title] = Object.fromEntries(SPELL_FIELDS.filter((k) => f[k] !== undefined).map((k) => [k, f[k]]));
    }
    pending = pending.filter((s) => !pickSpellPage(pages, s));
  }
  return pages;
}

// Monstruos (tabla Cargo "Monsters"): PV y resistencias solo están en la ficha de cada página.
async function fetchMobs() {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const params = new URLSearchParams({
      action: 'cargoquery', format: 'json', limit: '500', offset: String(offset),
      tables: 'Monsters,_pageData', join_on: 'Monsters._pageID=_pageData._pageID',
      fields: 'Monsters.name=name,Monsters.family=family,Monsters.type=type,Monsters.minLevel=minLevel,'
        + 'Monsters.maxLevel=maxLevel,_pageData._pageName=page',
    });
    const res = await wikiJson(`${WIKI}/api.php?${params}`);
    if (!res.cargoquery) throw new Error(res.error?.info ?? 'respuesta inesperada de Monsters');
    rows.push(...res.cargoquery.map((r) => r.title));
    if (res.cargoquery.length < 500) break;
    await sleep(400);
  }
  const texts = await fetchWikitext([...new Set(rows.map((r) => r.page))]);
  // De cada página solo se guarda la ficha {{Infobox monster}} (sin hechizos ni botín).
  return rows.map((r) => ({ ...r, infobox: /\{\{Infobox monster[^{}]*\}\}/i.exec(texts.get(r.page) ?? '')?.[0] ?? '' }));
}

// Drops de monstruos (tabla Cargo "Monster_drops" de la wiki; Ankama no los publica).
async function fetchDrops() {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const params = new URLSearchParams({
      action: 'cargoquery', format: 'json', limit: '500', offset: String(offset),
      tables: 'Monster_drops', fields: 'monster,item,rate',
    });
    const res = await wikiJson(`${WIKI}/api.php?${params}`);
    if (!res.cargoquery) throw new Error(res.error?.info ?? 'respuesta inesperada de Monster_drops');
    rows.push(...res.cargoquery.map((r) => r.title));
    if (res.cargoquery.length < 500) break;
    await sleep(400);
  }
  return rows;
}

// Condiciones para equipar cada objeto (tabla Cargo "Items" de la wiki; Ankama no las publica).
async function fetchConditions() {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const params = new URLSearchParams({
      action: 'cargoquery', format: 'json', limit: '500', offset: String(offset),
      tables: 'Items', fields: 'name,level,type,conditions', where: "conditions__full <> ''",
    });
    const res = await (await fetch(`${WIKI}/api.php?${params}`, { headers: wikiHeaders })).json();
    if (!res.cargoquery) throw new Error(res.error?.info ?? 'respuesta inesperada de Items');
    rows.push(...res.cargoquery.map((r) => r.title));
    if (res.cargoquery.length < 500) break;
  }
  // Solo equipamiento: los planos, la comida o los disfraces comparten a veces el nombre con un objeto.
  const NOT_GEAR = /Recipe|Food|Transformation|Tool|Bag|Sidekick|Costume|Emote|Title|Teleport|Harvest|Quest|Profession|Torch|Aura/;
  return rows.filter((r) => r.conditions && !NOT_GEAR.test(r.type ?? ''))
    .map((r) => ({ name: r.name, level: r.level, conditions: r.conditions }));
}

// Hechizos y pasivas de clase (tabla Cargo "Class_spells" de la wiki), sin los retirados del juego.
async function fetchSpells() {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const params = new URLSearchParams({
      action: 'cargoquery', format: 'json', limit: '500', offset: String(offset),
      tables: 'Class_spells,_pageData', join_on: 'Class_spells._pageID=_pageData._pageID',
      fields: 'Class_spells.class=class,Class_spells.spell=spell,Class_spells.type=type,Class_spells.element=element,'
        + 'Class_spells.level=level,Class_spells.icon=icon,Class_spells.effects=effects,'
        + 'Class_spells.ap=ap,Class_spells.mp=mp,Class_spells.wp=wp,_pageData._categories__full=cats',
    });
    const res = await (await fetch(`${WIKI}/api.php?${params}`, { headers: wikiHeaders })).json();
    if (!res.cargoquery) throw new Error(res.error?.info ?? 'respuesta inesperada de Class_spells');
    rows.push(...res.cargoquery.map((r) => r.title));
    if (res.cargoquery.length < 500) break;
  }
  return rows.filter((r) => !/(^|\|)Removed/.test(r.cats ?? '')).map(({ cats, ...r }) => r);
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
// Copias antiguas sin hechizos: se descargan solo los hechizos y se añaden a la copia.
if (wiki && !wiki.spells) {
  try {
    wiki.spells = await fetchSpells();
    await writeFile(WIKI_CACHE, JSON.stringify(wiki, null, 1));
    console.log(`Wiki: añadidos ${wiki.spells.length} hechizos a la copia local`);
  } catch (e) {
    console.warn(`No se pudieron descargar los hechizos (${e.message}); la baraja irá vacía.`);
  }
}
// Copias antiguas sin costes ni fichas de hechizos y mobs: se completan sin tocar el resto.
if (wiki && (!wiki.spellPages || !wiki.mobs || wiki.spells?.some((s) => s.ap === undefined))) {
  try {
    const spells = await fetchSpells();
    const spellPages = await fetchSpellPages(spells);
    const mobs = await fetchMobs();
    Object.assign(wiki, { spells, spellPages, mobs });
    await writeFile(WIKI_CACHE, JSON.stringify(wiki, null, 1));
    console.log(`Wiki: añadidas ${Object.keys(spellPages).length} fichas de hechizos y ${mobs.length} de mobs a la copia local`);
  } catch (e) {
    console.warn(`No se pudieron descargar las fichas de hechizos y mobs (${e.message}); el simulador irá sin ellas.`);
  }
}
if (wiki && !wiki.conditions) {
  try {
    wiki.conditions = await fetchConditions();
    await writeFile(WIKI_CACHE, JSON.stringify(wiki, null, 1));
    console.log(`Wiki: añadidas las condiciones de ${wiki.conditions.length} objetos a la copia local`);
  } catch (e) {
    console.warn(`No se pudieron descargar las condiciones de los objetos (${e.message}).`);
  }
}
if (wiki && !wiki.drops) {
  try {
    wiki.drops = await fetchDrops();
    await writeFile(WIKI_CACHE, JSON.stringify(wiki, null, 1));
    console.log(`Wiki: añadidos ${wiki.drops.length} drops de monstruos a la copia local`);
  } catch (e) {
    console.warn(`No se pudieron descargar los drops de monstruos (${e.message}); las piezas irán sin drops.`);
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
// Traducción propia al francés (misma estructura que wiki-es.json).
const wikiFr = JSON.parse(await readFile(new URL('../data/wiki-fr.json', import.meta.url), 'utf8'));
const untranslatedFr = new Set();
const toLang = (text, lang) => {
  if (lang === 'en') return text;
  if (lang === 'es') return toEs(text);
  const fr = wikiFr.effects[text];
  if (fr === undefined) untranslatedFr.add(text);
  return fr ?? text;
};
// Nombres oficiales de los estados (Ankama los publica en todos los idiomas; las descripciones no)
const stateTitles = new Map(gameStates.map((st) => [st.definition.id, st.title ?? {}]));

// Convierte las plantillas de la wiki en texto plano para un nivel dado.
function renderEffect(text, level, lang = 'es') {
  let s = String(text);
  for (let guard = 0; guard < 20 && s.includes('{{'); guard++) {
    s = s.replace(/\{\{([^{}]*)\}\}/g, (_, body) => {
      const [name, ...args] = body.split('|');
      const kv = Object.fromEntries(args.filter((a) => a.includes('=')).map((a) => a.split('=').map((x) => x.trim())));
      const pos = args.filter((a) => !a.includes('='));
      switch (name.trim()) {
        case 'se': return String(Math.floor(Number(kv.base ?? 0) + Number(kv.scale ?? 0) * (level - 1)));
        case 'st': return stateTitles.get(Number(pos[0]))?.[lang] ?? wikiStates[pos[0]]?.name ?? '';
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

// Efectos permanentes curados a mano (data/sublimation-stats.json), por nombre inglés sin número romano.
const subStats = JSON.parse(await readFile(new URL('../data/sublimation-stats.json', import.meta.url), 'utf8')).sublimations;
const unusedSubStats = new Set(Object.keys(subStats));
const sublimations = [];
const subNames = Object.fromEntries(LANGS.map((l) => [l, {}]));
for (const raw of items) {
  const def = raw.definition.item;
  if (def.baseParameters.itemTypeId !== SUBLIMATION_TYPE) continue;
  const p = raw.definition.equipEffects[0]?.effect.definition.params ?? [];
  const stateId = p[0];
  const level = p[2] || 1;
  const sp = def.sublimationParameters;
  const st = wikiStates[stateId];
  const nameEn = raw.title?.en ?? '';
  const baseNameEn = nameEn.replace(/\s+(I|II|III|IV)$/, '');
  const baseEn = baseNameEn.toLowerCase();
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
    ...(subStats[baseNameEn] && { stats: subStats[baseNameEn] }),
  });
  unusedSubStats.delete(baseNameEn);
  const sourceEn = wikiSources[baseEn];
  for (const lang of LANGS) {
    const effect = st ? Object.values(st.effects ?? {}).map((e) => renderEffect(toLang(String(e), lang), level, lang)).filter(Boolean) : [];
    const srcText = sourceEn === undefined ? undefined
      : lang === 'en' ? sourceEn : (lang === 'es' ? wikiEs : wikiFr).sources[sourceEn] ?? sourceEn;
    subNames[lang][def.id] = [titleIn(raw.title, lang) ?? nameEn, effect, ...(srcText ? [renderEffect(srcText, 1, lang)] : [])];
  }
}
if (unusedSubStats.size) console.warn(`Aviso: sublimaciones de data/sublimation-stats.json que no existen: ${[...unusedSubStats].join(', ')}`);

// ---------- Hechizos y pasivas (baraja) ----------

// Clase de la wiki -> id de clase de la app ("Common" = pasivas comunes a todas las clases)
const WIKI_CLASS = {
  Feca: 'feca', Osamodas: 'osamodas', Enutrof: 'anutrof', Sram: 'sram', Xelor: 'xelor', Ecaflip: 'zurcarak',
  Eniripsa: 'aniripsa', Iop: 'yopuka', Cra: 'ocra', Sadida: 'sadida', Sacrier: 'sacrogrito', Pandawa: 'pandawa',
  Rogue: 'tymador', Masqueraider: 'zobal', Foggernaut: 'steamer', Eliotrope: 'selotrop', Huppermage: 'hipermago',
  Ouginak: 'uginak',
};
const spellStats = JSON.parse(await readFile(new URL('../data/spell-stats.json', import.meta.url), 'utf8')).passives;

// Id numérico corto y estable (FNV-1a de "Clase|Nombre") para guardar la baraja en el enlace.
const spellId = (key) => {
  let h = 0x811c9dc5;
  for (const ch of key) h = Math.imul(h ^ ch.codePointAt(0), 0x01000193) >>> 0;
  return h;
};

// Texto de la wiki a líneas planas (sin iconos ni marcado).
const spellText = (wikitext) => String(wikitext ?? '')
  .replace(/<span[^>]*>([^<]*)<\/span>/g, '$1')
  .replace(/\[\[File:[^\]|]*\|link=\|(Ally|Enemy|Caster|Target)\]\]/g, '')
  .replace(/\[\[File:[^\]]*\]\]/g, '')
  .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
  .replace(/<[^>]+>/g, '')
  .replace(/'''?/g, '')
  .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);

// Traducción propia de nombres y textos de hechizos (la wiki solo los tiene en inglés).
// Claves: nombre o línea de texto en inglés. Si falta una traducción se deja en inglés.
const spellI18n = {
  en: { names: {}, lines: {} },
  es: JSON.parse(await readFile(new URL('../data/spells-es.json', import.meta.url), 'utf8')),
  fr: JSON.parse(await readFile(new URL('../data/spells-fr.json', import.meta.url), 'utf8')),
};
const spellNames = Object.fromEntries(LANGS.map((l) => [l, {}]));
const missingSpell = { es: new Set(), fr: new Set() };
const trSpell = (lang, kind, text) => {
  if (lang === 'en') return text;
  const tr = spellI18n[lang][kind][text];
  if (tr === undefined) missingSpell[lang].add(text);
  return tr ?? text;
};

const spellsOut = { common: [], classes: {} };
const usedIds = new Map();
const unusedStats = new Set(Object.keys(spellStats));
const castStats = { active: 0, cast: 0, partial: 0, noPage: 0, missing: {}, critFixed: [] };
for (const r of wiki?.spells ?? []) {
  const classId = r.class === 'Common' ? 'common' : WIKI_CLASS[r.class];
  if (!classId) continue;
  const key = `${r.class}|${r.spell}`;
  const id = spellId(key);
  if (usedIds.get(id) === key) continue; // fila repetida en la wiki
  if (usedIds.has(id)) throw new Error(`Id de hechizo repetido: ${key} y ${usedIds.get(id)}`);
  usedIds.set(id, key);
  const passive = r.type === 'Passive';
  const curated = spellStats[key];
  unusedStats.delete(key);
  const { zero, ...stats } = curated ?? {};
  const spell = {
    id,
    name: r.spell,
    el: passive ? 'passive' : (r.element || 'Neutral').toLowerCase(),
    lvl: Number(r.level) || 0,
    icon: Number(/(\d+)/.exec(r.icon ?? '')?.[1] ?? 0),
    text: spellText(r.effects),
    ...(passive && { key: r.spell }),  // nombre inglés estable: `name` se traduce más tarde
    ...(curated && Object.keys(stats).length && { stats }),
    ...(zero?.length && { zero }),
  };
  if (!passive) {
    const page = pickSpellPage(wiki?.spellPages ?? {}, r);
    // Sin ficha propia de su clase ni con los títulos alternativos: no se simula.
    if (page) {
      const critFixes = [];
      spell.cast = parseSpellCast(page, r, critFixes);
      for (const f of critFixes) castStats.critFixed.push(`${r.class} / ${r.spell} (${f.kind}): máx. ${f.max}, crítico ${f.critMax} -> ${f.fixedMax}`);
      castStats.cast++;
      if (spell.cast.partial) castStats.partial++;
    } else {
      castStats.noPage++;
      (castStats.missing[r.class] ??= []).push(r.spell);
    }
    castStats.active++;
  }
  for (const lang of LANGS) {
    spellNames[lang][id] = [trSpell(lang, 'names', spell.name), spell.text.map((l) => trSpell(lang, 'lines', l))];
  }
  if (classId === 'common') spellsOut.common.push(spell);
  else (spellsOut.classes[classId] ??= []).push(spell);
}
for (const list of [spellsOut.common, ...Object.values(spellsOut.classes)]) {
  list.sort((a, b) => a.lvl - b.lvl || a.name.localeCompare(b.name));
}
if (unusedStats.size) console.warn(`Aviso: pasivas de data/spell-stats.json que ya no están en la wiki: ${[...unusedStats].join(', ')}`);

// ---------- Condiciones para equipar ----------
// Se enlazan por nombre inglés (y nivel si hay varias versiones con el mismo nombre).
const COND_STATS = {
  'CH': 'crit', 'Lock': 'tackle', 'Dodge': 'dodge', 'Distance Mastery': 'mastDist', 'Melee Mastery': 'mastMelee',
  'MP Max': 'mp', 'AP Max': 'ap', 'WP Max': 'wp', 'RA': 'range', 'Block': 'block', 'Force of Will': 'will',
  'Initiative': 'init',
};
const unknownConds = new Set();
function parseConditions(text) {
  const out = [];
  const stat = new Map();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    let m;
    if (!line || line === 'Unique' || /^Not to be on a Battlefield$/.test(line)) continue;
    if ((m = line.match(/^(.+?)\s*(<=|>=|<|>)\s*(-?\d+)$/)) && COND_STATS[m[1]]) {
      const key = COND_STATS[m[1]];
      const v = Number(m[3]);
      const c = stat.get(key) ?? { s: key };
      if (m[2] === '>=') c.min = v; else if (m[2] === '>') c.min = v + 1;
      else if (m[2] === '<=') c.max = v; else c.max = v - 1;
      if (!stat.has(key)) { stat.set(key, c); out.push(c); }
    } else if ((m = line.match(/^Has (.+) equipped$/))) {
      out.push({ needs: m[1] });
    } else if ((m = line.match(/^Only usable by (\w+)$/)) && WIKI_CLASS[m[1]]) {
      out.push({ cls: WIKI_CLASS[m[1]] });
    } else if ((m = line.match(/^Troupe Rank >= (\d+)$/))) {
      out.push({ x: 'troupe', v: Number(m[1]) });
    } else if ((m = line.match(/^Citizen points >= (\d+)$/))) {
      out.push({ x: 'citizen', v: Number(m[1]) });
    } else if ((m = line.match(/^Have finished: (.+)$/))) {
      out.push({ x: 'quest', v: m[1] });
    } else {
      unknownConds.add(line);
      out.push({ x: 'raw', v: line });
    }
  }
  return out;
}
{
  const norm = (n) => String(n ?? '').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
  const enTitle = new Map(items.map((i) => [i.definition.item.id, i.title?.en]));
  const byName = new Map();
  for (const r of wiki?.conditions ?? []) {
    const k = norm(r.name);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(r);
  }
  const idByName = new Map(out.map((i) => [norm(enTitle.get(i.id)), i.id]));
  let linked = 0;
  for (const item of out) {
    const rows = byName.get(norm(enTitle.get(item.id)));
    if (!rows) continue;
    const row = rows.find((r) => Number(r.level) === item.lvl) ?? (new Set(rows.map((r) => r.conditions)).size === 1 ? rows[0] : null);
    if (!row) continue;
    const cond = parseConditions(row.conditions).map((c) => {
      if (!('needs' in c)) return c;
      const id = idByName.get(norm(c.needs));
      return id ? { needs: id } : { x: 'raw', v: `Has ${c.needs} equipped` };
    });
    if (cond.length) { item.cond = cond; linked++; }
  }
  console.log(`Condiciones para equipar: ${linked} objetos`);
  if (unknownConds.size) console.warn(`Aviso: condiciones sin interpretar (se muestran tal cual): ${[...unknownConds].join(' | ')}`);
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(new URL('spells.json', OUT_DIR), JSON.stringify({ version, source: WIKI, ...spellsOut }));
console.log(`${usedIds.size} hechizos y pasivas escritos en public/data/spells.json`);
console.log(`Simulador: ${castStats.cast} de ${castStats.active} hechizos activos con ficha (${castStats.partial} parciales, ${castStats.noPage} sin página propia o de otra clase)`);

for (const [cls, names] of Object.entries(castStats.missing)) console.log(`  Sin ficha (${cls}): ${names.join(', ')}`);
console.log(`Críticos corregidos con ×1,25 (${castStats.critFixed.length} líneas):`);
for (const line of castStats.critFixed) console.log(`  ${line}`);

// Monstruos para el simulador: se descartan las fichas sin PV ni resistencias.
{
  const mobs = [];
  let dropped = 0;
  for (const r of wiki?.mobs ?? []) {
    const mob = parseMob(r.infobox);
    if (!mob) { dropped++; continue; }
    // La ficha manda; sin nivel en ella, vale el de la tabla Cargo.
    const minLevel = mob.minLevel || Number(r.minLevel) || 0;
    const maxLevel = mob.maxLevel || Number(r.maxLevel) || minLevel;
    mobs.push({ ...mob, minLevel, maxLevel, name: r.name || mob.name, family: mob.family || r.family || '', type: mob.type || r.type || '' });
  }
  await writeFile(new URL('mobs.json', OUT_DIR), JSON.stringify({ version, mobs }));
  console.log(`Mobs: ${mobs.length} guardados y ${dropped} descartados (sin PV ni resistencias) en public/data/mobs.json`);

  // Drops de las piezas sin receta ni tienda: nombre inglés + rareza contra la tabla de la wiki; tipo y niveles salen de los mobs.
  const enName = new Map(items.map((i) => [i.definition.item.id, i.title?.en]));
  const drops = linkDrops(wiki?.drops ?? [], out.filter((i) => i.src === 'other').map((i) => ({ id: i.id, en: enName.get(i.id), rarity: i.rarity })),
    // Primero las filas en bruto (cubren mobs sin ficha) y luego las fichas interpretadas, que mandan.
    [...(wiki?.mobs ?? []).map((r) => ({ name: r.name, type: r.type, minLevel: Number(r.minLevel) || 0, maxLevel: Number(r.maxLevel) || 0 })), ...mobs]);
  await writeFile(new URL('drops.json', OUT_DIR), JSON.stringify({ version, source: WIKI, drops }));
  console.log(`Drops: ${Object.keys(drops).length} objetos con drops en public/data/drops.json`);
}
await writeFile(new URL('enchant.json', OUT_DIR), JSON.stringify({ version, shards, sublimations }));
console.log(`${shards.length} runas y ${sublimations.length} sublimaciones escritas en public/data/enchant.json`,
  `(${sublimations.filter((s) => s.effect.length).length} con efecto descrito)`);
if (untranslated.size) console.warn(`Aviso: ${untranslated.size} textos de la wiki sin traducir en data/wiki-es.json (se muestran en inglés).`);
await writeFile(new URL('items.json', OUT_DIR), JSON.stringify({ version, items: out }));
await writeFile(new URL('recipes.json', OUT_DIR), JSON.stringify({ version, recipes: recipesOut, ingredients: ingredientsOut }));
// Nombres por idioma
await mkdir(new URL('lang/', OUT_DIR), { recursive: true });
const itemTitles = new Map(items.map((i) => [i.definition.item.id, i.title ?? {}]));
for (const lang of LANGS) {
  const names = {
    items: Object.fromEntries(out.map((i) => [i.id, titleIn(itemTitles.get(i.id), lang) ?? i.name])),
    ingredients: Object.fromEntries(Object.keys(ingredientsOut).map((id) => [id, titleIn(resourceInfo.get(Number(id))?.title, lang) ?? ingredientsOut[id][0]])),
    jobs: Object.fromEntries([...jobTitles].map(([id, title]) => [id, titleIn(title, lang) ?? `#${id}`])),
    shards: Object.fromEntries(shards.map((s) => [s.id, titleIn(itemTitles.get(s.id), lang) ?? s.name])),
    subs: subNames[lang],
    spells: spellNames[lang],
  };
  await writeFile(new URL(`lang/${lang}.json`, OUT_DIR), JSON.stringify(names));
}
console.log(`Nombres en ${LANGS.join(', ')} escritos en public/data/lang/`);
if (untranslatedFr.size) console.warn(`Aviso: ${untranslatedFr.size} textos de la wiki sin traducir en data/wiki-fr.json (se muestran en inglés).`);
for (const lang of ['es', 'fr']) {
  if (missingSpell[lang].size) console.warn(`Aviso: ${missingSpell[lang].size} textos de hechizos sin traducir en data/spells-${lang}.json (se muestran en inglés).`);
}
const bySrc = out.reduce((acc, i) => ({ ...acc, [i.src]: (acc[i.src] ?? 0) + 1 }), {});
console.log(`${out.length} objetos de equipamiento escritos en public/data/items.json`, bySrc);
console.log(`${Object.keys(recipesOut).length} recetas escritas en public/data/recipes.json`);
