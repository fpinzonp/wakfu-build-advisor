// Lista de materiales para craftear un conjunto de objetos.
import type { Recipe, RecipeData } from './game';

export interface CraftStep {
  id: number;
  times: number;   // veces que hay que lanzar la receta
  job: number;
  lvl: number;
  upgrade: boolean; // la receta mejora un objeto base (p. ej. mítico -> legendario)
}

export interface MaterialList {
  materials: { id: number; qty: number }[];   // materias que hay que conseguir
  crafts: CraftStep[];                          // intermedios primero, piezas al final
  plans: number[];
  jobs: { job: number; lvl: number }[];         // nivel máximo requerido por profesión
}

export interface MaterialOptions {
  expand: boolean;     // desglosar ingredientes intermedios hasta materias primas
  fullChain: boolean;  // craftear también el objeto base de cada mejora (raro -> mítico -> legendario)
}

/**
 * Cadena de mejoras de un objeto, de la rareza más baja crafteable a la final.
 * `base` es el objeto del que parte la cadena cuando no tiene receta (se consigue por drop u otras vías).
 */
export function upgradeChain(id: number, data: RecipeData): { steps: { id: number; recipe: Recipe }[]; base?: number } {
  const steps: { id: number; recipe: Recipe }[] = [];
  const seen = new Set<number>();
  let cur: number | undefined = id;
  while (cur !== undefined && !seen.has(cur)) {
    seen.add(cur);
    const recipe: Recipe | undefined = data.recipes[cur]?.[0];
    if (!recipe) return { steps, base: cur };
    steps.unshift({ id: cur, recipe });
    cur = recipe.upgradeOf;
  }
  return { steps };
}

/**
 * Suma los ingredientes de las piezas indicadas. Con `expand`, los ingredientes que tienen
 * receta se desglosan recursivamente; con `fullChain`, también el objeto base de las mejoras.
 */
export function materialsFor(itemIds: number[], data: RecipeData, opts: MaterialOptions): MaterialList {
  const materials = new Map<number, number>();
  const crafts = new Map<number, CraftStep>();
  const order: number[] = [];
  const plans = new Set<number>();
  const jobs = new Map<number, number>();

  const need = (id: number, qty: number, craft: boolean, stack: Set<number>) => {
    const recipe = data.recipes[id]?.[0];
    // Sin receta, sin desglose o con un ciclo de recetas: se trata como materia a conseguir.
    if (!recipe || !craft || stack.has(id)) {
      materials.set(id, (materials.get(id) ?? 0) + qty);
      return;
    }
    const times = Math.ceil(qty / (recipe.yield ?? 1));
    const step = crafts.get(id);
    if (step) step.times += times;
    else crafts.set(id, { id, times, job: recipe.job, lvl: recipe.lvl, upgrade: recipe.upgradeOf !== undefined });
    if (recipe.plan !== undefined) plans.add(recipe.plan);
    jobs.set(recipe.job, Math.max(jobs.get(recipe.job) ?? 0, recipe.lvl));
    const inner = new Set(stack).add(id);
    for (const [ingId, q] of recipe.ing) {
      need(ingId, q * times, ingId === recipe.upgradeOf ? opts.fullChain : opts.expand, inner);
    }
    // Se registra después de sus ingredientes: así los intermedios quedan antes que las piezas.
    if (!order.includes(id)) order.push(id);
  };

  for (const id of itemIds) need(id, 1, true, new Set());

  return {
    materials: [...materials].map(([id, qty]) => ({ id, qty })).sort((a, b) => b.qty - a.qty),
    crafts: order.map((id) => crafts.get(id)!),
    plans: [...plans],
    jobs: [...jobs].map(([job, lvl]) => ({ job, lvl })).sort((a, b) => b.lvl - a.lvl),
  };
}
