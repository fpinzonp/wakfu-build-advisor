import { describe, expect, it } from 'vitest';
import { parseInfobox, parseMob, parseRange, parseSpellCast, pickSpellPage, spellTitleCandidates } from './wiki-parse.mjs';

// Textos reales de wakfu.wiki.gg (action=raw), recortados tras la ficha.
const ARROW = String.raw`{{Spell
| icon = 604
| class = Cra
| ele = fire
| level = ?
| AP = 2
| target = aoe
| range = 2-5
| los = y
| mod = y
| effects = {{gui|fire}} Damage: 2-60 {{gui|area cross|text=Size: 1}}
{{gui|arrow}} {{gui|fire}} Damage: 4-121 on summons {{gui|area cross|text=Size: 1}}

{{st|7757}}: {{gui|fire}} Damage: 6-182 on summons
{{gui|arrow}} Consumes 30 {{st|7792}}
| criteffects = {{gui|fire}} Damage: 2-75 {{gui|area cross|text=Size: 1}}
{{gui|arrow}} {{gui|fire}} Damage: 5-152 on summons {{gui|area cross|text=Size: 1}}

{{st|7757}}: {{gui|fire}} Damage: 8-228 on summons
{{gui|arrow}} Consumes 30 {{st|7792}}
| conditions = 3 uses per turn
| desc = Inflicts Fire damage in a cross-shaped area of effect. The spell inflicts double damage on targeted summons. This spell generates 20 Sharpening and Precision.
}}'''Burning Arrow''' is a [[Fire]] [[spell]] from the [[Cra]] [[class]]. It is unlocked at [[character level|level]] ?.{{Navbox spell|class=Cra}}`;

const JABS = String.raw`{{Spell
| icon = 509
| class = Iop
| ele = air
| level = ?
| AP = 3
| target = st
| range = 1
| los = y
| effects = {{gui|air}} Damage: 3-105

{{gui|caster}} {{st|3442}} (+25 Lvl.)
| criteffects = {{gui|air}} Damage: 4-132

{{gui|caster}} {{st|3442}} (+25 Lvl.)
| conditions = 2 uses per turn
| desc = This spell boosts the lop's Concentration even more. Concentration is a state that allows the lop to regenerate Wakfu points (WP) and inflict more damage.
}}

'''Jabs''' is an [[Air]] [[spell]] from the [[Iop]] [[class]]. It is unlocked at [[character level|level]] ?.

==Version history==
{{Version history}}

{{Navbox spell|class=Iop}}`;

const JELLY = String.raw`{{Infobox monster
|title=Blue Raspberry Jelly
|fam=Jellies
|tier=Solid
|typ=Monster
|minlevel=100
|maxlevel=104
|HP=2350 to 2450
|AP=10
|MP=4
|WP=0
|ini=125 to 133
|fow=10
|lock=157 to 177
|dodge=157 to 177
|block=9
|crit=12
|wm=531 to 555
|wr=287 to 299
|em=0
|er=52 to 64
|am=0
|ar=169 to 181
|fm=0
|fr=169 to 181
|swift=3 MP
}}

==Spells==
{{Spell container|
{{Spell
|name=Blue Raspberry Jella
|icon=4
|ele=Water
|AP=2
|range=1-6
|effects={{gui|water}} Damage: 24
|conditions=1 use per target
2 uses per turn
}}
}}`;

describe('parseRange', () => {
  it('lee rangos con "to", con guion y valores sueltos', () => {
    expect(parseRange('2350 to 2450')).toEqual([2350, 2450]);
    expect(parseRange('2-5')).toEqual([2, 5]);
    expect(parseRange('10')).toEqual([10, 10]);
    expect(parseRange('')).toEqual([0, 0]);
  });
});

describe('parseInfobox', () => {
  it('respeta plantillas anidadas y valores de varias líneas', () => {
    const f = parseInfobox(ARROW, 'Spell');
    expect(f.range).toBe('2-5');
    expect(f.effects).toContain('Consumes 30');
    expect(f.conditions).toBe('3 uses per turn');
  });
  it('en un monstruo no se mezcla con los hechizos anidados', () => {
    expect(parseInfobox(JELLY, 'Infobox monster').HP).toBe('2350 to 2450');
  });
});

describe('parseSpellCast', () => {
  it('Jabs: un golpe, crítico, usos por turno y niveles de estado', () => {
    const jabs = parseSpellCast(parseInfobox(JABS, 'Spell'), { spell: 'Jabs', ap: 3, mp: 0, wp: 0 });
    expect(jabs).toMatchObject({ key: 'Jabs', ap: 3, rangeMin: 1, rangeMax: 1, los: true, perTurn: 2, target: 'st', partial: false });
    expect(jabs.lines).toEqual([{ kind: 'damage', side: 'enemy', min: 3, max: 105, critMin: 4, critMax: 132 }]);
    expect(jabs.stateGains).toEqual([{ state: 3442, levels: 25 }]);
  });
  it('Burning Arrow: zona, alcance modificable y efectos sin interpretar', () => {
    const arrow = parseSpellCast(parseInfobox(ARROW, 'Spell'), { spell: 'Burning Arrow', ap: 2, mp: 0, wp: 0 });
    expect(arrow).toMatchObject({ rangeMin: 2, rangeMax: 5, rangeMod: true, target: 'aoe', perTurn: 3 });
    expect(arrow.lines).toEqual([{ kind: 'damage', side: 'enemy', min: 2, max: 60, critMin: 2, critMax: 75 }]);
    expect(arrow.partial).toBe(true); // "on summons" no se interpreta
  });
  it('las líneas tras "Effects if Berserk" van a berserkLines', () => {
    const f = { target: 'st', range: '1', effects: '{{gui|fire}} Damage: 1-10\nEffects if Berserk:\n{{gui|fire}} Damage: 2-20', criteffects: '{{gui|fire}} Damage: 2-12\nEffects if Berserk:\n{{gui|fire}} Damage: 3-24' };
    const c = parseSpellCast(f, { spell: 'X', ap: 1, mp: 0, wp: 0 });
    expect(c.lines).toEqual([{ kind: 'damage', side: 'enemy', min: 1, max: 10, critMin: 2, critMax: 12 }]);
    expect(c.berserkLines).toEqual([{ kind: 'damage', side: 'enemy', min: 2, max: 20, critMin: 3, critMax: 24 }]);
    expect(c.partial).toBe(false);
  });
  it('formato real de Berserk y de armadura de la wiki', () => {
    const fx = "'''Normal Effects'''\nSwitches places\n{{gui|caster}} {{gui|armor}} 4-18 {{gui|air}} Armor\n\n'''Effects if {{gui|caster}} {{gui|berserk}} {{st|9315}}'''\nCosts {{gui|wp}} 1 extra WP\n{{gui|enemy}} {{gui|air}} Damage: 2-60";
    const c = parseSpellCast({ target: 'st', range: '1', effects: fx, criteffects: fx }, { spell: 'Y', ap: 1, mp: 0, wp: 0 });
    expect(c.lines).toEqual([{ kind: 'armor', side: 'caster', min: 4, max: 18, critMin: 4, critMax: 18 }]);
    expect(c.berserkLines).toEqual([{ kind: 'damage', side: 'enemy', min: 2, max: 60, critMin: 2, critMax: 60 }]);
    expect(c.partial).toBe(true); // "1 extra WP" no se interpreta
  });
});

// Fichas reales de la wiki con efectos condicionales (campos ya separados).
const cast = (f) => parseSpellCast({ target: 'st', range: '1', ...f }, { spell: 'X', ap: 1, mp: 0, wp: 0 });
const GLISTENING = "{{gui|enemy}} {{gui|light}} Damage: 3-98\n{{gui|ally}} {{gui|light}} Healing: 6-53\n\nIf {{gui|caster}} has {{gui|waterrune}}:\n{{gui|arrow}} {{gui|caster}} {{gui|light}} Healing: 6-53\n{{gui|arrow}} {{gui|caster}} consumes {{gui|waterrune}}";
const GLISTENING_CRIT = "{{gui|enemy}} {{gui|light}} Damage: 4-123\n{{gui|ally}} {{gui|light}} Healing: 7-67\n\nIf {{gui|caster}} has {{gui|waterrune}}:\n{{gui|arrow}} {{gui|caster}} {{gui|light}} Healing: 7-67\n{{gui|arrow}} {{gui|caster}} consumes {{gui|waterrune}}";
const ROCKY = "If the Sacrier has no Armor:\n{{gui|arrow}} {{gui|earth}} Damage: 3-91\n{{gui|arrow}} {{gui|caster}} {{gui|armor}} 6-28 {{gui|earth}} Armor\n\nIf the Sacrier has Armor:\n{{gui|arrow}} {{gui|earth}} Damage: 4-121\n{{gui|arrow}} {{gui|caster}} {{gui|armor}} -5% of max HP as Armor";
const THUNDER = "{{gui|fire}} Damage: 3-93\n{{gui|enemy}} {{st|3475}} (Lvl 2-55)\n{{gui|arrow}} When the {{gui|caster}} Iop reaches 100 {{st|3442}}\n{{gui|arrow}} {{gui|fire}} damage: 2-55\n\n{{gui|caster}} {{st|3442}} (+15 Lvl.)";
const PUNCH = "{{gui|fire}} Damage: 4-141\n\nIf this spell kills a fighter, {{gui|caster}} regains 2 {{gui|ap}} and {{st|3442}} (+50 Lvl.)\n\n{{gui|caster}} {{st|3442}} (+20 Lvl.)";
const CUTTING = "{{gui|water}} Damage: 3-105\n{{gui|arrow}} Damage quadrupled on summons\n\nIf the Enutrof kills a fighter with this spell:\n{{gui|arrow}} {{st|8552}} (+1 Lvl.)";

describe('parseSpellCast: efectos condicionales', () => {
  it('Glistening Tears: la cura bajo "If" va a conditional y no se duplica', () => {
    const c = cast({ effects: GLISTENING, criteffects: GLISTENING_CRIT });
    expect(c.lines).toEqual([
      { kind: 'damage', side: 'enemy', min: 3, max: 98, critMin: 4, critMax: 123 },
      { kind: 'heal', side: 'ally', min: 6, max: 53, critMin: 7, critMax: 67 },
    ]);
    expect(c.conditional).toEqual([{ when: 'If has', lines: [{ kind: 'heal', side: 'caster', min: 6, max: 53, critMin: 7, critMax: 67 }] }]);
    expect(c.reasons).toEqual(['conditional']);
    expect(c.partial).toBe(true);
  });
  it('Rocky Foot: dos ramas excluyentes, nada en lines', () => {
    const c = cast({ effects: ROCKY, criteffects: ROCKY });
    expect(c.lines).toEqual([]);
    expect(c.conditional.map((b) => b.when)).toEqual(['If the Sacrier has no Armor', 'If the Sacrier has Armor']);
    expect(c.conditional[0].lines.map((l) => l.kind)).toEqual(['damage', 'armor']);
    expect(c.partial).toBe(true);
  });
  it('Thunderbolt: el golpe de "reaches 100" queda aparte y su rama no se mezcla con los golpes', () => {
    const c = cast({ effects: THUNDER, criteffects: '{{gui|enemy}} {{gui|fire}} Damage: 2-82 {{gui|area hline}}' });
    expect(c.lines).toEqual([{ kind: 'damage', side: 'enemy', min: 3, max: 93, critMin: 2, critMax: 82 }]);
    expect(c.conditional[0].lines).toHaveLength(1);
    expect(c.reasons).toEqual(['conditional', 'secondary']); // la rama condicional no tiene crítico equivalente
  });
  it('una línea "instead" va a conditional con su propia condición', () => {
    const c = cast({ effects: '{{gui|air}} Damage: 3-91\n{{gui|arrow}} {{gui|exalted}} {{st|3303}}: {{gui|earth}} Damage: 4-131 instead' });
    expect(c.lines).toHaveLength(1);
    expect(c.conditional).toEqual([{ when: 'state 3303', lines: [{ kind: 'damage', side: 'enemy', min: 4, max: 131, critMin: 4, critMax: 131 }] }]);
    const d = cast({ effects: 'If the target is on a {{st|3396}}:\n{{gui|arrow}} {{gui|air}} Damage: 7-247 instead' });
    expect(d.lines).toEqual([]);
    expect(d.conditional).toHaveLength(1);
  });
  it('"Damage 4-151" sin dos puntos se lee', () => {
    const c = cast({ effects: '{{gui|caster}} {{st|4840}}: Damage: 10% of max HP\n{{gui|fire}} Damage 4-151 {{gui|area circlering|text=Size: 1 - 1}}', criteffects: '{{gui|fire}} Damage 5-188' });
    expect(c.lines).toEqual([{ kind: 'damage', side: 'enemy', min: 4, max: 151, critMin: 5, critMax: 188 }]);
    expect(c.reasons).toContain('conditional');
  });
});

describe('parseSpellCast: cabeceras de estructura', () => {
  const CLEAVER = "In a cross {{gui|area cross}} area of effect:\n{{gui|arrow}} {{gui|enemy}} {{gui|earth}} Damage: 2-55\n\nPer target hit:\n{{gui|arrow}} {{gui|caster}} {{gui|armor}} 1-20 {{gui|earth}} Armor";
  const dmg = (min, max, critMin, critMax, side = 'enemy') => ({ kind: 'damage', side, min, max, critMin, critMax });
  it('Cleaver: el daño del área va a lines y "Per target hit" sigue condicional', () => {
    const c = cast({ target: 'aoe', effects: CLEAVER, criteffects: CLEAVER.replace('2-55', '2-69') });
    expect(c.lines).toEqual([dmg(2, 55, 2, 69)]);
    expect(c.conditional.map((b) => b.when)).toEqual(['Per target hit']);
    expect(c.conditional[0].lines[0]).toMatchObject({ kind: 'armor', side: 'caster', min: 1, max: 20 });
  });
  it('Flaming Arrow: "In a 5-cell vertical line :" es estructura', () => {
    const f = "In a 5-cell vertical line {{gui|area vline}}:\n{{gui|arrow}} {{gui|fire}} Damage: 4-121\n{{gui|arrow}} {{gui|enemy}} {{st|752}} (Lvl 3)";
    const c = cast({ effects: f, criteffects: f.replace('4-121', '5-152') });
    expect(c.lines).toEqual([dmg(4, 121, 5, 152)]);
    expect(c.conditional).toEqual([]);
  });
  it('Deliverance: "In :" vacío, daño al enemigo y cura al aliado', () => {
    const f = "In {{gui|area square|text=Size: 3}}:\n{{gui|arrow}} {{gui|enemy}} {{gui|water}} Damage: 3-76\n{{gui|arrow}} {{gui|ally}} {{gui|water}} Healing: 6-42";
    const c = cast({ effects: f, criteffects: f });
    expect(c.lines.map((l) => [l.kind, l.side])).toEqual([['damage', 'enemy'], ['heal', 'ally']]);
    expect(c.partial).toBe(false);
  });
  it('Colonnades: el icono "ally" en un daño no cambia el lado y "Per target hit" lo hereda del lanzador', () => {
    const f = "In a square {{gui|area square}} area of effect:\n{{gui|arrow}} {{gui|enemy}}\n{{gui|arrow}} {{gui|ally}} {{gui|earth}} Damage: 4-131\n\nPer target hit:\n{{gui|arrow}} {{gui|caster}} {{gui|earth}} Damage: 4-131\n{{gui|armor}} 1-20 {{gui|earth}} Armor {{gui|area squarering}}";
    const c = cast({ target: 'aoe', effects: f, criteffects: f });
    expect(c.lines).toEqual([dmg(4, 131, 4, 131)]);
    expect(c.conditional[0].lines.map((l) => [l.kind, l.side])).toEqual([['damage', 'caster'], ['armor', 'caster']]);
  });
  it('Watchdog y Capering: "For each enemy affected" y "Along the path" son estructura', () => {
    const w = cast({ effects: "For each enemy affected:\n{{gui|arrow}} {{gui|caster}} 1-467 armor\n{{gui|enemy}} {{gui|earth}} Damage: 4-121 {{gui|area cross}}", criteffects: "For each enemy affected:\n{{gui|arrow}} {{gui|caster}} 1-467 armor\n{{gui|enemy}} {{gui|earth}} Damage: 5-152 {{gui|area cross}}" });
    expect(w.lines.map((l) => [l.kind, l.side])).toEqual([['armor', 'caster'], ['damage', 'enemy']]);
    expect(w.partial).toBe(false);
  });
  it('otras cabeceras ("For each cell away", "Per portal") siguen condicionales', () => {
    const c = cast({ effects: "For each cell away:\n{{gui|arrow}} {{gui|fire}} Damage: 1-10\n\nPer portal:\n{{gui|fire}} Damage: 2-20", criteffects: "For each cell away:\n{{gui|arrow}} {{gui|fire}} Damage: 1-12\n\nPer portal:\n{{gui|fire}} Damage: 2-24" });
    expect(c.lines).toEqual([]);
    expect(c.conditional).toHaveLength(2);
    expect(c.partial).toBe(true);
  });
  it('"(melee)" y "(distance)" van a conditional con el alcance como condición; las comas se leen', () => {
    const f = "Along the path:\n{{gui|arrow}} {{gui|enemy}} {{gui|fire}} Damage: 6-153 (melee)\n{{gui|arrow}} {{gui|ally}} {{gui|armor}} 5-2,398 armor";
    const c = cast({ target: 'aoe', effects: f, criteffects: f.replace('6-153', '8-191').replace('5-2,398', '7-2,997') });
    expect(c.lines).toEqual([{ kind: 'armor', side: 'ally', min: 5, max: 2398, critMin: 7, critMax: 2997 }]);
    expect(c.conditional).toEqual([{ when: 'melee', lines: [dmg(6, 153, 8, 191)] }]);
    expect(c.reasons).toContain('conditional');
  });
});

describe('fichas de hechizos con otro título', () => {
  it('prueba el nombre, "(spell)" y "(clase)" en ese orden', () => {
    expect(spellTitleCandidates('Sword of Iop', 'Iop')).toEqual(['Sword of Iop', 'Sword of Iop (spell)', 'Sword of Iop (Iop)']);
  });
  it('elige la primera ficha de la clase y descarta la de otra clase', () => {
    const row = { spell: 'Sword of Iop', class: 'Iop' };
    const pages = { 'Sword of Iop': { class: 'Cra' }, 'Sword of Iop (spell)': { class: 'Iop', AP: '4' } };
    expect(pickSpellPage(pages, row)).toEqual({ class: 'Iop', AP: '4' });
    expect(pickSpellPage({ 'Sword of Iop': { class: 'Cra' } }, row)).toBeNull();
  });
});

describe('parseSpellCast: estados y críticos', () => {
  it('una ganancia de estado con condición no se registra', () => {
    const c = cast({ effects: PUNCH, criteffects: PUNCH });
    expect(c.stateGains).toEqual([{ state: 3442, levels: 20 }]);
    expect(c.reasons).toContain('conditional');
    const k = cast({ effects: CUTTING, criteffects: CUTTING });
    expect(k.stateGains).toEqual([]);
    expect(k.partial).toBe(true);
  });
  it('sin bloque de críticos: noCrit, crit igual al normal y no es partial por sí solo', () => {
    const c = cast({ effects: '{{gui|fire}} Damage: 3-93' });
    expect(c.reasons).toEqual(['noCrit']);
    expect(c.partial).toBe(false);
    expect(c.lines).toEqual([{ kind: 'damage', side: 'enemy', min: 3, max: 93, critMin: 3, critMax: 93 }]);
  });
  it('críticos que no cuadran con el normal marcan secondary', () => {
    const c = cast({ effects: '{{gui|fire}} Damage: 3-93\n{{gui|water}} Damage: 1-9', criteffects: '{{gui|fire}} Damage: 4-100' });
    expect(c.reasons).toEqual(['secondary']);
    expect(c.partial).toBe(true);
  });
  it('otros efectos numéricos sin leer marcan secondary', () => {
    const c = cast({ effects: '{{gui|fire}} Damage: 3-93\nPushes back 2 cells', criteffects: '{{gui|fire}} Damage: 4-100\nPushes back 2 cells' });
    expect(c.reasons).toEqual(['secondary']);
  });
});

describe('parseMob', () => {
  it('Blue Raspberry Jelly: PV, PA, PM y resistencias', () => {
    expect(parseMob(JELLY)).toMatchObject({
      name: 'Blue Raspberry Jelly', family: 'Jellies', type: 'Monster', minLevel: 100, maxLevel: 104,
      hp: [2350, 2450], ap: 10, mp: 4,
      res: { water: [287, 299], earth: [52, 64], air: [169, 181], fire: [169, 181] },
    });
  });
  it('sin PV ni resistencias no es un mob utilizable', () => {
    expect(parseMob('{{Infobox monster|title=X}}')).toBeNull();
  });
});
