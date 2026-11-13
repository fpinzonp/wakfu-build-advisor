import { describe, expect, it } from 'vitest';
import { CLASS_RULES, type SimActor } from '../engine';

const actor = (classId: string, stats: Record<string, number>) => ({ classId, stats }) as SimActor;

describe('Tymador: dominio híbrido', () => {
  it('suma melé y distancia en ambos, siempre', () => {
    const stats = CLASS_RULES.tymador!.statsFor!(actor('tymador', { mastMelee: 100, mastDist: 50, mastBack: 30 }), false);
    expect(stats.mastMelee).toBe(150);
    expect(stats.mastDist).toBe(150);
    expect(stats.mastBack).toBe(30);
  });
});
