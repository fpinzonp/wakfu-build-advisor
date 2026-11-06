import { useEffect, useMemo, useState } from 'react';
import SimAdjust from './SimAdjust';
import SimMap from './SimMap';
import SimSteps from './SimSteps';
import SimTarget, { DUMMY, type MobLoad, type TargetState } from './SimTarget';
import { fmt, t } from './lib/i18n';
import type { Element } from './lib/game';
import type { BuildResult } from './lib/optimizer';
import { spellImage, type Deck, type Spell } from './lib/spells';
import { simulate, type SimActor, type SimStep, type Triple } from './lib/sim/engine';
import { actorFromBuild } from './lib/sim/fromBuild';
import { distance, type Cell, type Facing } from './lib/sim/formulas';
import type { MobData } from './lib/sim/mobs';
import { CONC_KEY, PREPARATION } from './lib/sim/rules/iop';
import { turnOfSteps, turnTotals } from './lib/sim/summary';

const START: Cell = { x: 3, y: 5 };
const MOB_START: Cell = { x: 6, y: 5 };
const STEP_MS = 800;

const costText = (s: Spell) => {
  const c = s.cast;
  if (!c) return t('sim.deck.noData');
  const parts = [c.ap && `${c.ap} ${t('stat.ap')}`, c.mp && `${c.mp} ${t('stat.mp')}`, c.wp && `${c.wp} ${t('stat.wp')}`].filter(Boolean);
  return parts.length ? parts.join(' · ') : `0 ${t('stat.ap')}`;
};

/** Los hechizos sin efecto sobre enemigos (armaduras, curas) se lanzan sobre uno mismo; el resto, al mob. */
const castTarget = (s: Spell): 'mob' | 'self' => {
  const lines = [...(s.cast?.lines ?? []), ...(s.cast?.berserkLines ?? [])];
  return lines.length > 0 && !lines.some((l) => l.side === 'enemy') ? 'self' : 'mob';
};

function Totals({ title, damage, extra }: { title: string; damage: Triple; extra?: string[] }) {
  return (
    <div className="sim-total">
      <h3>{title}</h3>
      <dl>
        <div><dt>{t('sim.total.normal')}</dt><dd>{fmt(damage.normal)}</dd></div>
        <div><dt>{t('sim.total.crit')}</dt><dd>{fmt(damage.crit)}</dd></div>
        <div className="main"><dt>{t('sim.total.avg')}</dt><dd>{fmt(damage.avg)}</dd></div>
      </dl>
      {extra?.map((line) => <p key={line} className="muted small">{line}</p>)}
    </div>
  );
}

export default function SimPanel({ result, classId, level, elements, deck, spells, active, onGoToDeck }: {
  result: BuildResult; classId: string; level: number; elements: Element[]; deck: Deck; spells: Spell[] | null;
  active: boolean; onGoToDeck: () => void;
}) {
  // mobs.json se pide al abrir la pestaña por primera vez.
  const [load, setLoad] = useState<MobLoad>({ status: 'idle' });
  const [opened, setOpened] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { if (active) setOpened(true); }, [active]);
  useEffect(() => {
    if (!opened) return;
    let cancelled = false;
    setLoad({ status: 'loading' });
    fetch(import.meta.env.BASE_URL + 'data/mobs.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: MobData) => { if (!cancelled) setLoad({ status: 'ready', mobs: d.mobs }); })
      .catch(() => { if (!cancelled) setLoad({ status: 'error' }); });
    return () => { cancelled = true; };
  }, [opened, attempt]);

  const [target, setTarget] = useState<TargetState>(DUMMY);
  const [facing, setFacing] = useState<Facing>('w');
  const [mobCell, setMobCell] = useState<Cell>(MOB_START);
  const [placing, setPlacing] = useState(false);
  const [steps, setSteps] = useState<SimStep[]>([]);
  const [comboExtraPct, setComboExtraPct] = useState(0);
  const [preview, setPreview] = useState<Spell | null>(null);
  // `view` es el paso mostrado; null sigue el último (en vivo) y -1 es antes del primer paso.
  const [view, setView] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  // La lista tiene un solo personaje; el aliado llegará en otra tarea.
  const actors: SimActor[] = useMemo(() => [actorFromBuild('main', result, {
    classId, level, elements, deck, spells: spells ?? [], start: START, name: t('sim.me'),
  })], [result, classId, level, elements, deck, spells]);
  const actor = actors[0];

  const sim = useMemo(() => simulate({
    actors, steps, comboExtraPct,
    target: { name: target.mob?.name ?? t('sim.dummy'), hp: target.hp, res: target.res, resBack: target.resBack, resCrit: target.resCrit, cell: mobCell, facing },
  }), [actors, steps, comboExtraPct, target, mobCell, facing]);

  const last = sim.steps.length - 1;
  const idx = view === null ? last : Math.min(view, last);
  const shown = idx >= 0 ? sim.steps[idx].state : null;
  const me = shown?.actors.main;
  const turns = turnOfSteps(sim.steps);
  const turn = idx >= 0 ? turns[idx] : 1;

  // Reproducción: avanza un paso cada 800 ms hasta el último.
  useEffect(() => {
    if (!playing) return;
    if (idx >= last) { setPlaying(false); return; }
    const timer = setTimeout(() => setView(idx + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, idx, last]);

  const add = (step: SimStep) => { setSteps((s) => [...s, step]); setView(null); setPlaying(false); };
  const remove = (i: number) => { setSteps((s) => s.filter((_, j) => j !== i)); setView(null); setPlaying(false); };
  const liveCell = (last >= 0 ? sim.steps[last].state.actors.main?.cell : undefined) ?? START;

  const onCell = (c: Cell) => {
    if (placing) { if (c.x !== liveCell.x || c.y !== liveCell.y) setMobCell(c); return; }
    if (c.x === liveCell.x && c.y === liveCell.y) return;
    add({ type: 'move', actor: 'main', to: c });
  };

  const inRange = useMemo(() => {
    const cast = preview?.cast;
    if (!cast) return undefined;
    const max = Math.max(cast.rangeMin, cast.rangeMax + (cast.rangeMod ? actor.stats.range ?? 0 : 0));
    const from = me?.cell ?? START;
    return (c: Cell) => { const d = distance(from, c); return d >= cast.rangeMin && d <= max; };
  }, [preview, actor, me?.cell]);

  if (!spells) return <div className="panel muted">{t('deck.loading')}</div>;
  if (actor.spells.length === 0) {
    return (
      <div className="panel sim-empty">
        <h2>{t('tab.sim')}</h2>
        <p className="muted">{t('sim.deck.empty')}</p>
        <div><button type="button" className="btn primary" onClick={onGoToDeck}>{t('sim.deck.goto')}</button></div>
      </div>
    );
  }

  const spellById = new Map(actor.spells.map((s) => [s.id, s]));
  const mobHpPct = shown && target.hp > 0 ? Math.round((shown.mobHp / target.hp) * 100) : 100;
  const seq = sim.totals.main;
  const hpNow = me && actor.maxHp > 0 ? Math.round((me.hp / actor.maxHp) * 100) : 100;
  const conc = me?.states[CONC_KEY] ?? 0;
  const prep = me?.states[PREPARATION] ?? 0;
  const supportLine = (k: 'heal' | 'armor', totals: typeof seq) =>
    totals && totals[k].avg > 0 ? `${t(`sim.kind.${k}`)}: ${fmt(totals[k].normal)} / ${fmt(totals[k].crit)} / ${fmt(totals[k].avg)}` : null;
  const extras = (totals: typeof seq) => [supportLine('heal', totals), supportLine('armor', totals)].filter((x): x is string => !!x);

  return (
    <div className="sim" aria-label={t('sim.aria')}>
      <div className="sim-col">
        <SimTarget load={load} target={target} facing={facing} onTarget={setTarget} onFacing={setFacing}
          onRetry={() => setAttempt((n) => n + 1)} />

        <div className="panel">
          <h2>{t('sim.map')}</h2>
          <SimMap me={me?.cell ?? START} mob={mobCell} facing={facing} inRange={inRange} onCell={onCell} />
          <label className="check sim-place">
            <input type="checkbox" checked={placing} onChange={(e) => setPlacing(e.target.checked)} />
            <span>{t('sim.map.place')}</span>
          </label>
          <p className="muted small">{t('sim.map.hint')}</p>
        </div>

        <div className="panel">
          <h2>{t('sim.deck')}</h2>
          <div className="spell-grid">
            {actor.spells.map((s) => (
              <button key={s.id} type="button" className="spell" title={`${s.name} · ${costText(s)}`}
                aria-label={t('sim.spell.add', { name: s.name, cost: costText(s) })}
                onClick={() => add({ type: 'cast', actor: 'main', spell: s.id, target: castTarget(s) })}
                onMouseEnter={() => setPreview(s)} onMouseLeave={() => setPreview(null)}
                onFocus={() => setPreview(s)} onBlur={() => setPreview(null)}>
                <img src={spellImage(s.icon)} alt="" loading="lazy" referrerPolicy="no-referrer" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sim-col">
        <div className="panel sim-res" role="status" aria-label={t('sim.res')}>
          <span>{me?.ap ?? actor.ap}/{actor.ap} {t('stat.ap')}</span>
          <span>{me?.mp ?? actor.mp}/{actor.mp} {t('stat.mp')}</span>
          <span>{me?.wp ?? actor.wp}/{actor.wp} {t('stat.wp')}</span>
          <span>{t('sim.res.hp', { pct: hpNow })}</span>
          {classId === 'yopuka' && <span>{t('sim.res.conc', { n: conc })}</span>}
          {classId === 'yopuka' && prep > 0 && <span>{t('sim.res.prep', { n: prep })}</span>}
        </div>

        <div className="panel sim-steps">
          <div className="sim-controls">
            <div className="actions" role="group" aria-label={t('sim.play')}>
              <button type="button" className="btn" disabled={idx < 0} onClick={() => { setPlaying(false); setView(-1); }}>{t('sim.play.start')}</button>
              <button type="button" className="btn" disabled={idx < 0} onClick={() => { setPlaying(false); setView(idx - 1); }}>{t('sim.play.prev')}</button>
              <button type="button" className="btn" disabled={idx >= last} onClick={() => { setPlaying(false); setView(idx + 1); }}>{t('sim.play.next')}</button>
              <button type="button" className="btn" disabled={last < 0} aria-pressed={playing}
                onClick={() => { if (playing) setPlaying(false); else { if (idx >= last) setView(-1); setPlaying(true); } }}>
                {playing ? t('sim.play.pause') : t('sim.play.play')}
              </button>
              <button type="button" className={`btn ${view === null ? 'primary' : ''}`} aria-pressed={view === null}
                onClick={() => { setPlaying(false); setView(null); }}>{t('sim.play.live')}</button>
            </div>
            <div className="actions">
              <button type="button" className="btn" onClick={() => add({ type: 'endTurn' })}>{t('sim.endTurn')}</button>
              <button type="button" className="btn ghost" disabled={steps.length === 0} onClick={() => { setSteps([]); setView(null); setPlaying(false); }}>
                {t('sim.clear')}
              </button>
            </div>
            <SimAdjust yopuka={classId === 'yopuka'} comboExtraPct={comboExtraPct} onComboExtra={setComboExtraPct} onAdd={add} />
          </div>

          <SimSteps steps={sim.steps} selected={idx} spellName={(id) => spellById.get(id)?.name}
            onSelect={(i) => { setPlaying(false); setView(i); }} onRemove={remove} />
        </div>

        <div className="panel sim-totals">
          <Totals title={t('sim.total.turn', { n: turn })} damage={turnTotals(sim.steps, turn).damage}
            extra={extras(turnTotals(sim.steps, turn))} />
          <Totals title={t('sim.total.seq')} damage={seq?.damage ?? { normal: 0, crit: 0, avg: 0 }} extra={extras(seq)} />
          <p className="muted small">{t('sim.total.mobHp', { pct: mobHpPct })}</p>
          <p className="muted small">{t('sim.unvalidated')}</p>
        </div>
      </div>
    </div>
  );
}
