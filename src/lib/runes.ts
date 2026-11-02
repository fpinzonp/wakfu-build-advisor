// Recomendación de runas por engarce: elige, pieza a pieza, la runa que más mejora la build.
import type { BuildSlot, Item, Shard, SocketColor } from './game';
import { evaluateBuild, type BuildRequest, type BuildResult, type BuildSlots } from './optimizer';

// Ranuras con engarces y su nombre en la tabla de bonus doble de las runas
const RUNE_SLOTS: Partial<Record<BuildSlot, string>> = {
  head: 'head', neck: 'neck', chest: 'chest', back: 'back', shoulders: 'shoulders',
  belt: 'belt', legs: 'legs', ring1: 'ring', ring2: 'ring', weapon: 'weapon',
};

export interface SocketPlan {
  shard: Shard;
  color: SocketColor;
  value: number;
  doubled: boolean;
  forced: boolean;   // color impuesto por una sublimación
}

export interface RunePlan {
  sockets: Partial<Record<BuildSlot, SocketPlan[]>>;
  bonus: Record<string, number>;
  before: BuildResult;
  after: BuildResult;
}

/** Nivel máximo de runa que admite un objeto (1-11), según su nivel. */
export const runeLevel = (item: Item, shard: Shard) => shard.req.filter((r) => r <= item.lvl).length || 1;

export const runeValue = (item: Item, slot: BuildSlot, shard: Shard) => {
  const doubled = shard.double.includes(RUNE_SLOTS[slot]!);
  return { value: Math.floor(shard.per * runeLevel(item, shard) * (doubled ? 2 : 1)), doubled };
};

export interface RuneSocket { slot: BuildSlot; item: Item; forced?: SocketColor }

/** Engarces de la build, en orden; `forced` = color impuesto por la sublimación aplicada. */
export function runeSockets(slots: BuildSlots, patterns: Partial<Record<BuildSlot, SocketColor[]>> = {}): RuneSocket[] {
  const sockets: RuneSocket[] = [];
  for (const [slot, key] of Object.entries(RUNE_SLOTS) as [BuildSlot, string][]) {
    const item = slots[slot];
    if (!key || !item?.sockets) continue;
    const pattern = patterns[slot] ?? [];
    for (let i = 0; i < Math.max(item.sockets, pattern.length); i++) sockets.push({ slot, item, forced: pattern[i] });
  }
  return sockets;
}

/** Suma de stats de una lista de runas. */
export function runeBonus(plans: SocketPlan[]): Record<string, number> {
  const b: Record<string, number> = {};
  for (const p of plans) b[p.shard.stat] = (b[p.shard.stat] ?? 0) + p.value;
  return b;
}

/**
 * @param patterns colores obligatorios de los primeros engarces de cada pieza (sublimaciones aplicadas)
 */
export function planRunes(
  slots: BuildSlots, req: BuildRequest, shards: Shard[],
  patterns: Partial<Record<BuildSlot, SocketColor[]>> = {},
): RunePlan {
  const sockets = runeSockets(slots, patterns);

  const choice: (SocketPlan | null)[] = sockets.map(() => null);
  const bonusOf = (skip: number) => {
    const b: Record<string, number> = {};
    choice.forEach((c, i) => { if (c && i !== skip) b[c.shard.stat] = (b[c.shard.stat] ?? 0) + c.value; });
    return b;
  };

  // Dos pasadas: la segunda reajusta cada engarce con el resto ya decidido.
  for (let pass = 0; pass < 2; pass++) {
    sockets.forEach((s, i) => {
      const others = bonusOf(i);
      let best: SocketPlan | null = null;
      let bestScore = -Infinity;
      for (const shard of shards) {
        if (s.forced && shard.color !== s.forced) continue;
        const { value, doubled } = runeValue(s.item, s.slot, shard);
        const extra = { ...others, [shard.stat]: (others[shard.stat] ?? 0) + value };
        const sc = evaluateBuild(slots, req, extra).score;
        if (sc > bestScore) {
          bestScore = sc;
          best = { shard, color: shard.color, value, doubled, forced: !!s.forced };
        }
      }
      choice[i] = best;
    });
  }

  const plan: Partial<Record<BuildSlot, SocketPlan[]>> = {};
  sockets.forEach((s, i) => { if (choice[i]) (plan[s.slot] ??= []).push(choice[i]!); });
  const bonus = bonusOf(-1);
  return { sockets: plan, bonus, before: evaluateBuild(slots, req), after: evaluateBuild(slots, req, bonus) };
}
