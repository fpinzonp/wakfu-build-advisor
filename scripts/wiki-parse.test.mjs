import { describe, expect, it } from 'vitest';
import { parseInfobox, parseMob, parseRange, parseSpellCast } from './wiki-parse.mjs';

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
    expect(jabs.lines).toEqual([{ kind: 'damage', min: 3, max: 105, critMin: 4, critMax: 132 }]);
    expect(jabs.stateGains).toEqual([{ state: 3442, levels: 25 }]);
  });
  it('Burning Arrow: zona, alcance modificable y efectos sin interpretar', () => {
    const arrow = parseSpellCast(parseInfobox(ARROW, 'Spell'), { spell: 'Burning Arrow', ap: 2, mp: 0, wp: 0 });
    expect(arrow).toMatchObject({ rangeMin: 2, rangeMax: 5, rangeMod: true, target: 'aoe', perTurn: 3 });
    expect(arrow.lines).toEqual([{ kind: 'damage', min: 2, max: 60, critMin: 2, critMax: 75 }]);
    expect(arrow.partial).toBe(true); // "on summons" no se interpreta
  });
  it('las líneas tras "Effects if Berserk" van a berserkLines', () => {
    const f = { target: 'st', range: '1', effects: '{{gui|fire}} Damage: 1-10\nEffects if Berserk:\n{{gui|fire}} Damage: 2-20', criteffects: '{{gui|fire}} Damage: 2-12\nEffects if Berserk:\n{{gui|fire}} Damage: 3-24' };
    const c = parseSpellCast(f, { spell: 'X', ap: 1, mp: 0, wp: 0 });
    expect(c.lines).toEqual([{ kind: 'damage', min: 1, max: 10, critMin: 2, critMax: 12 }]);
    expect(c.berserkLines).toEqual([{ kind: 'damage', min: 2, max: 20, critMin: 3, critMax: 24 }]);
    expect(c.partial).toBe(false);
  });
  it('formato real de Berserk y de armadura de la wiki', () => {
    const fx = "'''Normal Effects'''\nSwitches places\n{{gui|caster}} {{gui|armor}} 4-18 {{gui|air}} Armor\n\n'''Effects if {{gui|caster}} {{gui|berserk}} {{st|9315}}'''\nCosts {{gui|wp}} 1 extra WP\n{{gui|enemy}} {{gui|air}} Damage: 2-60";
    const c = parseSpellCast({ target: 'st', range: '1', effects: fx, criteffects: fx }, { spell: 'Y', ap: 1, mp: 0, wp: 0 });
    expect(c.lines).toEqual([{ kind: 'armor', min: 4, max: 18, critMin: 4, critMax: 18 }]);
    expect(c.berserkLines).toEqual([{ kind: 'damage', min: 2, max: 60, critMin: 2, critMax: 60 }]);
    expect(c.partial).toBe(true); // "1 extra WP" no se interpreta
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
