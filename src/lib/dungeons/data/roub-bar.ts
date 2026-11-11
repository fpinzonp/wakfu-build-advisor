import type { Dungeon, L10n, Piece } from '../types';

// Roub'Bar (156-170). Fuente: https://wakfu.guide/donjons/156-170/ (sección «Donjon Roub Bar»).
// Imágenes revisadas: d8 (estado de la sala 1: «Un personnage qui finit au contact d'un Roublard ou qui tue un Roublard devient
// Bombifié», 300 res. elemental), d9 (ficha «Bombifié»: se da a un aliado haciéndole daño a menos de 3 casillas; al acabar el
// turno alineado con otro portador crea un «Mur de poudre» entre los 2 jugadores, 8 casillas como máximo), d10 (montículos de
// pólvora entre 2 personajes, zona roja), d11 (ficha «Affaibli»: «Durée : 3 tours restants», -400 res. elemental), d12 (ficha
// «Mur de poudre»: sobre un jugador 4000 de daño, -4 PA, -4 PM), d13 (montículos de pólvora y Remington), d14 (nieblas de la
// fase 2, marcadas en rojo), d15 (líneas de su daño en línea). Sin imágenes con posiciones relativas exactas: posiciones,
// personajes y qué enemigo recoge la pólvora son un ejemplo. «Brise Tibia» (mini-boss de la sala 1) solo pierde daño; no se
// anima. Sin comprobar en el juego.

const T = (es: string, en: string, fr: string): L10n => ({ es, en, fr });

const weak: L10n = T('Affaibli (turnos)', 'Affaibli (turns)', 'Affaibli (tours)'); // nombre pendiente: es, en
const misted: L10n = T('Turnos escondido (ejemplo)', 'Turns hidden (example)', 'Tours caché (exemple)');

const pj = (n: number, cell: Piece['cell'], role?: L10n): Piece => ({
  id: `pj${n}`, kind: 'char', cell, ...(role ? { role } : {}),
  name: T(`Personaje ${n}`, `Character ${n}`, `Personnage ${n}`),
});

const wall1 = [{ x: 2, y: 4 }, { x: 2, y: 5 }];
const wall2 = [{ x: 3, y: 4 }, { x: 4, y: 4 }];
const mist = [{ x: 8, y: 5 }, { x: 9, y: 5 }, { x: 8, y: 6 }, { x: 9, y: 6 }];

const bombSteps = {
  hit: T(
    'El Personaje 1 hace daño al Personaje 2, a 3 casillas o menos: este también queda «Bombifié».',
    'Character 1 damages Character 2, 3 cells or less away: it also becomes “Bombifié”.',
    'Le Personnage 1 blesse le Personnage 2, à 3 cases ou moins : celui-ci devient aussi « Bombifié ».',
  ),
  wall: T(
    'El Personaje 2 acaba su turno alineado con el 1: se crea un muro de pólvora entre los dos.',
    'Character 2 ends its turn aligned with Character 1: a powder wall appears between them.',
    'Le Personnage 2 finit son tour aligné avec le 1 : un mur de poudre apparaît entre eux.',
  ),
};

const d: Dungeon = {
  id: 'roub-bar',
  tier: [156, 170],
  name: T('Roub\'Bar', 'Roub\'Bar', 'Roub\'Bar'), // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/156-170/',
  rooms: [
    {
      id: 'room1',
      name: T('Sala 1', 'Room 1', 'Salle 1'),
      size: { w: 11, h: 9 },
      pieces: [
        {
          id: 'roublard', kind: 'mob', cell: { x: 2, y: 2 }, invulnerable: true,
          name: T('Roublard', 'Roublard', 'Roublard'), // nombre pendiente: es, en
        },
        {
          id: 'm1', kind: 'mob', cell: { x: 4, y: 2 }, invulnerable: true,
          name: T('Monstruo', 'Monster', 'Monstre'), // la guía no los nombra
        },
        pj(1, { x: 1, y: 3 }),
        pj(2, { x: 3, y: 5 }),
      ],
      condition: T(
        'Todos los monstruos tienen +300 resistencias (aura verde). Las anula «Affaibli» (−400 res., supera las +300), que da recoger la pólvora de un muro entre 2 personajes «Bombifié».',
        'All monsters have +300 resistance (green aura). “Affaibli” (−400 res., more than the +300) cancels it; it is got by picking up powder from a wall between 2 “Bombifié” characters.',
        'Tous les monstres ont +300 de résistances (aura verte). « Affaibli » (−400 rés., plus que les +300) les annule ; il s’obtient en récupérant la poudre d’un mur entre 2 personnages « Bombifié ».',
      ),
      duration: T(
        '«Affaibli» dura 3 turnos (ficha de la guía). La pólvora también daña a tus personajes si pasan por encima (4000 de daño, −4 PA, −4 PM según la ficha).',
        '“Affaibli” lasts 3 turns (guide’s tooltip). Powder also hurts your characters if they step on it (4000 damage, −4 AP, −4 MP per the tooltip).',
        '« Affaibli » dure 3 tours (fiche du guide). La poudre blesse aussi vos personnages s’ils passent dessus (4000 dégâts, −4 PA, −4 PM selon la fiche).',
      ),
      steps: [
        {
          text: T(
            'Situación inicial: los monstruos tienen +300 res. (aura verde); hay un Roublard cerca (posiciones de ejemplo).',
            'Initial situation: the monsters have +300 res. (green aura); a Roublard is nearby (example positions).',
            'Situation initiale : les monstres ont +300 rés. (aura verte) ; un Roublard est tout près (positions d’exemple).',
          ),
          changes: [],
        },
        {
          actor: 'pj1',
          text: T(
            'El Personaje 1 acaba su turno al cuerpo a cuerpo del Roublard y queda «Bombifié» (aura roja).',
            'Character 1 ends its turn next to the Roublard and becomes “Bombifié” (red aura).',
            'Le Personnage 1 finit son tour au corps à corps du Roublard et devient « Bombifié » (aura rouge).',
          ),
          changes: [
            { type: 'move', piece: 'pj1', to: { x: 2, y: 3 } },
            { type: 'label', piece: 'pj1', label: '💣' },
          ],
        },
        {
          actor: 'pj1',
          text: bombSteps.hit,
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 3, y: 5 }] } },
            { type: 'label', piece: 'pj2', label: '💣' },
          ],
        },
        {
          actor: 'pj2',
          text: bombSteps.wall,
          changes: [
            { type: 'move', piece: 'pj2', to: { x: 2, y: 6 } },
            { type: 'tiles', cells: wall1, color: 'red' },
          ],
        },
        {
          text: T(
            'Un monstruo recoge la pólvora (ejemplo) y queda «Affaibli»: −400 res. (supera las +300), 3 turnos.',
            'A monster picks up the powder (example) and becomes “Affaibli”: −400 res. (more than +300), 3 turns.',
            'Un monstre récupère la poudre (exemple) et devient « Affaibli » : −400 rés. (plus que +300), 3 tours.',
          ),
          changes: [
            { type: 'move', piece: 'm1', to: { x: 2, y: 5 }, path: [{ x: 4, y: 3 }, { x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }] },
            { type: 'aura', piece: 'm1', on: false },
            { type: 'label', piece: 'm1', label: '−400' },
            { type: 'counter', id: 'weak', name: weak, value: '3' },
          ],
        },
        {
          text: T(
            'Pasados los 3 turnos «Affaibli» termina y el monstruo vuelve a +300 res. (deducido).',
            'After the 3 turns “Affaibli” ends and the monster is back to +300 res. (deduced).',
            'Après les 3 tours « Affaibli » se termine et le monstre revient à +300 rés. (déduit).',
          ),
          changes: [
            { type: 'aura', piece: 'm1', on: true },
            { type: 'label', piece: 'm1', label: null },
            { type: 'counter', id: 'weak', name: weak, value: null },
          ],
        },
      ],
    },
    {
      id: 'boss',
      name: T('Boss', 'Boss', 'Boss'),
      size: { w: 11, h: 9 },
      pieces: [
        {
          id: 'boss', kind: 'boss', cell: { x: 4, y: 1 }, invulnerable: true,
          name: T('Remington Smisse', 'Remington Smisse', 'Remington Smisse'), // nombre pendiente: es, fr (la guía dice «Remington»)
        },
        pj(1, { x: 2, y: 4 }),
        pj(2, { x: 4, y: 5 }),
        pj(3, { x: 6, y: 2 }, T('coloca al boss', 'places the boss', 'place le boss')),
      ],
      condition: T(
        'Remington es invulnerable (aura verde) y tiene 2 fases (50 % PV). Su invulnerabilidad cae al estar en el camino de un muro de pólvora entre 2 personajes «Bombifié».',
        'Remington is invulnerable (green aura) and has 2 phases (50 % HP). Its invulnerability falls when it is in the path of a powder wall between 2 “Bombifié” characters.',
        'Remington est invulnérable (aura verte) et a 2 phases (50 % PV). Son invulnérabilité tombe quand il est sur le chemin d’un mur de poudre entre 2 personnages « Bombifié ».',
      ),
      duration: T(
        'Cada turno el boss da «Bombifié» al personaje con más PV (%). La guía no dice cuánto dura la vulnerabilidad. Fase 2: cada 2 turnos se esconde invisible en una niebla y reaparece al recibir 1 PV de daño; una Stabilisation al final de la fase 1 evita que se teletransporte.',
        'Each turn the boss gives “Bombifié” to the character with the highest HP %. The guide does not say how long the vulnerability lasts. Phase 2: every 2 turns it hides invisible in a mist and reappears after taking 1 HP of damage; a Stabilisation at the end of phase 1 stops it from teleporting.',
        'Chaque tour le boss donne « Bombifié » au personnage le moins affaibli en % PV. Le guide n’indique pas la durée de la vulnérabilité. Phase 2 : tous les 2 tours il se cache invisible dans une brume et réapparaît dès qu’il subit 1 PV de dégâts ; une Stabilisation en fin de phase 1 l’empêche de se téléporter.',
      ),
      steps: [
        {
          text: T(
            'Situación inicial: Remington es invulnerable (aura verde). Posiciones de ejemplo.',
            'Initial situation: Remington is invulnerable (green aura). Example positions.',
            'Situation initiale : Remington est invulnérable (aura verte). Positions d’exemple.',
          ),
          changes: [],
        },
        {
          actor: 'boss',
          text: T(
            'Remington aplica «Bombifié» a un personaje (el Personaje 1 en este ejemplo).',
            'Remington gives “Bombifié” to one character (Character 1 in this example).',
            'Remington applique « Bombifié » à un personnage (le Personnage 1 dans cet exemple).',
          ),
          changes: [{ type: 'label', piece: 'pj1', label: '💣' }],
        },
        {
          actor: 'pj1',
          text: bombSteps.hit,
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: [{ x: 4, y: 5 }] } },
            { type: 'label', piece: 'pj2', label: '💣' },
          ],
        },
        {
          actor: 'pj2',
          text: bombSteps.wall,
          changes: [
            { type: 'move', piece: 'pj2', to: { x: 5, y: 4 } },
            { type: 'tiles', cells: wall2, color: 'red' },
          ],
        },
        {
          actor: 'pj3',
          text: T(
            'El Personaje 3 coloca al boss en el camino de la pólvora: cae su invulnerabilidad.',
            'Character 3 places the boss in the powder’s path: its invulnerability falls.',
            'Le Personnage 3 place le boss sur le chemin de la poudre : son invulnérabilité tombe.',
          ),
          changes: [
            { type: 'move', piece: 'boss', to: { x: 4, y: 4 }, path: [{ x: 4, y: 2 }, { x: 4, y: 3 }] },
            { type: 'aura', piece: 'boss', on: false },
          ],
        },
        {
          text: T(
            'Fase 2: cada 2 turnos Remington se esconde en una niebla (ejemplo). La guía no dice si vuelve su invulnerabilidad.',
            'Phase 2: every 2 turns Remington hides in a mist (example). The guide does not say if invulnerability returns.',
            'Phase 2 : tous les 2 tours Remington se cache en brume (exemple). Le guide ne dit pas si l’invulnérabilité revient.',
          ),
          changes: [
            { type: 'tiles', cells: wall2, color: null },
            { type: 'tiles', cells: mist, color: 'white' },
            { type: 'move', piece: 'boss', to: { x: 9, y: 6 } },
            { type: 'label', piece: 'boss', label: '?' },
            { type: 'counter', id: 'mist', name: misted, value: '0' },
          ],
        },
        {
          actor: 'pj3',
          text: T(
            'El Personaje 3 lanza un hechizo de zona a la niebla: al recibir 1 PV de daño Remington reaparece.',
            'Character 3 casts an area spell on the mist: after taking 1 HP of damage Remington reappears.',
            'Le Personnage 3 lance un sort de zone dans la brume : dès 1 PV de dégâts Remington réapparaît.',
          ),
          changes: [
            { type: 'zone', zone: { kind: 'hit', cells: mist } },
            { type: 'label', piece: 'boss', label: null },
            { type: 'counter', id: 'mist', name: misted, value: null },
          ],
        },
      ],
    },
  ],
};

export default d;
