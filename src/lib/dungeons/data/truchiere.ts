import type { Dungeon, L10n, Piece } from '../types';

// Truchière Abandonnée (66-80). Fuente: https://wakfu.guide/donjons/66-80/ (imágenes d372: estado «En pleine truche» de 2 turnos;
// d373: Truchemuche con su Esquive; d366: un huevo rodeado de zonas de fuego, de radio 2 según el texto).
// Número y posiciones de los huevos y de los personajes son un ejemplo; la forma real de la sala no se reproduce. Sin comprobar en el juego.

const turns: L10n = { es: 'Turnos para matar los huevos', en: 'Turns to kill the eggs', fr: 'Tours pour tuer les œufs' };

const egg = (n: number, cell: Piece['cell']): Piece => ({
  id: `egg${n}`, kind: 'mob', cell, invulnerable: true,
  name: { es: `Œuf ${n}`, en: `Egg ${n}`, fr: `Œuf ${n}` }, // nombre pendiente: es, en
});

const pj = (n: number, cell: Piece['cell'], role: L10n): Piece => ({
  id: `pj${n}`, kind: 'char', cell, role,
  name: { es: `Personaje ${n}`, en: `Character ${n}`, fr: `Personnage ${n}` },
});

const d: Dungeon = {
  id: 'truchiere',
  tier: [66, 80],
  name: { es: 'Truchière Abandonnée', en: 'Truchière Abandonnée', fr: 'Truchière Abandonnée' }, // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/66-80/',
  rooms: [
    {
      id: 'boss',
      name: { es: 'Boss', en: 'Boss', fr: 'Boss' },
      size: { w: 11, h: 7 },
      pieces: [
        {
          id: 'boss', kind: 'boss', cell: { x: 5, y: 3 }, invulnerable: true,
          name: { es: 'Boss de la Truchière', en: 'Truchière boss', fr: 'Boss de la Truchière' }, // nombre pendiente: es, en, fr
        },
        egg(1, { x: 1, y: 1 }),
        egg(2, { x: 9, y: 5 }),
        pj(1, { x: 1, y: 5 }, { es: 'Placador', en: 'Tackler', fr: 'Tacleur' }),
        pj(2, { x: 5, y: 6 }, { es: 'Daño a los huevos', en: 'Egg damage', fr: 'Dégâts sur les œufs' }),
      ],
      condition: {
        es: 'El boss es invulnerable (aura verde) mientras haya huevos vivos. Cada turno una zona de radio 2 golpea alrededor de cada huevo.',
        en: 'The boss is invulnerable (green aura) while any egg is alive. Each turn a radius-2 zone hits around every egg.',
        fr: 'Le boss est invulnérable (aura verte) tant que des œufs sont en vie. Chaque tour une zone de rayon 2 frappe autour de chaque œuf.',
      },
      duration: {
        es: 'La guía da 2 turnos para matar los huevos tras el placaje; después de matarlos no indica que vuelva la invulnerabilidad.',
        en: 'The guide gives 2 turns to kill the eggs after the tackle; it does not say the invulnerability returns once they are dead.',
        fr: 'Le guide donne 2 tours pour tuer les œufs après le tacle ; il n’indique pas que l’invulnérabilité revient une fois morts.',
      },
      steps: [
        {
          text: {
            es: 'Situación inicial: el boss y los huevos son invulnerables mientras haya huevos vivos (huevos y posiciones de ejemplo).',
            en: 'Initial situation: the boss and the eggs are invulnerable while any egg is alive (eggs and positions are an example).',
            fr: 'Situation initiale : le boss et les œufs sont invulnérables tant qu’il reste des œufs (œufs et positions d’exemple).',
          },
          changes: [],
        },
        {
          text: {
            es: 'Cada turno hay un ataque de zona de radio 2 alrededor de cada huevo: los personajes se quedan fuera de ese radio.',
            en: 'Every turn there is a radius-2 area attack around each egg: the characters stay outside that radius.',
            fr: 'Chaque tour il y a une attaque de zone de rayon 2 autour de chaque œuf : les personnages restent hors de ce rayon.',
          },
          changes: [
            { type: 'zone', zone: { kind: 'hit', center: { x: 1, y: 1 }, radius: 2 } },
            { type: 'zone', zone: { kind: 'hit', center: { x: 9, y: 5 }, radius: 2 } },
          ],
        },
        {
          actor: 'pj1',
          text: {
            es: 'El Personaje 1 (placador, al menos 501 de placaje en estasis 3) se coloca junto al boss lo antes posible.',
            en: 'Character 1 (tackler, at least 501 tackle in stasis 3) gets next to the boss as soon as possible.',
            fr: 'Le Personnage 1 (tacleur, au moins 501 de tacle en stase 3) se place près du boss au plus vite.',
          },
          changes: [{ type: 'move', piece: 'pj1', to: { x: 4, y: 3 }, path: [{ x: 1, y: 4 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }] }],
        },
        {
          actor: 'pj1',
          text: {
            es: 'El boss queda placado: los huevos pasan a ser vulnerables y hay 2 turnos para matarlos todos.',
            en: 'The boss is tackled: the eggs become vulnerable and there are 2 turns to kill them all.',
            fr: 'Le boss est taclé : les œufs deviennent vulnérables et il y a 2 tours pour tous les tuer.',
          },
          changes: [
            { type: 'aura', piece: 'egg1', on: false },
            { type: 'aura', piece: 'egg2', on: false },
            { type: 'counter', id: 'turns', name: turns, value: '2' },
          ],
        },
        {
          actor: 'pj2',
          text: {
            es: 'Los demás personajes matan todos los huevos (orden de ejemplo: primero el huevo 2, luego el 1).',
            en: 'The other characters kill all the eggs (example order: egg 2 first, then egg 1).',
            fr: 'Les autres personnages tuent tous les œufs (ordre d’exemple : l’œuf 2 d’abord, puis l’œuf 1).',
          },
          changes: [
            { type: 'remove', piece: 'egg2' },
            { type: 'remove', piece: 'egg1' },
          ],
        },
        {
          text: {
            es: 'Sin huevos vivos el boss pierde la invulnerabilidad y se le puede matar (la guía no indica cuánto dura).',
            en: 'With no egg left alive the boss loses its invulnerability and can be killed (the guide does not say for how long).',
            fr: 'Sans œuf en vie le boss perd son invulnérabilité et peut être tué (le guide n’indique pas combien de temps).',
          },
          changes: [
            { type: 'aura', piece: 'boss', on: false },
            { type: 'counter', id: 'turns', name: turns, value: null },
          ],
        },
      ],
    },
  ],
};

export default d;
