import { useEffect, useMemo, useState } from 'react';
import {
  BUILD_SLOTS, EPIC, RELIC, SOCKET_COLORS, STAT_LABELS,
  type BuildSlot, type EnchantData, type SocketColor, type Sublimation,
} from './lib/game';
import type { BuildRequest, BuildResult } from './lib/optimizer';
import { planRunes } from './lib/runes';
import { sublimationAffinity, sublimationBase } from './lib/sublimations';

const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1).replace('.', ',')} %`;
const slotLabel = (s: BuildSlot) => BUILD_SLOTS.find((x) => x.id === s)!.label;

function Socket({ color, title }: { color: SocketColor; title?: string }) {
  return <span className="socket" title={title ?? SOCKET_COLORS[color].label} style={{ background: SOCKET_COLORS[color].color }} />;
}

type Tab = 'normal' | 'epic' | 'relic';

export default function EnchantPanel({ result, request, onRunes }: {
  result: BuildResult; request: BuildRequest;
  onRunes?: (bonus: Record<string, number> | null) => void;   // avisa al padre del bonus de runas actual
}) {
  const [data, setData] = useState<EnchantData | null>(null);
  const [applied, setApplied] = useState<Partial<Record<BuildSlot, Sublimation>>>({});
  const [tab, setTab] = useState<Tab>('normal');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(15);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/enchant.json').then((r) => r.json()).then(setData).catch(() => undefined);
  }, []);

  // Solo las piezas con engarces pueden llevar sublimación normal.
  const socketSlots = BUILD_SLOTS.map((s) => s.id).filter((s) => (result.slots[s]?.sockets ?? 0) >= 3);
  const patterns = useMemo(() => {
    const p: Partial<Record<BuildSlot, SocketColor[]>> = {};
    for (const [s, sub] of Object.entries(applied)) if (sub && result.slots[s as BuildSlot]) p[s as BuildSlot] = sub.pattern;
    return p;
  }, [applied, result]);

  const reqKey = JSON.stringify({ ...request, excluded: [...request.excluded], locked: undefined });
  const runes = useMemo(
    () => (data ? planRunes(result.slots, request, data.shards, patterns) : null),
    // request se recrea en cada render; reqKey resume sus campos.
    [data, result, patterns, reqKey],
  );

  useEffect(() => onRunes?.(runes?.bonus ?? null), [runes, onRunes]);

  const focus = { crit: request.crit, back: request.back, berserk: request.berserk };
  const list = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const subs = data.sublimations.filter((s) => s.kind === tab && s.effect.length > 0
      && (!q || s.name.toLowerCase().includes(q) || s.effect.join(' ').toLowerCase().includes(q)));
    // Las normales se agrupan por nombre base (I, II, III) mostrando el nivel más alto.
    const groups = new Map<string, Sublimation[]>();
    for (const s of subs) {
      const key = tab === 'normal' ? sublimationBase(s.name) : s.name;
      groups.set(key, [...(groups.get(key) ?? []), s].sort((a, b) => a.level - b.level));
    }
    return [...groups.values()]
      .map((variants) => {
        const top = variants[variants.length - 1];
        return { top, variants, affinity: sublimationAffinity(top, request.role, focus) };
      })
      .sort((a, b) => b.affinity - a.affinity || a.top.name.localeCompare(b.top.name));
    // focus deriva de request (reqKey)
  }, [data, tab, query, reqKey]);

  const epicItem = Object.values(result.slots).find((i) => i?.rarity === EPIC);
  const relicItem = Object.values(result.slots).find((i) => i?.rarity === RELIC);
  const host = tab === 'epic' ? epicItem : tab === 'relic' ? relicItem : null;

  if (!data) return <div className="panel"><h2>Runas y sublimaciones</h2><p className="muted">Cargando…</p></div>;

  return (
    <div className="panel enchant">
      <h2>Runas recomendadas</h2>
      {runes && (
        <>
          <p className="muted">
            Con estas runas: daño/cura {pct((runes.after.derived.output / runes.before.derived.output - 1) * 100)} ·
            PdV efectivos {pct((runes.after.derived.ehp / runes.before.derived.ehp - 1) * 100)}.
            Nivel de runa según el nivel de cada pieza; ×2 = engarce con bonus doble.
          </p>
          <div className="row wrap">
            {Object.entries(runes.bonus).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <span key={k} className="chip">+{v} {STAT_LABELS[k] ?? k}</span>
            ))}
          </div>
          <div className="rune-grid">
            {Object.entries(runes.sockets).map(([slot, sockets]) => (
              <div key={slot} className="rune-item">
                <div className="rune-item-head">
                  <b>{slotLabel(slot as BuildSlot)}</b>
                  <span className="muted">{result.slots[slot as BuildSlot]?.name}</span>
                  {applied[slot as BuildSlot] && (
                    <span className="sub-tag">{applied[slot as BuildSlot]!.name}</span>
                  )}
                </div>
                {sockets!.map((s, i) => (
                  <div key={i} className="rune-line">
                    <Socket color={s.color} />
                    <span>{s.shard.name}</span>
                    <b>+{s.value}</b>
                    {s.doubled && <span className="x2">×2</span>}
                    {s.forced && <span className="muted small-note">color de la sublimación</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="mt">Sublimaciones</h2>
      <div className="seg">
        <button className={tab === 'normal' ? 'on' : ''} onClick={() => { setTab('normal'); setLimit(15); }}>Pergaminos (normales)</button>
        <button className={tab === 'epic' ? 'on' : ''} onClick={() => { setTab('epic'); setLimit(15); }}>Épicas</button>
        <button className={tab === 'relic' ? 'on' : ''} onClick={() => { setTab('relic'); setLimit(15); }}>Reliquia</button>
      </div>

      {tab === 'normal' ? (
        <p className="muted small">Se engarzan en una pieza con 3 engarces seguidos de los colores del patrón (los blancos valen
          para cualquier color). Al aplicarla, las runas de esa pieza se ajustan a esos colores.</p>
      ) : (
        <p className="muted small">
          {host
            ? <>Va en tu objeto {tab === 'epic' ? 'épico' : 'reliquia'}: <b>{host.name}</b>. Solo puedes llevar una.</>
            : <>Tu build no lleva objeto {tab === 'epic' ? 'épico' : 'reliquia'}: esta sublimación no se podría usar.</>}
        </p>
      )}

      {tab === 'normal' && Object.keys(applied).length > 0 && (
        <div className="row wrap">
          {Object.entries(applied).map(([slot, sub]) => (
            <button key={slot} className="chip on" title="Quitar"
              onClick={() => setApplied((a) => { const n = { ...a }; delete n[slot as BuildSlot]; return n; })}>
              {sub!.name} en {slotLabel(slot as BuildSlot)} ✕
            </button>
          ))}
        </div>
      )}

      <input type="search" className="search" placeholder="Buscar por nombre o efecto (en inglés: critical, heal, melee…)"
        value={query} onChange={(e) => setQuery(e.target.value)} />

      <div className="sub-list">
        {list.slice(0, limit).map(({ top, variants, affinity }) => (
          <div key={top.id} className="sub">
            <div className="sub-head">
              <b>{tab === 'normal' ? sublimationBase(top.name) : top.name}</b>
              {top.pattern.length > 0 && <span className="pattern">{top.pattern.map((c, i) => <Socket key={i} color={c} />)}</span>}
              {affinity >= 2.5 && <span className="sug">Sugerida</span>}
              {tab === 'normal' && (
                <select value="" onChange={(e) => {
                  const slot = e.target.value as BuildSlot;
                  if (slot) setApplied((a) => ({ ...a, [slot]: top }));
                }}>
                  <option value="">Aplicar a…</option>
                  {socketSlots.map((s) => (
                    <option key={s} value={s}>{slotLabel(s)}: {result.slots[s]!.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="sub-meta muted">
              {variants.length > 1 && <>Niveles {variants.map((v) => v.level).join(' · ')} · </>}
              {top.stackable && top.maxLevel && <>acumulable hasta nivel {top.maxLevel} · </>}
              {top.source && <>se obtiene en {top.source}</>}
            </div>
            <ul>{top.effect.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        ))}
        {list.length > limit && (
          <button className="small-btn" onClick={() => setLimit((l) => l + 20)}>Ver más ({list.length - limit})</button>
        )}
        {list.length === 0 && <p className="muted">No hay sublimaciones con ese filtro.</p>}
      </div>
      <p className="muted small">"Sugerida" se calcula por palabras clave del efecto según tu rol; es orientativa. Efectos en inglés
        tomados de <a href="https://wakfu.wiki.gg/wiki/List_of_Sublimations" target="_blank" rel="noreferrer">wakfu.wiki.gg</a> (CC BY-SA).</p>
    </div>
  );
}
