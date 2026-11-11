// Tablero de una sala: cuadrícula vista desde arriba con las piezas en una capa absoluta (en %).
import type { BoardState } from './lib/dungeons/play';
import { t, useLang } from './lib/i18n';

interface Props { state: BoardState; size: { w: number; h: number }; roomName: string }

export default function DungeonBoard({ state, size, roomName }: Props) {
  const { lang } = useLang();
  const cells: JSX.Element[] = [];
  for (let y = 0; y < size.h; y++) {
    for (let x = 0; x < size.w; x++) {
      const cls = ['dun-cell'];
      const tile = state.tiles[`${x},${y}`];
      if (tile) cls.push(`dun-tile-${tile}`);
      for (const z of state.zones) if (z.cells.some(c => c.x === x && c.y === y)) cls.push(`dun-zone-${z.kind}`);
      // Los números visibles son de base 1; los datos, de base 0.
      cells.push(<div key={`${x},${y}`} className={cls.join(' ')} aria-label={t('dun.cell', { x: x + 1, y: y + 1 })} />);
    }
  }
  return (
    <div
      className="dun-board"
      style={{ aspectRatio: `${size.w} / ${size.h}` }}
      role="group"
      aria-label={t('dun.board', { room: roomName })}
    >
      <div className="dun-grid" style={{ gridTemplateColumns: `repeat(${size.w}, 1fr)`, gridTemplateRows: `repeat(${size.h}, 1fr)` }}>
        {cells}
      </div>
      <div className="dun-pieces">
        {state.pieces.map(p => {
          const name = p.name[lang];
          const label = t('dun.piece', { name, x: p.cell.x + 1, y: p.cell.y + 1 }) + (p.invulnerable ? `, ${t('dun.invulnerable')}` : '');
          const cls = ['dun-piece', `dun-${p.kind}`];
          if (p.invulnerable) cls.push('dun-inv');
          if (p.id === state.actor) cls.push('dun-actor');
          return (
            <div
              key={p.id}
              className={cls.join(' ')}
              style={{ left: `${(p.cell.x / size.w) * 100}%`, top: `${(p.cell.y / size.h) * 100}%`, width: `${100 / size.w}%`, height: `${100 / size.h}%` }}
              title={label}
              data-name={name}
              tabIndex={0}
              role="img"
              aria-label={label}
            >
              <span>{p.label ?? name.charAt(0).toUpperCase()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
