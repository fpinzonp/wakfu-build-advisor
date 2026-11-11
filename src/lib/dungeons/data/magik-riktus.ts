import type { Dungeon, L10n, Piece } from '../types';

// Repaire des Magik Riktus (96-110). Fuente: https://wakfu.guide/donjons/96-110/ (solo hay imagen de portada; la mecánica sale del texto:
// golpe por la espalda -> chapeau, máximo 1 por personaje y turno; con 3 invocados el boss deja de ser invulnerable; si muere uno vuelve).
// Posiciones y número de personajes son un ejemplo; la forma real de la sala no se reproduce. Sin comprobar en el juego.

const hats: L10n = { es: 'Sombreros invocados', en: 'Hats summoned', fr: 'Chapeaux invoqués' };

const pj = (n: number, cell: Piece['cell']): Piece => ({
  id: `pj${n}`, kind: 'char', cell,
  name: { es: `Personaje ${n}`, en: `Character ${n}`, fr: `Personnage ${n}` },
});

const hat = (n: number, cell: Piece['cell']): Piece => ({
  id: `hat${n}`, kind: 'mob', cell,
  name: { es: `Chapeau ${n}`, en: `Magik Hat ${n}`, fr: `Chapeau ${n}` }, // nombre pendiente: es
});

const d: Dungeon = {
  id: 'magik-riktus',
  tier: [96, 110],
  name: { es: 'Guarida de los Magik Riktus', en: 'Magik Riktus Lair', fr: 'Repaire des Magik Riktus' }, // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/96-110/',
  rooms: [
    {
      id: 'boss',
      name: { es: 'Boss', en: 'Boss', fr: 'Boss' },
      size: { w: 9, h: 7 },
      pieces: [
        {
          id: 'boss', kind: 'boss', cell: { x: 4, y: 2 }, invulnerable: true,
          name: { es: 'Boss de los Magik Riktus', en: 'Magik Riktus boss', fr: 'Boss des Magik Riktus' }, // nombre pendiente: es, en, fr
        },
        pj(1, { x: 1, y: 6 }),
        pj(2, { x: 7, y: 6 }),
        pj(3, { x: 0, y: 4 }),
      ],
      condition: {
        es: 'El boss es invulnerable a los daños directos (aura verde). Cada golpe por la espalda invoca un sombrero (máx. 1 por personaje y turno).',
        en: 'The boss is invulnerable to direct damage (green aura). Each hit in the back summons a hat (max. 1 per character per turn).',
        fr: 'Le boss est invulnérable aux dégâts directs (aura verte). Chaque coup dans le dos fait apparaître un chapeau (max. 1 par personnage et par tour).',
      },
      duration: {
        es: 'Si se mata un sombrero, el boss vuelve a ser invulnerable: hay que matar primero al boss y luego a los 3 sombreros. Desde el turno 4 los sombreros invocan monstruos.',
        en: 'If a hat is killed, the boss becomes invulnerable again: kill the boss first, then the 3 hats. From turn 4 the hats summon extra monsters.',
        fr: 'Si un chapeau est tué, le boss redevient invulnérable : il faut tuer le boss puis les 3 chapeaux. À partir du tour 4 les chapeaux invoquent des monstres.',
      },
      steps: [
        {
          text: {
            es: 'Situación inicial: el boss es invulnerable a los daños directos (personajes de ejemplo).',
            en: 'Initial situation: the boss is invulnerable to direct damage (example characters).',
            fr: 'Situation initiale : le boss est invulnérable aux dégâts directs (personnages d’exemple).',
          },
          changes: [],
        },
        {
          actor: 'pj1',
          text: {
            es: 'El Personaje 1 golpea al boss por la espalda (casilla de ejemplo): aparece el primer sombrero.',
            en: 'Character 1 hits the boss in the back (example cell): the first hat appears.',
            fr: 'Le Personnage 1 frappe le boss dans le dos (case d’exemple) : le premier chapeau apparaît.',
          },
          changes: [
            { type: 'move', piece: 'pj1', to: { x: 4, y: 3 } },
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 4, y: 2 }] } },
            { type: 'add', piece: hat(1, { x: 2, y: 1 }) },
            { type: 'counter', id: 'hats', name: hats, value: '1/3' },
          ],
        },
        {
          actor: 'pj2',
          text: {
            es: 'El Personaje 2 también golpea al boss por la espalda: aparece el segundo sombrero.',
            en: 'Character 2 also hits the boss in the back: the second hat appears.',
            fr: 'Le Personnage 2 frappe aussi le boss dans le dos : le deuxième chapeau apparaît.',
          },
          changes: [
            { type: 'move', piece: 'pj2', to: { x: 4, y: 4 } },
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 4, y: 2 }] } },
            { type: 'add', piece: hat(2, { x: 6, y: 1 }) },
            { type: 'counter', id: 'hats', name: hats, value: '2/3' },
          ],
        },
        {
          actor: 'pj3',
          text: {
            es: 'El Personaje 3 golpea al boss por la espalda: aparece el tercer sombrero.',
            en: 'Character 3 hits the boss in the back: the third hat appears.',
            fr: 'Le Personnage 3 frappe le boss dans le dos : le troisième chapeau apparaît.',
          },
          changes: [
            { type: 'move', piece: 'pj3', to: { x: 4, y: 5 } },
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 4, y: 2 }] } },
            { type: 'add', piece: hat(3, { x: 4, y: 0 }) },
            { type: 'counter', id: 'hats', name: hats, value: '3/3' },
          ],
        },
        {
          text: {
            es: 'Con 3 sombreros cae su invulnerabilidad; no mates ningún sombrero antes: si muere uno, vuelve.',
            en: 'With 3 hats its invulnerability falls: kill no hat first; if one dies, the boss becomes invulnerable again.',
            fr: 'Avec 3 chapeaux son invulnérabilité tombe : ne tuez aucun chapeau avant ; si un meurt, le boss redevient invulnérable.',
          },
          changes: [{ type: 'aura', piece: 'boss', on: false }],
        },
      ],
    },
  ],
};

export default d;
