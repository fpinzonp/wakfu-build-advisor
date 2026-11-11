import type { Dungeon, L10n, Piece } from '../types';

// Château du Wa Wabbit (141-155). Fuente: https://wakfu.guide/donjons/141-155/ (sección «Château du Wa Wabbit»; donjon de 3 jugadores).
// Imágenes revisadas: d558 (Wobot), d562 (logo dorado sobre un Wabbit, flecha desde el boss), d563 (logo rojo «hors combat»:
// el Wabbit muerto se queda en el terreno), d564 (explosión del boss, no animada), d559-d561 (Chevaliew Wabbit, Tiwailleul, Gawde
// = los 3 Wabbits que luchan a tu favor al final), 2 (portada). El boss es invulnerable hasta que mueran los 4 monstruos; el
// Wobot muere sin mecánica y los 3 Wabbits necesitan el logo dorado del boss (uno por turno). El orden de los Wabbits y las
// posiciones son un ejemplo. No se animan el empujón ni la explosión de 3 PO del boss al entrar en juego. Sin comprobar en el juego.

const T = (es: string, en: string, fr: string): L10n => ({ es, en, fr });

const dead: L10n = T('Monstruos abatidos', 'Monsters down', 'Monstres abattus');

const pj = (n: number, cell: Piece['cell']): Piece => ({
  id: `pj${n}`, kind: 'char', cell,
  name: T(`Personaje ${n}`, `Character ${n}`, `Personnage ${n}`),
});

const wabbit = (id: string, cell: Piece['cell'], name: L10n): Piece => ({ id, kind: 'mob', cell, invulnerable: true, name });

const d: Dungeon = {
  id: 'wa-wabbit',
  tier: [141, 155],
  name: T('Castillo del Wa Wabbit', 'Wa Wabbit’s Castle', 'Château du Wa Wabbit'), // nombre pendiente: es, en
  guide: 'https://wakfu.guide/donjons/141-155/',
  rooms: [
    {
      id: 'boss',
      name: T('Combate', 'Fight', 'Combat'),
      size: { w: 11, h: 9 },
      pieces: [
        {
          id: 'boss', kind: 'boss', cell: { x: 5, y: 1 }, invulnerable: true,
          name: T('Wa Wabbit', 'Wa Wabbit', 'Wa Wabbit'), // nombre pendiente: es
        },
        { id: 'wobot', kind: 'mob', cell: { x: 2, y: 4 }, name: T('Wobot', 'Wobot', 'Wobot') }, // nombre pendiente: es
        wabbit('w1', { x: 8, y: 3 }, T('Chevaliew Wabbit', 'Chevaliew Wabbit', 'Chevaliew Wabbit')), // nombre pendiente: es, en
        wabbit('w2', { x: 3, y: 6 }, T('Tiwailleul', 'Tiwailleul', 'Tiwailleul')), // nombre pendiente: es, en
        wabbit('w3', { x: 8, y: 6 }, T('Gawde', 'Gawde', 'Gawde')), // nombre pendiente: es, en
        pj(1, { x: 4, y: 4 }),
        pj(2, { x: 6, y: 5 }),
        pj(3, { x: 5, y: 7 }),
      ],
      condition: T(
        'El boss es invulnerable (aura verde) hasta que mueran los 4 monstruos. El Wobot muere sin más; los 3 Wabbits son invulnerables hasta recibir del boss un logo dorado.',
        'The boss is invulnerable (green aura) until the 4 monsters are dead. The Wobot dies normally; the 3 Wabbits are invulnerable until the boss gives them a golden logo.',
        'Le boss est invulnérable (aura verte) tant que les 4 monstres ne sont pas morts. Le Wobot meurt normalement ; les 3 Wabbits sont invulnérables jusqu’à recevoir du boss un logo doré.',
      ),
      duration: T(
        'El boss da un logo dorado por turno: hacen falta 3 turnos como mínimo. Los Wabbits abatidos se quedan en el terreno sin jugar. La guía no dice cuánto dura la invulnerabilidad del boss tras caer.',
        'The boss gives one golden logo per turn: at least 3 turns are needed. Defeated Wabbits stay on the field without playing. The guide does not say how long the boss stays vulnerable.',
        'Le boss donne un logo doré par tour : il faut 3 tours minimum. Les Wabbits achevés restent sur le terrain sans jouer. Le guide ne dit pas combien de temps le boss reste vulnérable.',
      ),
      steps: [
        {
          text: T(
            'Situación inicial: el boss y los 3 Wabbits son invulnerables; el Wobot no (posiciones de ejemplo).',
            'Initial situation: the boss and the 3 Wabbits are invulnerable; the Wobot is not (example positions).',
            'Situation initiale : le boss et les 3 Wabbits sont invulnérables ; le Wobot ne l’est pas (positions d’exemple).',
          ),
          changes: [],
        },
        {
          actor: 'pj1',
          text: T(
            'El Personaje 1 mata al Wobot sin más: no tiene ninguna mecánica.',
            'Character 1 just kills the Wobot: it has no mechanic.',
            'Le Personnage 1 tue le Wobot directement : il n’a aucune mécanique.',
          ),
          changes: [
            { type: 'remove', piece: 'wobot' },
            { type: 'counter', id: 'dead', name: dead, value: '1/4' },
          ],
        },
        {
          text: T(
            'Turno 1: el boss da un logo dorado a un Wabbit (orden de ejemplo): ese Wabbit deja de ser invulnerable.',
            'Turn 1: the boss gives a golden logo to a Wabbit (example order): that Wabbit stops being invulnerable.',
            'Tour 1 : le boss donne un logo doré à un Wabbit (ordre d’exemple) : ce Wabbit n’est plus invulnérable.',
          ),
          changes: [
            { type: 'label', piece: 'w1', label: '★' },
            { type: 'aura', piece: 'w1', on: false },
          ],
        },
        {
          actor: 'pj2',
          text: T(
            'El Personaje 2 lo derrota: se queda en el terreno «hors combat» (logo rojo) y ya no juega.',
            'Character 2 defeats it: it stays on the field “out of combat” (red logo) and no longer plays.',
            'Le Personnage 2 l’achève : il reste sur le terrain « hors combat » (logo rouge) et ne joue plus.',
          ),
          changes: [
            { type: 'label', piece: 'w1', label: '✖' },
            { type: 'counter', id: 'dead', name: dead, value: '2/4' },
          ],
        },
        {
          actor: 'pj3',
          text: T(
            'Turno 2: el boss da otro logo dorado y el Personaje 3 derrota a ese Wabbit, que se queda hors combat.',
            'Turn 2: the boss gives another golden logo and Character 3 defeats that Wabbit, which stays out of combat.',
            'Tour 2 : le boss donne un autre logo doré et le Personnage 3 achève ce Wabbit, qui reste hors combat.',
          ),
          changes: [
            { type: 'aura', piece: 'w2', on: false },
            { type: 'label', piece: 'w2', label: '✖' },
            { type: 'counter', id: 'dead', name: dead, value: '3/4' },
          ],
        },
        {
          actor: 'pj1',
          text: T(
            'Turno 3: tercer logo dorado y el Personaje 1 derrota al último Wabbit: caen los 4 monstruos.',
            'Turn 3: third golden logo and Character 1 defeats the last Wabbit: all 4 monsters are down.',
            'Tour 3 : troisième logo doré et le Personnage 1 achève le dernier Wabbit : les 4 monstres sont tombés.',
          ),
          changes: [
            { type: 'aura', piece: 'w3', on: false },
            { type: 'label', piece: 'w3', label: '✖' },
            { type: 'counter', id: 'dead', name: dead, value: '4/4' },
          ],
        },
        {
          text: T(
            'Con los 4 monstruos abatidos, el boss entra a combatir y cae su invulnerabilidad (la guía no da su duración).',
            'With the 4 monsters down, the boss joins the fight and its invulnerability falls (the guide gives no duration).',
            'Les 4 monstres abattus, le boss entre en jeu et son invulnérabilité tombe (le guide n’en donne pas la durée).',
          ),
          changes: [{ type: 'aura', piece: 'boss', on: false }],
        },
      ],
    },
  ],
};

export default d;
