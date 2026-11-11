import type { Cell } from '../../sim/formulas';
import type { Dungeon, L10n, Piece, Step } from '../types';

// Donjon Équipage du Poulpe (36-50). Fuente: https://wakfu.guide/donjons/36-50/ (imágenes d322 y d339).
// d322: 4 tentáculos repartidos por la sala; d339: zona de radio 2 de un tentáculo.
// Las casillas exactas y la del boss sumergido son un ejemplo; la forma real de la sala no se reproduce.
// Sin comprobar en el juego.

const tentacle = (n: number, cell: Cell): Piece => ({
  id: `t${n}`, kind: 'mob', cell,
  name: {
    es: `Tentacule ${n}`, // nombre pendiente: es
    en: `Tentacle ${n}`, // nombre pendiente: en
    fr: `Tentacule ${n}`, // nombre pendiente: fr
  },
});

const tentacles: L10n = { es: 'Tentáculos vivos', en: 'Tentacles alive', fr: 'Tentacules en vie' };

const kill = (n: number, left: number): Step => ({
  actor: 'pj1',
  text: {
    es: `Se mata el tentáculo ${n}${left ? '' : ': era el último'}.`,
    en: `Tentacle ${n} is killed${left ? '' : ': it was the last one'}.`,
    fr: `Le tentacule ${n} est tué${left ? '' : ' : c’était le dernier'}.`,
  },
  changes: [
    { type: 'remove', piece: `t${n}` },
    { type: 'counter', id: 'tent', name: tentacles, value: String(left) },
  ],
});

const d: Dungeon = {
  id: 'poulpe',
  tier: [36, 50],
  name: { es: 'Équipage du Poulpe', en: 'Équipage du Poulpe', fr: 'Équipage du Poulpe' }, // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/36-50/',
  rooms: [
    {
      id: 'room1',
      name: { es: 'Sala 1', en: 'Room 1', fr: 'Salle 1' },
      size: { w: 9, h: 9 },
      pieces: [
        {
          id: 'boss', kind: 'boss', cell: { x: 4, y: 4 }, invulnerable: true, label: '≈',
          name: { es: 'Poulpe', en: 'Poulpe', fr: 'Poulpe' }, // nombre pendiente: es, en
        },
        tentacle(1, { x: 1, y: 1 }),
        tentacle(2, { x: 7, y: 1 }),
        tentacle(3, { x: 1, y: 7 }),
        tentacle(4, { x: 7, y: 7 }),
        {
          id: 'pj1', kind: 'char', cell: { x: 4, y: 7 },
          name: { es: 'Personaje 1', en: 'Character 1', fr: 'Personnage 1' },
        },
      ],
      condition: {
        es: 'El boss se sumerge y es invulnerable (aura verde); invoca 4 tentáculos que hay que matar para que vuelva a la superficie.',
        en: 'The boss dives and is invulnerable (green aura); it summons 4 tentacles that must be killed to bring it back up.',
        fr: 'Le boss plonge et est invulnérable (aura verte) ; il invoque 4 tentacules qu’il faut tuer pour le faire remonter.',
      },
      duration: {
        es: 'La guía no indica cuánto dura fuera del agua ni si vuelve a sumergirse.',
        en: 'The guide does not say how long it stays on the surface or whether it dives again.',
        fr: 'Le guide n’indique pas combien de temps il reste en surface ni s’il replonge.',
      },
      steps: [
        {
          text: {
            es: 'Situación inicial: el boss está bajo el agua e invulnerable; hay 4 tentáculos (posiciones de ejemplo).',
            en: 'Initial situation: the boss is underwater and invulnerable; 4 tentacles are out (example positions).',
            fr: 'Situation initiale : le boss est sous l’eau et invulnérable ; 4 tentacules sont sortis (positions d’exemple).',
          },
          changes: [],
        },
        {
          actor: 't1',
          text: {
            es: 'Cada tentáculo golpea todo en un radio de 2 a su alrededor (ejemplo: tentáculo 1).',
            en: 'Each tentacle hits everything within radius 2 around it (example: tentacle 1).',
            fr: 'Chaque tentacule frappe tout dans un rayon de 2 autour de lui (exemple : tentacule 1).',
          },
          changes: [
            { type: 'zone', zone: { kind: 'hit', center: { x: 1, y: 1 }, radius: 2 } },
            { type: 'counter', id: 'tent', name: tentacles, value: '4' },
          ],
        },
        {
          actor: 'pj1',
          text: {
            es: 'El Personaje 1 va a por los tentáculos de uno en uno, sin prisa: la guía aconseja preparar el turno de daño.',
            en: 'Character 1 goes after the tentacles one at a time: the guide advises preparing the burst turn.',
            fr: 'Le Personnage 1 s’occupe des tentacules un par un : le guide conseille de préparer le tour de burst.',
          },
          changes: [{ type: 'move', piece: 'pj1', to: { x: 3, y: 6 } }],
        },
        kill(3, 3),
        kill(1, 2),
        kill(4, 1),
        kill(2, 0),
        {
          text: {
            es: 'Sin tentáculos el boss vuelve a la superficie y pierde la invulnerabilidad (la guía no indica cuánto dura).',
            en: 'With no tentacles left the boss resurfaces and loses its invulnerability (the guide does not say for how long).',
            fr: 'Sans tentacules le boss remonte et perd son invulnérabilité (le guide n’indique pas combien de temps).',
          },
          changes: [
            { type: 'aura', piece: 'boss', on: false },
            { type: 'label', piece: 'boss', label: null },
            { type: 'counter', id: 'tent', name: tentacles, value: null },
          ],
        },
      ],
    },
  ],
};

export default d;
