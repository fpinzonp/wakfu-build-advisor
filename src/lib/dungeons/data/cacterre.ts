import type { Dungeon, L10n, Piece } from '../types';

// Donjon Cacterre (111-125). Fuente: https://wakfu.guide/donjons/111-125/ (d438: el boss; d439: su ficha con los estados
// «Absorption Cacterre» por elemento; d436/d437: zonas de sombra y bonus por elemento recibido). Hay que infligirle 10 PA de
// daño de cada elemento; las salas previas (sol, sombra, escorpión) no tienen invulnerabilidad y no se animan. El reparto de
// elementos entre personajes es un ejemplo. Sin comprobar en el juego.

const el = (es: string, en: string, fr: string): L10n => ({ es: `${es} (PA)`, en: `${en} (AP)`, fr: `${fr} (PA)` });
const earth = el('Tierra', 'Earth', 'Terre');
const water = el('Agua', 'Water', 'Eau');
const fire = el('Fuego', 'Fire', 'Feu');
const air = el('Aire', 'Air', 'Air');

const pj = (n: number, cell: Piece['cell'], role: L10n): Piece => ({
  id: `pj${n}`, kind: 'char', cell, role,
  name: { es: `Personaje ${n}`, en: `Character ${n}`, fr: `Personnage ${n}` },
});

const d: Dungeon = {
  id: 'cacterre',
  tier: [111, 125],
  name: { es: 'Mazmorra Cacterre', en: 'Cacterre Dungeon', fr: 'Donjon Cacterre' }, // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/111-125/',
  rooms: [
    {
      id: 'boss',
      name: { es: 'Boss', en: 'Boss', fr: 'Boss' },
      size: { w: 9, h: 7 },
      pieces: [
        {
          id: 'boss', kind: 'boss', cell: { x: 5, y: 3 }, invulnerable: true,
          name: { es: 'Cacterre', en: 'Cacterre', fr: 'Cacterre' }, // nombre pendiente: es, en
        },
        pj(1, { x: 1, y: 1 }, { es: 'Tierra', en: 'Earth', fr: 'Terre' }),
        pj(2, { x: 1, y: 3 }, { es: 'Agua', en: 'Water', fr: 'Eau' }),
        pj(3, { x: 1, y: 5 }, { es: 'Fuego', en: 'Fire', fr: 'Feu' }),
        pj(4, { x: 3, y: 6 }, { es: 'Aire', en: 'Air', fr: 'Air' }),
      ],
      condition: {
        es: 'El boss es invulnerable (aura verde). Hay que infligirle 10 PA de daño de cada elemento: el progreso se ve en su ficha de combatiente.',
        en: 'The boss is invulnerable (green aura). It must take 10 AP of damage of each element: progress is shown in its fighter sheet.',
        fr: 'Le boss est invulnérable (aura verte). Il faut lui infliger 10 PA de dégâts de chaque élément : l’avancée se voit dans sa fiche de combattant.',
      },
      duration: {
        es: 'La guía no indica que la invulnerabilidad vuelva. Cada elemento le da un bonus (resistencia, parada, maestría o críticos) hasta tenerlos todos.',
        en: 'The guide does not say the invulnerability returns. Each element gives it a bonus (resistance, parry, mastery or crits) until all are done.',
        fr: 'Le guide n’indique pas que l’invulnérabilité revient. Chaque élément lui donne un bonus (résistance, parade, maîtrise ou CC) jusqu’à les avoir tous.',
      },
      steps: [
        {
          text: {
            es: 'Situación inicial: el boss es invulnerable; los 4 elementos están a 0 de 10 PA (personajes de ejemplo).',
            en: 'Initial situation: the boss is invulnerable; the 4 elements are at 0 of 10 AP (example characters).',
            fr: 'Situation initiale : le boss est invulnérable ; les 4 éléments sont à 0 sur 10 PA (personnages d’exemple).',
          },
          changes: [],
        },
        {
          actor: 'pj1',
          text: {
            es: 'El Personaje 1 inflige 10 PA de daño de tierra al boss; el boss gana resistencia (reparto de ejemplo).',
            en: 'Character 1 deals 10 AP of earth damage to the boss; the boss gains resistance (example split).',
            fr: 'Le Personnage 1 inflige 10 PA de dégâts de terre au boss ; le boss gagne de la résistance (répartition d’exemple).',
          },
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 3 }] } },
            { type: 'counter', id: 'earth', name: earth, value: '10/10' },
            { type: 'counter', id: 'water', name: water, value: '0/10' },
            { type: 'counter', id: 'fire', name: fire, value: '0/10' },
            { type: 'counter', id: 'air', name: air, value: '0/10' },
          ],
        },
        {
          actor: 'pj2',
          text: {
            es: 'El Personaje 2 inflige 10 PA de daño de agua; el boss gana parada.',
            en: 'Character 2 deals 10 AP of water damage; the boss gains parry.',
            fr: 'Le Personnage 2 inflige 10 PA de dégâts d’eau ; le boss gagne de la parade.',
          },
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 3 }] } },
            { type: 'counter', id: 'water', name: water, value: '10/10' },
          ],
        },
        {
          actor: 'pj3',
          text: {
            es: 'El Personaje 3 inflige 10 PA de daño de fuego; el boss gana maestría elemental.',
            en: 'Character 3 deals 10 AP of fire damage; the boss gains elemental mastery.',
            fr: 'Le Personnage 3 inflige 10 PA de dégâts de feu ; le boss gagne de la maîtrise élémentaire.',
          },
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 3 }] } },
            { type: 'counter', id: 'fire', name: fire, value: '10/10' },
          ],
        },
        {
          actor: 'pj4',
          text: {
            es: 'El Personaje 4 inflige 10 PA de daño de aire; el boss gana golpes críticos.',
            en: 'Character 4 deals 10 AP of air damage; the boss gains critical hits.',
            fr: 'Le Personnage 4 inflige 10 PA de dégâts d’air ; le boss gagne des coups critiques.',
          },
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 3 }] } },
            { type: 'counter', id: 'air', name: air, value: '10/10' },
          ],
        },
        {
          text: {
            es: 'Con los 4 elementos a 10 el boss pierde la invulnerabilidad (y sus bonus, pero gana 2 PM y 100 % de daños).',
            en: 'With all 4 elements at 10 the boss loses its invulnerability (and its boosts, but gains 2 MP and 100% damage).',
            fr: 'Avec les 4 éléments à 10 le boss perd son invulnérabilité (et ses boosts, mais gagne 2 PM et 100 % de dégâts).',
          },
          changes: [{ type: 'aura', piece: 'boss', on: false }],
        },
      ],
    },
  ],
};

export default d;
