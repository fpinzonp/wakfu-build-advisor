// Recomendador de equipos: reparte las necesidades de cada contenido entre las clases. Lo que aporta cada clase
// está curado a mano en KIT a partir de los textos de public/data/spells.json (solo efectos claros).
import { CLASSES, type Role } from './game';
import { getLang, type Lang } from './i18n';

export type Need = 'protect' | 'heal' | 'revive' | 'debuff' | 'support' | 'control' | 'melee' | 'ranged' | 'place';
export const NEEDS: Need[] = ['protect', 'heal', 'revive', 'debuff', 'support', 'control', 'melee', 'ranged', 'place'];

/** Subtipos de colocación: mover piezas (empujar, atraer, intercambiar posiciones, teletransportar). */
export type PlaceKind = 'push' | 'pull' | 'swap' | 'teleport';

/** @deprecated se borra en Task 6 */
export type Content = 'rooms' | 'stasis' | 'ultimate' | 'trio';
/** @deprecated se borra en Task 6 */
export const SIX_CONTENTS: Content[] = ['rooms', 'stasis', 'ultimate'];
/** @deprecated se borra en Task 6 */
export type TeamSize = 3 | 6;

export interface Member { classId: string; role: Role }

export interface Contribution {
  need: Need;
  power: 1 | 2 | 3;       // 1 = algo, 2 = bien, 3 = de lo mejor del juego
  spell: number;          // id en spells.json
  role?: Role;            // solo cuenta si el personaje juega ese rol
  place?: PlaceKind;      // obligatorio cuando need === 'place'
  note: Record<Lang, string>;
}

const c = (need: Need, power: 1 | 2 | 3, spell: number, es: string, en: string, fr: string, role?: Role): Contribution =>
  ({ need, power, spell, role, note: { es, en, fr } });

// Aporte de colocación: 3 = a distancia y sin condición; 2 = con condición o efecto corto; 1 = muy limitado.
const cp = (kind: PlaceKind, power: 1 | 2 | 3, spell: number, es: string, en: string, fr: string, role?: Role): Contribution =>
  ({ need: 'place', place: kind, power, spell, role, note: { es, en, fr } });

export const KIT: Record<string, Contribution[]> = {
  feca: [
    c('protect', 3, 2501242652, 'Redirige hacia sí el 25 % del daño de un enemigo.', 'Redirects 25% of an enemy\'s damage to itself.', 'Redirige vers lui 25 % des dégâts d\'un ennemi.', 'tank'),
    c('support', 2, 605853271, 'Sus escudos dan a los aliados daño, alcance o PM.', 'Its shields give allies damage, range or MP.', 'Ses boucliers donnent dégâts, portée ou PM aux alliés.'),
    cp('pull', 3, 922953897, 'Tormenta atrae 4 casillas a los objetivos de alrededor.', 'Storm pulls the targets around it 4 cells.', 'Tempête attire de 4 cases les cibles autour.'),
    cp('pull', 2, 2882458401, 'Magnetismo atrae 2 casillas si se lanza sobre un glifo.', 'Magnetism pulls 2 cells when cast on a glyph.', 'Magnétisme attire de 2 cases sur un glyphe.'),
    cp('push', 2, 2882458401, 'Magnetismo empuja 2 casillas a los adyacentes si se lanza con escudo.', 'Magnetism pushes adjacent entities 2 cells when cast with a shield.', 'Magnétisme repousse de 2 cases les adjacents avec un bouclier.'),
    cp('teleport', 2, 3035657056, 'Teletransporte: se coloca junto a un enemigo, o pone al enemigo delante de sí.', 'Teleportation: moves next to an enemy, or puts the enemy in front of itself.', 'Téléportation : se place près d\'un ennemi, ou place l\'ennemi devant lui.'),
  ],
  osamodas: [
    c('support', 2, 873080721, 'Transfiere sus PM sobrantes a un aliado: 2 por cada 1, hasta 4.', 'Transfers spare MP to an ally: 2 for 1, up to 4.', 'Transfère ses PM restants à un allié : 2 pour 1, jusqu\'à 4.'),
    c('protect', 1, 813474466, 'Transfiere hasta un 30 % de sus PdV máximos como armadura.', 'Transfers up to 30% of max HP as armor.', 'Transfère jusqu\'à 30 % de ses PV max en armure.'),
    c('heal', 2, 4114652964, 'Sus hechizos sobre aliados dejan de dañar y curan, dan armadura o aplican efectos.', 'Its spells on allies stop dealing damage and heal, give armor or add effects.', 'Ses sorts sur alliés ne blessent plus et soignent, donnent de l\'armure ou des effets.', 'heal'),
    cp('push', 2, 1869107077, 'Aliento repulsivo empuja 1 casilla a distancia (hasta 6).', 'Repulsive Breath pushes 1 cell at up to 6 range.', 'Souffle répulsif repousse d\'1 case jusqu\'à 6 de portée.'),
    cp('pull', 2, 2182009435, 'Puñetazo crepitante atrae 2 casillas en forma Dragón.', 'Crackler Punch pulls 2 cells in Dragon form.', 'Coup de crépitant attire de 2 cases en forme Dragon.'),
    cp('swap', 2, 147611393, 'Transferencia intercambia a un combatiente con sus invocaciones (hasta 7 casillas).', 'Transfer swaps a fighter with its summons (up to 7 cells).', 'Transfert échange un combattant avec ses invocations (jusqu\'à 7 cases).'),
  ],
  anutrof: [
    c('debuff', 2, 1929865839, 'Deuda: −100 de resistencia elemental.', 'Debt: −100 Elemental Resistance.', 'Dette : −100 de résistance élémentaire.'),
    c('control', 2, 1777255876, 'Quita 3 PM y roba placaje y esquiva.', 'Removes 3 MP and steals Lock and Dodge.', 'Retire 3 PM et vole tacle et esquive.'),
    cp('push', 2, 4266415628, 'Pala asesina empuja 1 casilla en forma Enutrof.', 'Killer Spade pushes 1 cell in Enutrof form.', 'Pelle assassine repousse d\'1 case en forme Enutrof.'),
    cp('swap', 2, 4266415628, 'Pala asesina intercambia posiciones en forma Drhellzerker.', 'Killer Spade switches places in Drhellzerker form.', 'Pelle assassine échange les places en forme Drhellzerker.'),
  ],
  sram: [
    c('debuff', 2, 3734854004, '−100 de resistencia elemental; se revierte si el objetivo sobrevive.', '−100 Elemental Resistance; reverted if the target survives.', '−100 de résistance élémentaire ; annulé si la cible survit.'),
    cp('push', 2, 1793755256, 'Trampa de repulsión empuja 2 casillas a quien la pise.', 'Repulsion Trap pushes whoever triggers it 2 cells.', 'Piège de répulsion repousse de 2 cases qui le déclenche.'),
    cp('pull', 2, 4162929758, 'Trampa de atracción atrae 2 casillas a quien la pise.', 'Attraction Trap pulls whoever triggers it 2 cells.', 'Piège d\'attraction attire de 2 cases qui le déclenche.'),
    cp('teleport', 2, 4148660049, 'Trampa de teletransporte envía al objetivo a la otra trampa (hasta 6 casillas).', 'Teleportation Trap sends the target to the other trap (up to 6 cells).', 'Piège de téléportation envoie la cible vers l\'autre piège (jusqu\'à 6 cases).'),
    cp('teleport', 3, 3706299833, 'Astuto: se teletransporta detrás del objetivo.', 'Wily: teleports behind the target.', 'Rusé : se téléporte derrière la cible.'),
  ],
  xelor: [
    c('support', 3, 3097237492, 'Sinistro da PA a los aliados al final de su turno.', 'Sinistro gives allies AP at the end of its turn.', 'Sinistro donne des PA aux alliés à la fin de son tour.'),
    c('heal', 1, 3097237492, 'Sinistro también cura a los aliados según su vida perdida.', 'Sinistro also heals allies based on missing HP.', 'Sinistro soigne aussi les alliés selon leurs PV perdus.'),
    c('control', 2, 3693455262, 'Quita 3 PA al enemigo.', 'Removes 3 AP from the enemy.', 'Retire 3 PA à l\'ennemi.'),
    cp('teleport', 2, 3907194268, 'Tempus Fugit teletransporta al objetivo a la hora actual (hasta 6 casillas).', 'Tempus Fugit teleports the target to the current hour (up to 6 cells).', 'Tempus Fugit téléporte la cible à l\'heure actuelle (jusqu\'à 6 cases).'),
    cp('teleport', 2, 2855140322, 'Paradoja teletransporta simétricamente a los objetivos de la zona.', 'Paradox teleports the targets in the area symmetrically.', 'Paradoxe téléporte symétriquement les cibles de la zone.'),
    cp('swap', 1, 1381123216, 'Bajo cuerda intercambia posiciones si la casilla está ocupada.', 'Underhand switches places if the cell is occupied.', 'Sous le manteau échange les places si la case est occupée.'),
  ],
  zurcarak: [
    c('revive', 3, 2131594746, 'Revive a un aliado con el 25 % de sus PdV máximos.', 'Revives an ally with 25% max HP.', 'Ranime un allié avec 25 % de ses PV max.'),
    c('heal', 2, 2469229602, 'Cura a los aliados y roba vida a los enemigos.', 'Heals allies and steals life from enemies.', 'Soigne les alliés et vole la vie des ennemis.', 'heal'),
    c('heal', 1, 101471877, 'Cura a un aliado y le da 1 PM y 1 PW.', 'Heals an ally and gives 1 MP and 1 WP.', 'Soigne un allié et lui donne 1 PM et 1 PW.'),
    c('support', 1, 101471877, 'Da 1 PM y 1 PW a un aliado.', 'Gives an ally 1 MP and 1 WP.', 'Donne 1 PM et 1 PW à un allié.'),
    cp('push', 2, 4112117538, 'Bastos empuja 2 casillas a los objetivos adyacentes.', 'Clubs pushes adjacent targets 2 cells.', 'Bâtons repousse de 2 cases les cibles adjacentes.'),
    cp('pull', 3, 2622927442, 'Lengua áspera atrae 2 casillas a distancia (hasta 5).', 'Rough Tongue pulls 2 cells at up to 5 range.', 'Langue râpeuse attire de 2 cases jusqu\'à 5 de portée.'),
  ],
  aniripsa: [
    c('heal', 3, 1306163655, 'La clase con más curas; Regeneración es su cura fuerte.', 'The class with the most healing; Regeneration is its strong heal.', 'La classe la plus riche en soins ; Régénération est son gros soin.', 'heal'),
    c('heal', 1, 733187938, 'Cura disponible en cualquier rol.', 'Healing available in any role.', 'Soin disponible dans tous les rôles.'),
    c('revive', 3, 236446319, 'Revive a un aliado con el 30 % de sus PdV máximos.', 'Revives an ally with 30% max HP.', 'Ranime un allié avec 30 % de ses PV max.'),
    cp('push', 3, 2249118235, 'Repulsión empuja 2 casillas a distancia sin gastar PA.', 'Repulsion pushes 2 cells at range for no AP.', 'Répulsion repousse de 2 cases à distance sans PA.'),
  ],
  yopuka: [
    c('support', 3, 2230276261, 'Da +15 % de daño y 1 PM a los aliados cercanos.', 'Gives nearby allies +15% damage and 1 MP.', 'Donne +15 % de dégâts et 1 PM aux alliés proches.'),
    cp('teleport', 3, 2679397925, 'Salto: se teletransporta hasta 5 casillas.', 'Jump: teleports up to 5 cells.', 'Saut : se téléporte jusqu\'à 5 cases.'),
  ],
  ocra: [
    c('control', 2, 324226730, 'Quita 3 PM, o 5 con Disparo de precisión.', 'Removes 3 MP, or 5 with Precision Shot.', 'Retire 3 PM, ou 5 avec Tir de précision.'),
    cp('push', 3, 556243841, 'Flecha de retirada empuja 3 casillas, 6 con Disparo de precisión.', 'Retreat Arrow pushes 3 cells, 6 with Precision Shot.', 'Flèche de recul repousse de 3 cases, 6 avec Tir de précision.'),
    cp('teleport', 3, 950482915, 'Baliza furtiva: se teletransporta a la casilla elegida (3 a 6).', 'Beacon Sneakin\': teleports to the chosen cell (3 to 6).', 'Balise furtive : se téléporte à la case choisie (3 à 6).'),
  ],
  sadida: [
    c('heal', 2, 4215691195, 'Cura a los aliados además de dañar.', 'Heals allies as well as dealing damage.', 'Soigne les alliés en plus d\'infliger des dégâts.', 'heal'),
    c('debuff', 1, 2727000349, '−50 de resistencia elemental durante 2 turnos.', '−50 Elemental Resistance for 2 turns.', '−50 de résistance élémentaire pendant 2 tours.'),
    c('control', 1, 1599412904, 'Quita 1 PM al enemigo.', 'Removes 1 MP from the enemy.', 'Retire 1 PM à l\'ennemi.'),
    cp('pull', 3, 1155117847, 'K\'mir atrae 2 casillas al objetivo.', 'K\'mir pulls the target 2 cells.', 'K\'mir attire la cible de 2 cases.'),
  ],
  sacrogrito: [
    c('protect', 3, 3464931865, 'Puede sacrificarse por un aliado para protegerlo.', 'Can sacrifice itself to protect an ally.', 'Peut se sacrifier pour protéger un allié.', 'tank'),
    c('protect', 1, 3364540755, 'Da armadura equivalente al 20 % de los PdV máximos del objetivo.', 'Gives armor worth 20% of the target\'s max HP.', 'Donne une armure de 20 % des PV max de la cible.'),
    c('debuff', 2, 1760451441, '−150 de resistencia al portador, a cambio de que haga +30 % de daño al Sacrógrito.', '−150 resistance on the bearer, who deals +30% damage to the Sacrier.', '−150 de résistance sur le porteur, qui inflige +30 % de dégâts au Sacrieur.'),
    cp('pull', 3, 3859709041, 'Atracción atrae 6 casillas desde hasta 7 de distancia.', 'Attraction pulls 6 cells from up to 7 away.', 'Attraction attire de 6 cases depuis 7 de portée.'),
    cp('pull', 2, 3074194437, 'Locura atrae a los objetivos alrededor de la casilla elegida.', 'Insanity pulls the targets around the chosen cell.', 'Folie attire les cibles autour de la case choisie.'),
    cp('swap', 3, 3518294309, 'Transposición intercambia posiciones con el objetivo (2 a 6).', 'Transposition switches places with the target (2 to 6).', 'Transposition échange les places avec la cible (2 à 6).'),
    cp('teleport', 3, 1477581367, 'Velocidad luz: se teletransporta a la casilla elegida.', 'Light Speed: teleports to the chosen cell.', 'Vitesse lumière : se téléporte à la case choisie.'),
  ],
  pandawa: [
    c('protect', 2, 1823628150, 'Se da armadura y +100 de resistencia durante 1 turno.', 'Gives itself armor and +100 resistance for 1 turn.', 'Se donne de l\'armure et +100 de résistance pendant 1 tour.', 'tank'),
    c('debuff', 2, 3698074602, '−100 de resistencia durante 1 turno a un objetivo mareado.', '−100 resistance for 1 turn on a Dizzy target.', '−100 de résistance pendant 1 tour sur une cible étourdie.'),
    c('heal', 1, 662752163, 'Cura además de dañar.', 'Heals as well as dealing damage.', 'Soigne en plus d\'infliger des dégâts.'),
    cp('teleport', 2, 2222681896, 'Salto de barril: se teletransporta (hasta 5) si la casilla está libre.', 'Barrelhop: teleports (up to 5) if the cell is free.', 'Saut de tonneau : se téléporte (jusqu\'à 5) si la case est libre.'),
  ],
  tymador: [
    c('debuff', 1, 1346497027, '−50 de resistencia elemental.', '−50 Elemental Resistance.', '−50 de résistance élémentaire.'),
    c('control', 2, 1762922172, 'Quita 3 PM al enemigo.', 'Removes 3 MP from the enemy.', 'Retire 3 PM à l\'ennemi.'),
    cp('push', 3, 721024046, 'Trabucazo empuja 2 casillas a distancia.', 'Blunderbuss pushes 2 cells at range.', 'Tromblon repousse de 2 cases à distance.'),
    cp('pull', 3, 2941263785, 'En cruz atrae 5 casillas a distancia (hasta 10).', 'Crosswise pulls 5 cells at up to 10 range.', 'En croix attire de 5 cases jusqu\'à 10 de portée.'),
    cp('pull', 2, 2119139013, 'Imán atrae 3 casillas a los alineados, pero debe apuntar a una bomba.', 'Magnet pulls aligned fighters 3 cells, but must target a bomb.', 'Aimant attire de 3 cases les alignés, mais doit viser une bombe.'),
    cp('swap', 3, 273725650, 'Treta intercambia posiciones con el objetivo (hasta 6).', 'Ruse switches places with the target (up to 6).', 'Ruse échange les places avec la cible (jusqu\'à 6).'),
    cp('swap', 2, 3313548430, 'Trampa intercambia posiciones con ciertos objetivos.', 'Cheating switches places with certain targets.', 'Triche échange les places avec certaines cibles.'),
  ],
  zobal: [
    c('protect', 2, 3454637746, 'Da +50 de resistencia a los aliados a 4 casillas o menos.', 'Gives +50 resistance to allies within 4 cells.', 'Donne +50 de résistance aux alliés à 4 cases ou moins.', 'tank'),
    c('revive', 3, 3519416140, 'Revive a un aliado con el 30 % de sus PdV máximos.', 'Revives an ally with 30% max HP.', 'Ranime un allié avec 30 % de ses PV max.'),
    c('support', 2, 564796608, 'Da 2 PM y armadura a un aliado durante 2 turnos.', 'Gives an ally 2 MP and armor for 2 turns.', 'Donne 2 PM et de l\'armure à un allié pendant 2 tours.'),
    c('debuff', 1, 108262377, '−50 de resistencia elemental.', '−50 Elemental Resistance.', '−50 de résistance élémentaire.'),
    cp('pull', 2, 2788878790, 'Neurosis atrae 3 casillas a los alineados.', 'Neurosis pulls aligned targets 3 cells.', 'Névrose attire de 3 cases les alignés.'),
    cp('swap', 3, 505118565, 'Dislocación intercambia posiciones con el objetivo (hasta 5).', 'Dislocation switches places with the target (up to 5).', 'Dislocation échange les places avec la cible (jusqu\'à 5).'),
    cp('teleport', 3, 3888033637, 'Acrobacias: se teletransporta junto a un combatiente a 6 casillas.', 'Acrobatics: teleports next to a fighter 6 cells away.', 'Acrobaties : se téléporte près d\'un combattant à 6 cases.'),
  ],
  steamer: [
    c('debuff', 3, 1447144933, '−150 de resistencia elemental a un enemigo durante 2 turnos.', '−150 Elemental Resistance on an enemy for 2 turns.', '−150 de résistance élémentaire sur un ennemi pendant 2 tours.'),
    c('support', 2, 1447144933, 'Da +2 de alcance y +30 % de daño a distancia a un aliado.', 'Gives an ally +2 Range and +30% ranged damage.', 'Donne +2 de portée et +30 % de dégâts à distance à un allié.'),
    c('protect', 1, 4210275767, 'Da a un aliado armadura del 10 % de sus PdV máximos.', 'Gives an ally armor worth 10% of their max HP.', 'Donne à un allié une armure de 10 % de ses PV max.'),
    cp('pull', 3, 3471659918, 'Garra martillo atrae 2 casillas a un aliado o enemigo.', 'Hammer Claw pulls an ally or enemy 2 cells.', 'Griffe marteau attire de 2 cases un allié ou un ennemi.'),
  ],
  selotrop: [
    c('support', 2, 2492617042, 'Lo que pasa por sus portales gana +25 % de daño y de cura.', 'Spells through its portals gain +25% damage and healing.', 'Les sorts passant par ses portails gagnent +25 % de dégâts et de soins.'),
    c('heal', 1, 3440095827, 'Cura además de dañar.', 'Heals as well as dealing damage.', 'Soigne en plus d\'infliger des dégâts.'),
    c('control', 1, 2589217030, 'Quita 2 PA o 2 PM según su estado.', 'Removes 2 AP or 2 MP depending on its state.', 'Retire 2 PA ou 2 PM selon son état.'),
    cp('push', 2, 1390230726, 'Torbellino empuja 2 casillas (estado Calma).', 'Whirlwind pushes 2 cells (Calm).', 'Tourbillon repousse de 2 cases (état Calme).'),
    cp('pull', 2, 1390230726, 'Torbellino atrae 2 casillas (estado Exaltado).', 'Whirlwind pulls 2 cells (Exalted).', 'Tourbillon attire de 2 cases (état Exalté).'),
    cp('swap', 2, 108797664, 'Inundación intercambia posiciones (estado Calma).', 'Flood switches places (Calm).', 'Inondation échange les places (état Calme).'),
  ],
  hipermago: [
    c('support', 1, 3028558902, 'Da +20 % de daño a un aliado durante 1 turno.', 'Gives an ally +20% damage for 1 turn.', 'Donne +20 % de dégâts à un allié pendant 1 tour.'),
    c('heal', 1, 1849148515, 'Cura además de dañar.', 'Heals as well as dealing damage.', 'Soigne en plus d\'infliger des dégâts.'),
    c('protect', 1, 2167178146, 'Da armadura, que se duplica en ciertas condiciones.', 'Gives armor, doubled under certain conditions.', 'Donne de l\'armure, doublée sous certaines conditions.'),
    c('control', 1, 4115469629, 'Quita 1 PA o 1 PM al enemigo.', 'Removes 1 AP or 1 MP from the enemy.', 'Retire 1 PA ou 1 PM à l\'ennemi.'),
    cp('pull', 2, 3799450656, 'Pulsación atrae 2 casillas a los alineados al invocar el fuego fatuo.', 'Pulsation pulls aligned targets 2 cells when summoning the Will-o-the-Wisp.', 'Pulsation attire de 2 cases les alignés à l\'invocation du feu follet.'),
    cp('swap', 3, 4006738486, 'Espejismo intercambia posiciones con el objetivo.', 'Mirage switches places with the target.', 'Mirage échange les places avec la cible.'),
    cp('teleport', 2, 2138938567, 'Principio Valere teletransporta según la última runa.', 'Principio Valere teleports depending on the last rune.', 'Principio Valere téléporte selon la dernière rune.'),
  ],
  uginak: [
    c('protect', 2, 241494416, 'Gana armadura por cada enemigo golpeado.', 'Gains armor for each enemy hit.', 'Gagne de l\'armure par ennemi touché.', 'tank'),
    c('support', 2, 2041106158, 'Más daño por aliado en la zona, hasta +25 %.', 'More damage per ally in the area, up to +25%.', 'Plus de dégâts par allié dans la zone, jusqu\'à +25 %.'),
    c('control', 2, 3245529915, 'Coloca un Canino que quita 3 PM al inicio del turno.', 'Places a Canine that removes 3 MP at start of turn.', 'Place un Canin qui retire 3 PM en début de tour.'),
    cp('pull', 2, 3482240081, 'Cazador atrae 3 casillas al objetivo.', 'Hunter pulls the target 3 cells.', 'Chasseur attire la cible de 3 cases.'),
  ],
};

// Peso de cada necesidad en la puntuación general.
const WEIGHTS: Record<Need, number> = { protect: 3, heal: 3, revive: 0.5, debuff: 1, support: 1, control: 0.5, melee: 1.5, ranged: 1.5, place: 1 };
// Solo para bestTrio (deprecado): pesos del antiguo contenido de 3.
const TRIO_WEIGHTS: Record<Need, number> = { protect: 4, heal: 4, revive: 0.5, debuff: 0.5, support: 0.5, control: 0.25, melee: 1.5, ranged: 1.5, place: 1 };

const DAMAGE_ROLES: Role[] = ['melee', 'dist'];
/** @deprecated se borra en Task 6 */
export const contentSize = (content: Content): TeamSize => (content === 'trio' ? 3 : 6);

/** Aportes que cuentan para un personaje según el rol que juega. */
export const contributions = (m: Member) => (KIT[m.classId] ?? []).filter((x) => !x.role || x.role === m.role);
export const contributionNote = (x: Contribution) => x.note[getLang()];

/** Mejor aporte (power) de colocación del personaje por subtipo, según el rol que juega. */
export function memberPlaces(m: Member): Map<PlaceKind, number> {
  const out = new Map<PlaceKind, number>();
  for (const x of contributions(m)) {
    if (x.need === 'place' && x.place) out.set(x.place, Math.max(out.get(x.place) ?? 0, x.power));
  }
  return out;
}

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

function weightedScore(team: Member[], w: Record<Need, number>, wanted: number): number {
  const cov = coverage(team);
  const dealers = team.filter((m) => DAMAGE_ROLES.includes(m.role)).length;
  return NEEDS.reduce((sum, n) => sum + (w[n] * cov[n]) / 3, 0) + (3 * Math.min(dealers, wanted)) / wanted;
}

/** Puntuación general de un grupo (pensada para 6 personajes). */
export const scoreTeam = (team: Member[]): number => weightedScore(team, WEIGHTS, 3);

const candidates = (): Member[] => CLASSES.flatMap((cl) => cl.roles.map((role) => ({ classId: cl.id, role })));

/**
 * Búsqueda del mejor grupo de `size` que incluye a los fijados, según `score`: añade por ganancia y luego prueba
 * cambios uno a uno (sin repetir clase) hasta que ninguno mejora.
 */
export function searchTeam(fixed: Member[], size: number, score: (t: Member[]) => number): Member[] {
  const team = [...fixed].slice(0, size);
  const free = (cur: Member[]) => candidates().filter((m) => !cur.some((x) => x.classId === m.classId));
  while (team.length < size) {
    let best: Member | null = null;
    let top = -Infinity;
    for (const m of free(team)) {
      const s = score([...team, m]);
      if (s > top + 1e-9) { top = s; best = m; }
    }
    team.push(best!);
  }
  for (let improved = true; improved;) {
    improved = false;
    for (let i = fixed.length; i < team.length; i++) {
      const others = team.filter((_, j) => j !== i);
      const top = score(team);
      const better = free(others)
        .map((m) => ({ m, s: score([...others, m]) }))
        .reduce((a, b) => (b.s > a.s + 1e-9 ? b : a), { m: team[i], s: top });
      if (better.s > top + 1e-9) { team[i] = better.m; improved = true; }
    }
  }
  return team;
}

/** @deprecated se borra en Task 6 (el contenido se descarta salvo 'trio', que sigue dando 3 personajes). */
export const recommendTeam = (fixed: Member[], content: Content): Member[] =>
  content === 'trio'
    ? searchTeam(fixed, 3, (t) => weightedScore(t, TRIO_WEIGHTS, 1))
    : searchTeam(fixed, 6, scoreTeam);

/** @deprecated se borra en Task 6 */
export function bestTrio(team: Member[]): Member[] {
  let best = team.slice(0, 3);
  let top = -Infinity;
  for (let i = 1; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      const trio = [team[0], team[i], team[j]];
      const s = weightedScore(trio, TRIO_WEIGHTS, 1);
      if (s > top + 1e-9) { top = s; best = trio; }
    }
  }
  return best;
}

/** @deprecated se borra en Task 6 */
export function lostNeeds(before: Member[], after: Member[]): Need[] {
  const rank: Record<NeedStatus, number> = { ok: 2, weak: 1, none: 0 };
  const a = coverage(before);
  const b = coverage(after);
  return NEEDS.filter((n) => rank[needStatus(b[n])] < rank[needStatus(a[n])]);
}

/** Necesidad por la que un personaje está en el grupo, y si nadie más la cubre igual de bien. */
export function mainNeed(team: Member[], index: number): { need: Need; only: boolean } {
  const w = WEIGHTS;
  const mine = memberPower(team[index]);
  const others = team.filter((_, i) => i !== index).map(memberPower);
  const gain = (n: Need) => w[n] * Math.max(0, mine[n] - Math.max(0, ...others.map((p) => p[n])));
  const value = (n: Need) => gain(n) * 10 + w[n] * mine[n];
  const need = NEEDS.reduce((a, b) => (value(b) > value(a) ? b : a));
  return { need, only: mine[need] > 0 && gain(need) > 0 };
}

/** Rol con el que una clase rinde más en el hueco de `index`. */
export function bestRole(classId: string, team: Member[], index: number): Role {
  const others = team.filter((_, i) => i !== index);
  const roles = CLASSES.find((x) => x.id === classId)!.roles;
  return roles.reduce((a, b) => (
    scoreTeam([...others, { classId, role: b }]) > scoreTeam([...others, { classId, role: a }]) + 1e-9 ? b : a
  ));
}

/** Reemplazos para un hueco: primero las clases que cubren lo mismo, de mejor a peor. */
export function replacements(team: Member[], index: number, max = 4): Member[] {
  const { need } = mainNeed(team, index);
  return CLASSES.filter((x) => !team.some((m) => m.classId === x.id))
    .map((x) => ({ classId: x.id, role: bestRole(x.id, team, index) }))
    .filter((m) => memberPower(m)[need] > 0)
    .map((m) => ({ m, s: scoreTeam(team.map((x, i) => (i === index ? m : x))) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, max)
    .map((x) => x.m);
}
