import { describe, expect, it } from 'vitest';
import { derive, toVector } from './optimizer';
import type { Role } from './game';

const opts = (role: Role, classId: string) => ({ role, level: 200, berserk: false, back: false, classId });
const vec = (stats: Record<string, number>) => toVector(stats, undefined, undefined, ['fire']);

describe('dominio híbrido del Tymador', () => {
  it('Tymador melé cuenta el dominio distancia', () => {
    expect(derive(vec({ mastDist: 100 }), opts('melee', 'tymador')).mastery).toBe(100);
  });
  it('Tymador distancia cuenta el dominio melé', () => {
    expect(derive(vec({ mastMelee: 100 }), opts('dist', 'tymador')).mastery).toBe(100);
  });
  it('Tymador melé mantiene el término de espalda', () => {
    expect(derive(vec({ mastMelee: 100, mastDist: 50, mastBack: 40 }), opts('melee', 'tymador')).mastery).toBe(170);
  });
  it('otras clases no cambian', () => {
    expect(derive(vec({ mastDist: 100 }), opts('melee', 'yopuka')).mastery).toBe(0);
    expect(derive(vec({ mastMelee: 100 }), opts('dist', 'ocra')).mastery).toBe(0);
  });
});
