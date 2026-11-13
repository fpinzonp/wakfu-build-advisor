// Drops de monstruos (tabla Cargo "Monster_drops" de wakfu.wiki.gg) cruzados con los objetos del juego.
// La wiki nombra cada objeto en inglés, con "/Rareza" cuando existe en varias rarezas.

// Rarezas de la wiki por índice de rareza del juego.
const RARITY_NAMES = ['Common', 'Unusual', 'Rare', 'Mythical', 'Legendary', 'Relic', 'Souvenir', 'Epic'];

const norm = (n) => String(n ?? '').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();

/** "Nombre/Rareza" -> { name, rarity }; un sufijo que no es rareza se queda en el nombre. */
function splitItem(item) {
  const i = item.lastIndexOf('/');
  const rarity = i < 0 ? -1 : RARITY_NAMES.indexOf(item.slice(i + 1).trim());
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
    const targets = (byName.get(norm(name)) ?? []).filter((it) => rarity === undefined || it.rarity === rarity);
    if (!targets.length) continue;
    const mob = mobByName.get(norm(r.monster));
    const drop = {
      monster: r.monster, rate,
      ...(mob?.type && { type: mob.type }),
      ...(mob?.minLevel && { minLevel: mob.minLevel, maxLevel: mob.maxLevel ?? mob.minLevel }),
    };
    for (const it of targets) (out[it.id] ??= []).push(drop);
  }
  for (const list of Object.values(out)) list.sort((a, b) => b.rate - a.rate);
  return out;
}
