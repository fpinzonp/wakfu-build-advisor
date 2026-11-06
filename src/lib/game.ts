// Reglas y constantes del juego usadas por el recomendador.
import { t, tk } from './i18n';
import type { Cond } from './conditions';

// Añade una etiqueta traducida que se resuelve al leerla (sigue el idioma actual).
const L = <T extends object>(key: string, o: T) =>
  Object.defineProperty(o, 'label', { get: () => tk(key), enumerable: true }) as T & { label: string };

export type Element = 'fire' | 'water' | 'earth' | 'air';
export type Role = 'tank' | 'heal' | 'dist' | 'melee';
export type ItemSlot =
  | 'head' | 'neck' | 'chest' | 'back' | 'shoulders' | 'belt' | 'legs' | 'ring'
  | 'accessory' | 'pet' | 'mount' | 'weapon1' | 'weapon2h' | 'offhand';

export interface Item {
  id: number;
  name: string;
  lvl: number;
  type: number;
  slot: ItemSlot;
  rarity: number;
  gfx: number;
  stats: Record<string, number>;
  src: ItemSource;
  craft?: { job: number; lvl: number };
  multiMast?: { v: number; n: number };
  multiRes?: { v: number; n: number };
  sockets?: number;   // engarces máximos para runas
  cond?: Cond[];      // condiciones para equiparlo (wakfu.wiki.gg)
}

// ---------- Runas y sublimaciones ----------

export type SocketColor = 1 | 2 | 3;
export const SOCKET_COLORS: Record<SocketColor, { label: string; color: string }> = {
  1: L('socket.1', { color: '#e0524a' }),
  2: L('socket.2', { color: '#5cc25a' }),
  3: L('socket.3', { color: '#4a90e0' }),
};

export interface Shard {
  id: number;
  name: string;
  stat: string;
  color: SocketColor;
  per: number;          // valor por nivel de runa
  double: string[];     // ranuras (head, ring, weapon…) donde el bonus se duplica
  req: number[];        // nivel de objeto necesario para cada nivel de runa
}

export interface Sublimation {
  id: number;
  name: string;
  nameEn: string;
  kind: 'normal' | 'epic' | 'relic';
  pattern: SocketColor[];
  level: number;
  maxLevel: number | null;
  stackable: boolean;
  effect: string[];     // texto de wakfu.wiki.gg en español (para puntuar por palabras clave)
  text?: string[];      // texto en el idioma de la interfaz
  source?: string;
  gfx: number;
  stats?: SubStats;     // efectos permanentes curados a mano (data/sublimation-stats.json)
}

/** Número fijo, [base, escala] por nivel de sublimación, o {lvl}: % del nivel del personaje. */
export type SubValue = number | [base: number, scale: number] | { lvl: number | [base: number, scale: number] };
export type SubStats = { if?: { s: string; min?: number; max?: number }; zero?: string[] } & Record<string, unknown>;

export interface EnchantData { version: string; shards: Shard[]; sublimations: Sublimation[] }

export type ItemSource = 'craft' | 'shop' | 'other';
export const SOURCE_LABELS: Record<ItemSource, string> = {
  get craft() { return t('source.craft'); },
  get shop() { return t('source.shop'); },
  get other() { return t('source.other'); },
};

export interface Recipe {
  job: number;          // id de oficio (nombre en public/data/lang)
  lvl: number;
  ing: [id: number, qty: number][];
  yield?: number;       // unidades producidas por receta (1 si no se indica)
  plan?: number;        // id del plano necesario
  upgradeOf?: number;   // id del objeto base si es una mejora
}
export interface RecipeData {
  version: string;
  recipes: Record<number, Recipe[]>;
  ingredients: Record<number, [name: string, gfx: number, rarity?: number]>;
}

// Ranuras que no se filtran con "solo crafteables" (casi nunca se craftean)
// Mascota y montura siempre se colocan: no les aplican los filtros de nivel mínimo, rareza ni fabricación.
export const ALWAYS_EQUIPPED_SLOTS: ItemSlot[] = ['pet', 'mount'];

// Franjas de nivel del juego: 1-20, 21-35 y luego de 15 en 15 hasta 245.
export const LEVEL_BANDS = [
  { min: 1, max: 20 },
  ...Array.from({ length: 15 }, (_, i) => ({ min: 21 + i * 15, max: 35 + i * 15 })),
];
export const bandOf = (level: number) => LEVEL_BANDS.find((b) => level <= b.max) ?? LEVEL_BANDS[LEVEL_BANDS.length - 1];

export const ELEMENTS: { id: Element; label: string; color: string }[] = [
  L('el.fire', { id: 'fire', color: '#e8643a' }),
  L('el.water', { id: 'water', color: '#3a9be8' }),
  L('el.earth', { id: 'earth', color: '#8fb33a' }),
  L('el.air', { id: 'air', color: '#b48be8' }),
];

export const ROLES: { id: Role; label: string; hint: string }[] = [
  { id: 'tank', get label() { return tk('role.tank'); }, get hint() { return tk('role.tank.hint'); } },
  { id: 'heal', get label() { return tk('role.heal'); }, get hint() { return tk('role.heal.hint'); } },
  { id: 'dist', get label() { return tk('role.dist'); }, get hint() { return tk('role.dist.hint'); } },
  { id: 'melee', get label() { return tk('role.melee'); }, get hint() { return tk('role.melee.hint'); } },
];

// Ramas elementales habituales de cada clase (editables en la interfaz).
// `focus`: especialidades de daño que conviene priorizar por defecto en esa clase.
export const CLASSES: {
  id: string; label: string; elements: Element[]; roles: Role[]; berserk?: boolean; focus?: ('crit' | 'back')[];
}[] = [
  L('class.feca', { id: 'feca', elements: ['fire', 'water', 'earth'], roles: ['tank', 'dist'] }),
  L('class.osamodas', { id: 'osamodas', elements: ['fire', 'earth', 'air'], roles: ['dist', 'heal'] }),
  L('class.anutrof', { id: 'anutrof', elements: ['fire', 'water', 'earth'], roles: ['dist'] }),
  L('class.sram', { id: 'sram', elements: ['fire', 'water', 'air'], roles: ['melee'], focus: ['crit', 'back'] }),
  L('class.xelor', { id: 'xelor', elements: ['fire', 'water', 'air'], roles: ['dist'] }),
  L('class.zurcarak', { id: 'zurcarak', elements: ['fire', 'water', 'earth'], roles: ['melee', 'heal'] }),
  L('class.aniripsa', { id: 'aniripsa', elements: ['fire', 'water', 'air'], roles: ['heal', 'dist'] }),
  L('class.yopuka', { id: 'yopuka', elements: ['fire', 'earth', 'air'], roles: ['melee'] }),
  L('class.ocra', { id: 'ocra', elements: ['fire', 'earth', 'air'], roles: ['dist'], focus: ['crit', 'back'] }),
  L('class.sadida', { id: 'sadida', elements: ['water', 'earth', 'air'], roles: ['dist', 'heal'] }),
  L('class.sacrogrito', { id: 'sacrogrito', elements: ['fire', 'earth', 'air'], roles: ['melee', 'tank'], berserk: true }),
  L('class.pandawa', { id: 'pandawa', elements: ['fire', 'water', 'earth'], roles: ['tank', 'melee'] }),
  L('class.tymador', { id: 'tymador', elements: ['fire', 'water', 'earth'], roles: ['melee', 'dist'] }),
  L('class.zobal', { id: 'zobal', elements: ['fire', 'water', 'air'], roles: ['melee', 'tank'] }),
  L('class.steamer', { id: 'steamer', elements: ['fire', 'water', 'earth'], roles: ['dist', 'heal'] }),
  L('class.selotrop', { id: 'selotrop', elements: ['fire', 'water', 'air'], roles: ['dist', 'melee'] }),
  L('class.hipermago', { id: 'hipermago', elements: ['fire', 'water', 'earth', 'air'], roles: ['dist'] }),
  L('class.uginak', { id: 'uginak', elements: ['fire', 'water', 'earth'], roles: ['melee', 'tank'] }),
];

export const RARITIES: Record<number, { label: string; color: string }> = {
  0: L('rarity.0', { color: '#9a9a9a' }),
  1: L('rarity.1', { color: '#d8d8d8' }),
  2: L('rarity.2', { color: '#4fc35a' }),
  3: L('rarity.3', { color: '#f08a2b' }),
  4: L('rarity.4', { color: '#f5d33b' }),
  5: L('rarity.5', { color: '#c85ce0' }),
  6: L('rarity.6', { color: '#5ec8e6' }),
  7: L('rarity.7', { color: '#e0458f' }),
};
export const RELIC = 5;
export const EPIC = 7;

export type BuildSlot =
  | 'head' | 'neck' | 'chest' | 'back' | 'shoulders' | 'belt' | 'legs'
  | 'ring1' | 'ring2' | 'weapon' | 'offhand' | 'accessory' | 'pet' | 'mount';

export const BUILD_SLOTS: { id: BuildSlot; label: string; accepts: ItemSlot[] }[] = [
  L('slot.head', { id: 'head', accepts: ['head'] }),
  L('slot.neck', { id: 'neck', accepts: ['neck'] }),
  L('slot.chest', { id: 'chest', accepts: ['chest'] }),
  L('slot.back', { id: 'back', accepts: ['back'] }),
  L('slot.shoulders', { id: 'shoulders', accepts: ['shoulders'] }),
  L('slot.belt', { id: 'belt', accepts: ['belt'] }),
  L('slot.legs', { id: 'legs', accepts: ['legs'] }),
  L('slot.ring1', { id: 'ring1', accepts: ['ring'] }),
  L('slot.ring2', { id: 'ring2', accepts: ['ring'] }),
  L('slot.weapon', { id: 'weapon', accepts: ['weapon1', 'weapon2h'] }),
  L('slot.offhand', { id: 'offhand', accepts: ['offhand'] }),
  L('slot.accessory', { id: 'accessory', accepts: ['accessory'] }),
  L('slot.pet', { id: 'pet', accepts: ['pet'] }),
  L('slot.mount', { id: 'mount', accepts: ['mount'] }),
];

/** Nombre traducido de cada característica (clave interna -> texto); undefined si no existe. */
export const STAT_LABELS: Record<string, string | undefined> = new Proxy({}, {
  get: (_, key) => (typeof key === 'string' && tk(`stat.${key}`) !== `stat.${key}` ? tk(`stat.${key}`) : undefined),
});

export const isDamageRole = (role: Role) => role === 'melee' || role === 'dist';

export const ROLE_DEFAULT_TARGETS = (role: Role, level: number) => {
  const maxAp = level < 20 ? 7 : level < 50 ? 8 : level < 95 ? 9 : level < 140 ? 10 : level < 185 ? 11 : 12;
  // El tanque sacrifica PA por PM; los daños y curas priorizan PA.
  const ap = role === 'tank' ? Math.max(7, maxAp - 1) : maxAp;
  const mp = role === 'tank' ? (level < 50 ? 5 : level < 140 ? 6 : 7)
    : role === 'melee' ? (level < 95 ? 4 : 5)
    : 4;
  const range = role === 'dist' ? (level < 50 ? 1 : level < 140 ? 2 : 3) : role === 'heal' ? (level < 95 ? 1 : 2) : 0;
  return { ap, mp, range };
};

export const itemImage = (gfx: number) =>
  `https://static.ankama.com/wakfu/portal/game/item/115/${gfx}.png`;
