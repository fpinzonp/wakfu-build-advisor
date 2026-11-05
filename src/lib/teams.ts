// Recomendador de equipos: reparte las necesidades de cada contenido entre las clases. Lo que aporta cada clase
// está curado a mano en KIT a partir de los textos de public/data/spells.json (solo efectos claros).
import { CLASSES, type Role } from './game';
import { getLang, type Lang } from './i18n';

export type Need = 'protect' | 'heal' | 'revive' | 'debuff' | 'support' | 'control' | 'melee' | 'ranged';
export const NEEDS: Need[] = ['protect', 'heal', 'revive', 'debuff', 'support', 'control', 'melee', 'ranged'];

export type Content = 'rooms' | 'stasis' | 'ultimate' | 'trio';
export const SIX_CONTENTS: Content[] = ['rooms', 'stasis', 'ultimate'];
export type TeamSize = 3 | 6;

export interface Member { classId: string; role: Role }

export interface Contribution {
  need: Need;
  power: 1 | 2 | 3;       // 1 = algo, 2 = bien, 3 = de lo mejor del juego
  spell: number;          // id en spells.json
  role?: Role;            // solo cuenta si el personaje juega ese rol
  note: Record<Lang, string>;
}

const c = (need: Need, power: 1 | 2 | 3, spell: number, es: string, en: string, fr: string, role?: Role): Contribution =>
  ({ need, power, spell, role, note: { es, en, fr } });

export const KIT: Record<string, Contribution[]> = {
  feca: [
    c('protect', 3, 2501242652, 'Redirige hacia sí el 25 % del daño de un enemigo.', 'Redirects 25% of an enemy\'s damage to itself.', 'Redirige vers lui 25 % des dégâts d\'un ennemi.', 'tank'),
    c('support', 2, 605853271, 'Sus escudos dan a los aliados daño, alcance o PM.', 'Its shields give allies damage, range or MP.', 'Ses boucliers donnent dégâts, portée ou PM aux alliés.'),
  ],
  osamodas: [
    c('support', 2, 873080721, 'Transfiere sus PM sobrantes a un aliado: 2 por cada 1, hasta 4.', 'Transfers spare MP to an ally: 2 for 1, up to 4.', 'Transfère ses PM restants à un allié : 2 pour 1, jusqu\'à 4.'),
    c('protect', 1, 813474466, 'Transfiere hasta un 30 % de sus PdV máximos como armadura.', 'Transfers up to 30% of max HP as armor.', 'Transfère jusqu\'à 30 % de ses PV max en armure.'),
    c('heal', 2, 4114652964, 'Sus hechizos sobre aliados dejan de dañar y curan, dan armadura o aplican efectos.', 'Its spells on allies stop dealing damage and heal, give armor or add effects.', 'Ses sorts sur alliés ne blessent plus et soignent, donnent de l\'armure ou des effets.', 'heal'),
  ],
  anutrof: [
    c('debuff', 2, 1929865839, 'Deuda: −100 de resistencia elemental.', 'Debt: −100 Elemental Resistance.', 'Dette : −100 de résistance élémentaire.'),
    c('control', 2, 1777255876, 'Quita 3 PM y roba placaje y esquiva.', 'Removes 3 MP and steals Lock and Dodge.', 'Retire 3 PM et vole tacle et esquive.'),
  ],
  sram: [
    c('debuff', 2, 3734854004, '−100 de resistencia elemental; se revierte si el objetivo sobrevive.', '−100 Elemental Resistance; reverted if the target survives.', '−100 de résistance élémentaire ; annulé si la cible survit.'),
  ],
  xelor: [
    c('support', 3, 3097237492, 'Sinistro da PA a los aliados al final de su turno.', 'Sinistro gives allies AP at the end of its turn.', 'Sinistro donne des PA aux alliés à la fin de son tour.'),
    c('heal', 1, 3097237492, 'Sinistro también cura a los aliados según su vida perdida.', 'Sinistro also heals allies based on missing HP.', 'Sinistro soigne aussi les alliés selon leurs PV perdus.'),
    c('control', 2, 3693455262, 'Quita 3 PA al enemigo.', 'Removes 3 AP from the enemy.', 'Retire 3 PA à l\'ennemi.'),
  ],
  zurcarak: [
    c('revive', 3, 2131594746, 'Revive a un aliado con el 25 % de sus PdV máximos.', 'Revives an ally with 25% max HP.', 'Ranime un allié avec 25 % de ses PV max.'),
    c('heal', 2, 2469229602, 'Cura a los aliados y roba vida a los enemigos.', 'Heals allies and steals life from enemies.', 'Soigne les alliés et vole la vie des ennemis.', 'heal'),
    c('heal', 1, 101471877, 'Cura a un aliado y le da 1 PM y 1 PW.', 'Heals an ally and gives 1 MP and 1 WP.', 'Soigne un allié et lui donne 1 PM et 1 PW.'),
    c('support', 1, 101471877, 'Da 1 PM y 1 PW a un aliado.', 'Gives an ally 1 MP and 1 WP.', 'Donne 1 PM et 1 PW à un allié.'),
  ],
  aniripsa: [
    c('heal', 3, 1306163655, 'La clase con más curas; Regeneración es su cura fuerte.', 'The class with the most healing; Regeneration is its strong heal.', 'La classe la plus riche en soins ; Régénération est son gros soin.', 'heal'),
    c('heal', 1, 733187938, 'Cura disponible en cualquier rol.', 'Healing available in any role.', 'Soin disponible dans tous les rôles.'),
    c('revive', 3, 236446319, 'Revive a un aliado con el 30 % de sus PdV máximos.', 'Revives an ally with 30% max HP.', 'Ranime un allié avec 30 % de ses PV max.'),
  ],
  yopuka: [
    c('support', 3, 2230276261, 'Da +15 % de daño y 1 PM a los aliados cercanos.', 'Gives nearby allies +15% damage and 1 MP.', 'Donne +15 % de dégâts et 1 PM aux alliés proches.'),
  ],
  ocra: [
    c('control', 2, 324226730, 'Quita 3 PM, o 5 con Disparo de precisión.', 'Removes 3 MP, or 5 with Precision Shot.', 'Retire 3 PM, ou 5 avec Tir de précision.'),
  ],
  sadida: [
    c('heal', 2, 4215691195, 'Cura a los aliados además de dañar.', 'Heals allies as well as dealing damage.', 'Soigne les alliés en plus d\'infliger des dégâts.', 'heal'),
    c('debuff', 1, 2727000349, '−50 de resistencia elemental durante 2 turnos.', '−50 Elemental Resistance for 2 turns.', '−50 de résistance élémentaire pendant 2 tours.'),
    c('control', 1, 1599412904, 'Quita 1 PM al enemigo.', 'Removes 1 MP from the enemy.', 'Retire 1 PM à l\'ennemi.'),
  ],
  sacrogrito: [
    c('protect', 3, 3464931865, 'Puede sacrificarse por un aliado para protegerlo.', 'Can sacrifice itself to protect an ally.', 'Peut se sacrifier pour protéger un allié.', 'tank'),
    c('protect', 1, 3364540755, 'Da armadura equivalente al 20 % de los PdV máximos del objetivo.', 'Gives armor worth 20% of the target\'s max HP.', 'Donne une armure de 20 % des PV max de la cible.'),
    c('debuff', 2, 1760451441, '−150 de resistencia al portador, a cambio de que haga +30 % de daño al Sacrógrito.', '−150 resistance on the bearer, who deals +30% damage to the Sacrier.', '−150 de résistance sur le porteur, qui inflige +30 % de dégâts au Sacrieur.'),
  ],
  pandawa: [
    c('protect', 2, 1823628150, 'Se da armadura y +100 de resistencia durante 1 turno.', 'Gives itself armor and +100 resistance for 1 turn.', 'Se donne de l\'armure et +100 de résistance pendant 1 tour.', 'tank'),
    c('debuff', 2, 3698074602, '−100 de resistencia durante 1 turno a un objetivo mareado.', '−100 resistance for 1 turn on a Dizzy target.', '−100 de résistance pendant 1 tour sur une cible étourdie.'),
    c('heal', 1, 662752163, 'Cura además de dañar.', 'Heals as well as dealing damage.', 'Soigne en plus d\'infliger des dégâts.'),
  ],
  tymador: [
    c('debuff', 1, 1346497027, '−50 de resistencia elemental.', '−50 Elemental Resistance.', '−50 de résistance élémentaire.'),
    c('control', 2, 1762922172, 'Quita 3 PM al enemigo.', 'Removes 3 MP from the enemy.', 'Retire 3 PM à l\'ennemi.'),
  ],
  zobal: [
    c('protect', 2, 3454637746, 'Da +50 de resistencia a los aliados a 4 casillas o menos.', 'Gives +50 resistance to allies within 4 cells.', 'Donne +50 de résistance aux alliés à 4 cases ou moins.', 'tank'),
    c('revive', 3, 3519416140, 'Revive a un aliado con el 30 % de sus PdV máximos.', 'Revives an ally with 30% max HP.', 'Ranime un allié avec 30 % de ses PV max.'),
    c('support', 2, 564796608, 'Da 2 PM y armadura a un aliado durante 2 turnos.', 'Gives an ally 2 MP and armor for 2 turns.', 'Donne 2 PM et de l\'armure à un allié pendant 2 tours.'),
    c('debuff', 1, 108262377, '−50 de resistencia elemental.', '−50 Elemental Resistance.', '−50 de résistance élémentaire.'),
  ],
  steamer: [
    c('debuff', 3, 1447144933, '−150 de resistencia elemental a un enemigo durante 2 turnos.', '−150 Elemental Resistance on an enemy for 2 turns.', '−150 de résistance élémentaire sur un ennemi pendant 2 tours.'),
    c('support', 2, 1447144933, 'Da +2 de alcance y +30 % de daño a distancia a un aliado.', 'Gives an ally +2 Range and +30% ranged damage.', 'Donne +2 de portée et +30 % de dégâts à distance à un allié.'),
    c('protect', 1, 4210275767, 'Da a un aliado armadura del 10 % de sus PdV máximos.', 'Gives an ally armor worth 10% of their max HP.', 'Donne à un allié une armure de 10 % de ses PV max.'),
  ],
  selotrop: [
    c('support', 2, 2492617042, 'Lo que pasa por sus portales gana +25 % de daño y de cura.', 'Spells through its portals gain +25% damage and healing.', 'Les sorts passant par ses portails gagnent +25 % de dégâts et de soins.'),
    c('heal', 1, 3440095827, 'Cura además de dañar.', 'Heals as well as dealing damage.', 'Soigne en plus d\'infliger des dégâts.'),
    c('control', 1, 2589217030, 'Quita 2 PA o 2 PM según su estado.', 'Removes 2 AP or 2 MP depending on its state.', 'Retire 2 PA ou 2 PM selon son état.'),
  ],
  hipermago: [
    c('support', 1, 3028558902, 'Da +20 % de daño a un aliado durante 1 turno.', 'Gives an ally +20% damage for 1 turn.', 'Donne +20 % de dégâts à un allié pendant 1 tour.'),
    c('heal', 1, 1849148515, 'Cura además de dañar.', 'Heals as well as dealing damage.', 'Soigne en plus d\'infliger des dégâts.'),
    c('protect', 1, 2167178146, 'Da armadura, que se duplica en ciertas condiciones.', 'Gives armor, doubled under certain conditions.', 'Donne de l\'armure, doublée sous certaines conditions.'),
    c('control', 1, 4115469629, 'Quita 1 PA o 1 PM al enemigo.', 'Removes 1 AP or 1 MP from the enemy.', 'Retire 1 PA ou 1 PM à l\'ennemi.'),
  ],
  uginak: [
    c('protect', 2, 241494416, 'Gana armadura por cada enemigo golpeado.', 'Gains armor for each enemy hit.', 'Gagne de l\'armure par ennemi touché.', 'tank'),
    c('support', 2, 2041106158, 'Más daño por aliado en la zona, hasta +25 %.', 'More damage per ally in the area, up to +25%.', 'Plus de dégâts par allié dans la zone, jusqu\'à +25 %.'),
    c('control', 2, 3245529915, 'Coloca un Canino que quita 3 PM al inicio del turno.', 'Places a Canine that removes 3 MP at start of turn.', 'Place un Canin qui retire 3 PM en début de tour.'),
  ],
};

// Peso de cada necesidad según el contenido.
const WEIGHTS: Record<Content, Record<Need, number>> = {
  rooms: { protect: 3, heal: 3, revive: 0.5, debuff: 1, support: 1, control: 0.5, melee: 1.5, ranged: 1.5 },
  stasis: { protect: 3.5, heal: 3.5, revive: 2, debuff: 1, support: 1.5, control: 1, melee: 1, ranged: 1 },
  ultimate: { protect: 2, heal: 2.5, revive: 1.5, debuff: 3, support: 2, control: 0.5, melee: 1.5, ranged: 1.5 },
  trio: { protect: 4, heal: 4, revive: 0.5, debuff: 0.5, support: 0.5, control: 0.25, melee: 1.5, ranged: 1.5 },
};

const DAMAGE_ROLES: Role[] = ['melee', 'dist'];
export const contentSize = (content: Content): TeamSize => (content === 'trio' ? 3 : 6);

/** Aportes que cuentan para un personaje según el rol que juega. */
export const contributions = (m: Member) => (KIT[m.classId] ?? []).filter((x) => !x.role || x.role === m.role);
export const contributionNote = (x: Contribution) => x.note[getLang()];

/** Lo que aporta un personaje a cada necesidad (0-3). El rol da una base aunque no haya hechizo curado. */
export function memberPower(m: Member): Record<Need, number> {
  const p = Object.fromEntries(NEEDS.map((n) => [n, 0])) as Record<Need, number>;
  for (const x of contributions(m)) p[x.need] = Math.max(p[x.need], x.power);
  if (m.role === 'melee') p.melee = 3;
  if (m.role === 'dist') p.ranged = 3;
  if (m.role === 'tank') p.protect = Math.max(p.protect, 1);
  if (m.role === 'heal') p.heal = Math.max(p.heal, 1);
  return p;
}

/** Cobertura del grupo (0-3): cuenta el mejor aporte y una cuarta parte del segundo. */
export function coverage(team: Member[]): Record<Need, number> {
  const powers = team.map(memberPower);
  const cov = {} as Record<Need, number>;
  for (const n of NEEDS) {
    const [a = 0, b = 0] = powers.map((p) => p[n]).sort((x, y) => y - x);
    cov[n] = Math.min(3, a + b / 4);
  }
  return cov;
}

export type NeedStatus = 'ok' | 'weak' | 'none';
export const needStatus = (value: number): NeedStatus => (value >= 2 ? 'ok' : value > 0 ? 'weak' : 'none');

export function scoreTeam(team: Member[], content: Content): number {
  const cov = coverage(team);
  const w = WEIGHTS[content];
  const dealers = team.filter((m) => DAMAGE_ROLES.includes(m.role)).length;
  const wanted = contentSize(content) === 6 ? 3 : 1;
  return NEEDS.reduce((sum, n) => sum + (w[n] * cov[n]) / 3, 0) + (3 * Math.min(dealers, wanted)) / wanted;
}

const candidates = (): Member[] => CLASSES.flatMap((cl) => cl.roles.map((role) => ({ classId: cl.id, role })));

/** Mejor grupo que incluye a los personajes fijados: añade por ganancia y luego prueba cambios uno a uno. */
export function recommendTeam(fixed: Member[], content: Content): Member[] {
  const size = contentSize(content);
  const team = [...fixed].slice(0, size);
  const free = (cur: Member[]) => candidates().filter((m) => !cur.some((x) => x.classId === m.classId));
  while (team.length < size) {
    let best: Member | null = null;
    let top = -Infinity;
    for (const m of free(team)) {
      const s = scoreTeam([...team, m], content);
      if (s > top + 1e-9) { top = s; best = m; }
    }
    team.push(best!);
  }
  for (let improved = true; improved;) {
    improved = false;
    for (let i = fixed.length; i < team.length; i++) {
      const others = team.filter((_, j) => j !== i);
      const top = scoreTeam(team, content);
      const better = free(others)
        .map((m) => ({ m, s: scoreTeam([...others, m], content) }))
        .reduce((a, b) => (b.s > a.s + 1e-9 ? b : a), { m: team[i], s: top });
      if (better.s > top + 1e-9) { team[i] = better.m; improved = true; }
    }
  }
  return team;
}

/** Los 3 del grupo que mejor funcionan juntos; team[0] (tu clase) siempre está incluida. */
export function bestTrio(team: Member[]): Member[] {
  let best = team.slice(0, 3);
  let top = -Infinity;
  for (let i = 1; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      const trio = [team[0], team[i], team[j]];
      const s = scoreTeam(trio, 'trio');
      if (s > top + 1e-9) { top = s; best = trio; }
    }
  }
  return best;
}

/** Necesidades que empeoran de estado al pasar de un grupo a otro. */
export function lostNeeds(before: Member[], after: Member[]): Need[] {
  const rank: Record<NeedStatus, number> = { ok: 2, weak: 1, none: 0 };
  const a = coverage(before);
  const b = coverage(after);
  return NEEDS.filter((n) => rank[needStatus(b[n])] < rank[needStatus(a[n])]);
}

/** Necesidad por la que un personaje está en el grupo, y si nadie más la cubre igual de bien. */
export function mainNeed(team: Member[], index: number, content: Content): { need: Need; only: boolean } {
  const w = WEIGHTS[content];
  const mine = memberPower(team[index]);
  const others = team.filter((_, i) => i !== index).map(memberPower);
  const gain = (n: Need) => w[n] * Math.max(0, mine[n] - Math.max(0, ...others.map((p) => p[n])));
  const value = (n: Need) => gain(n) * 10 + w[n] * mine[n];
  const need = NEEDS.reduce((a, b) => (value(b) > value(a) ? b : a));
  return { need, only: mine[need] > 0 && gain(need) > 0 };
}

/** Rol con el que una clase rinde más en el hueco de `index`. */
export function bestRole(classId: string, team: Member[], index: number, content: Content): Role {
  const others = team.filter((_, i) => i !== index);
  const roles = CLASSES.find((x) => x.id === classId)!.roles;
  return roles.reduce((a, b) => (
    scoreTeam([...others, { classId, role: b }], content) > scoreTeam([...others, { classId, role: a }], content) + 1e-9 ? b : a
  ));
}

/** Reemplazos para un hueco: primero las clases que cubren lo mismo, de mejor a peor. */
export function replacements(team: Member[], index: number, content: Content, max = 4): Member[] {
  const { need } = mainNeed(team, index, content);
  return CLASSES.filter((x) => !team.some((m) => m.classId === x.id))
    .map((x) => ({ classId: x.id, role: bestRole(x.id, team, index, content) }))
    .filter((m) => memberPower(m)[need] > 0)
    .map((m) => ({ m, s: scoreTeam(team.map((x, i) => (i === index ? m : x)), content) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, max)
    .map((x) => x.m);
}
