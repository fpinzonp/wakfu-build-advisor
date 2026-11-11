import type { Cell } from '../../sim/formulas';
import type { Dungeon, L10n, Piece, Room, Step } from '../types';

// Fabrique Méka (156-170). Fuente: https://wakfu.guide/donjons/156-170/ (sección «Fabrique Méka»).
// Imágenes revisadas: d30 (Vertox y aliados junto a glifos azul oscuro), d31 (glifos verdes de otro mecanismo), d32 (ficha de
// «Silence Divin», no animado), d33 (glifos de números romanos de otra sala), d34 y d35 (mobs de la sala 1 y el glifo azul oscuro
// en una esquina), d36 (rotación dibujada: la zona de glifo azul y la de muerte giran en el mismo sentido), d37 (ejemplo de
// colocación: «mon huppermage peut placer mon roublard ici s'il joue juste après»), d38 («Tour 1»: glifo azul oscuro arriba a la
// izquierda, casillas de muerte opuestas), d39 (gif de la rotación de la sala del boss: cuadrante central, zona azul y roja
// opuestas). Sin imágenes con posiciones exactas: tamaño del glifo (en la guía crece con las vueltas) y casillas son un ejemplo;
// aquí solo se dibujan 3x3 y su giro un paso en sentido horario. La guía no nombra a los 3 monstruos «invu» de la sala 1.
// Los glifos crecen cada vuelta y hay 3 fases de Vertox (PM/PA, transposición, teletransporte): no se animan. Sin comprobar en el juego.

const T = (es: string, en: string, fr: string): L10n => ({ es, en, fr });

const bonus: L10n = T('Daño infligido (solo ese turno)', 'Damage dealt (that turn only)', 'Dégâts infligés (ce tour seulement)');

const pj = (n: number, cell: Cell, role?: L10n): Piece => ({
  id: `pj${n}`, kind: 'char', cell, ...(role ? { role } : {}),
  name: T(`Personaje ${n}`, `Character ${n}`, `Personnage ${n}`),
});

const block = (x0: number, y0: number): Cell[] => [0, 1, 2].flatMap(dx => [0, 1, 2].map(dy => ({ x: x0 + dx, y: y0 + dy })));
const glyphA = block(2, 2); // arriba a la izquierda
const glyphB = block(6, 2); // tras el giro horario: arriba a la derecha
const deathA = block(6, 6); // opuesta al glifo (solo sala del boss)
const deathB = block(2, 6);

const dial: Piece = {
  id: 'dial', kind: 'special', cell: { x: 5, y: 5 },
  name: T('Cuadrante central', 'Central dial', 'Cadran central'), // nombre pendiente: es, en
};

const common = {
  rotate: T(
    'Tras el turno del Personaje 2 el glifo gira un paso en sentido horario y llega a esa posición.',
    'After Character 2’s turn the glyph turns one step clockwise and reaches that position.',
    'Après le tour du Personnage 2 le glyphe tourne d’un cran dans le sens horaire jusqu’à cette position.',
  ),
  place: T(
    'El Personaje 2 (colocador) coloca al Personaje 1 en el siguiente glifo, antes de su turno.',
    'Character 2 (placer) places Character 1 in the next glyph position, before its turn.',
    'Le Personnage 2 (placeur) place le Personnage 1 dans le prochain glyphe, avant son tour.',
  ),
  start: T(
    'El Personaje 1 empieza su turno en el glifo azul oscuro: +50 % de daño infligido ese turno.',
    'Character 1 starts its turn on the dark blue glyph: +50 % damage dealt that turn.',
    'Le Personnage 1 commence son tour sur le glyphe bleu foncé : +50 % de dégâts infligés ce tour.',
  ),
  end: T(
    'Acaba el turno: el +50 % de daño dura solo 1 turno y se pierde.',
    'The turn ends: the +50 % damage lasts only 1 turn and is lost.',
    'Le tour se termine : le +50 % de dégâts ne dure que 1 tour et se perd.',
  ),
};

const openingSteps: Step[] = [
  { actor: 'pj2', text: common.place, changes: [{ type: 'move', piece: 'pj1', to: { x: 7, y: 3 } }] },
  { text: common.rotate, changes: [{ type: 'tiles', cells: glyphA, color: null }, { type: 'tiles', cells: glyphB, color: 'dark' }] },
  { actor: 'pj1', text: common.start, changes: [{ type: 'counter', id: 'bonus', name: bonus, value: '+50 %' }] },
];

const monster = (id: string, cell: Cell): Piece => ({
  id, kind: 'mob', cell, invulnerable: true,
  name: T('Monstruo', 'Monster', 'Monstre'), // la guía no los nombra
});

const rooms: Room[] = [
  {
    id: 'room1',
    name: T('Sala 1', 'Room 1', 'Salle 1'),
    size: { w: 11, h: 11 },
    pieces: [
      dial,
      monster('m1', { x: 9, y: 5 }),
      monster('m2', { x: 5, y: 9 }),
      monster('m3', { x: 1, y: 5 }),
      pj(1, { x: 3, y: 6 }),
      pj(2, { x: 5, y: 6 }, T('colocador', 'placer', 'placeur')),
    ],
    tiles: [{ cells: glyphA, color: 'dark' }],
    condition: T(
      '3 monstruos de la sala tienen resistencias enormes (aura azulada; la guía pide tratarlos como invulnerables, aura verde aquí). Con el glifo azul oscuro (gira desde el centro del mapa; zona dibujada de ejemplo) se les puede vencer.',
      '3 monsters in the room have huge resistances (bluish aura; the guide says to treat them as invulnerable, green aura here). The dark blue glyph (it turns from the map center; drawn area is an example) lets you beat them.',
      '3 monstres de la salle ont d’énormes résistances (aura bleutée ; le guide dit de les considérer invulnérables, aura verte ici). Le glyphe bleu foncé (il tourne depuis le centre de la carte ; zone dessinée d’exemple) permet de les vaincre.',
    ),
    duration: T(
      'Empezar el turno en el glifo da +50 % de daño infligido durante 1 turno. El glifo gira en sentido horario en cada turno de personaje y crece con cada vuelta.',
      'Starting the turn on the glyph gives +50 % damage dealt for 1 turn. The glyph turns clockwise on every character’s turn and grows each lap.',
      'Commencer le tour sur le glyphe donne +50 % de dégâts infligés pendant 1 tour. Le glyphe tourne dans le sens horaire à chaque tour de personnage et grandit à chaque tour complet.',
    ),
    steps: [
      {
        text: T(
          'Situación inicial: 3 monstruos con aura verde (muy resistentes) y un glifo azul oscuro (tamaño y posiciones de ejemplo).',
          'Initial situation: 3 monsters with a green aura (very resistant) and a dark blue glyph (example size and positions).',
          'Situation initiale : 3 monstres à aura verte (très résistants) et un glyphe bleu foncé (positions d’exemple).',
        ),
        changes: [],
      },
      ...openingSteps,
      {
        actor: 'pj1',
        text: T(
          'Con el +50 % de daño los 3 monstruos pueden eliminarse con facilidad: cae su protección.',
          'With +50 % damage the 3 monsters can be killed easily: their protection falls.',
          'Avec +50 % de dégâts les 3 monstres s’éliminent facilement : leur protection tombe.',
        ),
        changes: [
          { type: 'aura', piece: 'm1', on: false },
          { type: 'aura', piece: 'm2', on: false },
          { type: 'aura', piece: 'm3', on: false },
          { type: 'zone', zone: { kind: 'hit', cells: [{ x: 9, y: 5 }, { x: 5, y: 9 }, { x: 1, y: 5 }] } },
        ],
      },
      {
        actor: 'pj1',
        text: T(
          'El Personaje 1 elimina a los 3 monstruos.',
          'Character 1 kills the 3 monsters.',
          'Le Personnage 1 élimine les 3 monstres.',
        ),
        changes: [
          { type: 'remove', piece: 'm1' },
          { type: 'remove', piece: 'm2' },
          { type: 'remove', piece: 'm3' },
        ],
      },
      { text: common.end, changes: [{ type: 'counter', id: 'bonus', name: bonus, value: null }] },
    ],
  },
  {
    id: 'boss',
    name: T('Boss', 'Boss', 'Boss'),
    size: { w: 11, h: 11 },
    pieces: [
      dial,
      {
        id: 'boss', kind: 'boss', cell: { x: 9, y: 5 }, invulnerable: true,
        name: T('Vertox', 'Vertox the Timeless', 'Vertox'), // nombre pendiente: es, fr (nombre completo)
      },
      pj(1, { x: 5, y: 8 }),
      pj(2, { x: 5, y: 6 }, T('colocador', 'placer', 'placeur')),
    ],
    tiles: [{ cells: glyphA, color: 'dark' }, { cells: deathA, color: 'red' }],
    condition: T(
      'Vertox es invulnerable (aura verde) y se le hace daño igual que a los monstruos de la sala 1. Frente al glifo azul oscuro hay una zona de muerte (roja): quien empiece el turno en ella muere.',
      'Vertox is invulnerable (green aura) and is dealt with like the room 1 monsters. Opposite the dark blue glyph is a death zone (red): starting the turn on it kills.',
      'Vertox est invulnérable (aura verte) et se traite comme les monstres de la salle 1. À l’opposé du glyphe bleu foncé il y a une zone de mort (rouge) : y commencer son tour tue.',
    ),
    duration: T(
      '+50 % de daño infligido durante 1 turno por cada personaje que empiece su turno en el glifo. Al morir Vertox la mecánica se detiene por completo.',
      '+50 % damage dealt for 1 turn for each character that starts its turn on the glyph. When Vertox dies the mechanic stops completely.',
      '+50 % de dégâts infligés pendant 1 tour pour chaque personnage qui commence son tour sur le glyphe. À la mort de Vertox la mécanique s’arrête complètement.',
    ),
    steps: [
      {
        text: T(
          'Situación inicial: Vertox es invulnerable; glifo azul oscuro y, enfrente, zona de muerte roja (ejemplo).',
          'Initial situation: Vertox is invulnerable; dark blue glyph and, opposite, a red death zone (example).',
          'Situation initiale : Vertox est invulnérable ; glyphe bleu foncé et, en face, zone de mort rouge (exemple).',
        ),
        changes: [],
      },
      { actor: 'pj2', text: common.place, changes: [{ type: 'move', piece: 'pj1', to: { x: 7, y: 3 } }] },
      {
        text: T(
          'Tras el turno del Personaje 2 el glifo y la zona de muerte giran un paso en sentido horario.',
          'After Character 2’s turn the glyph and the death zone turn one step clockwise.',
          'Après le tour du Personnage 2 le glyphe et la zone de mort tournent d’un cran dans le sens horaire.',
        ),
        changes: [
          { type: 'tiles', cells: glyphA, color: null },
          { type: 'tiles', cells: deathA, color: null },
          { type: 'tiles', cells: glyphB, color: 'dark' },
          { type: 'tiles', cells: deathB, color: 'red' },
        ],
      },
      { actor: 'pj1', text: common.start, changes: [{ type: 'counter', id: 'bonus', name: bonus, value: '+50 %' }] },
      {
        actor: 'pj1',
        text: T(
          'Con el +50 % de daño el Personaje 1 puede dañar a Vertox: cae su invulnerabilidad para ese turno.',
          'With +50 % damage Character 1 can damage Vertox: its invulnerability falls for that turn.',
          'Avec +50 % de dégâts le Personnage 1 peut blesser Vertox : son invulnérabilité tombe pour ce tour.',
        ),
        changes: [
          { type: 'zone', zone: { kind: 'hit', cells: [{ x: 9, y: 5 }] } },
          { type: 'aura', piece: 'boss', on: false },
        ],
      },
      {
        text: T(
          'Acaba el turno: el +50 % dura solo 1 turno y Vertox vuelve a ser invulnerable (deducido).',
          'The turn ends: the +50 % lasts only 1 turn and Vertox is invulnerable again (deduced).',
          'Le tour se termine : le +50 % ne dure que 1 tour et Vertox redevient invulnérable (déduit).',
        ),
        changes: [
          { type: 'aura', piece: 'boss', on: true },
          { type: 'counter', id: 'bonus', name: bonus, value: null },
        ],
      },
    ],
  },
];

const d: Dungeon = {
  id: 'fabrique-meka',
  tier: [156, 170],
  name: T('Fábrica Meka', 'Mecha Factory', 'Fabrique Méka'), // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/156-170/',
  rooms,
};

export default d;
