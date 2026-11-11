import type { Dungeon, L10n, Piece } from '../types';

// E-Bou (156-170). Fuente: https://wakfu.guide/donjons/156-170/ (sección «Donjon E-Bou»).
// Imágenes revisadas: d22 (alcance de los empujes y del cono del boss), d23 (aviso de casillas de muerte/Syclick), d24 (casilla
// azul del borde con calaveras de «muerte» al lado), d29 (borde de casillas azules con el boss y mobs), d25 (fase 1: casillas
// del borde ya rojas y 2 azules por pasar a rojas, cuadrado central con 4 bloques), d26 (borde azul con casillas de muerte),
// d27 (fase 2: daño 3000 a quien no está en el centro), d28 (fase 3: casillas rojas «à re-désactiver», verdes de bonus, y el
// cuadrado central marcado «le boss ne doit pas aller ici»). Sin imágenes con posiciones exactas: casillas y personajes son un
// ejemplo (el borde real tiene más casillas). La sala 1 (Poz, Syclick…) no tiene invulnerabilidad y la fase 2 no tiene
// mecánica de invulnerabilidad: no se animan. Las casillas verdes (bonus de daño al boss) no se dibujan. Sin comprobar en el juego.

const T = (es: string, en: string, fr: string): L10n => ({ es, en, fr });

const reds: L10n = T('Casillas rojas', 'Red cells', 'Cases rouges');
const redsLeft: L10n = T('Casillas rojas por resetear', 'Red cells left to reset', 'Cases rouges à remettre');

const pj = (n: number, cell: Piece['cell']): Piece => ({
  id: `pj${n}`, kind: 'char', cell,
  name: T(`Personaje ${n}`, `Character ${n}`, `Personnage ${n}`),
});

const bossName: L10n = T('Raipiode l’Inféquençable', 'Raipiode l’Inféquençable', 'Raipiode l’Inféquençable'); // nombre pendiente: es, en
const central = [3, 4, 5].flatMap(x => [3, 4, 5].map(y => ({ x, y })));

const d: Dungeon = {
  id: 'e-bou',
  tier: [156, 170],
  name: T('E-Bou', 'E-Bou', 'E-Bou'), // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/156-170/',
  rooms: [
    {
      id: 'phase1',
      name: T('Boss: fase 1', 'Boss: phase 1', 'Boss : phase 1'),
      size: { w: 9, h: 9 },
      pieces: [
        { id: 'boss', kind: 'boss', cell: { x: 4, y: 4 }, invulnerable: true, name: bossName },
        pj(1, { x: 1, y: 2 }),
        pj(2, { x: 2, y: 7 }),
        pj(3, { x: 7, y: 6 }),
        pj(4, { x: 7, y: 2 }),
      ],
      tiles: [{ cells: [{ x: 0, y: 2 }, { x: 2, y: 8 }, { x: 8, y: 6 }, { x: 8, y: 2 }], color: 'blue' }],
      condition: T(
        'Raipiode es invulnerable (aura verde) en la fase 1: hay que pasar a rojo todas las casillas azules del borde de la sala (aquí 4 de ejemplo).',
        'Raipiode is invulnerable (green aura) in phase 1: all the blue cells around the room’s edge must turn red (4 example cells here).',
        'Raipiode est invulnérable (aura verte) en phase 1 : il faut passer en rouge toutes les cases bleues du pourtour de la salle (4 d’exemple ici).',
      ),
      duration: T(
        'Una casilla pasa de azul a roja al pisarla (personaje o invocación). Si lanzas un hechizo desde una casilla roja, se desactiva y vuelve a azul.',
        'A cell turns from blue to red when stepped on (character or summon). If you cast a spell from a red cell, it deactivates and turns blue again.',
        'Une case passe de bleue à rouge en marchant dessus (personnage ou invocation). Lancer un sort depuis une case rouge la désactive à nouveau.',
      ),
      steps: [
        {
          text: T(
            'Situación inicial: el boss es invulnerable y el borde tiene casillas azules (posiciones de ejemplo).',
            'Initial situation: the boss is invulnerable and the edge has blue cells (example positions).',
            'Situation initiale : le boss est invulnérable et le pourtour a des cases bleues (positions d’exemple).',
          ),
          changes: [],
        },
        {
          actor: 'pj1',
          text: T(
            'El Personaje 1 pisa una casilla azul del borde: pasa a roja (sin lanzar hechizos desde ella).',
            'Character 1 steps on a blue edge cell: it turns red (without casting spells from it).',
            'Le Personnage 1 marche sur une case bleue du pourtour : elle passe en rouge (sans lancer de sort depuis).',
          ),
          changes: [
            { type: 'move', piece: 'pj1', to: { x: 0, y: 2 } },
            { type: 'tiles', cells: [{ x: 0, y: 2 }], color: 'red' },
            { type: 'counter', id: 'reds', name: reds, value: '1/4' },
          ],
        },
        {
          actor: 'pj2',
          text: T(
            'El Personaje 2 pisa otra casilla azul y también pasa a roja.',
            'Character 2 steps on another blue cell and it also turns red.',
            'Le Personnage 2 marche sur une autre case bleue et elle passe aussi en rouge.',
          ),
          changes: [
            { type: 'move', piece: 'pj2', to: { x: 2, y: 8 } },
            { type: 'tiles', cells: [{ x: 2, y: 8 }], color: 'red' },
            { type: 'counter', id: 'reds', name: reds, value: '2/4' },
          ],
        },
        {
          actor: 'pj3',
          text: T(
            'El Personaje 3 pisa otra casilla azul del borde: pasa a roja.',
            'Character 3 steps on another blue edge cell: it turns red.',
            'Le Personnage 3 marche sur une autre case bleue du pourtour : elle passe en rouge.',
          ),
          changes: [
            { type: 'move', piece: 'pj3', to: { x: 8, y: 6 } },
            { type: 'tiles', cells: [{ x: 8, y: 6 }], color: 'red' },
            { type: 'counter', id: 'reds', name: reds, value: '3/4' },
          ],
        },
        {
          actor: 'pj4',
          text: T(
            'El Personaje 4 pisa la última casilla azul: todas las del borde son rojas.',
            'Character 4 steps on the last blue cell: all the edge cells are red.',
            'Le Personnage 4 marche sur la dernière case bleue : toutes celles du pourtour sont rouges.',
          ),
          changes: [
            { type: 'move', piece: 'pj4', to: { x: 8, y: 2 } },
            { type: 'tiles', cells: [{ x: 8, y: 2 }], color: 'red' },
            { type: 'counter', id: 'reds', name: reds, value: '4/4' },
          ],
        },
        {
          text: T(
            'Con todas las casillas rojas cae la invulnerabilidad del boss (la guía no indica que vuelva en la fase 1).',
            'With all cells red the boss’s invulnerability falls (the guide does not say it returns in phase 1).',
            'Avec toutes les cases rouges l’invulnérabilité du boss tombe (le guide n’indique pas qu’elle revienne en phase 1).',
          ),
          changes: [
            { type: 'aura', piece: 'boss', on: false },
            { type: 'counter', id: 'reds', name: reds, value: null },
          ],
        },
      ],
    },
    {
      id: 'phase3',
      name: T('Boss: fase 3', 'Boss: phase 3', 'Boss : phase 3'),
      size: { w: 9, h: 9 },
      pieces: [
        { id: 'boss', kind: 'boss', cell: { x: 4, y: 4 }, invulnerable: true, name: bossName },
        pj(1, { x: 0, y: 2 }),
        pj(2, { x: 8, y: 6 }),
        pj(3, { x: 4, y: 6 }),
      ],
      tiles: [
        { cells: central, color: 'white' },
        { cells: [{ x: 2, y: 0 }, { x: 6, y: 0 }, { x: 0, y: 6 }, { x: 8, y: 2 }, { x: 2, y: 8 }, { x: 6, y: 8 }], color: 'blue' },
        { cells: [{ x: 0, y: 2 }, { x: 8, y: 6 }], color: 'red' },
      ],
      condition: T(
        'En la fase 3 casi todas las casillas del borde son azules y cada turno 2 pasan a rojas (y 2 a verdes, bonus de daño al boss). Con casillas rojas el boss es invulnerable (aura verde).',
        'In phase 3 almost all edge cells are blue and each turn 2 turn red (and 2 green, a damage bonus for the boss). With red cells the boss is invulnerable (green aura).',
        'En phase 3 presque toutes les cases du pourtour sont bleues et chaque tour 2 passent en rouge (et 2 en vert, bonus de dégâts du boss). Avec des cases rouges le boss est invulnérable (aura verte).',
      ),
      duration: T(
        'Hay que lanzar un hechizo desde cada casilla roja para volverla azul, y el boss debe estar fuera del cuadrado central (casillas claras) para recibir daño. Los personajes de daño juegan al final del turno del equipo.',
        'Cast a spell from each red cell to turn it blue, and the boss must be outside the central square (light cells) to take damage. Damage dealers play at the end of the team’s turn.',
        'Il faut lancer un sort depuis chaque case rouge pour la repasser en bleue, et le boss doit être hors du carré central (cases claires) pour subir des dégâts. Les personnages de dégâts jouent en fin de tour d’équipe.',
      ),
      steps: [
        {
          text: T(
            'Situación inicial: hay 2 casillas rojas y el boss, invulnerable, está en el cuadrado central (ejemplo).',
            'Initial situation: there are 2 red cells and the invulnerable boss is in the central square (example).',
            'Situation initiale : il y a 2 cases rouges et le boss, invulnérable, est dans le carré central (exemple).',
          ),
          changes: [],
        },
        {
          actor: 'pj1',
          text: T(
            'El Personaje 1 lanza un hechizo desde una casilla roja: esa casilla vuelve a azul.',
            'Character 1 casts a spell from a red cell: that cell turns blue again.',
            'Le Personnage 1 lance un sort depuis une case rouge : cette case repasse en bleue.',
          ),
          changes: [
            { type: 'tiles', cells: [{ x: 0, y: 2 }], color: 'blue' },
            { type: 'counter', id: 'left', name: redsLeft, value: '1' },
          ],
        },
        {
          actor: 'pj2',
          text: T(
            'El Personaje 2 hace lo mismo desde la otra casilla roja: ya no quedan rojas.',
            'Character 2 does the same from the other red cell: no red cells are left.',
            'Le Personnage 2 fait pareil depuis l’autre case rouge : il n’en reste plus.',
          ),
          changes: [
            { type: 'tiles', cells: [{ x: 8, y: 6 }], color: 'blue' },
            { type: 'counter', id: 'left', name: redsLeft, value: '0' },
          ],
        },
        {
          actor: 'pj3',
          text: T(
            'El Personaje 3 (colocador) saca al boss del cuadrado central: sin rojas y fuera del cuadrado, cae la invulnerabilidad.',
            'Character 3 (placer) moves the boss out of the central square: no red cells and outside it, invulnerability falls.',
            'Le Personnage 3 (placeur) sort le boss du carré central : sans rouges et hors du carré, l’invulnérabilité tombe.',
          ),
          changes: [
            { type: 'move', piece: 'boss', to: { x: 4, y: 2 }, path: [{ x: 4, y: 3 }] },
            { type: 'aura', piece: 'boss', on: false },
            { type: 'counter', id: 'left', name: redsLeft, value: null },
          ],
        },
        {
          text: T(
            'Cada turno aparecen casillas rojas nuevas: con rojas el boss vuelve a ser invulnerable y hay que resetearlas otra vez.',
            'Each turn new red cells appear: with red cells the boss is invulnerable again and they must be reset again.',
            'Chaque tour de nouvelles cases rouges apparaissent : avec des rouges le boss redevient invulnérable.',
          ),
          changes: [
            { type: 'tiles', cells: [{ x: 2, y: 0 }, { x: 6, y: 8 }], color: 'red' },
            { type: 'aura', piece: 'boss', on: true },
          ],
        },
      ],
    },
  ],
};

export default d;
