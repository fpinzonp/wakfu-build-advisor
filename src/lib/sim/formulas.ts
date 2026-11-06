// Fórmulas puras del simulador: daño, cura, armadura, posición y berserker.
// La resistencia en % se calcula fuera, con `resistancePct` de characteristics.ts.

export type Position = 'front' | 'side' | 'back';
export type Facing = 'n' | 'e' | 's' | 'w';
export interface Cell { x: number; y: number }

// Nivel máximo de un hechizo. Falta validarlo con un golpe real del juego.
export const SPELL_MAX_LEVEL = 245;

const POSITION_MULT: Record<Position, number> = { front: 1, side: 1.1, back: 1.25 };

// El epsilon evita que el error de coma flotante reste 1 al redondear hacia abajo.
const floor = (x: number) => Math.floor(x + 1e-9);

/** Distancia Manhattan entre dos casillas. */
export const distance = (a: Cell, b: Cell): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Melé a 1-2 casillas; a 3 o más es distancia. */
export const isMelee = (a: Cell, b: Cell): boolean => distance(a, b) <= 2;

const FACING_VECTOR: Record<Facing, Cell> = {
  n: { x: 0, y: -1 },
  e: { x: 1, y: 0 },
  s: { x: 0, y: 1 },
  w: { x: -1, y: 0 },
};

/**
 * Posición del atacante respecto al objetivo según hacia dónde mira este.
 * Gana el eje con mayor distancia; un empate cuenta como lado.
 */
export function positionOf(attacker: Cell, target: Cell, facing: Facing): Position {
  const dx = attacker.x - target.x;
  const dy = attacker.y - target.y;
  if (Math.abs(dx) === Math.abs(dy)) return 'side';
  const f = FACING_VECTOR[facing];
  // Eje dominante: se proyecta sobre él y se compara con la dirección de la mirada.
  const alongFacing = Math.abs(dx) > Math.abs(dy) ? dx * f.x : dy * f.y;
  const dominantIsFacingAxis = Math.abs(dx) > Math.abs(dy) ? f.x !== 0 : f.y !== 0;
  if (!dominantIsFacingAxis) return 'side';
  return alongFacing > 0 ? 'front' : 'back';
}

/** Berserker: PV estrictamente por debajo del 50 %. */
export const isBerserk = (hpPct: number): boolean => hpPct < 50;

/** Interpola de forma lineal entre el nivel 1 y el máximo, y redondea hacia abajo. */
export function baseAtLevel(min: number, max: number, level: number): number {
  const t = (level - 1) / (SPELL_MAX_LEVEL - 1);
  return floor(min + (max - min) * t);
}

export function damageValue(i: {
  base: number; mastery: number; position: Position; dmgPct: number; resPct: number;
}): number {
  return floor(
    i.base * (1 + i.mastery / 100) * POSITION_MULT[i.position]
      * (1 + i.dmgPct / 100) * (1 - i.resPct / 100),
  );
}

export function healValue(i: {
  base: number; mastery: number; healDone: number; healReceived: number; healRes: number; incurable: number;
}): number {
  return floor(
    i.base * (1 + i.mastery / 100) * (1 + (i.healDone + i.healReceived) / 100)
      * (1 - i.healRes / 100) * (1 - i.incurable / 100),
  );
}

export function armorValue(i: {
  base: number; armorGiven: number; armorReceived: number; crumbly: number; onSelf: boolean;
}): number {
  // El % de armadura dada no se aplica cuando uno se lanza la armadura a sí mismo.
  const given = i.onSelf ? 0 : i.armorGiven;
  return floor(i.base * (1 + (given + i.armorReceived) / 100) * (1 - i.crumbly / 100));
}

/** Suma armadura sin superar el 50 % de los PV máximos. */
export const addArmor = (current: number, gain: number, maxHp: number): number =>
  Math.min(current + gain, floor(maxHp / 2));

/** Resistencia a curas: cada cura suma (cura / PV máximos) × 20, solo la parte entera. */
export const addHealRes = (current: number, healed: number, maxHp: number): number =>
  current + floor((healed / maxHp) * 20);
