// Aplica los nombres de public/data/lang/{idioma}.json sobre los datos ya cargados.
// Se modifican los mismos objetos para que la build abierta (que guarda referencias) cambie de idioma también.
import type { EnchantData, Item, RecipeData } from './game';
import type { LangData } from './i18n';
import type { SpellData } from './spells';

// Último juego de nombres aplicado a cada conjunto de datos (evita repetir el trabajo en cada render).
const applied = new WeakMap<object, LangData>();
const once = (target: object, names: LangData, fn: () => void) => {
  if (applied.get(target) === names) return;
  fn();
  applied.set(target, names);
};

export function localizeItems(items: Item[], names: LangData) {
  once(items, names, () => {
    for (const i of items) i.name = names.items[i.id] ?? i.name;
  });
}

export function localizeRecipes(data: RecipeData, names: LangData) {
  once(data, names, () => {
    for (const [id, ing] of Object.entries(data.ingredients)) ing[0] = names.ingredients[+id] ?? ing[0];
  });
}

export function localizeEnchant(data: EnchantData, names: LangData) {
  once(data, names, () => {
    for (const s of data.shards) s.name = names.shards[s.id] ?? s.name;
    for (const s of data.sublimations) {
      const n = names.subs[s.id];
      if (!n) continue;
      s.name = n[0];
      s.text = n[1].length ? n[1] : undefined;
      s.source = n[2];
    }
  });
}

export function localizeSpells(data: SpellData, names: LangData) {
  once(data, names, () => {
    for (const s of [...data.common, ...Object.values(data.classes).flat()]) {
      const n = names.spells[s.id];
      if (n) { s.name = n[0]; s.text = n[1]; }
    }
  });
}
