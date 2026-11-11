// Sección Mazmorras: guía animada paso a paso de cómo se quita la invulnerabilidad en cada sala.
import { useEffect, useState } from 'react';
import DungeonBoard from './DungeonBoard';
import { DUNGEONS, byTier } from './lib/dungeons';
import { boardAt } from './lib/dungeons/play';
import { t, useLang } from './lib/i18n';

export const PLAY_MS = 1800;

// Al pulsar Reproducir en el último paso se vuelve al inicio; si no, se sigue donde estaba.
export const playFrom = (step: number, total: number) => (step >= total - 1 ? 0 : step);

// Avanza un paso; al llegar al último se detiene la reproducción.
export function autoNext(step: number, total: number): { step: number; playing: boolean } {
  const next = Math.min(step + 1, total - 1);
  return { step: next, playing: next < total - 1 };
}

// Cambiar de mazmorra o de sala vuelve al primer paso y pausa.
export const selectionReset = (): { step: 0; playing: false } => ({ step: 0, playing: false });

export default function DungeonPanel({ active }: { active: boolean }) {
  const { lang } = useLang();
  const [dungeonId, setDungeonId] = useState(DUNGEONS[0].id);
  const [roomId, setRoomId] = useState(DUNGEONS[0].rooms[0].id);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const dungeon = DUNGEONS.find(d => d.id === dungeonId) ?? DUNGEONS[0];
  const room = dungeon.rooms.find(r => r.id === roomId) ?? dungeon.rooms[0];
  const total = room.steps.length;
  const state = boardAt(room, step);

  const reset = () => { const r = selectionReset(); setStep(r.step); setPlaying(r.playing); };
  const pickDungeon = (id: string) => {
    const d = DUNGEONS.find(x => x.id === id) ?? DUNGEONS[0];
    setDungeonId(d.id); setRoomId(d.rooms[0].id); reset();
  };
  const pickRoom = (id: string) => { setRoomId(id); reset(); };

  // Reproducción automática: solo con la sección visible y mientras se esté reproduciendo.
  useEffect(() => {
    if (!active || !playing) return;
    const timer = setInterval(() => {
      const n = autoNext(step, total);
      setStep(n.step);
      setPlaying(n.playing);
    }, PLAY_MS);
    return () => clearInterval(timer);
  }, [active, playing, step, total, dungeonId, roomId]);

  const legend = [
    { cls: 'dun-boss', key: 'dun.legend.boss' },
    { cls: 'dun-mob', key: 'dun.legend.mob' },
    { cls: 'dun-special', key: 'dun.legend.special' },
    { cls: 'dun-char', key: 'dun.legend.char' },
  ] as const;

  return (
    <section className="panel dun" aria-label={t('dun.aria')}>
      <div className="dun-pick">
        <label className="field">
          <span>{t('dun.pick')}</span>
          <select value={dungeon.id} onChange={e => pickDungeon(e.target.value)}>
            {byTier().map(g => (
              <optgroup key={g.tier.join('-')} label={t('dun.tier', { min: g.tier[0], max: g.tier[1] })}>
                {g.dungeons.map(d => <option key={d.id} value={d.id}>{d.name[lang]}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        {dungeon.rooms.length > 1 && (
          <div className="tabs" role="tablist" aria-label={t('dun.room')}>
            {dungeon.rooms.map(r => (
              <button key={r.id} role="tab" aria-selected={r.id === room.id} className={r.id === room.id ? 'on' : ''} onClick={() => pickRoom(r.id)}>
                {r.name[lang]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="dun-controls">
        <button onClick={() => { setStep(0); setPlaying(false); }} aria-label={t('dun.first')} title={t('dun.first')}>⏮</button>
        <button onClick={() => { setStep(Math.max(0, step - 1)); setPlaying(false); }} disabled={step === 0} aria-label={t('dun.prev')} title={t('dun.prev')}>‹</button>
        {playing ? (
          <button onClick={() => setPlaying(false)} aria-label={t('dun.pause')} title={t('dun.pause')}>⏸</button>
        ) : (
          <button onClick={() => { setStep(playFrom(step, total)); setPlaying(true); }} aria-label={t('dun.play')} title={t('dun.play')}>▶</button>
        )}
        <button onClick={() => { setStep(Math.min(total - 1, step + 1)); setPlaying(false); }} disabled={step >= total - 1} aria-label={t('dun.next')} title={t('dun.next')}>›</button>
        <strong className="dun-step">{t('dun.step', { n: step + 1, total })}</strong>
      </div>

      <DungeonBoard state={state} size={room.size} roomName={room.name[lang]} />

      <ul className="dun-legend">
        {legend.map(l => (
          <li key={l.key}><span className={`dun-dot ${l.cls}`} aria-hidden="true" />{t(l.key)}</li>
        ))}
        <li><span className="dun-dot dun-inv" aria-hidden="true" />{t('dun.legend.inv')}</li>
      </ul>

      <p className="dun-text" aria-live="polite">{state.text[lang]}</p>

      {state.counters.length > 0 && (
        <ul className="dun-counters">
          {state.counters.map(c => <li key={c.id}><span>{c.name[lang]}</span> <strong>{c.value}</strong></li>)}
        </ul>
      )}

      <dl className="dun-info">
        <dt>{t('dun.condition')}</dt><dd>{room.condition[lang]}</dd>
        <dt>{t('dun.duration')}</dt><dd>{room.duration[lang]}</dd>
      </dl>
      <p className="dun-foot">
        <a href={dungeon.guide} target="_blank" rel="noopener">{t('dun.guide')}</a>
      </p>
      <p className="dun-warn">{t('dun.unverified')}</p>
    </section>
  );
}
