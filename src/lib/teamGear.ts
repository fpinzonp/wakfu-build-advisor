// Sets de todo el equipo a la vez: una build por personaje (mismo nivel, tipo de set propio)
// y la lista conjunta de lo que hace falta para armarlos todos.
import { BUILD_SLOTS, CLASSES, ROLE_DEFAULT_TARGETS, type Drop, type DropData, type Element, type Item, type RecipeData, type Role } from './game';
import { materialsFor, type MaterialList } from './materials';
import type { BuildRequest, BuildSlots } from './optimizer';

/** Tipo de set elegido para un personaje. */
export interface GearChoice { role: Role; elements: Element[] }

/** Ajustes comunes a todo el equipo. */
export interface TeamGearSettings { level: number; craftOnly: boolean }

/** Tipo de set por defecto: el rol que tiene en el equipo y las dos primeras ramas de su clase. */
export function defaultChoice(classId: string, role: Role): GearChoice {
  return { role, elements: CLASSES.find((c) => c.id === classId)!.elements.slice(0, 2) };
}

/** Petición al optimizador para un personaje, con los mismos valores por defecto que la sección Builds. */
export function gearRequest(classId: string, choice: GearChoice, s: TeamGearSettings): BuildRequest {
  const c = CLASSES.find((x) => x.id === classId)!;
  return {
    level: s.level, classId, role: choice.role, elements: choice.elements,
    targets: ROLE_DEFAULT_TARGETS(choice.role, s.level), allowedRarities: [0, 1, 2, 3, 4, 5, 6, 7],
    minLevel: 0, craftOnly: s.craftOnly, berserk: !!c.berserk, crit: !!c.focus?.includes('crit'),
    back: !!c.focus?.includes('back'), excluded: new Set(), locked: {},
  };
}

export interface TeamPiece {
  item: Item;
  count: number;        // unidades necesarias en todo el equipo
  owners: string[];     // clases que la llevan (una vez por unidad)
}

export interface DropPiece extends TeamPiece {
  drops: Drop[];        // de mayor a menor probabilidad
}

export interface TeamShopping {
  craft: TeamPiece[];
  materials: MaterialList | null;   // receta completa: materias primas y cadena de mejoras
  drops: DropPiece[];               // piezas de drop con su probabilidad por monstruo
  others: TeamPiece[];              // tienda u otras vías sin datos de drop
}

/** Agrupa las piezas de todas las builds y calcula la receta al 100 % de las crafteables. */
export function teamShopping(
  builds: { classId: string; slots: BuildSlots }[],
  recipes: RecipeData | null,
  drops: DropData | null,
): TeamShopping {
  const pieces = new Map<number, TeamPiece>();
  for (const b of builds) {
    for (const s of BUILD_SLOTS) {
      const item = b.slots[s.id];
      if (!item) continue;
      const p = pieces.get(item.id);
      if (p) { p.count++; p.owners.push(b.classId); } else pieces.set(item.id, { item, count: 1, owners: [b.classId] });
    }
  }
  const all = [...pieces.values()].sort((a, b) => b.item.lvl - a.item.lvl || a.item.name.localeCompare(b.item.name));
  const craft = all.filter((p) => p.item.src === 'craft');
  const rest = all.filter((p) => p.item.src !== 'craft');
  const dropOf = (p: TeamPiece) => [...(drops?.drops[p.item.id] ?? [])].sort((a, b) => b.rate - a.rate);
  return {
    craft,
    materials: recipes
      ? materialsFor(craft.flatMap((p) => Array<number>(p.count).fill(p.item.id)), recipes, { expand: true, fullChain: true })
      : null,
    drops: rest.filter((p) => dropOf(p).length > 0).map((p) => ({ ...p, drops: dropOf(p) })),
    others: rest.filter((p) => dropOf(p).length === 0),
  };
}

/** Combates de media contra un monstruo para conseguir `count` unidades con una probabilidad de `rate` %. */
export const expectedFights = (rate: number, count = 1) => (rate > 0 ? Math.ceil((100 * count) / rate) : Infinity);
