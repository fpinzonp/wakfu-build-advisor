import { useEffect, useMemo, useState } from 'react';
import {
  BUILD_SLOTS, EPIC, RELIC, SOCKET_COLORS, STAT_LABELS,
  type BuildSlot, type EnchantData, type SocketColor, type Sublimation,
} from './lib/game';
import { evaluateBuild, type BuildRequest, type BuildResult } from './lib/optimizer';
import { planRunes, runeBonus, runeSockets, runeValue, type SocketPlan } from './lib/runes';
import { sublimationAffinity, sublimationBase } from './lib/sublimations';

const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1).replace('.', ',')} %`;
const slotLabel = (s: BuildSlot) => BUILD_SLOTS.find((x) => x.id === s)!.label;

// Sin color = engarce vacío (blanco).
function Socket({ color, title }: { color?: SocketColor; title?: string }) {
  const c = color ? SOCKET_COLORS[color] : { label: 'Vacío', color: '#e8e8e8' };
  return <span className="socket" title={title ?? c.label} style={{ background: c.color }} />;
}

type Tab = 'normal' | 'epic' | 'relic';
// Runas elegidas por el usuario en cada pieza (id de runa por engarce, null = vacío).
type Chosen = Partial<Record<BuildSlot, { itemId: number; shards: (number | null)[] }>>;

export default function EnchantPanel({ result, request, onRunes }: {
  result: BuildResult; request: BuildRequest;
  onRunes?: (bonus: Record<string, number> | null) => void;   // avisa al padre del bonus de runas actual
}) {
  const [data, setData] = useState<EnchantData | null>(null);
  const [applied, setApplied] = useState<Partial<Record<BuildSlot, Sublimation>>>({});
  const [tab, setTab] = useState<Tab>('normal');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(15);
  const [chosen, setChosen] = useState<Chosen>({});

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
  const suggested = useMemo(
    () => (data ? planRunes(result.slots, request, data.shards, patterns) : null),
    // request se recrea en cada render; reqKey resume sus campos.
    [data, result, patterns, reqKey],
  );

  // Engarces agrupados por pieza, con la runa elegida (si la pieza sigue siendo la misma) y la sugerida.
  const groups = useMemo(() => {
    if (!data) return [];
    const byId = new Map(data.shards.map((sh) => [sh.id, sh]));
    const out: { slot: BuildSlot; itemName: string; sockets: { forced?: SocketColor; mine: SocketPlan | null; sug: SocketPlan | null }[] }[] = [];
    const seen = new Map<BuildSlot, number>();
    for (const sock of runeSockets(result.slots, patterns)) {
      const i = seen.get(sock.slot) ?? 0;
      seen.set(sock.slot, i + 1);
      if (i === 0) out.push({ slot: sock.slot, itemName: sock.item.name, sockets: [] });
      const c = chosen[sock.slot];
      const id = c?.itemId === sock.item.id ? c.shards[i] : null;
      const shard = id != null ? byId.get(id) : undefined;
      const mine = shard ? { shard, color: shard.color, forced: false, ...runeValue(sock.item, sock.slot, shard) } : null;
      out[out.length - 1].sockets.push({ forced: sock.forced, mine, sug: suggested?.sockets[sock.slot]?.[i] ?? null });
    }
    return out;
  }, [data, result, patterns, chosen, suggested]);

  const mine = groups.flatMap((g) => g.sockets.flatMap((s) => (s.mine ? [s.mine] : [])));
  const mineKey = mine.map((m) => `${m.shard.id}:${m.value}`).join();
  const bonus = useMemo(() => (mine.length ? runeBonus(mine) : null), [mineKey]);
  useEffect(() => onRunes?.(bonus), [bonus, onRunes]);
  const withMine = useMemo(() => (bonus ? evaluateBuild(result.slots, request, bonus) : null), [bonus, result, reqKey]);

  const setRune = (slot: BuildSlot, index: number, shardId: number | null) => setChosen((c) => {
    const item = result.slots[slot]!;
    const count = groups.find((g) => g.slot === slot)?.sockets.length ?? 0;
    const prev = c[slot]?.itemId === item.id ? c[slot]!.shards : [];
    const shards = Array.from({ length: count }, (_, k) => prev[k] ?? null);
    shards[index] = shardId;
    return { ...c, [slot]: { itemId: item.id, shards } };
  });
  const applySuggested = (only?: BuildSlot) => setChosen((c) => {
    const n = { ...c };
    for (const g of groups) {
      if (only && g.slot !== only) continue;
      n[g.slot] = { itemId: result.slots[g.slot]!.id, shards: g.sockets.map((s) => s.sug?.shard.id ?? null) };
    }
    return n;
  });

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
      <h2>Runas</h2>
      <p className="muted small">Los engarces empiezan vacíos. Pon en cada uno la runa que ya llevas y decide si la cambias por la
        sugerida. Nivel de runa según el nivel de cada pieza; ×2 = engarce con bonus doble.</p>
      {suggested && (
        <p className="muted">
          {withMine && <>Con tus runas: daño/cura {pct((withMine.derived.output / suggested.before.derived.output - 1) * 100)} ·
            PdV efectivos {pct((withMine.derived.ehp / suggested.before.derived.ehp - 1) * 100)}. </>}
          Con las sugeridas: daño/cura {pct((suggested.after.derived.output / suggested.before.derived.output - 1) * 100)} ·
          PdV efectivos {pct((suggested.after.derived.ehp / suggested.before.derived.ehp - 1) * 100)}.
        </p>
      )}
      <div className="row wrap">
        <button className="small-btn" onClick={() => applySuggested()}>Poner todas las sugeridas</button>
        {mine.length > 0 && <button className="small-btn" onClick={() => setChosen({})}>Vaciar todas</button>}
      </div>
      {bonus && (
        <div className="row wrap">
          {Object.entries(bonus).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <span key={k} className="chip">+{v} {STAT_LABELS[k] ?? k}</span>
          ))}
        </div>
      )}
      <div className="rune-grid">
        {groups.map((g) => (
          <div key={g.slot} className="rune-item">
            <div className="rune-item-head">
              <b>{slotLabel(g.slot)}</b>
              <span className="muted">{g.itemName}</span>
              {applied[g.slot] && <span className="sub-tag">{applied[g.slot]!.name}</span>}
              <button className="link-btn" onClick={() => applySuggested(g.slot)}>usar sugeridas</button>
            </div>
            {g.sockets.map((s, i) => {
              const item = result.slots[g.slot]!;
              const same = s.mine && s.sug && s.mine.shard.id === s.sug.shard.id;
              return (
                <div key={i} className="rune-socket">
                  <div className="rune-line">
                    <Socket color={s.mine?.color} />
                    <select value={s.mine?.shard.id ?? ''}
                      onChange={(e) => setRune(g.slot, i, e.target.value ? Number(e.target.value) : null)}>
                      <option value="">Vacío</option>
                      {data.shards.map((sh) => {
                        const v = runeValue(item, g.slot, sh);
                        return (
                          <option key={sh.id} value={sh.id}>
                            {SOCKET_COLORS[sh.color].label}: {sh.name} +{v.value}{v.doubled ? ' (×2)' : ''}
                          </option>
                        );
                      })}
                    </select>
                    {s.mine?.doubled && <span className="x2">×2</span>}
                  </div>
                  {s.forced && s.mine && s.mine.color !== s.forced && (
                    <div className="small-note warn">La sublimación pide aquí color {SOCKET_COLORS[s.forced].label.toLowerCase()}.</div>
                  )}
                  {s.sug && !same && (
                    <div className="rune-sug muted small-note">
                      Sugerida: <Socket color={s.sug.color} /> {s.sug.shard.name} +{s.sug.value}
                      <button className="link-btn" onClick={() => setRune(g.slot, i, s.sug!.shard.id)}>cambiar</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <h2 className="mt">Sublimaciones</h2>
      <div className="seg">
        <button className={tab === 'normal' ? 'on' : ''} onClick={() => { setTab('normal'); setLimit(15); }}>Pergaminos (normales)</button>
        <button className={tab === 'epic' ? 'on' : ''} onClick={() => { setTab('epic'); setLimit(15); }}>Épicas</button>
        <button className={tab === 'relic' ? 'on' : ''} onClick={() => { setTab('relic'); setLimit(15); }}>Reliquia</button>
      </div>

      {tab === 'normal' ? (
        <p className="muted small">Se engarzan en una pieza con 3 engarces seguidos de los colores del patrón (los blancos valen
          para cualquier color). Al aplicarla, las runas sugeridas de esa pieza se ajustan a esos colores.</p>
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

      <input type="search" className="search" placeholder="Buscar por nombre o efecto (crítico, cura, melé…)"
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
      <p className="muted small">"Sugerida" se calcula por palabras clave del efecto según tu rol; es orientativa. Efectos traducidos al
        español desde <a href="https://wakfu.wiki.gg/wiki/List_of_Sublimations" target="_blank" rel="noreferrer">wakfu.wiki.gg</a> (CC BY-SA).</p>
    </div>
  );
}
