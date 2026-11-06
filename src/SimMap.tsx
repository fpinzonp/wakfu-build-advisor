import { t } from './lib/i18n';
import { positionOf, type Cell, type Facing } from './lib/sim/formulas';

const SIZE = 11;
const ARROW: Record<Facing, string> = { n: '▲', e: '▶', s: '▼', w: '◀' };

/** Casilla para mostrar: se cuenta desde 1. */
export const cellText = (c: Cell) => `${c.x + 1}, ${c.y + 1}`;

/** Mapa de 11×11 con el personaje, el mob, su orientación, el alcance del hechizo y la espalda del mob. */
export default function SimMap({ me, mob, facing, inRange, onCell }: {
  me: Cell; mob: Cell; facing: Facing; inRange?: (c: Cell) => boolean; onCell: (c: Cell) => void;
}) {
  const cells: Cell[] = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) cells.push({ x, y });
  const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

  return (
    <div className="sim-map" role="group" aria-label={t('sim.map')}>
      {cells.map((c) => {
        const isMe = same(c, me);
        const isMob = same(c, mob);
        const back = !isMe && !isMob && positionOf(c, mob, facing) === 'back';
        const xy = { x: c.x + 1, y: c.y + 1 };
        const label = isMe ? t('sim.map.cellMe', xy)
          : isMob ? t('sim.map.cellMob', { ...xy, facing: t(`sim.facing.${facing}`) })
            : t('sim.map.cell', xy);
        return (
          <button key={`${c.x}-${c.y}`} type="button"
            className={`sim-cell ${isMe ? 'me' : ''} ${isMob ? 'mob' : ''} ${!isMe && !isMob && inRange?.(c) ? 'range' : ''} ${back ? 'back' : ''}`}
            aria-label={back ? `${label} · ${t('sim.pos.back')}` : label}
            onClick={() => onCell(c)}>
            {isMe ? '●' : isMob ? ARROW[facing] : ''}
          </button>
        );
      })}
    </div>
  );
}
