// Puntos de aptitud (características) y reparto recomendado según el rol.
import { isDamageRole, type Role } from './game';

export interface AptitudeLine {
  key: string;        // aptitud (texto en locales: apt.o.<key> / apt.m.<key>)
  points: number;
}
export interface AptitudeBranch {
  branch: 'int' | 'str' | 'agi' | 'luck' | 'major';
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
interface Option { key: string; per: Record<string, number>; cap?: number }

const O = {
  intRes: { key: 'intRes', per: { resElem: 10 }, cap: 10 },
  intHp: { key: 'intHp', per: { hpPct: 4 } },
  strElem: { key: 'strElem', per: { mastElem: 5 } },
  strMelee: { key: 'strMelee', per: { mastMelee: 8 }, cap: 20 },
  strDist: { key: 'strDist', per: { mastDist: 8 }, cap: 20 },
  strHp: { key: 'strHp', per: { hp: 20 } },
  agiTackle: { key: 'agiTackle', per: { tackle: 6 } },
  agiDodge: { key: 'agiDodge', per: { dodge: 6 } },
  agiBoth: { key: 'agiBoth', per: { tackle: 4, dodge: 4 } },
  agiWill: { key: 'agiWill', per: { will: 1 }, cap: 20 },
  agiInit: { key: 'agiInit', per: { init: 4 }, cap: 20 },
  luckCrit: { key: 'luckCrit', per: { crit: 1 }, cap: 20 },
  luckBlock: { key: 'luckBlock', per: { block: 1 }, cap: 20 },
  luckCritM: { key: 'luckCritM', per: { mastCrit: 4 } },
  luckBack: { key: 'luckBack', per: { mastBack: 6 } },
  luckBerserk: { key: 'luckBerserk', per: { mastBerserk: 8 } },
  luckHeal: { key: 'luckHeal', per: { mastHeal: 6 } },
  luckResCrit: { key: 'luckResCrit', per: { resCrit: 4 }, cap: 20 },
  luckResBack: { key: 'luckResBack', per: { resBack: 4 }, cap: 20 },
} satisfies Record<string, Option>;

const MAJOR = {
  ap: { per: { ap: 1 } },
  mp: { per: { mp: 1, mastElem: 20 } },
  range: { per: { range: 1, mastElem: 40 } },
  indirect: { per: { mastElem: 40 } },
  dmg: { per: { dmgPct: 10 } },
  heal: { per: { healPct: 10 } },
  armor: { per: { armorGiven: 20 } },
  res: { per: { resElem: 50 } },
  wp: { per: { wp: 2 } },
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
    lines.push({ key: `apt.o.${opt.key}`, points: n });
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
    { branch: 'int', total: pts.int, lines: fill(pts.int, plan.int, bonus) },
    { branch: 'str', total: pts.str, lines: fill(pts.str, plan.str, bonus) },
    { branch: 'agi', total: pts.agi, lines: fill(pts.agi, plan.agi, bonus) },
    { branch: 'luck', total: pts.luck, lines: fill(pts.luck, plan.luck, bonus) },
  ];
  const majorLines = plan.major.slice(0, pts.major).map((key) => {
    for (const [k, v] of Object.entries(MAJOR[key].per)) bonus[k] = (bonus[k] ?? 0) + v;
    return { key: `apt.m.${key}`, points: 1 };
  });
  branches.push({ branch: 'major', total: pts.major, lines: majorLines });
  return { branches, bonus };
}
