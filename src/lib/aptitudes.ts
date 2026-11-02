// Puntos de aptitud (características) y reparto recomendado según el rol.
import { isDamageRole, type Role } from './game';

export interface AptitudeLine {
  stat: string;       // nombre visible de la aptitud
  points: number;
  effect: string;     // efecto total legible
}
export interface AptitudeBranch {
  branch: string;
  total: number;
  lines: AptitudeLine[];
}
export interface AptitudePlan {
  branches: AptitudeBranch[];
  bonus: Record<string, number>; // stats que aportan las aptitudes
}

// Un punto por nivel en ciclo Inteligencia (nv. 2), Fuerza (3), Agilidad (4), Suerte (5);
// puntos mayores en los niveles 25, 75, 125, 175 y 225.
export function aptitudePoints(level: number) {
  return {
    int: Math.max(0, Math.floor((level + 2) / 4)),
    str: Math.max(0, Math.floor((level + 1) / 4)),
    agi: Math.max(0, Math.floor(level / 4)),
    luck: Math.max(0, Math.floor((level - 1) / 4)),
    major: [25, 75, 125, 175, 225].filter((l) => level >= l).length,
  };
}

// Cada opción: estadística por punto y tope de puntos (undefined = sin tope).
interface Option { label: string; per: Record<string, number>; cap?: number; unit: (n: number) => string }

const O = {
  intRes: { label: 'Resistencia elemental', per: { resElem: 10 }, cap: 10, unit: (n) => `+${n * 10} resistencia elemental` },
  intHp: { label: '% PdV', per: { hpPct: 4 }, unit: (n) => `+${n * 4}% PdV` },
  strElem: { label: 'Dominio elemental', per: { mastElem: 5 }, unit: (n) => `+${n * 5} dominio elemental` },
  strMelee: { label: 'Dominio de melé', per: { mastMelee: 8 }, cap: 20, unit: (n) => `+${n * 8} dominio de melé` },
  strDist: { label: 'Dominio distancia', per: { mastDist: 8 }, cap: 20, unit: (n) => `+${n * 8} dominio distancia` },
  strHp: { label: 'PdV', per: { hp: 20 }, unit: (n) => `+${n * 20} PdV` },
  agiTackle: { label: 'Placaje', per: { tackle: 6 }, unit: (n) => `+${n * 6} placaje` },
  agiDodge: { label: 'Esquiva', per: { dodge: 6 }, unit: (n) => `+${n * 6} esquiva` },
  agiBoth: { label: 'Placaje y esquiva', per: { tackle: 4, dodge: 4 }, unit: (n) => `+${n * 4} placaje y esquiva` },
  agiWill: { label: 'Voluntad', per: { will: 1 }, cap: 20, unit: (n) => `+${n} voluntad` },
  agiInit: { label: 'Iniciativa', per: { init: 4 }, cap: 20, unit: (n) => `+${n * 4} iniciativa` },
  luckCrit: { label: '% Golpe crítico', per: { crit: 1 }, cap: 20, unit: (n) => `+${n}% golpe crítico` },
  luckBlock: { label: '% Anticipación', per: { block: 1 }, cap: 20, unit: (n) => `+${n}% anticipación` },
  luckCritM: { label: 'Dominio crítico', per: { mastCrit: 4 }, unit: (n) => `+${n * 4} dominio crítico` },
  luckBack: { label: 'Dominio espalda', per: { mastBack: 6 }, unit: (n) => `+${n * 6} dominio espalda` },
  luckBerserk: { label: 'Dominio berserker', per: { mastBerserk: 8 }, unit: (n) => `+${n * 8} dominio berserker` },
  luckHeal: { label: 'Dominio cura', per: { mastHeal: 6 }, unit: (n) => `+${n * 6} dominio cura` },
  luckResCrit: { label: 'Resistencia crítica', per: { resCrit: 4 }, cap: 20, unit: (n) => `+${n * 4} resistencia crítica` },
  luckResBack: { label: 'Resistencia espalda', per: { resBack: 4 }, cap: 20, unit: (n) => `+${n * 4} resistencia espalda` },
} satisfies Record<string, Option>;

const MAJOR = {
  ap: { label: '+1 PA', per: { ap: 1 } },
  mp: { label: '+1 PM y +20 dominio elemental', per: { mp: 1, mastElem: 20 } },
  range: { label: '+1 Alcance y +40 dominio elemental', per: { range: 1, mastElem: 40 } },
  indirect: { label: '+10% Daños indirectos y +40 dominio elemental', per: { mastElem: 40 } },
  dmg: { label: '+10% Daños infligidos', per: { dmgPct: 10 } },
  heal: { label: '+10% Curas realizadas', per: { healPct: 10 } },
  armor: { label: '+20% Armadura dada', per: { armorGiven: 20 } },
  res: { label: '+50 Resistencia elemental', per: { resElem: 50 } },
  wp: { label: '+2 PW', per: { wp: 2 } },
};

const PLANS: Record<Role, { int: Option[]; str: Option[]; agi: Option[]; luck: Option[]; major: (keyof typeof MAJOR)[] }> = {
  dist: {
    int: [O.intRes, O.intHp], str: [O.strDist, O.strElem], agi: [O.agiWill, O.agiDodge],
    luck: [O.luckCrit, O.luckCritM], major: ['ap', 'mp', 'range', 'dmg', 'res'],
  },
  melee: {
    int: [O.intRes, O.intHp], str: [O.strMelee, O.strElem], agi: [O.agiWill, O.agiBoth],
    luck: [O.luckCrit, O.luckBack], major: ['ap', 'mp', 'dmg', 'indirect', 'res'],
  },
  heal: {
    int: [O.intRes, O.intHp], str: [O.strDist, O.strElem], agi: [O.agiDodge],
    luck: [O.luckCrit, O.luckHeal], major: ['ap', 'mp', 'heal', 'range', 'res'],
  },
  tank: {
    int: [O.intRes, O.intHp], str: [O.strHp], agi: [O.agiTackle],
    luck: [O.luckBlock, O.luckResCrit, O.luckResBack, O.luckCritM], major: ['ap', 'mp', 'res', 'indirect', 'dmg'],
  },
};

function fill(points: number, options: Option[], bonus: Record<string, number>): AptitudeLine[] {
  const lines: AptitudeLine[] = [];
  let left = points;
  for (const opt of options) {
    if (left <= 0) break;
    const n = opt.cap === undefined ? left : Math.min(opt.cap, left);
    left -= n;
    for (const [k, v] of Object.entries(opt.per)) bonus[k] = (bonus[k] ?? 0) + v * n;
    lines.push({ stat: opt.label, points: n, effect: opt.unit(n) });
  }
  return lines;
}

export interface DamageFocus { berserk?: boolean; crit?: boolean; back?: boolean }

// Tras el 20 % de crítico, la Suerte va a la especialidad de daño elegida.
function luckFor(role: Role, focus: DamageFocus): Option[] | null {
  if (!isDamageRole(role)) return null;
  if (focus.berserk) return [O.luckCrit, O.luckBerserk];
  if (focus.back && (role === 'melee' || !focus.crit)) return [O.luckCrit, O.luckBack];
  if (focus.crit) return [O.luckCrit, O.luckCritM];
  return null;
}

export function planAptitudes(role: Role, level: number, focus: DamageFocus = {}): AptitudePlan {
  const pts = aptitudePoints(level);
  const base = PLANS[role];
  const luck = luckFor(role, focus);
  const plan = luck ? { ...base, luck } : base;
  const bonus: Record<string, number> = {};
  const branches: AptitudeBranch[] = [
    { branch: 'Inteligencia', total: pts.int, lines: fill(pts.int, plan.int, bonus) },
    { branch: 'Fuerza', total: pts.str, lines: fill(pts.str, plan.str, bonus) },
    { branch: 'Agilidad', total: pts.agi, lines: fill(pts.agi, plan.agi, bonus) },
    { branch: 'Suerte', total: pts.luck, lines: fill(pts.luck, plan.luck, bonus) },
  ];
  const majorLines = plan.major.slice(0, pts.major).map((key) => {
    for (const [k, v] of Object.entries(MAJOR[key].per)) bonus[k] = (bonus[k] ?? 0) + v;
    return { stat: MAJOR[key].label, points: 1, effect: MAJOR[key].label };
  });
  branches.push({ branch: 'Mayor', total: pts.major, lines: majorLines });
  return { branches, bonus };
}
