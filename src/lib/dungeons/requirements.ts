import type { Need, PlaceKind } from '../teams';
import type { L10n } from './types';

export interface Requirement {
  need: Need;
  required: boolean;      // true = obligatoria; false = recomendada
  level?: 1 | 2 | 3;      // por defecto 2
  count?: number;         // personajes distintos que deben cumplirla; por defecto 1
  place?: PlaceKind;      // solo con need 'place'; ausente = cualquier subtipo
  why: L10n;              // motivo visible
}

export interface DungeonNeeds { size: 3 | 4 | 6; reqs: Requirement[] }

// Ids aún sin curar; las tareas de curación los van quitando.
export const PENDING = new Set<string>([
  'dragon-cochon',
  'smarrante',
  'cacterre',
  'hagen-glass',
  'potofeu',
  'jawdin',
  'noirespore',
  'wa-wabbit',
  'enutrosor',
  'source-du-mal',
  'e-bou',
  'fabrique-meka',
  'lampionaute',
  'roub-bar',
  'crocodailles',
  'tropikes',
  'gerbouille',
]);

export const REQUIREMENTS: Record<string, DungeonNeeds> = {
  // Guía 36-50: hay que matar los 4 tentáculos para que el jefe salga del agua; vale cualquier daño. Sin exigencias.
  'poulpe': { size: 6, reqs: [] },
  // guía: «Donjon · 3 joueurs» (cabecera de la sección)
  'tour-minerale': { size: 3, reqs: [
    // guía: «Privilégiez une équipe avec pas mal de PO pour pouvoir briser les cailloux rapidement de loin»
    // (también se puede «aller taper le boss au corps-à-corps»: recomendada)
    { need: 'ranged', required: false, why: {
      es: 'Las barreras tapan la línea de visión: con alcance se rompen rápido las piedras desde lejos.',
      en: 'The barriers block line of sight: with range you break the stones quickly from afar.',
      fr: 'Les barrières bloquent la ligne de vue : avec de la PO on brise vite les cailloux de loin.',
    } },
  ] },
  'excarnus': { size: 6, reqs: [
    // guía: «il faudra les taper en mêlée seulement ou à 3PO max»; «au moins un personnage qui pourra très vite courir»
    // Recomendada: a 3 PO también vale, así que un equipo a distancia puede hacerlo.
    { need: 'melee', required: false, why: {
      es: 'Los tótems no reciben daño a distancia: hay que correr hasta ellos y pegarles cuerpo a cuerpo o a 3 PO como máximo.',
      en: 'The totems take no ranged damage: someone must run to them and hit in melee or from 3 range at most.',
      fr: 'Les totems ne prennent pas de dégâts à distance : il faut courir les taper en mêlée ou à 3 PO max.',
    } },
    // guía: «Essayez de poser -200 de résistances sur le boss rapidement après avoir tué le totem terre maudite»
    { need: 'debuff', required: false, why: {
      es: 'Tras desactivar el tótem «tierra maldita», bajar 200 res. al jefe ayuda a matarlo antes de que se reactive.',
      en: 'After disabling the cursed-earth totem, lowering the boss by 200 res. helps kill it before it reactivates.',
      fr: 'Après le totem terre maudite, poser -200 rés. au boss aide à le tuer avant qu’il ne redevienne actif.',
    } },
  ] },
  'corbeau-cave': { size: 6, reqs: [
    // guía: «Lancer des sorts de soins/boost sur les renvois de monstres vous permettra de vous soigner tout en retirant leur protection»
    // Recomendada: el daño indirecto o de zona tampoco se refleja.
    { need: 'heal', required: false, why: {
      es: 'Una cura o un boost sobre un monstruo con aura violeta le quita el reflejo y te cura.',
      en: 'A heal or boost on a monster with the purple aura removes its reflect and heals you.',
      fr: 'Un soin ou un boost sur un monstre à l’aura violette lui retire son renvoi et vous soigne.',
    } },
  ] },
  // Guía 66-80: hace falta un placador con «au moins 501 de tacle en stasis 3» junto al jefe; el placaje es de
  // equipo/estadísticas, no de clase, y no hay necesidad que lo represente. Sin exigencias.
  'truchiere': { size: 6, reqs: [] },
  // Guía 81-95: la invulnerabilidad se quita transformándose en Slek en el glifo blanco; lo hace cualquier clase. Sin exigencias.
  'slekymoses': { size: 6, reqs: [] },
  // Guía 81-95: matar el escarabajo del elemento del equipo con quien juega tras el jefe; depende del elemento y del
  // orden de turno, no de la clase. Sin exigencias.
  'scarriere': { size: 6, reqs: [] },
  // Guía 96-110: el hechizo especial lo da matar un corbac y lo usa cualquiera; los empujones del jefe se evitan
  // estabilizándose («vous pouvez vous stabiliser»). Sin exigencias.
  'corbeau-noir': { size: 6, reqs: [] },
  'arene-dansante': { size: 6, reqs: [
    // guía: «Les personnages de « dégâts mêlée » ne seront donc pas très efficaces au boss»; «prenez plutôt une team distance !»
    { need: 'ranged', required: false, why: {
      es: 'El jefe devuelve el daño salvo desde la PO de su arritmia (1 a 7): un equipo a distancia lo tiene más fácil.',
      en: 'The boss reflects damage unless hit from its arrhythmia range (1 to 7): a ranged team has it easier.',
      fr: 'Le boss renvoie les dégâts sauf depuis la PO de son arythmie (1 à 7) : une team distance s’en sort mieux.',
    } },
  ] },
  // Guía 96-110: golpear al jefe por la espalda invoca sombreros (1 por personaje y turno); lo hace cualquier clase
  // y los sombreros se acumulan entre turnos. Sin exigencias.
  'magik-riktus': { size: 6, reqs: [] },
  'dragon-cochon': { size: 6, reqs: [] }, // pendiente de curar
  'smarrante': { size: 6, reqs: [] }, // pendiente de curar
  'cacterre': { size: 6, reqs: [] }, // pendiente de curar
  'hagen-glass': { size: 6, reqs: [] }, // pendiente de curar
  'potofeu': { size: 6, reqs: [] }, // pendiente de curar
  'jawdin': { size: 6, reqs: [] }, // pendiente de curar
  'noirespore': { size: 6, reqs: [] }, // pendiente de curar
  'wa-wabbit': { size: 6, reqs: [] }, // pendiente de curar
  'enutrosor': { size: 6, reqs: [] }, // pendiente de curar
  'source-du-mal': { size: 6, reqs: [] }, // pendiente de curar
  'e-bou': { size: 6, reqs: [] }, // pendiente de curar
  'fabrique-meka': { size: 6, reqs: [] }, // pendiente de curar
  'lampionaute': { size: 6, reqs: [] }, // pendiente de curar
  'roub-bar': { size: 6, reqs: [] }, // pendiente de curar
  'crocodailles': { size: 6, reqs: [] }, // pendiente de curar
  'tropikes': { size: 6, reqs: [] }, // pendiente de curar
  'gerbouille': { size: 6, reqs: [] }, // pendiente de curar
};

export const needsOf = (id: string): DungeonNeeds => {
  const n = REQUIREMENTS[id];
  if (!n) throw new Error(`Sin exigencias para la mazmorra: ${id}`);
  return n;
};
