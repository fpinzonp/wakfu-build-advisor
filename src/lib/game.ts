// Reglas y constantes del juego usadas por el recomendador.

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
  craft?: { job: string; lvl: number };
  multiMast?: { v: number; n: number };
  multiRes?: { v: number; n: number };
  sockets?: number;   // engarces máximos para runas
}

// ---------- Runas y sublimaciones ----------

export type SocketColor = 1 | 2 | 3;
export const SOCKET_COLORS: Record<SocketColor, { label: string; color: string }> = {
  1: { label: 'Rojo', color: '#e0524a' },
  2: { label: 'Verde', color: '#5cc25a' },
  3: { label: 'Azul', color: '#4a90e0' },
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
  effect: string[];     // texto en inglés (wakfu.wiki.gg)
  source?: string;
  gfx: number;
}

export interface EnchantData { version: string; shards: Shard[]; sublimations: Sublimation[] }

export type ItemSource = 'craft' | 'shop' | 'other';
export const SOURCE_LABELS: Record<ItemSource, string> = {
  craft: 'Craft',
  shop: 'Tienda',
  other: 'Drop / otros',
};

export interface Recipe {
  job: string;
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
export const CRAFT_FILTER_EXEMPT: ItemSlot[] = ['pet', 'mount'];

export const ELEMENTS: { id: Element; label: string; color: string }[] = [
  { id: 'fire', label: 'Fuego', color: '#e8643a' },
  { id: 'water', label: 'Agua', color: '#3a9be8' },
  { id: 'earth', label: 'Tierra', color: '#8fb33a' },
  { id: 'air', label: 'Aire', color: '#b48be8' },
];

export const ROLES: { id: Role; label: string; hint: string }[] = [
  { id: 'tank', label: 'Tanque', hint: 'Anticipación, resistencias y vida; más PM que PA' },
  { id: 'heal', label: 'Curas', hint: 'Dominio cura + dominio distancia' },
  { id: 'dist', label: 'Daño a distancia', hint: 'Full dominio distancia; PA primero' },
  { id: 'melee', label: 'Daño cuerpo a cuerpo', hint: 'Full dominio de melé; PA primero' },
];

// Ramas elementales habituales de cada clase (editables en la interfaz).
// `focus`: especialidades de daño que conviene priorizar por defecto en esa clase.
export const CLASSES: {
  id: string; label: string; elements: Element[]; roles: Role[]; berserk?: boolean; focus?: ('crit' | 'back')[];
}[] = [
  { id: 'feca', label: 'Feca', elements: ['fire', 'water', 'earth'], roles: ['tank', 'dist'] },
  { id: 'osamodas', label: 'Osamodas', elements: ['fire', 'earth', 'air'], roles: ['dist', 'heal'] },
  { id: 'anutrof', label: 'Anutrof', elements: ['fire', 'water', 'earth'], roles: ['dist'] },
  { id: 'sram', label: 'Sram', elements: ['fire', 'water', 'air'], roles: ['melee'], focus: ['crit', 'back'] },
  { id: 'xelor', label: 'Xelor', elements: ['fire', 'water', 'air'], roles: ['dist'] },
  { id: 'zurcarak', label: 'Zurcarák', elements: ['fire', 'water', 'earth'], roles: ['melee', 'heal'] },
  { id: 'aniripsa', label: 'Aniripsa', elements: ['fire', 'water', 'air'], roles: ['heal', 'dist'] },
  { id: 'yopuka', label: 'Yopuka', elements: ['fire', 'earth', 'air'], roles: ['melee'] },
  { id: 'ocra', label: 'Ocra', elements: ['fire', 'earth', 'air'], roles: ['dist'], focus: ['crit', 'back'] },
  { id: 'sadida', label: 'Sadida', elements: ['water', 'earth', 'air'], roles: ['dist', 'heal'] },
  { id: 'sacrogrito', label: 'Sacrógrito', elements: ['fire', 'earth', 'air'], roles: ['melee', 'tank'], berserk: true },
  { id: 'pandawa', label: 'Pandawa', elements: ['fire', 'water', 'earth'], roles: ['tank', 'melee'] },
  { id: 'tymador', label: 'Tymador', elements: ['fire', 'water', 'earth'], roles: ['melee', 'dist'] },
  { id: 'zobal', label: 'Zobal', elements: ['fire', 'water', 'air'], roles: ['melee', 'tank'] },
  { id: 'steamer', label: 'Steamer', elements: ['fire', 'water', 'earth'], roles: ['dist', 'heal'] },
  { id: 'selotrop', label: 'Selotrop', elements: ['fire', 'water', 'air'], roles: ['dist', 'melee'] },
  { id: 'hipermago', label: 'Hipermago', elements: ['fire', 'water', 'earth', 'air'], roles: ['dist'] },
  { id: 'uginak', label: 'Uginak', elements: ['fire', 'water', 'earth'], roles: ['melee', 'tank'] },
];

export const RARITIES: Record<number, { label: string; color: string }> = {
  0: { label: 'Común', color: '#9a9a9a' },
  1: { label: 'Inusual', color: '#d8d8d8' },
  2: { label: 'Raro', color: '#4fc35a' },
  3: { label: 'Mítico', color: '#f08a2b' },
  4: { label: 'Legendario', color: '#f5d33b' },
  5: { label: 'Reliquia', color: '#c85ce0' },
  6: { label: 'Recuerdo', color: '#5ec8e6' },
  7: { label: 'Épico', color: '#e0458f' },
};
export const RELIC = 5;
export const EPIC = 7;

export type BuildSlot =
  | 'head' | 'neck' | 'chest' | 'back' | 'shoulders' | 'belt' | 'legs'
  | 'ring1' | 'ring2' | 'weapon' | 'offhand' | 'accessory' | 'pet' | 'mount';

export const BUILD_SLOTS: { id: BuildSlot; label: string; accepts: ItemSlot[] }[] = [
  { id: 'head', label: 'Casco', accepts: ['head'] },
  { id: 'neck', label: 'Amuleto', accepts: ['neck'] },
  { id: 'chest', label: 'Coraza', accepts: ['chest'] },
  { id: 'back', label: 'Capa', accepts: ['back'] },
  { id: 'shoulders', label: 'Hombreras', accepts: ['shoulders'] },
  { id: 'belt', label: 'Cinturón', accepts: ['belt'] },
  { id: 'legs', label: 'Botas', accepts: ['legs'] },
  { id: 'ring1', label: 'Anillo', accepts: ['ring'] },
  { id: 'ring2', label: 'Anillo', accepts: ['ring'] },
  { id: 'weapon', label: 'Arma', accepts: ['weapon1', 'weapon2h'] },
  { id: 'offhand', label: 'Segunda mano', accepts: ['offhand'] },
  { id: 'accessory', label: 'Emblema', accepts: ['accessory'] },
  { id: 'pet', label: 'Mascota', accepts: ['pet'] },
  { id: 'mount', label: 'Montura', accepts: ['mount'] },
];

export const STAT_LABELS: Record<string, string> = {
  hp: 'PdV', ap: 'PA', mp: 'PM', wp: 'PW', range: 'Alcance',
  mastElem: 'Dominio elemental', mastFire: 'Dominio de fuego', mastWater: 'Dominio de agua',
  mastEarth: 'Dominio de tierra', mastAir: 'Dominio de aire',
  mastMelee: 'Dominio de melé', mastDist: 'Dominio distancia', mastBerserk: 'Dominio berserker',
  mastCrit: 'Dominio crítico', mastBack: 'Dominio espalda', mastHeal: 'Dominio cura',
  crit: '% Golpe crítico', block: '% Anticipación',
  resElem: 'Resistencia elemental', resFire: 'Resistencia fuego', resWater: 'Resistencia agua',
  resEarth: 'Resistencia tierra', resAir: 'Resistencia aire',
  resCrit: 'Resistencia crítica', resBack: 'Resistencia espalda',
  init: 'Iniciativa', tackle: 'Placaje', dodge: 'Esquiva', will: 'Voluntad',
  prospection: 'Prospección', wisdom: 'Sabiduría',
  armorGiven: '% Armadura dada', armorReceived: '% Armadura recibida',
  hpPct: '% PdV', dmgPct: '% Daños infligidos', healPct: '% Curas realizadas',
};

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
