import type { Cell } from '../../sim/formulas';
import type { Dungeon, L10n, Piece, Step } from '../types';

// Donjon des Crocodailles (171-185). Fuente: https://wakfu.guide/donjons/171-185/ (sección «Donjon des Crocodailles»).
// Imágenes revisadas: d50 (Éventreur), d51 (Crocodaille Ancestral/chamán: cura y -50 % monoblanco), d52-d54 (marca «Capturé»/«Proie
// Ensanglantée» del cazador), d56 (ficha «Écailles Renforcées»: +500 res. elementales hasta sufrir una colisión, aura verde),
// d57 (ficha del Roi des Crocodailles), d59 (agujeros «Noyades» con flechas: no alinearse con ellos). No hay diagrama de posiciones
// de la sala: tablero y casillas son un ejemplo esquemático. La guía no dice qué 3 monstruos de la sala 1 llevan las escamas
// reforzadas; se muestran como «Crocodaille 1-3». Sin comprobar en el juego.

const T = (es: string, en: string, fr: string): L10n => ({ es, en, fr });

const pj = (n: number, cell: Cell): Piece => ({
  id: `pj${n}`, kind: 'char', cell,
  name: T(`Personaje ${n}`, `Character ${n}`, `Personnage ${n}`),
});

const croco = (n: number, cell: Cell): Piece => ({
  id: `mob${n}`, kind: 'mob', cell, invulnerable: true,
  name: {
    es: `Crocodaille ${n}`, // nombre pendiente: es
    en: `Crocodyl ${n}`, // nombre pendiente: en
    fr: `Crocodaille ${n}`,
  },
});

// Paso de colisión: el personaje es desplazado hacia el monstruo (empuje, tp, etc.), desliza 3 casillas más y choca.
// El desplazamiento inicial de 1 casilla es un ejemplo; el deslizamiento acaba al chocar contra el objetivo.
const slide = (who: string, y: number, target: string, es: string, en: string, fr: string): Step => ({
  actor: who,
  text: T(es, en, fr),
  changes: [
    { type: 'move', piece: who, to: { x: 4, y }, path: [{ x: 2, y }, { x: 3, y }] },
    { type: 'zone', zone: { kind: 'collision', cells: [{ x: 5, y }] } },
    { type: 'aura', piece: target, on: false },
  ],
});

const d: Dungeon = {
  id: 'crocodailles',
  tier: [171, 185],
  name: {
    es: 'Mazmorra de los Crocodailles', // nombre pendiente: es
    en: 'Crocodyl Dungeon', // nombre pendiente: en
    fr: 'Donjon des Crocodailles',
  },
  guide: 'https://wakfu.guide/donjons/171-185/',
  rooms: [
    {
      id: 'room1',
      name: { es: 'Sala 1', en: 'Room 1', fr: 'Salle 1' },
      size: { w: 8, h: 7 },
      pieces: [
        croco(1, { x: 5, y: 1 }),
        croco(2, { x: 5, y: 3 }),
        croco(3, { x: 5, y: 5 }),
        pj(1, { x: 1, y: 1 }),
        pj(2, { x: 1, y: 3 }),
        pj(3, { x: 1, y: 5 }),
      ],
      condition: {
        es: 'Hay 3 monstruos con +500 res. elementales (aura verde) hasta que sufren una colisión. Todo desplazamiento desliza 3 casillas más hacia donde mira el personaje.',
        en: 'There are 3 monsters with +500 elemental res. (green aura) until they suffer a collision. Every displacement slides 3 more cells in the direction the character faces.',
        fr: 'Il y a 3 monstres avec +500 rés. élémentaires (aura verte) tant qu’ils ne subissent pas de collision. Tout déplacement glisse de 3 cases de plus dans la direction regardée.',
      },
      duration: {
        es: 'La guía no indica que las escamas vuelvan tras la colisión.',
        en: 'The guide does not say the scales come back after the collision.',
        fr: 'Le guide n’indique pas que les écailles reviennent après la collision.',
      },
      steps: [
        {
          text: T(
            'Situación inicial: los 3 monstruos tienen +500 res. (aura verde); nadie se ha desplazado todavía.',
            'Initial situation: the 3 monsters have +500 res. (green aura); nobody has been displaced yet.',
            'Situation initiale : les 3 monstres ont +500 rés. (aura verte) ; personne n’a encore été déplacé.',
          ),
          changes: [],
        },
        slide('pj1', 1, 'mob1',
          'El Personaje 1 es desplazado hacia el monstruo 1, desliza 3 casillas más y choca: cae su +500 res.',
          'Character 1 is displaced toward monster 1, slides 3 more cells and collides: its +500 res. falls.',
          'Le Personnage 1 est déplacé vers le monstre 1, glisse de 3 cases de plus et le percute : son +500 rés. tombe.'),
        slide('pj2', 3, 'mob2',
          'El Personaje 2 es desplazado hacia el monstruo 2, desliza 3 casillas más y choca: cae su +500 res.',
          'Character 2 is displaced toward monster 2, slides 3 more cells and collides: its +500 res. falls.',
          'Le Personnage 2 est déplacé vers le monstre 2, glisse de 3 cases de plus et le percute : son +500 rés. tombe.'),
        slide('pj3', 5, 'mob3',
          'El Personaje 3 es desplazado hacia el monstruo 3, desliza 3 casillas más y choca: cae su +500 res.',
          'Character 3 is displaced toward monster 3, slides 3 more cells and collides: its +500 res. falls.',
          'Le Personnage 3 est déplacé vers le monstre 3, glisse de 3 cases de plus et le percute : son +500 rés. tombe.'),
        {
          text: T(
            'Los 3 monstruos ya no tienen la protección; también vale empujar a un aliado o monstruo contra ellos.',
            'The 3 monsters no longer have the protection; pushing an ally or monster into them also works.',
            'Les 3 monstres n’ont plus la protection ; pousser un allié ou un monstre sur eux fonctionne aussi.',
          ),
          changes: [],
        },
      ],
    },
    {
      id: 'boss',
      name: { es: 'Boss: Roi Dunil', en: 'Boss: Nyl King', fr: 'Boss : Roi Dunil' }, // nombre pendiente: es
      size: { w: 8, h: 7 },
      pieces: [
        {
          id: 'boss', kind: 'boss', cell: { x: 5, y: 3 }, label: '100 %',
          name: {
            es: 'Roi Dunil', // nombre pendiente: es
            en: 'Nyl King',
            fr: 'Roi Dunil',
          },
        },
        pj(1, { x: 1, y: 3 }),
      ],
      condition: {
        es: 'El boss no es invulnerable al principio, pero lo pasa a ser al llegar al 55 % de PV; hay que provocarle una colisión. Es indesplazable. Cuidado: los desplazamientos deslizan 3 casillas más y los agujeros «Noyades» quitan -2 PM y -33 % PV.',
        en: 'The boss is not invulnerable at first, but becomes so at 55 % HP; you must make it suffer a collision. It cannot be moved. Careful: displacements slide 3 more cells and “Drowning” holes cost -2 MP and -33 % HP.',
        fr: 'Le boss n’est pas invulnérable au début, mais le devient à 55 % de PV ; il faut lui infliger une collision. Il est indéplaçable. Attention : les déplacements glissent de 3 cases de plus et les trous « Noyades » coûtent -2 PM et -33 % PV.',
      },
      duration: {
        es: 'La guía no indica cuánto dura el estado sin invulnerabilidad ni si vuelve a protegerse.',
        en: 'The guide does not say how long the boss stays vulnerable or whether it is protected again.',
        fr: 'Le guide n’indique pas combien de temps le boss reste vulnérable ni s’il se reprotège.',
      },
      steps: [
        {
          text: T(
            'Situación inicial: el boss con todos sus PV; todavía no es invulnerable.',
            'Initial situation: the boss at full HP; it is not invulnerable yet.',
            'Situation initiale : le boss avec tous ses PV ; il n’est pas encore invulnérable.',
          ),
          changes: [],
        },
        {
          actor: 'boss',
          text: T(
            'Al llegar al 55 % de PV el boss pasa a ser invulnerable (aura verde).',
            'On reaching 55 % HP the boss becomes invulnerable (green aura).',
            'À 55 % de PV le boss devient invulnérable (aura verte).',
          ),
          changes: [
            { type: 'label', piece: 'boss', label: '55 %' },
            { type: 'aura', piece: 'boss', on: true },
          ],
        },
        {
          actor: 'pj1',
          text: T(
            'El Personaje 1 es desplazado hacia el boss, desliza 3 casillas más y choca contra él.',
            'Character 1 is displaced toward the boss, slides 3 more cells and collides with it.',
            'Le Personnage 1 est déplacé vers le boss, glisse de 3 cases de plus et le percute.',
          ),
          changes: [
            { type: 'move', piece: 'pj1', to: { x: 4, y: 3 }, path: [{ x: 2, y: 3 }, { x: 3, y: 3 }] },
            { type: 'zone', zone: { kind: 'collision', cells: [{ x: 5, y: 3 }] } },
          ],
        },
        {
          text: T(
            'La colisión quita la invulnerabilidad: se le puede dañar (la guía no dice cuánto dura).',
            'The collision removes the invulnerability: it can be damaged (the guide does not say how long).',
            'La collision retire l’invulnérabilité : on peut le blesser (le guide ne dit pas combien de temps).',
          ),
          changes: [{ type: 'aura', piece: 'boss', on: false }],
        },
      ],
    },
  ],
};

export default d;
