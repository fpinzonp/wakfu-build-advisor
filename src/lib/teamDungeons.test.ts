import { describe, expect, it } from 'vitest';
import {
  baseScore, dungeonDiff, dungeonResult, meets, recommendBaseTeam, suggestFix, teamReport,
} from './teamDungeons';
import type { DungeonNeeds, Requirement } from './dungeons/requirements';
import { DUNGEONS, byTier } from './dungeons';
import { isDamageRole } from './game';
import { scoreTeam, type Member } from './teams';

const why = { es: '', en: '', fr: '' };
const req = (r: Omit<Requirement, 'why' | 'required'> & { required?: boolean }): Requirement => ({ required: true, why, ...r });

// Exigencias inyectadas: las mazmorras no listadas no piden nada.
const inject = (map: Record<string, DungeonNeeds>) => (id: string): DungeonNeeds => map[id] ?? { size: 6, reqs: [] };

const M = (classId: string, role: Member['role']): Member => ({ classId, role });

// Equipo sin nadie que reviva (ni Aniripsa, ni Zurcarák, ni Zobal).
const NO_REVIVE: Member[] = [
  M('sram', 'melee'), M('feca', 'tank'), M('ocra', 'dist'), M('yopuka', 'melee'), M('tymador', 'dist'), M('anutrof', 'dist'),
];

describe('meets', () => {
  it('umbral por defecto 2: Aniripsa curandero cumple heal; Sadida de daño no (su cura es de rol heal)', () => {
    const heal = req({ need: 'heal' });
    expect(meets([M('aniripsa', 'heal')], heal)).toBe(true);
    expect(meets([M('sadida', 'dist')], heal)).toBe(false);
    expect(meets([M('sadida', 'heal')], heal)).toBe(true);
  });

  it('respeta un nivel declarado', () => {
    expect(meets([M('sadida', 'heal')], req({ need: 'heal', level: 3 }))).toBe(false);
  });

  it('count 2 de colocación: falla con una clase que coloca, pasa con dos', () => {
    const r = req({ need: 'place', count: 2 });
    expect(meets([M('ocra', 'dist')], r)).toBe(false);
    expect(meets([M('ocra', 'dist'), M('tymador', 'dist')], r)).toBe(true);
  });

  it('count cuenta personajes distintos, no la cobertura del grupo', () => {
    // Feca protege a 3 y Osamodas a 1: el grupo llega a 3, pero solo uno llega a 2 por sí mismo.
    const r = req({ need: 'protect', count: 2 });
    expect(meets([M('feca', 'tank'), M('osamodas', 'dist')], r)).toBe(false);
    expect(meets([M('feca', 'tank'), M('sacrogrito', 'tank')], r)).toBe(true);
  });

  it('place pull: una clase que solo empuja no cumple', () => {
    const r = req({ need: 'place', place: 'pull' });
    expect(meets([M('aniripsa', 'dist')], r)).toBe(false);
    expect(meets([M('sacrogrito', 'melee')], r)).toBe(true);
  });
});

describe('dungeonResult', () => {
  it('sin exigencias y sin roles de daño no está cubierta; con un melee sí', () => {
    const needs = inject({});
    const id = DUNGEONS[0].id;
    const noDamage = [M('feca', 'tank'), M('aniripsa', 'heal'), M('sacrogrito', 'tank')];
    const r = dungeonResult(noDamage, id, needs);
    expect(r.covered).toBe(false);
    expect(r.missing).toHaveLength(1);
    expect(r.missing[0].need).toBe('melee');
    expect(r.missing[0].required).toBe(true);
    expect(r.missing[0].why.es).not.toBe('');
    expect(dungeonResult([...noDamage, M('sram', 'melee')], id, needs).covered).toBe(true);
  });

  it('mazmorra de 3 que exige revivir: subgrupo con el usuario y Zurcarák', () => {
    const id = DUNGEONS[0].id;
    const needs = inject({ [id]: { size: 3, reqs: [req({ need: 'revive' })] } });
    const team = [M('ocra', 'dist'), M('feca', 'tank'), M('sram', 'melee'), M('zurcarak', 'heal'), M('yopuka', 'melee'), M('tymador', 'dist')];
    const r = dungeonResult(team, id, needs);
    expect(r.group).toHaveLength(3);
    expect(r.group[0]).toEqual(team[0]);
    expect(r.group.some((m) => m.classId === 'zurcarak')).toBe(true);
    expect(r.covered).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it('lista las obligatorias que faltan y cuenta las recomendadas cumplidas', () => {
    const id = DUNGEONS[0].id;
    const revive = req({ need: 'revive' });
    const needs = inject({ [id]: { size: 6, reqs: [revive, req({ need: 'debuff', required: false }), req({ need: 'heal', required: false, level: 3 })] } });
    const r = dungeonResult(NO_REVIVE, id, needs);
    expect(r.covered).toBe(false);
    expect(r.missing).toEqual([revive]);
    expect(r.recommendedMet).toBe(1); // Anutrof y Sram dan debuff 2; nadie cura a nivel 3
    expect(r.group).toEqual(NO_REVIVE);
  });
});

describe('teamReport', () => {
  it('suma por franja igual que byTier()', () => {
    const id = DUNGEONS[0].id;
    const needs = inject({ [id]: { size: 6, reqs: [req({ need: 'revive' })] } });
    const rep = teamReport(NO_REVIVE, needs);
    const tiers = byTier();
    expect(rep.tiers.map((t) => t.tier)).toEqual(tiers.map((t) => t.tier));
    expect(rep.tiers.map((t) => t.total)).toEqual(tiers.map((t) => t.dungeons.length));
    expect(rep.tiers.map((t) => t.results.map((r) => r.id))).toEqual(tiers.map((t) => t.dungeons.map((d) => d.id)));
    expect(rep.total).toBe(DUNGEONS.length);
    expect(rep.covered).toBe(DUNGEONS.length - 1);
    expect(rep.tiers.reduce((s, t) => s + t.covered, 0)).toBe(rep.covered);
  });
});

describe('baseScore', () => {
  it('1000 por cubierta + 10 por recomendada + puntuación general', () => {
    const id = DUNGEONS[0].id;
    const needs = inject({ [id]: { size: 6, reqs: [req({ need: 'revive' }), req({ need: 'debuff', required: false })] } });
    const rep = teamReport(NO_REVIVE, needs);
    const rec = rep.tiers.flatMap((t) => t.results).reduce((s, r) => s + r.recommendedMet, 0);
    expect(rec).toBe(1);
    expect(baseScore(NO_REVIVE, needs)).toBeCloseTo(1000 * rep.covered + 10 * rec + scoreTeam(NO_REVIVE));
  });
});

describe('recommendBaseTeam', () => {
  it('6 miembros de clases distintas, el usuario intacto y alguien que hace daño', () => {
    const me = M('aniripsa', 'heal');
    const t = recommendBaseTeam([me], inject({}));
    expect(t).toHaveLength(6);
    expect(new Set(t.map((m) => m.classId)).size).toBe(6);
    expect(t[0]).toEqual(me);
    expect(t.some((m) => isDamageRole(m.role))).toBe(true);
  });

  it('prioriza cubrir mazmorras sobre la puntuación general', () => {
    // Exigir dos personajes que revivan: el equipo debe llevar dos de Aniripsa/Zurcarák/Zobal.
    const id = DUNGEONS[0].id;
    const needs = inject({ [id]: { size: 6, reqs: [req({ need: 'revive', count: 2 })] } });
    const t = recommendBaseTeam([M('sram', 'melee')], needs);
    expect(dungeonResult(t, id, needs).covered).toBe(true);
    expect(baseScore(t, needs)).toBeGreaterThanOrEqual(1000 * DUNGEONS.length);
  });
});

describe('suggestFix', () => {
  const id = DUNGEONS[0].id;
  it('propone un cambio que deja la mazmorra cubierta y no toca al usuario', () => {
    const needs = inject({ [id]: { size: 6, reqs: [req({ need: 'revive' })] } });
    const fix = suggestFix(NO_REVIVE, id, needs)!;
    expect(fix).not.toBeNull();
    expect(fix.index).not.toBe(0);
    expect(NO_REVIVE.some((m) => m.classId === fix.member.classId)).toBe(false);
    const after = NO_REVIVE.map((m, i) => (i === fix.index ? fix.member : m));
    expect(dungeonResult(after, id, needs).covered).toBe(true);
    expect(fix.total).toBe(teamReport(after, needs).covered);
    expect(fix.total).toBe(DUNGEONS.length);
  });

  it('elige el cambio que deja el total más alto', () => {
    // La segunda mazmorra exige daño a distancia y solo Ocra lo da: el cambio no debe perderla.
    const other = DUNGEONS[1].id;
    const team = [M('sram', 'melee'), M('feca', 'tank'), M('ocra', 'dist'), M('yopuka', 'melee'), M('pandawa', 'tank'), M('sacrogrito', 'tank')];
    const needs = inject({
      [id]: { size: 6, reqs: [req({ need: 'revive' })] },
      [other]: { size: 6, reqs: [req({ need: 'ranged' })] },
    });
    const fix = suggestFix(team, id, needs)!;
    const after = team.map((m, i) => (i === fix.index ? fix.member : m));
    expect(dungeonResult(after, other, needs).covered).toBe(true);
    expect(fix.total).toBe(DUNGEONS.length);
  });

  it('exigencia imposible → null', () => {
    const needs = inject({ [id]: { size: 6, reqs: [req({ need: 'revive', count: 7 })] } });
    expect(suggestFix(NO_REVIVE, id, needs)).toBeNull();
  });
});

describe('dungeonDiff', () => {
  it('reporta las mazmorras que cambian de estado', () => {
    const a = DUNGEONS[0].id;
    const b = DUNGEONS[1].id;
    const needs = inject({
      [a]: { size: 6, reqs: [req({ need: 'revive' })] },
      [b]: { size: 6, reqs: [req({ need: 'place', place: 'teleport', level: 3, count: 2 })] },
    });
    // NO_REVIVE: Sram, Ocra y Yopuka teletransportan a nivel 3. Cambiar a Ocra por Zurcarák gana `a`; con Sram y Yopuka `b` se mantiene.
    const after = NO_REVIVE.map((m, i) => (i === 2 ? M('zurcarak', 'heal') : m));
    expect(dungeonDiff(NO_REVIVE, after, needs)).toEqual({ gained: [a], lost: [] });
    // Cambiar además a Yopuka pierde `b`.
    const worse = after.map((m, i) => (i === 3 ? M('pandawa', 'melee') : m));
    expect(dungeonDiff(after, worse, needs)).toEqual({ gained: [], lost: [b] });
  });
});
