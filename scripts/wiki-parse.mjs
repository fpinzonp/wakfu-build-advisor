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
const EFFECT = new RegExp(`^(?:(Damage|Heals?|Healing|Armor):?\\s*${N}\\s*-\\s*${N}|()${N}\\s*-\\s*${N} Armor)$`, 'i');
// Variante que sustituye a otra: "Damage: A-B instead", con o sin condición delante.
const INSTEAD = /^(?:(.*?):\s*)?(Damage|Heals?|Healing|Armor):?\s*(\d+)-(\d+)\s+instead$/i;
// Anotación de alcance tras el efecto: "Damage: 6-153 (melee)". Depende de la distancia, así que es condicional.
const RANGE_NOTE = /^(.*?)\s*\((melee|distance)\)$/i;
// Coletilla tras el valor que no lo cambia: "Damage: 4-121, penetrates Armor", "Damage: 2-65 and -2 MP"...
// Lista cerrada: lo que cambia el valor ("+5% per MP", "extra") o depende de algo ("on summons", "around the target")
// no se acepta y sigue saliendo como efecto sin leer, que es el lado seguro.
const QUALIFIER = new RegExp('^(.*?)\\s*(?:, penetrates Armor|\\(penetrates Armor\\)|\\((?:in)?direct(?: damage)?\\)'
  + '|around the starting cell|\\(to the targeted cell\\)|\\(except on\\s*\\)|\\(\\d+\\)|in an? .*area of effect|at end of the target\'s turn'
  + '|and (?:applies .*|steals .*|-.*|\\{ST\\}))$', 'i');
// Cabecera de un bloque condicional: "If ...:", "Otherwise:", "When ...", "Per ...", "For each ..."
// "Cast on ..." es cabecera, salvo una frase con coma ("Cast on a fighter, they switch places"): describe un efecto.
const HEADER = /^(?:If|Otherwise|When|Per|For each|At |Each time|In |Cast on)\b|:$/i;
// Cabecera con su efecto en la misma línea: "Cast on : Damage: 3-98" (el icono ya se quitó del texto).
const INLINE_HEADER = /^(.*?)\s*:\s*(.+)$/;
// Frase "Cast on X, ...": efecto descrito en prosa, que no abre bloque y no se calcula.
const CAST_NOTE = /^Cast on\b[^:]*,/i;
// Estado con niveles que se aplica al objetivo, con dos puntos: "{ST} (+50 Lvl.):". Lo que sigue no depende de nada.
const STATE_INTRO = /^\{ST\} \(\+\d+ Lvl\.?\):$/;

// Cabeceras de estructura: dicen DÓNDE cae el efecto (un área, una línea, el trayecto), no CUÁNDO.
// Como el hechizo tiene un solo objetivo, sus líneas se aplican siempre y no abren un bloque condicional.
// Es una lista cerrada a propósito: cualquier otra cabecera sigue siendo condicional, que es el lado seguro
// (avisa en vez de mostrar un número equivocado).
const STRUCTURAL = new RegExp(
  '^(?:In(?: an? .*?(?:area of effect|line|cross|square|circle|ring|diagonal|cone|cells?))? ?:'
  + '|Along the path(?: \\(\\d+\\s*-\\s*cell line\\))? ?:|For each enemy affected ?:|Normal Effects ?:)$', 'i');
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

// Texto de la condición de una cabecera. En "Cast on ..." el icono dice a quién va (enemigo o aliado) y al quitarlo
// del texto se perdería: se añade como palabra si el texto no la trae.
function headerText(text, icon) {
  const when = text.replace(/[\s:]+$/, '').trim();
  if (/^Cast on\b/i.test(when) && icon && icon !== 'caster' && !/\b(?:enem(?:y|ies)|all(?:y|ies))\b/i.test(when)) return `${when} ${icon}`;
  return when;
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
    // Un icono de lado seguido de dos puntos deja la línea en ": Damage: 2-65" al quitar el icono.
    const line = plain(raw).replace(/^:\s*/, '');
    const icon = /\{\{gui\|(enemy|ally|caster)\}\}/.exec(raw)?.[1];
    // "Effects if Berserk:" o "Effects if {{caster}} {{berserk}} {{st|id}}": a partir de aquí solo aplica en Berserk.
    if (/^Effects if/i.test(line) && /berserk/i.test(raw)) { inBerserk = true; block = null; continue; }
    const effect = effectOf(line, raw, ctx);
    if (icon) ctx = icon;
    if (effect) {
      (block ? block.lines : inBerserk ? berserk : normal).push(effect);
      continue;
    }
    const qualified = QUALIFIER.exec(line);
    const qualifiedEffect = qualified && effectOf(qualified[1], raw, ctx);
    if (qualifiedEffect) {
      (block ? block.lines : inBerserk ? berserk : normal).push(qualifiedEffect);
      secondary = true;  // el valor se lee, pero lo que dice la coletilla no se calcula
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
    if (CAST_NOTE.test(line) && !block) { secondary = true; continue; }
    if (STATE_INTRO.test(line)) {
      block = null;
      gains.push({ state: Number(/\{\{st\|(\d+)/.exec(raw)[1]), levels: Number(/\(\+(\d+)/.exec(line)[1]) });
      continue;
    }
    if (isStructuralHeader(line)) { block = null; continue; }
    // Cabecera y efecto en la misma línea: el bloque nace con ese único efecto y se cierra.
    const inline = INLINE_HEADER.exec(line);
    const inlineEffect = inline && HEADER.test(inline[1]) && effectOf(inline[2], raw, ctx);
    if (inlineEffect) {
      conditional.push({ when: headerText(inline[1], icon), lines: [inlineEffect] });
      block = null;
      continue;
    }
    if (HEADER.test(line)) {
      block = { when: headerText(plain(raw, true), icon), lines: [] };
      conditional.push(block);
      continue;
    }
    if (/\d/.test(line.replace(/\{ST\}/g, ''))) {
      if (block) block.unread = true;  // número sin leer dentro de la rama: si se aplica, hay que avisar
      else if (/(damage|heal|armor)/i.test(line)) unreadEffect = true; else secondary = true;
    }
  }
  return { normal, berserk, gains, conditional, unreadEffect, secondary };
}

// El crítico de la wiki ya lleva el ×1,25. Con un máximo pequeño el redondeo mueve mucho la proporción: no se juzga.
const CRIT_FACTOR = 1.25;
const CRIT_RATIO_MIN = 1.15;
const CRIT_RATIO_MAX = 1.35;
const CRIT_CHECK_FROM = 20;

// Crítico de una línea emparejada. Si la proporción es imposible (la wiki trae el de otro hechizo o una errata),
// se usa ×1,25 y se anota en `fixes`.
function checkedCrit(line, crit, fixes) {
  const ratio = crit.max / line.max;
  // Sin bloque de críticos se empareja el efecto consigo mismo (`crit === line`): no hay nada que corregir.
  if (crit === line || line.max < CRIT_CHECK_FROM || (ratio >= CRIT_RATIO_MIN && ratio <= CRIT_RATIO_MAX)) {
    return { critMin: crit.min, critMax: crit.max };
  }
  const fixedMax = Math.round(line.max * CRIT_FACTOR);
  fixes.push({ kind: line.kind, max: line.max, critMax: crit.max, fixedMax });
  return { critMin: Math.round(line.min * CRIT_FACTOR), critMax: fixedMax };
}

// Empareja cada línea con su crítico (mismo orden y tipo). Si no cuadran, la línea lleva `noCrit`: su crítico
// vale lo mismo que el golpe normal, y el motor no le suma maestría crítica.
function withCrit(base, crit, fixes) {
  const ok = base.length === crit.length && base.every((l, i) => l.kind === crit[i].kind);
  if (!ok) return { lines: base.map((l) => ({ ...l, critMin: l.min, critMax: l.max, noCrit: true })), ok };
  return { lines: base.map((l, i) => ({ ...l, ...checkedCrit(l, crit[i], fixes) })), ok };
}

function conditionalWithCrit(base, crit, fixes) {
  let ok = base.length === crit.length;
  const out = base.map((b, i) => {
    const r = withCrit(b.lines, crit[i]?.lines ?? [], fixes);
    if (!r.ok) ok = false;
    return { when: b.when, lines: r.lines, ...(b.unread && { unread: true }) };
  });
  return { conditional: out, ok };
}

// Marcador de zona: "{{gui|area cross|text=Size: 2}}", "{{gui|area cross|Size: 2}}", "{{gui|area circle}} (3)"
// o "2-cell {{gui|area circle}}". El tamaño es el radio; en las formas de anillo, "1-3" es de la casilla 1 a la 3.
const AREA = /(?:(\d+)-cell\s+)?\{\{gui\|area (\w+)(?:\|(?:text=)?([^}]*))?\}\}(?:\s*\((\d+)\))?/i;

/** Zona del hechizo: la primera que nombran sus efectos, sin contar "the area of effect becomes ...". */
export function parseZone(effects) {
  for (const line of String(effects ?? '').split('\n')) {
    if (/becomes/i.test(line)) continue;
    const m = AREA.exec(line);
    if (!m) continue;
    const shape = m[2].toLowerCase();
    const size = /Size:\s*(\d+)(?:\s*-\s*(\d+))?/i.exec(m[3] ?? '');
    const from = Number(size?.[1] ?? m[1] ?? m[4] ?? 1);
    const to = size?.[2] === undefined ? from : Number(size[2]);
    return { shape, min: /ring$/.test(shape) || size?.[2] !== undefined ? from : 0, max: to };
  }
  return undefined;
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

/** Ficha de un hechizo: coste de la tabla Cargo y efectos de la página. Los críticos corregidos se anotan en `critFixes`. */
export function parseSpellCast(fields, row, critFixes = []) {
  const noCrit = !String(fields.criteffects ?? '').trim();
  const e = parseEffectBlock(fields.effects);
  // Sin bloque de críticos, el crítico vale lo mismo que el golpe normal.
  const c = noCrit ? e : parseEffectBlock(fields.criteffects);
  const fixes = [];
  const normal = withCrit(e.normal, c.normal, fixes);
  const berserk = withCrit(e.berserk, c.berserk, fixes);
  const cond = conditionalWithCrit(e.conditional, c.conditional, fixes);
  const { lines } = normal;
  const berserkLines = berserk.lines;
  const { conditional } = cond;
  critFixes.push(...fixes);  // quien construye los datos los lista
  const reasons = [];
  if (e.conditional.length || e.unreadEffect || c.unreadEffect) reasons.push('conditional');
  if (e.secondary || c.secondary || !normal.ok || !berserk.ok || !cond.ok) reasons.push('secondary');
  if (noCrit) reasons.push('noCrit');
  if (fixes.length) reasons.push('critFixed');
  const zone = parseZone(fields.effects);
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
    ...(zone && { zone }),
    lines,
    conditional,
    stateGains: e.gains,
    reasons,
    partial: reasons.includes('conditional') || reasons.includes('secondary'),
  };
  if (berserkLines.length) cast.berserkLines = berserkLines;
  return cast;
}


/** Ficha de un monstruo, o null si la página no trae PV ni resistencias. */
export function parseMob(wikitext) {
  const f = parseInfobox(wikitext, 'Infobox monster');
  if (!f.HP && !f.wr && !f.er && !f.ar && !f.fr) return null;
  const hp = parseRange(f.HP);
  // "minlevel = 65 to 80" trae los dos niveles; un mob de un solo nivel no trae `maxlevel`.
  const [minLevel, topLevel] = parseRange(f.minlevel);
  return {
    name: f.title ?? '',
    family: f.fam ?? '',
    type: f.typ ?? '',
    minLevel, maxLevel: parseRange(f.maxlevel)[1] || topLevel,
    hp, ap: parseRange(f.AP)[0], mp: parseRange(f.MP)[0],
    res: { water: parseRange(f.wr), earth: parseRange(f.er), air: parseRange(f.ar), fire: parseRange(f.fr) },
  };
}
