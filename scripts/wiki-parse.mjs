// Interpretación del wikitext de wakfu.wiki.gg: fichas de hechizos y de monstruos.
// Funciones puras, sin red, para poder probarlas con textos reales.

/** Campos de la primera plantilla `{{template ...}}` como pares campo -> valor. */
export function parseInfobox(wikitext, template) {
  const start = wikitext.search(new RegExp(`\\{\\{\\s*${template}\\s*(\\||\\n)`, 'i'));
  if (start < 0) return {};
  // Cierre de la plantilla contando llaves: los valores contienen {{gui|..}} anidados.
  let depth = 0;
  let end = wikitext.length;
  for (let i = start; i < wikitext.length - 1; i++) {
    const two = wikitext.slice(i, i + 2);
    if (two === '{{') { depth++; i++; } else if (two === '}}') { depth--; i++; if (depth === 0) { end = i - 1; break; } }
  }
  const body = wikitext.slice(start + 2, end);
  // Separador de campos: "|" fuera de llaves y corchetes.
  const parts = [];
  let cur = '';
  let d = 0;
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === '{{' || two === '[[') { d++; cur += two; i++; continue; }
    if (two === '}}' || two === ']]') { d--; cur += two; i++; continue; }
    if (body[i] === '|' && d === 0) { parts.push(cur); cur = ''; continue; }
    cur += body[i];
  }
  parts.push(cur);
  const fields = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq < 0) continue;
    fields[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
  }
  return fields;
}

/** "2350 to 2450", "2-5" o "10" -> [mín, máx]. */
export function parseRange(v) {
  const nums = String(v ?? '').match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (!nums.length) return [0, 0];
  return [nums[0], nums[nums.length - 1]];
}

const KINDS = { damage: 'damage', heals: 'heal', heal: 'heal', healing: 'heal', armor: 'armor' };

// Quita plantillas {{...}} (iconos, áreas) y marcado; deja {ST} donde había un estado.
function plain(line) {
  let s = line;
  for (let i = 0; i < 5 && s.includes('{{'); i++) {
    s = s.replace(/\{\{[^{}]*\}\}/g, (m) => (/^\{\{st\|/.test(m) ? '{ST}' : ''));
  }
  return s.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/'''?/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// Interpreta un bloque de efectos. `partial` marca líneas numéricas que no se modelan.
function parseEffectBlock(text) {
  const normal = [];
  const berserk = [];
  const gains = [];
  let partial = false;
  let inBerserk = false;
  for (const raw of String(text ?? '').split('\n')) {
    if (!raw.trim()) continue;
    const line = plain(raw);
    // "Effects if Berserk:" o "Effects if {{caster}} {{berserk}} {{st|id}}": a partir de aquí solo aplica en Berserk.
    if (/^Effects if/i.test(line) && /berserk/i.test(raw)) { inBerserk = true; continue; }
    // "{{caster}} {{st|3442}} (+25 Lvl.)": suma niveles de un estado, no es daño.
    const gain = /\{\{st\|(\d+)[^}]*\}\}\s*\(\+(\d+)\s*Lvl\.?\)/.exec(raw);
    if (gain && !/^(Damage|Heal|Armor)/i.test(line)) {
      gains.push({ state: Number(gain[1]), levels: Number(gain[2]) });
      continue;
    }
    // Solo cuenta la línea completa "Damage: A-B": cualquier otra condición la deja parcial.
    // La armadura se escribe "4-18 Armor" (tras quitar los iconos).
    const m = /^(Damage|Heals?|Healing|Armor):\s*(\d+)-(\d+)$/i.exec(line) ?? /^()(\d+)-(\d+) Armor$/.exec(line);
    if (m) {
      (inBerserk ? berserk : normal).push({ kind: KINDS[m[1].toLowerCase()] ?? 'armor', min: Number(m[2]), max: Number(m[3]) });
    } else if (/\d/.test(line.replace(/\{ST\}/g, ''))) {
      partial = true;
    }
  }
  return { normal, berserk, gains, partial };
}

// Une las líneas con sus críticos (mismo orden). Si no cuadran, el crítico queda igual al normal.
function withCrit(base, crit) {
  const ok = base.length === crit.length && base.every((l, i) => l.kind === crit[i].kind);
  return { lines: base.map((l, i) => ({ ...l, critMin: ok ? crit[i].min : l.min, critMax: ok ? crit[i].max : l.max })), ok };
}

/** Ficha de un hechizo: coste de la tabla Cargo y efectos de la página. */
export function parseSpellCast(fields, row) {
  const e = parseEffectBlock(fields.effects);
  const c = parseEffectBlock(fields.criteffects);
  const normal = withCrit(e.normal, c.normal);
  const berserk = withCrit(e.berserk, c.berserk);
  const [rangeMin, rangeMax] = parseRange(fields.range);
  const uses = /(\d+)\s+uses?\s+per\s+turn/i.exec(fields.conditions ?? '');
  const cast = {
    key: row.spell,
    ap: Number(row.ap) || 0, mp: Number(row.mp) || 0, wp: Number(row.wp) || 0,
    rangeMin, rangeMax,
    rangeMod: /^y/i.test(fields.mod ?? ''),
    los: /^y/i.test(fields.los ?? ''),
    perTurn: uses ? Number(uses[1]) : null,
    target: /^aoe$/i.test(fields.target ?? '') ? 'aoe' : 'st',
    lines: normal.lines,
    stateGains: e.gains,
    partial: e.partial || c.partial || !normal.ok || !berserk.ok,
  };
  if (berserk.lines.length) cast.berserkLines = berserk.lines;
  return cast;
}

/** Ficha de un monstruo, o null si la página no trae PV ni resistencias. */
export function parseMob(wikitext) {
  const f = parseInfobox(wikitext, 'Infobox monster');
  if (!f.HP && !f.wr && !f.er && !f.ar && !f.fr) return null;
  const hp = parseRange(f.HP);
  return {
    name: f.title ?? '',
    family: f.fam ?? '',
    type: f.typ ?? '',
    minLevel: Number(f.minlevel) || 0, maxLevel: Number(f.maxlevel) || 0,
    hp, ap: parseRange(f.AP)[0], mp: parseRange(f.MP)[0],
    res: { water: parseRange(f.wr), earth: parseRange(f.er), air: parseRange(f.ar), fire: parseRange(f.fr) },
  };
}
