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

// Quita plantillas {{...}} (iconos, áreas) y marcado. Con `states`, un estado queda como "state 123";
// si no, como {ST} (marcador para reconocer líneas que son solo un estado).
function plain(line, states = false) {
  let s = line;
  for (let i = 0; i < 5 && s.includes('{{'); i++) {
    s = s.replace(/\{\{[^{}]*\}\}/g, (m) => {
      const id = /^\{\{st\|(\d+)/.exec(m)?.[1];
      return id ? (states ? `state ${id}` : '{ST}') : '';
    });
  }
  return s.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/'''?/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// Línea completa de efecto: "Damage: A-B", "Damage A-B", "Healing: A-B" o "A-B Armor" (tras quitar iconos).
const N = '(\\d[\\d,]*)'; // los números grandes llevan coma: "5-2,398"
const EFFECT = new RegExp(`^(?:(Damage|Heals?|Healing|Armor):?\\s*${N}-${N}|()${N}-${N} Armor)$`, 'i');
// Variante que sustituye a otra: "Damage: A-B instead", con o sin condición delante.
const INSTEAD = /^(?:(.*?):\s*)?(Damage|Heals?|Healing|Armor):?\s*(\d+)-(\d+)\s+instead$/i;
// Anotación de alcance tras el efecto: "Damage: 6-153 (melee)". Depende de la distancia, así que es condicional.
const RANGE_NOTE = /^(.*?)\s*\((melee|distance)\)$/i;
// Cabecera de un bloque condicional: "If ...:", "Otherwise:", "When ...", "Per ...", "For each ..."
const HEADER = /^(?:If|Otherwise|When|Per|For each|At |Each time|In |Cast on)\b|:$/i;

// Cabeceras de estructura: dicen DÓNDE cae el efecto (un área, una línea, el trayecto), no CUÁNDO.
// Como el hechizo tiene un solo objetivo, sus líneas se aplican siempre y no abren un bloque condicional.
// Es una lista cerrada a propósito: cualquier otra cabecera sigue siendo condicional, que es el lado seguro
// (avisa en vez de mostrar un número equivocado).
const STRUCTURAL = new RegExp(
  '^(?:In(?: an? .*?(?:area of effect|line|cross|square|circle|ring|diagonal|cone|cells?))? ?:'
  + '|Along the path ?:|For each enemy affected ?:)$', 'i');
export const isStructuralHeader = (line) => STRUCTURAL.test(line);

// A quién afecta una línea. El daño va al enemigo salvo que el icono diga lanzador (el icono "ally" en un daño
// significa que el área también golpea a aliados, no que el daño sea de aliado). La cura y la armadura usan su
// icono; sin icono heredan el último de su párrafo (`ctx`) y, si no hay, van al objetivo aliado.
function sideOf(raw, kind, ctx) {
  const icon = /\{\{gui\|(enemy|ally|caster)\}\}/.exec(raw)?.[1];
  if (kind === 'damage') return icon === 'caster' ? 'caster' : 'enemy';
  return icon ?? ctx ?? 'ally';
}

const num = (s) => Number(s.replace(/,/g, ''));

function effectOf(line, raw, ctx) {
  const m = EFFECT.exec(line);
  if (!m) return null;
  const kind = KINDS[(m[1] ?? 'armor').toLowerCase()];
  return { kind, side: sideOf(raw, kind, ctx), min: num(m[2] ?? m[5]), max: num(m[3] ?? m[6]) };
}

// Interpreta un bloque de efectos. Lo que cuelga de una cabecera condicional va a `conditional`, nunca a `normal`.
function parseEffectBlock(text) {
  const normal = [];
  const berserk = [];
  const gains = [];
  const conditional = [];
  let unreadEffect = false; // daño, cura o armadura que no se pudo leer
  let secondary = false;    // otros efectos numéricos sin leer
  let inBerserk = false;
  let block = null;
  let ctx = null; // último icono de lado del párrafo
  for (const raw of String(text ?? '').split('\n')) {
    if (!raw.trim()) { block = null; ctx = null; continue; } // la línea en blanco cierra el bloque condicional
    const line = plain(raw);
    const icon = /\{\{gui\|(enemy|ally|caster)\}\}/.exec(raw)?.[1];
    // "Effects if Berserk:" o "Effects if {{caster}} {{berserk}} {{st|id}}": a partir de aquí solo aplica en Berserk.
    if (/^Effects if/i.test(line) && /berserk/i.test(raw)) { inBerserk = true; block = null; continue; }
    const effect = effectOf(line, raw, ctx);
    if (icon) ctx = icon;
    if (effect) {
      (block ? block.lines : inBerserk ? berserk : normal).push(effect);
      continue;
    }
    const noted = RANGE_NOTE.exec(line);
    const notedEffect = noted && effectOf(noted[1], raw, ctx);
    if (notedEffect) {
      const when = block ? `${block.when}, ${noted[2].toLowerCase()}` : noted[2].toLowerCase();
      conditional.push({ when, lines: [notedEffect] });
      continue;
    }
    const instead = INSTEAD.exec(line);
    if (instead) {
      const kind = KINDS[instead[2].toLowerCase()];
      const entry = { kind, side: sideOf(raw, kind, ctx), min: Number(instead[3]), max: Number(instead[4]) };
      if (block) block.lines.push(entry);
      else conditional.push({ when: instead[1] ? plain(raw.slice(0, raw.search(/(Damage|Heal|Armor)/i)), true).replace(/:$/, '').trim() || 'instead' : 'instead', lines: [entry] });
      continue;
    }
    // Un estado con niveles, sin más: "{{caster}} {{st|3442}} (+25 Lvl.)". Con condición no es una ganancia segura.
    if (!block && /^\{ST\} \(\+\d+ Lvl\.?\)$/.test(line)) {
      const gain = /\{\{st\|(\d+)/.exec(raw);
      gains.push({ state: Number(gain[1]), levels: Number(/\(\+(\d+)/.exec(line)[1]) });
      continue;
    }
    if (isStructuralHeader(line)) { block = null; continue; }
    if (HEADER.test(line)) {
      block = { when: plain(raw, true).replace(/\s*:$/, '').trim(), lines: [] };
      conditional.push(block);
      continue;
    }
    if (!block && /\d/.test(line.replace(/\{ST\}/g, ''))) {
      if (/(damage|heal|armor)/i.test(line)) unreadEffect = true; else secondary = true;
    }
  }
  return { normal, berserk, gains, conditional, unreadEffect, secondary };
}

// Empareja cada línea con su crítico (mismo orden y tipo). Si no cuadran, el crítico queda igual al normal.
function withCrit(base, crit) {
  const ok = base.length === crit.length && base.every((l, i) => l.kind === crit[i].kind);
  return { lines: base.map((l, i) => ({ ...l, critMin: ok ? crit[i].min : l.min, critMax: ok ? crit[i].max : l.max })), ok };
}

function conditionalWithCrit(base, crit) {
  let ok = base.length === crit.length;
  const out = base.map((b, i) => {
    const r = withCrit(b.lines, crit[i]?.lines ?? []);
    if (!r.ok) ok = false;
    return { when: b.when, lines: r.lines };
  });
  return { conditional: out, ok };
}

/** Títulos de la wiki donde puede estar la ficha de un hechizo: algunos nombres son también un objeto o varias clases. */
export const spellTitleCandidates = (name, wikiClass) => [name, `${name} (spell)`, `${name} (${wikiClass})`];

/** Primera ficha candidata que sea de la clase del hechizo (los campos guardados por título), o null. */
export function pickSpellPage(pages, row) {
  for (const title of spellTitleCandidates(row.spell, row.class)) {
    if (pages[title] && pages[title].class === row.class) return pages[title];
  }
  return null;
}

/** Ficha de un hechizo: coste de la tabla Cargo y efectos de la página. */
export function parseSpellCast(fields, row) {
  const noCrit = !String(fields.criteffects ?? '').trim();
  const e = parseEffectBlock(fields.effects);
  // Sin bloque de críticos, el crítico vale lo mismo que el golpe normal.
  const c = noCrit ? e : parseEffectBlock(fields.criteffects);
  const normal = withCrit(e.normal, c.normal);
  const berserk = withCrit(e.berserk, c.berserk);
  const cond = conditionalWithCrit(e.conditional, c.conditional);
  const reasons = [];
  if (e.conditional.length || e.unreadEffect || c.unreadEffect) reasons.push('conditional');
  if (e.secondary || c.secondary || !normal.ok || !berserk.ok || !cond.ok) reasons.push('secondary');
  if (noCrit) reasons.push('noCrit');
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
    conditional: cond.conditional,
    stateGains: e.gains,
    reasons,
    partial: reasons.includes('conditional') || reasons.includes('secondary'),
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
