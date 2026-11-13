// Drops de monstruos (tabla Cargo "Monster_drops" de wakfu.wiki.gg) cruzados con los objetos del juego.
// La wiki nombra cada objeto en inglés, con "/Rareza" cuando existe en varias rarezas.

// Rarezas de la wiki por índice de rareza del juego (la wiki llama "Common" a la rareza 1; la 0 no la usa).
const RARITY_NAMES = [null, 'Common', 'Rare', 'Mythical', 'Legendary', 'Relic', 'Souvenir', 'Epic'];

const norm = (n) => String(n ?? '').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();

/** "Nombre/Rareza" -> { name, rarity }; un sufijo que no es rareza se queda en el nombre. */
function splitItem(item) {
  const i = item.lastIndexOf('/');
  const rarity = i < 0 ? -1 : RARITY_NAMES.indexOf(item.slice(i + 1).trim() || null);
  return rarity < 0 ? { name: item, rarity: undefined } : { name: item.slice(0, i), rarity };
}

/**
 * Devuelve id de objeto -> drops ({ monster, rate, type?, minLevel?, maxLevel? }), de mayor a menor %.
 * Un objeto sin rareza en la wiki se asigna a todos los ids con ese nombre inglés.
 */
export function linkDrops(rows, items, mobs) {
  const byName = new Map();
  for (const it of items) {
    const k = norm(it.en);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(it);
  }
  const mobByName = new Map(mobs.map((m) => [norm(m.name), m]));
  const out = {};
  for (const r of rows) {
    const rate = Number(r.rate);
    if (r.rate === '' || r.rate == null || !Number.isFinite(rate)) continue;
    const { name, rarity } = splitItem(String(r.item ?? ''));
    // La wiki desambigua a veces con "(amulet)", "(shield)"…: sin coincidencia, se prueba sin ese paréntesis.
    const named = byName.get(norm(name)) ?? byName.get(norm(name.replace(/\s*\([^)]*\)\s*$/, ''))) ?? [];
    const targets = named.filter((it) => rarity === undefined || it.rarity === rarity);
    if (!targets.length) continue;
    const mob = mobByName.get(norm(r.monster));
    const drop = {
      monster: r.monster, rate,
      ...(mob?.type && { type: mob.type }),
      ...(mob?.minLevel && { minLevel: mob.minLevel, maxLevel: mob.maxLevel || mob.minLevel }),
    };
    // La wiki repite a veces la misma fila: solo se muestra una vez.
    for (const it of targets) {
      const list = (out[it.id] ??= []);
      if (!list.some((d) => d.monster === drop.monster && d.rate === drop.rate)) list.push(drop);
    }
  }
  for (const list of Object.values(out)) list.sort((a, b) => b.rate - a.rate);
  return out;
}
