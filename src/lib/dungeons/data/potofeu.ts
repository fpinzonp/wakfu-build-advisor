import type { Dungeon, L10n, Piece } from '../types';

// Compost du grand Potofeu (126-140). Fuente: https://wakfu.guide/donjons/126-140/ (sección «Compost du grand Potofeu»).
// Imágenes revisadas: d479 y d480 (estado «Dégénérescence»: se transmite al boss «en allant à son contact» y «altère la
// régénération de Potofeu»), d481 (el boss con la aubergine al lado), d476 (radis), d478 (ataque de fuego del boss), d472-d475
// (monstres de las salas, sin mecánica de invulnerabilidad animada). Solo se anima la fase 2 del boss (50 % PV): recoger el
// veneno de la Aubergine, llevarlo al cuerpo a cuerpo del boss, transmitírselo y atacar; la guía pide repetirlo 2 veces.
// Que la protección vuelva entre las dos transmisiones es deducido (la guía dice «répétez l'opération»). Posiciones y número
// de personajes son un ejemplo. Los 2 radis no se dibujan. Sin comprobar en el juego.

const T = (es: string, en: string, fr: string): L10n => ({ es, en, fr });

const times: L10n = T('Veneno transmitido al boss', 'Poison passed to the boss', 'Poison transmis au boss');

const pj = (n: number, cell: Piece['cell']): Piece => ({
  id: `pj${n}`, kind: 'char', cell,
  name: T(`Personaje ${n}`, `Character ${n}`, `Personnage ${n}`),
});

const d: Dungeon = {
  id: 'potofeu',
  tier: [126, 140],
  name: T('Compost del gran Potofeu', 'Great Potofeu’s Compost', 'Compost du grand Potofeu'), // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/126-140/',
  rooms: [
    {
      id: 'boss',
      name: T('Boss, fase 2 (50 % PV)', 'Boss, phase 2 (50% HP)', 'Boss, phase 2 (50 % PV)'),
      size: { w: 11, h: 9 },
      pieces: [
        {
          id: 'boss', kind: 'boss', cell: { x: 5, y: 1 }, invulnerable: true,
          name: T('Potofeu', 'Potofeu', 'Potofeu'), // nombre pendiente: es, en
        },
        {
          id: 'aubergine', kind: 'mob', cell: { x: 8, y: 6 },
          name: T('Aubergine', 'Aubergine', 'Aubergine'), // nombre pendiente: es, en
        },
        pj(1, { x: 8, y: 4 }),
        pj(2, { x: 3, y: 4 }),
      ],
      condition: T(
        'En la fase 2 el boss es invulnerable (aura verde). Para quitarlo hay que reaplicarle el veneno «Dégénérescence» de la Aubergine, en cuerpo a cuerpo.',
        'In phase 2 the boss is invulnerable (green aura). To remove it you must re-apply the Aubergine’s “Dégénérescence” poison to it, in melee.',
        'En phase 2 le boss est invulnérable (aura verte). Pour la retirer il faut lui réappliquer le poison « Dégénérescence » de l’Aubergine, au corps à corps.',
      ),
      duration: T(
        'La guía no dice cuánto dura. Pide repetir la operación 2 veces en la fase 2 (el veneno también anula su regeneración de PV).',
        'The guide does not say how long it lasts. It asks to repeat the operation 2 times in phase 2 (the poison also cancels its HP regeneration).',
        'Le guide ne dit pas combien de temps ça dure. Il demande de répéter l’opération 2 fois en phase 2 (le poison annule aussi sa régénération de PV).',
      ),
      steps: [
        {
          text: T(
            'Situación inicial: el boss (fase 2) es invulnerable; la Aubergine está en el terreno (posiciones de ejemplo).',
            'Initial situation: the boss (phase 2) is invulnerable; the Aubergine is on the field (example positions).',
            'Situation initiale : le boss (phase 2) est invulnérable ; l’Aubergine est sur le terrain (positions d’exemple).',
          ),
          changes: [],
        },
        {
          actor: 'pj1',
          text: T(
            'El Personaje 1 pasa por la zona de la Aubergine y recoge el veneno.',
            'Character 1 walks through the Aubergine’s zone and picks up the poison.',
            'Le Personnage 1 passe dans la zone de l’Aubergine et récupère le poison.',
          ),
          changes: [
            { type: 'move', piece: 'pj1', to: { x: 8, y: 5 } },
            { type: 'label', piece: 'pj1', label: '☠' },
          ],
        },
        {
          actor: 'pj1',
          text: T(
            'El Personaje 1 va corriendo al cuerpo a cuerpo del boss con el veneno.',
            'Character 1 runs to the boss’s melee range with the poison.',
            'Le Personnage 1 court au corps à corps du boss avec le poison.',
          ),
          changes: [{ type: 'move', piece: 'pj1', to: { x: 5, y: 2 }, path: [{ x: 8, y: 4 }, { x: 8, y: 3 }, { x: 7, y: 3 }, { x: 6, y: 3 }, { x: 5, y: 3 }] }],
        },
        {
          actor: 'pj1',
          text: T(
            'El Personaje 1 transmite el veneno al boss: cae su invulnerabilidad.',
            'Character 1 passes the poison to the boss: its invulnerability falls.',
            'Le Personnage 1 transmet le poison au boss : son invulnérabilité tombe.',
          ),
          changes: [
            { type: 'label', piece: 'pj1', label: null },
            { type: 'aura', piece: 'boss', on: false },
            { type: 'counter', id: 'times', name: times, value: '1/2' },
          ],
        },
        {
          actor: 'pj2',
          text: T(
            'El Personaje 2 ataca al boss, ya sin invulnerabilidad.',
            'Character 2 attacks the boss, which is no longer invulnerable.',
            'Le Personnage 2 attaque le boss, qui n’est plus invulnérable.',
          ),
          changes: [{ type: 'zone', zone: { kind: 'hit', cells: [{ x: 5, y: 1 }] } }],
        },
        {
          actor: 'pj1',
          text: T(
            'Se repite (deducido): la protección vuelve y el Personaje 1 recoge otra vez el veneno de la Aubergine.',
            'Repeat (deduced): the protection returns and Character 1 picks up the Aubergine’s poison again.',
            'On répète (déduit) : la protection revient et le Personnage 1 récupère à nouveau le poison de l’Aubergine.',
          ),
          changes: [
            { type: 'aura', piece: 'boss', on: true },
            { type: 'move', piece: 'pj1', to: { x: 8, y: 5 }, path: [{ x: 5, y: 3 }, { x: 6, y: 3 }, { x: 7, y: 3 }, { x: 8, y: 3 }, { x: 8, y: 4 }] },
            { type: 'label', piece: 'pj1', label: '☠' },
          ],
        },
        {
          actor: 'pj1',
          text: T(
            'El Personaje 1 vuelve al cuerpo a cuerpo y lo transmite otra vez: cae la invulnerabilidad (sin duración en la guía).',
            'Character 1 returns to melee and passes it a 2nd time: the invulnerability falls (the guide gives no duration).',
            'Le Personnage 1 revient au corps à corps et le retransmet : l’invulnérabilité tombe (durée non donnée par le guide).',
          ),
          changes: [
            { type: 'move', piece: 'pj1', to: { x: 5, y: 2 }, path: [{ x: 8, y: 4 }, { x: 8, y: 3 }, { x: 7, y: 3 }, { x: 6, y: 3 }, { x: 5, y: 3 }] },
            { type: 'label', piece: 'pj1', label: null },
            { type: 'aura', piece: 'boss', on: false },
            { type: 'counter', id: 'times', name: times, value: '2/2' },
          ],
        },
      ],
    },
  ],
};

export default d;
