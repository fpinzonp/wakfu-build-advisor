import { useEffect, useMemo, useState } from 'react';
import SimAdjust from './SimAdjust';
import SimAlly from './SimAlly';
import SimMap from './SimMap';
import SimSteps from './SimSteps';
import SimTarget, { DUMMY, type MobLoad, type TargetState } from './SimTarget';
import { fmt, t } from './lib/i18n';
import type { Element, Item } from './lib/game';
import type { BuildResult } from './lib/optimizer';
import type { StoredBuild } from './lib/share';
import { spellImage, type Deck, type Spell, type SpellData } from './lib/spells';
import { allyFromStored } from './lib/sim/ally';
import { simulate, type ActorId, type CastTarget, type SimActor, type SimStep, type Triple } from './lib/sim/engine';
import { actorFromBuild } from './lib/sim/fromBuild';
import { addArmor, distance, type Cell, type Facing } from './lib/sim/formulas';
import type { MobData } from './lib/sim/mobs';
import { CONC_KEY, PREPARATION } from './lib/sim/rules/iop';
import { turnOfSteps, turnTotals } from './lib/sim/summary';

const START: Cell = { x: 3, y: 5 };
const MOB_START: Cell = { x: 6, y: 5 };
const ALLY_PREF: Cell = { x: 3, y: 3 };
const STEP_MS = 800;
const ZERO: Triple = { normal: 0, crit: 0, avg: 0 };

const costText = (s: Spell) => {
  const c = s.cast;
  if (!c) return t('sim.deck.noData');
  const parts = [c.ap && `${c.ap} ${t('stat.ap')}`, c.mp && `${c.mp} ${t('stat.mp')}`, c.wp && `${c.wp} ${t('stat.wp')}`].filter(Boolean);
  return parts.length ? parts.join(' · ') : `0 ${t('stat.ap')}`;
};

/**
 * Los hechizos sin efecto sobre enemigos (armaduras, curas) se lanzan sobre uno mismo; el resto, al mob.
 * Con aliado, los que tienen efectos sobre aliados van al otro personaje.
 */
const castTarget = (s: Spell, hasAlly: boolean): CastTarget => {
  const lines = [...(s.cast?.lines ?? []), ...(s.cast?.berserkLines ?? [])];
  if (lines.length === 0 || lines.some((l) => l.side === 'enemy')) return 'mob';
  return hasAlly && lines.some((l) => l.side === 'ally') ? 'ally' : 'self';
};

const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

/** Primera casilla libre, empezando por la preferida. */
function freeCell(pref: Cell, taken: Cell[]): Cell {
  const all: Cell[] = [pref];
  for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) all.push({ x, y });
  return all.find((c) => !taken.some((o) => same(c, o)))!;
}

/** Pasos que dejan de tener sentido sin aliado: los suyos y los hechizos dirigidos a él. */
function needsAlly(s: SimStep): boolean {
  if (s.type === 'endTurn') return false;
  if (s.type === 'cast') return s.actor === 'ally' || s.target === 'ally';
  return s.actor === 'ally';
}

/** Barra de PV o de armadura con su texto encima. */
function Bar({ kind, value, max, label }: { kind: 'hp' | 'armor'; value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="sim-bar-item">
      <div>{label}</div>
      <div className={`sim-bar ${kind}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

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

export default function SimPanel({ result, classId, level, elements, deck, spells, items, spellData, active, onGoToDeck }: {
  result: BuildResult; classId: string; level: number; elements: Element[]; deck: Deck; spells: Spell[] | null;
  items: Item[]; spellData: SpellData | null; active: boolean; onGoToDeck: () => void;
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
  // Modo de apoyo: el aliado es opcional; `acting` es quien recibe los hechizos y movimientos nuevos.
  const [ally, setAlly] = useState<SimActor | null>(null);
  const [acting, setActing] = useState<ActorId>('main');
  // Objetivo elegido para el próximo hechizo; null = el que corresponde al hechizo.
  const [castTo, setCastTo] = useState<CastTarget | null>(null);

  const mainActor: SimActor = useMemo(() => actorFromBuild('main', result, {
    classId, level, elements, deck, spells: spells ?? [], start: START, name: t('sim.me'),
  }), [result, classId, level, elements, deck, spells]);
  const actors: SimActor[] = useMemo(() => (ally ? [mainActor, ally] : [mainActor]), [mainActor, ally]);
  const actor = actors.find((a) => a.id === acting) ?? mainActor;
  const mobName = target.mob?.name ?? t('sim.dummy');

  const sim = useMemo(() => simulate({
    actors, steps, comboExtraPct,
    target: { name: mobName, hp: target.hp, res: target.res, resBack: target.resBack, resCrit: target.resCrit, cell: mobCell, facing },
  }), [actors, steps, comboExtraPct, target, mobName, mobCell, facing]);

  const last = sim.steps.length - 1;
  const idx = view === null ? last : Math.min(view, last);
  const shown = idx >= 0 ? sim.steps[idx].state : null;
  const me = shown?.actors.main;
  const allyNow = shown?.actors.ally;
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
  const liveCell = (a: SimActor) => (last >= 0 ? sim.steps[last].state.actors[a.id]?.cell : undefined) ?? a.start;

  const onCell = (c: Cell) => {
    // El mob y los personajes nunca comparten casilla; pulsar la de un personaje no hace nada.
    if (placing) { if (!actors.some((a) => same(liveCell(a), c) || same(a.start, c))) setMobCell(c); return; }
    if (actors.some((a) => same(liveCell(a), c))) return;
    add({ type: 'move', actor: acting, to: c });
  };

  const addAlly = (b: StoredBuild): boolean => {
    if (!spellData) return false;
    const a = allyFromStored(b, items, spellData, freeCell(ALLY_PREF, [mobCell, START]));
    if (!a) return false;
    setAlly(a); setActing('ally'); setCastTo(null);
    return true;
  };
  // Sin aliado dejarían de ser válidos sus pasos y los hechizos dirigidos a él: se borran.
  const removeAlly = () => {
    setSteps((s) => s.filter((x) => !needsAlly(x)));
    setAlly(null); setActing('main'); setCastTo(null); setView(null); setPlaying(false);
  };
  const cast = (s: Spell) => {
    add({ type: 'cast', actor: acting, spell: s.id, target: castTo ?? castTarget(s, !!ally) });
    setCastTo(null);
  };

  const inRange = useMemo(() => {
    const spell = preview?.cast;
    if (!spell) return undefined;
    const max = Math.max(spell.rangeMin, spell.rangeMax + (spell.rangeMod ? actor.stats.range ?? 0 : 0));
    const from = (acting === 'ally' ? allyNow?.cell : me?.cell) ?? actor.start;
    return (c: Cell) => { const d = distance(from, c); return d >= spell.rangeMin && d <= max; };
  }, [preview, actor, acting, me?.cell, allyNow?.cell]);

  if (!spells) return <div className="panel muted">{t('deck.loading')}</div>;
  if (mainActor.spells.length === 0) {
    return (
      <div className="panel sim-empty">
        <h2>{t('tab.sim')}</h2>
        <p className="muted">{t('sim.deck.empty')}</p>
        <div><button type="button" className="btn primary" onClick={onGoToDeck}>{t('sim.deck.goto')}</button></div>
      </div>
    );
  }

  const spellOf = (id: number, who: ActorId) => actors.find((a) => a.id === who)?.spells.find((s) => s.id === id)?.name;
  const mobHpPct = shown && target.hp > 0 ? Math.round((shown.mobHp / target.hp) * 100) : 100;
  const supportLine = (k: 'heal' | 'armor', totals?: Record<'heal' | 'armor', Triple>) =>
    totals && totals[k].avg > 0 ? `${t(`sim.kind.${k}`)}: ${fmt(totals[k].normal)} / ${fmt(totals[k].crit)} / ${fmt(totals[k].avg)}` : null;
  const extras = (totals?: Record<'heal' | 'armor', Triple>) => [supportLine('heal', totals), supportLine('armor', totals)].filter((x): x is string => !!x);
  const others = actors.filter((a) => a.id !== acting);
  const targetOptions: { id: CastTarget | null; label: string }[] = [
    { id: null, label: t('sim.castTo.auto') },
    { id: 'mob', label: mobName },
    { id: 'ally', label: others[0]?.name ?? '' },
    { id: 'self', label: t('sim.castTo.self') },
  ];

  return (
    <div className="sim" aria-label={t('sim.aria')}>
      <div className="sim-col">
        <SimTarget load={load} target={target} facing={facing} onTarget={setTarget} onFacing={setFacing}
          onRetry={() => setAttempt((n) => n + 1)} />

        <div className="panel">
          <h2>{t('sim.map')}</h2>
          <SimMap me={me?.cell ?? START} ally={ally ? allyNow?.cell ?? ally.start : undefined}
            acting={ally ? acting : undefined} allyName={ally?.name} mob={mobCell} facing={facing} inRange={inRange} onCell={onCell} />
          <label className="check sim-place">
            <input type="checkbox" checked={placing} onChange={(e) => setPlacing(e.target.checked)} />
            <span>{t('sim.map.place')}</span>
          </label>
          <p className="muted small">{t(ally ? 'sim.map.hintAlly' : 'sim.map.hint')}</p>
        </div>

        <SimAlly ally={ally} ready={!!spellData && items.length > 0}
          affected={steps.filter(needsAlly).length} onPick={addAlly} onRemove={removeAlly} />

        <div className="panel">
          <h2>{t('sim.deck')}</h2>
          <div className="spell-grid">
            {actor.spells.map((s) => (
              <button key={s.id} type="button" className="spell" title={`${s.name} · ${costText(s)}`}
                aria-label={t('sim.spell.add', { name: s.name, cost: costText(s) })}
                onClick={() => cast(s)}
                onMouseEnter={() => setPreview(s)} onMouseLeave={() => setPreview(null)}
                onFocus={() => setPreview(s)} onBlur={() => setPreview(null)}>
                <img src={spellImage(s.icon)} alt="" loading="lazy" referrerPolicy="no-referrer" />
              </button>
            ))}
            {actor.spells.length === 0 && <p className="muted small">{t('sim.ally.noSpells')}</p>}
          </div>
        </div>
      </div>

      <div className="sim-col">
        <div className="panel sim-res" role="status" aria-label={t('sim.res')}>
          {ally && (
            <div className="sim-who-pick">
              <div className="field">
                <span className="label" id="sim-acting">{t('sim.acting')}</span>
                <div className="seg" role="group" aria-labelledby="sim-acting">
                  {actors.map((a) => (
                    <button key={a.id} type="button" className={a.id === acting ? 'on' : ''} aria-pressed={a.id === acting}
                      onClick={() => { setActing(a.id); setCastTo(null); }}>{a.name}</button>
                  ))}
                </div>
              </div>
              <div className="field">
                <span className="label" id="sim-cast-to">{t('sim.castTo')}</span>
                <div className="seg" role="group" aria-labelledby="sim-cast-to">
                  {targetOptions.map((o) => (
                    <button key={o.id ?? 'auto'} type="button" className={o.id === castTo ? 'on' : ''} aria-pressed={o.id === castTo}
                      onClick={() => setCastTo(o.id)}>{o.label}</button>
                  ))}
                </div>
                <small className="muted">{t('sim.castTo.hint')}</small>
              </div>
            </div>
          )}
          {actors.map((a) => {
            const st = shown?.actors[a.id];
            const hp = st?.hp ?? a.maxHp;
            const armorMax = addArmor(0, Infinity, a.maxHp);
            const hpPct = a.maxHp > 0 ? Math.round((hp / a.maxHp) * 100) : 100;
            const yopuka = a.classId === 'yopuka';
            const prep = st?.states[PREPARATION] ?? 0;
            return (
              <div key={a.id} className={`sim-res-actor ${ally && a.id === acting ? 'acting' : ''}`} role="group" aria-label={a.name}>
                <div className="sim-res-row">
                  {ally && <b className="sim-res-name">{a.name}</b>}
                  <span>{st?.ap ?? a.ap}/{a.ap} {t('stat.ap')}</span>
                  <span>{st?.mp ?? a.mp}/{a.mp} {t('stat.mp')}</span>
                  <span>{st?.wp ?? a.wp}/{a.wp} {t('stat.wp')}</span>
                  {yopuka && <span>{t('sim.res.conc', { n: st?.states[CONC_KEY] ?? 0 })}</span>}
                  {yopuka && prep > 0 && <span>{t('sim.res.prep', { n: prep })}</span>}
                </div>
                <div className="sim-bars">
                  <Bar kind="hp" value={hp} max={a.maxHp} label={`${t('sim.res.hp', { pct: hpPct })} · ${fmt(hp)}/${fmt(a.maxHp)}`} />
                  <Bar kind="armor" value={st?.armor ?? 0} max={armorMax}
                    label={t('sim.res.armor', { n: fmt(st?.armor ?? 0), max: fmt(armorMax) })} />
                </div>
              </div>
            );
          })}
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
            <SimAdjust actor={acting} yopuka={actor.classId === 'yopuka'} comboExtraPct={comboExtraPct}
              onComboExtra={setComboExtraPct} onAdd={add} />
          </div>

          <SimSteps steps={sim.steps} selected={idx} spellName={spellOf}
            names={ally ? { main: mainActor.name, ally: ally.name, mob: mobName } : undefined}
            onSelect={(i) => { setPlaying(false); setView(i); }} onRemove={remove} />
        </div>

        <div className="panel sim-totals">
          {actors.map((a) => {
            const who = ally ? ` · ${a.name}` : '';
            const ofTurn = turnTotals(sim.steps, turn, a.id);
            return [
              <Totals key={`${a.id}-t`} title={t('sim.total.turn', { n: turn }) + who} damage={ofTurn.damage} extra={extras(ofTurn)} />,
              <Totals key={`${a.id}-s`} title={t('sim.total.seq') + who} damage={sim.totals[a.id]?.damage ?? ZERO} extra={extras(sim.totals[a.id])} />,
            ];
          })}
          <p className="muted small">{t('sim.total.mobHp', { pct: mobHpPct })}</p>
          <p className="muted small">{t('sim.unvalidated')}</p>
        </div>
      </div>
    </div>
  );
}
