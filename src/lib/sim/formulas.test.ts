import { describe, expect, it } from 'vitest';
import {
  SPELL_MAX_LEVEL, addArmor, addHealRes, armorValue, baseAtLevel, damageValue,
  distance, healValue, inZone, isBerserk, isCasterCentred, isMelee, positionOf,
} from './formulas';

describe('damageValue', () => {
  const hit = { base: 100, mastery: 500, dmgPct: 10, resPct: 20 };
  it('aplica la posición: frente, lado y espalda', () => {
    expect(damageValue({ ...hit, position: 'front' })).toBe(528);
    expect(damageValue({ ...hit, position: 'side' })).toBe(580);
    expect(damageValue({ ...hit, position: 'back' })).toBe(660);
  });
});

describe('healValue', () => {
  it('combina maestría, cura realizada/recibida y resistencia a curas', () => {
    expect(healValue({ base: 100, mastery: 400, healDone: 20, healReceived: 10, healRes: 5, incurable: 0 })).toBe(617);
  });
});

describe('armorValue', () => {
  it('suma la armadura dada solo si no es sobre uno mismo', () => {
    expect(armorValue({ base: 100, armorGiven: 20, armorReceived: 10, crumbly: 0, onSelf: false })).toBe(130);
    expect(armorValue({ base: 100, armorGiven: 20, armorReceived: 10, crumbly: 0, onSelf: true })).toBe(110);
  });
});

describe('addArmor', () => {
  it('limita la armadura al 50 % de los PV máximos', () => {
    expect(addArmor(900, 300, 2000)).toBe(1000);
  });
});

describe('addHealRes', () => {
  it('suma solo la parte entera de (cura / PV máximos) × 20', () => {
    expect(addHealRes(0, 500, 2000)).toBe(5);
  });
});

describe('positionOf', () => {
  const t = { x: 6, y: 5 };
  it('detecta frente, espalda y lado', () => {
    expect(positionOf({ x: 7, y: 5 }, t, 'e')).toBe('front');
    expect(positionOf({ x: 5, y: 5 }, t, 'e')).toBe('back');
    expect(positionOf({ x: 6, y: 4 }, t, 'e')).toBe('side');
  });
  it('un empate entre ejes cuenta como lado', () => {
    expect(positionOf({ x: 7, y: 4 }, t, 'e')).toBe('side');
  });
  it('gana el eje con mayor distancia', () => {
    expect(positionOf({ x: 8, y: 6 }, t, 'e')).toBe('front');
  });
});

describe('distance e isMelee', () => {
  it('usa distancia Manhattan', () => {
    expect(distance({ x: 3, y: 5 }, { x: 5, y: 7 })).toBe(4);
  });
  it('melé a 1-2 casillas, distancia a 3 o más', () => {
    expect(isMelee({ x: 3, y: 5 }, { x: 5, y: 5 })).toBe(true);
    expect(isMelee({ x: 3, y: 5 }, { x: 6, y: 5 })).toBe(false);
  });
});

describe('isBerserk', () => {
  it('es estrictamente por debajo del 50 %', () => {
    expect(isBerserk(49.9)).toBe(true);
    expect(isBerserk(50)).toBe(false);
  });
});

describe('baseAtLevel', () => {
  it('interpola entre el nivel 1 y el máximo', () => {
    expect(baseAtLevel(2, 60, 1)).toBe(2);
    expect(baseAtLevel(2, 60, SPELL_MAX_LEVEL)).toBe(60);
  });
});

describe('inZone', () => {
  const o = { x: 5, y: 5 };
  it('anillo: solo las casillas a esa distancia', () => {
    const ring = { shape: 'ring', min: 1, max: 1 };
    expect(inZone(ring, o, { x: 6, y: 5 })).toBe(true);
    expect(inZone(ring, o, { x: 6, y: 6 })).toBe(false);
    expect(inZone(ring, o, { x: 7, y: 5 })).toBe(false);
  });
  it('círculo: distancia en casillas', () => {
    const circle = { shape: 'circle', min: 0, max: 2 };
    expect(inZone(circle, o, { x: 6, y: 6 })).toBe(true);
    expect(inZone(circle, o, { x: 7, y: 6 })).toBe(false);
  });
  it('cuadrado y anillo cuadrado: las diagonales están dentro', () => {
    expect(inZone({ shape: 'square', min: 0, max: 3 }, o, { x: 8, y: 8 })).toBe(true);
    expect(inZone({ shape: 'square', min: 0, max: 3 }, o, { x: 9, y: 5 })).toBe(false);
    expect(inZone({ shape: 'squarering', min: 1, max: 1 }, o, { x: 6, y: 6 })).toBe(true);
    expect(inZone({ shape: 'squarering', min: 1, max: 1 }, o, { x: 7, y: 6 })).toBe(false);
  });
  it('cruz: solo en línea recta; cruz diagonal: solo en diagonal', () => {
    expect(inZone({ shape: 'cross', min: 0, max: 2 }, o, { x: 7, y: 5 })).toBe(true);
    expect(inZone({ shape: 'cross', min: 0, max: 2 }, o, { x: 6, y: 6 })).toBe(false);
    expect(inZone({ shape: 'crossdiagonal', min: 0, max: 1 }, o, { x: 6, y: 6 })).toBe(true);
    expect(inZone({ shape: 'crossdiagonal', min: 0, max: 1 }, o, { x: 6, y: 5 })).toBe(false);
  });
});

describe('isCasterCentred', () => {
  it('es de zona y con alcance 0', () => {
    expect(isCasterCentred({ target: 'aoe', rangeMax: 0 })).toBe(true);
    expect(isCasterCentred({ target: 'st', rangeMax: 0 })).toBe(false);
    expect(isCasterCentred({ target: 'aoe', rangeMax: 3 })).toBe(false);
  });
});
