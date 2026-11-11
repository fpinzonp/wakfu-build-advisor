import type { Dungeon, L10n, Piece } from '../types';

// Jawdin de la Weine (126-140). Fuente: https://wakfu.guide/donjons/126-140/ (sección «Jawdin de la Weine»).
// Imágenes revisadas: d496 y d497 (cawottes «piégées» a 1 PV junto al boss; la ficha dice «Cawotte piégée (1 PV)»), d495
// (cawottes de las salas), d498 (daño en todo el mapa del boss vulnerable), d499 (ídem), d492-d494 (Wo/Ti Wabbit). Solo se
// anima la sala del boss: invulnerable hasta estar dentro de la explosión (3 PO) de una Cawotte que llega a 0 PV; vulnerable
// 1 turno. Los PV de las cawottes (1 a 4 al aparecer, -1 por turno), posiciones y personajes son un ejemplo. El boss no tiene
// nombre propio en la guía. Sin comprobar en el juego.

const T = (es: string, en: string, fr: string): L10n => ({ es, en, fr });

const turns: L10n = T('Turnos vulnerable', 'Turns vulnerable', 'Tours vulnérable');

const pj = (n: number, cell: Piece['cell']): Piece => ({
  id: `pj${n}`, kind: 'char', cell,
  name: T(`Personaje ${n}`, `Character ${n}`, `Personnage ${n}`),
});

const cawotte = (id: string, cell: Piece['cell'], label: string): Piece => ({
  id, kind: 'mob', cell, label,
  name: T('Cawotte piégée', 'Cawotte piégée', 'Cawotte piégée'), // nombre pendiente: es, en
});

const d: Dungeon = {
  id: 'jawdin',
  tier: [126, 140],
  name: T('Jawdin de la Weine', 'Jawdin de la Weine', 'Jawdin de la Weine'), // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/126-140/',
  rooms: [
    {
      id: 'boss',
      name: T('Boss', 'Boss', 'Boss'),
      size: { w: 11, h: 9 },
      pieces: [
        {
          id: 'boss', kind: 'boss', cell: { x: 2, y: 2 }, invulnerable: true,
          name: T('Jefe del Jawdin', 'Jawdin boss', 'Boss du Jawdin'), // nombre pendiente: es, en, fr (la guía no lo nombra)
        },
        cawotte('c1', { x: 7, y: 3 }, '1 PV'),
        cawotte('c2', { x: 8, y: 7 }, '3 PV'),
        pj(1, { x: 3, y: 6 }),
        pj(2, { x: 6, y: 6 }),
      ],
      condition: T(
        'El boss es invulnerable (aura verde). Cada turno hace aparecer Cawottes (1 a 4 PV) que pierden 1 PV por turno y explotan (3 PO) al llegar a 0.',
        'The boss is invulnerable (green aura). Each turn it spawns Cawottes (1 to 4 HP) that lose 1 HP per turn and explode (3 range) at 0.',
        'Le boss est invulnérable (aura verte). Chaque tour il fait apparaître des Cawottes (1 à 4 PV) qui perdent 1 PV par tour et explosent (3 PO) à 0.',
      ),
      duration: T(
        'Vulnerable durante 1 turno. Después gana 10 PM y un hechizo que daña (tierra) todo el mapa: se evita estando al cuerpo a cuerpo de una Cawotte.',
        'Vulnerable for 1 turn. Then it gains 10 MP and a spell hitting (earth) the whole map: avoid it by standing next to a Cawotte.',
        'Vulnérable 1 tour. Ensuite il gagne 10 PM et un sort qui tape (terre) toute la map : on l’évite au corps à corps d’une Cawotte.',
      ),
      steps: [
        {
          text: T(
            'Situación inicial: el boss es invulnerable; hay una Cawotte a 1 PV y otra a 3 PV (ejemplo).',
            'Initial situation: the boss is invulnerable; there is a Cawotte at 1 HP and another at 3 HP (example).',
            'Situation initiale : le boss est invulnérable ; il y a une Cawotte à 1 PV et une autre à 3 PV (exemple).',
          ),
          changes: [],
        },
        {
          actor: 'pj1',
          text: T(
            'El Personaje 1 coloca al boss cerca de la Cawotte a 1 PV, dentro de su explosión de 3 PO.',
            'Character 1 places the boss next to the 1 HP Cawotte, inside its 3-range explosion.',
            'Le Personnage 1 place le boss près de la Cawotte à 1 PV, dans son explosion de 3 PO.',
          ),
          changes: [{ type: 'move', piece: 'boss', to: { x: 5, y: 3 } }],
        },
        {
          text: T(
            'Llega su turno: la Cawotte pierde 1 PV y llega a 0, y la otra baja a 2 PV.',
            'Its turn comes: the Cawotte loses 1 HP and reaches 0, and the other drops to 2 HP.',
            'Son tour arrive : la Cawotte perd 1 PV et arrive à 0, et l’autre passe à 2 PV.',
          ),
          changes: [
            { type: 'label', piece: 'c1', label: '0 PV' },
            { type: 'label', piece: 'c2', label: '2 PV' },
          ],
        },
        {
          text: T(
            'La Cawotte explota (3 PO) con el boss dentro: su invulnerabilidad cae durante 1 turno.',
            'The Cawotte explodes (3 range) with the boss inside: its invulnerability falls for 1 turn.',
            'La Cawotte explose (3 PO) avec le boss dedans : son invulnérabilité tombe pendant 1 tour.',
          ),
          changes: [
            { type: 'zone', zone: { kind: 'explosion', center: { x: 7, y: 3 }, radius: 3 } },
            { type: 'remove', piece: 'c1' },
            { type: 'aura', piece: 'boss', on: false },
            { type: 'counter', id: 'turns', name: turns, value: '1' },
          ],
        },
        {
          actor: 'pj2',
          text: T(
            'El Personaje 2 ataca al boss mientras es vulnerable.',
            'Character 2 attacks the boss while it is vulnerable.',
            'Le Personnage 2 attaque le boss pendant qu’il est vulnérable.',
          ),
          changes: [{ type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 3 }] } }],
        },
        {
          actor: 'pj1',
          text: T(
            'El boss, vulnerable, gana 10 PM y daño en todo el mapa: todos se ponen al cuerpo a cuerpo de una Cawotte.',
            'Vulnerable, the boss gains 10 MP and a map-wide damage spell: all characters stand next to a Cawotte.',
            'Le boss, vulnérable, gagne 10 PM et un sort sur toute la map : tous se placent au corps à corps d’une Cawotte.',
          ),
          changes: [
            { type: 'move', piece: 'pj1', to: { x: 7, y: 7 }, path: [{ x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }] },
            { type: 'move', piece: 'pj2', to: { x: 8, y: 6 } },
          ],
        },
        {
          text: T(
            'Termina ese turno: el boss vuelve a ser invulnerable (deducido, la guía solo dice «pour 1 tour»).',
            'That turn ends: the boss is invulnerable again (deduced, the guide only says “for 1 turn”).',
            'Ce tour se termine : le boss redevient invulnérable (déduit, le guide dit seulement « pour 1 tour »).',
          ),
          changes: [
            { type: 'aura', piece: 'boss', on: true },
            { type: 'counter', id: 'turns', name: turns, value: null },
          ],
        },
      ],
    },
  ],
};

export default d;
