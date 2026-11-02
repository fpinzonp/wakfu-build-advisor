import { useEffect, useMemo, useState } from 'react';
import {
  BUILD_SLOTS, CLASSES, ELEMENTS, RARITIES, ROLES, ROLE_DEFAULT_TARGETS, SOURCE_LABELS, STAT_LABELS, isDamageRole, itemImage,
  type BuildSlot, type Element, type Item, type RecipeData, type Role,
} from './lib/game';
import {
  evaluateBuild, rankAlternatives, recommend, swapItem,
  type BuildRequest, type BuildResult, type BuildSlots,
} from './lib/optimizer';
import { materialsFor, upgradeChain } from './lib/materials';
import EnchantPanel from './EnchantPanel';
import MaterialsPanel from './MaterialsPanel';
import StatSheet from './StatSheet';
import StatValuePanel from './StatValuePanel';

const NO_EXTRA: Record<string, number> = {};

interface Dataset { version: string; items: Item[] }

const fmt = (n: number) => Math.round(n).toLocaleString('es-ES');

export default function App() {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [level, setLevel] = useState(200);
  const [classId, setClassId] = useState('yopuka');
  const [role, setRole] = useState<Role>('melee');
  const [elements, setElements] = useState<Element[]>(['fire', 'earth']);
  const [targets, setTargets] = useState(ROLE_DEFAULT_TARGETS('melee', 200));
  const [rarities, setRarities] = useState<number[]>([0, 1, 2, 3, 4, 5, 6, 7]);
  const [minLevel, setMinLevel] = useState(0);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [craftOnly, setCraftOnly] = useState(false);
  const [berserk, setBerserk] = useState(false);
  const [critFocus, setCritFocus] = useState(false);
  const [backFocus, setBackFocus] = useState(false);
  const [locked, setLocked] = useState<BuildSlots>({});

  const [result, setResult] = useState<BuildResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/items.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e) => setError(`No se pudieron cargar los objetos (${e.message}). Ejecuta "npm run data".`));
  }, []);

  useEffect(() => setTargets(ROLE_DEFAULT_TARGETS(role, level)), [role, level]);

  const cls = CLASSES.find((c) => c.id === classId)!;

  const chooseClass = (id: string) => {
    const c = CLASSES.find((x) => x.id === id)!;
    setClassId(id);
    setElements(c.elements.slice(0, 2));
    setRole(c.roles[0]);
    setBerserk(!!c.berserk);
    setCritFocus(!!c.focus?.includes('crit'));
    setBackFocus(!!c.focus?.includes('back'));
  };

  const toggleElement = (e: Element) =>
    setElements((cur) => (cur.includes(e) ? (cur.length > 1 ? cur.filter((x) => x !== e) : cur) : [...cur, e]));

  const toggleRarity = (r: number) =>
    setRarities((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  const makeRequest = (excl = excluded, lock = locked): BuildRequest => {
    // Las piezas fijadas por encima del nivel actual dejan de aplicarse.
    const usable: BuildSlots = {};
    for (const [s, item] of Object.entries(lock)) if (item && item.lvl <= level) usable[s as BuildSlot] = item;
    return {
      level, role, elements, targets, allowedRarities: rarities, minLevel, craftOnly,
      berserk: berserk && !!cls.berserk, crit: critFocus, back: backFocus, excluded: excl, locked: usable,
    };
  };

  const run = (excl = excluded, lock = locked) => {
    if (!data) return;
    setBusy(true);
    // Deja que la interfaz pinte el estado "calculando" antes de bloquear el hilo.
    setTimeout(() => {
      setResult(recommend(data.items, makeRequest(excl, lock)));
      setBusy(false);
    }, 20);
  };

  const exclude = (id: number) => {
    const next = new Set(excluded).add(id);
    const lock = Object.fromEntries(Object.entries(locked).filter(([, i]) => i?.id !== id)) as BuildSlots;
    setExcluded(next);
    setLocked(lock);
    run(next, lock);
  };

  // Cambio manual: la pieza queda fijada y la build se recalcula sin reoptimizar.
  const swap = (slot: BuildSlot, item: Item) => {
    if (!result) return;
    const lock: BuildSlots = { ...locked, [slot]: item };
    if (slot === 'weapon' && item.slot === 'weapon2h') delete lock.offhand;
    setLocked(lock);
    setResult(evaluateBuild(swapItem(result.slots, slot, item), makeRequest(excluded, lock)));
  };

  const unlock = (slot: BuildSlot) =>
    setLocked((cur) => { const n = { ...cur }; delete n[slot]; return n; });

  const excludedItems = useMemo(
    () => (data ? data.items.filter((i) => excluded.has(i.id)) : []),
    [data, excluded],
  );

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Wakfu Build Advisor</h1>
          <p className="sub">Recomendador de equipamiento según tu nivel, clase y estilo de juego</p>
        </div>
        {data && <span className="badge">Datos oficiales v{data.version} · {fmt(data.items.length)} objetos</span>}
      </header>

      <main className="layout">
        <section className="panel form">
          <label className="field">
            <span>Nivel <b>{level}</b></span>
            <input type="range" min={1} max={245} value={level} onChange={(e) => setLevel(+e.target.value)} />
            <input type="number" min={1} max={245} value={level}
              onChange={(e) => setLevel(Math.min(245, Math.max(1, +e.target.value || 1)))} />
          </label>

          <div className="field">
            <span>Clase</span>
            <div className="class-grid">
              {CLASSES.map((c) => (
                <button key={c.id} className={`chip ${c.id === classId ? 'on' : ''}`} onClick={() => chooseClass(c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span>Tipo de juego</span>
            <div className="roles">
              {ROLES.map((r) => (
                <button key={r.id} className={`role ${r.id === role ? 'on' : ''}`} onClick={() => setRole(r.id)}>
                  <strong>{r.label}</strong>
                  <small>{r.hint}</small>
                  {cls.roles.includes(r.id) && <em>Recomendado para {cls.label}</em>}
                </button>
              ))}
            </div>
          </div>

          {cls.berserk && isDamageRole(role) && (
            <label className="check">
              <input type="checkbox" checked={berserk} onChange={(e) => setBerserk(e.target.checked)} />
              <span>Daños berserker <small className="muted">Cuenta el dominio berserker (activo por debajo del 50 % de PdV)</small></span>
            </label>
          )}

          {isDamageRole(role) && (
            <div className="field">
              <span>Priorizar también</span>
              <label className="check">
                <input type="checkbox" checked={critFocus} onChange={(e) => setCritFocus(e.target.checked)} />
                <span>Críticos <small className="muted">% golpe crítico y dominio crítico</small></span>
              </label>
              <label className="check">
                <input type="checkbox" checked={backFocus} onChange={(e) => setBackFocus(e.target.checked)} />
                <span>Daños por la espalda <small className="muted">dominio espalda</small></span>
              </label>
              {cls.focus && <small className="muted">Activados por defecto para {cls.label}.</small>}
            </div>
          )}

          <div className="field">
            <span>Elementos ({elements.length})</span>
            <div className="row">
              {ELEMENTS.map((e) => (
                <button key={e.id} className={`chip el ${elements.includes(e.id) ? 'on' : ''}`}
                  style={{ '--el': e.color } as React.CSSProperties} onClick={() => toggleElement(e.id)}>
                  {e.label}{cls.elements.includes(e.id) ? '' : ' *'}
                </button>
              ))}
            </div>
            <small className="muted">Menos elementos = más dominio por elemento. * fuera de las ramas habituales de la clase.</small>
          </div>

          <label className="check">
            <input type="checkbox" checked={craftOnly} onChange={(e) => setCraftOnly(e.target.checked)} />
            <span>Solo objetos crafteables <small className="muted">(mascota y montura no se filtran)</small></span>
          </label>

          <details className="field">
            <summary>Opciones avanzadas</summary>
            <div className="targets">
              {(['ap', 'mp', 'range'] as const).map((k) => (
                <label key={k}>
                  <span>Objetivo {STAT_LABELS[k]}</span>
                  <input type="number" min={0} max={20} value={targets[k]}
                    onChange={(e) => setTargets({ ...targets, [k]: +e.target.value })} />
                </label>
              ))}
              <label>
                <span>Nivel mínimo de objetos</span>
                <input type="number" min={0} max={level} value={minLevel} onChange={(e) => setMinLevel(+e.target.value)} />
              </label>
            </div>
            <span className="muted">Rarezas permitidas</span>
            <div className="row wrap">
              {Object.entries(RARITIES).map(([r, info]) => (
                <button key={r} className={`chip ${rarities.includes(+r) ? 'on' : ''}`}
                  style={{ color: info.color }} onClick={() => toggleRarity(+r)}>{info.label}</button>
              ))}
            </div>
            {excludedItems.length > 0 && (
              <>
                <span className="muted">Objetos excluidos</span>
                <div className="row wrap">
                  {excludedItems.map((i) => (
                    <button key={i.id} className="chip on" title="Volver a permitir"
                      onClick={() => setExcluded((s) => { const n = new Set(s); n.delete(i.id); return n; })}>
                      {i.name} ✕
                    </button>
                  ))}
                </div>
              </>
            )}
          </details>

          {Object.keys(locked).length > 0 && (
            <div className="locked-note">
              <span>{Object.keys(locked).length} pieza(s) fijada(s): el optimizador las respeta.</span>
              <button className="link" onClick={() => setLocked({})}>Quitar todas</button>
            </div>
          )}

          <button className="go" disabled={!data || busy} onClick={() => run()}>
            {busy ? 'Calculando…' : data ? 'Recomendar build' : 'Cargando datos…'}
          </button>
          {error && <p className="error">{error}</p>}
        </section>

        <section className="results">
          {!result && !busy && (
            <div className="panel empty">
              <h2>Elige tu personaje</h2>
              <p>Indica nivel, clase, tipo de juego y elementos, y pulsa <b>Recomendar build</b>. El optimizador
                revisa todo el equipamiento disponible para tu nivel y busca la combinación con mejor equilibrio entre
                daño (o curas), supervivencia y PA/PM/alcance, respetando las reglas del juego (una reliquia, un épico,
                anillos distintos y armas a dos manos).</p>
            </div>
          )}
          {result && data && (
            <BuildView result={result} level={level} role={role} cls={cls.label} elements={elements}
              items={data.items} request={makeRequest()} locked={locked}
              onExclude={exclude} onSwap={swap} onUnlock={unlock} />
          )}
        </section>
      </main>
      <footer className="site-footer muted small">
        Sitio de fans sin afiliación con Ankama. WAKFU, sus nombres, datos e imágenes son propiedad de Ankama Games.
        Textos de sublimaciones: <a href="https://wakfu.wiki.gg" target="_blank" rel="noreferrer">wakfu.wiki.gg</a> (CC BY-SA).
        Datos del juego: versión {data?.version ?? '—'}.
      </footer>
    </div>
  );
}

function BuildView({ result, level, role, cls, elements, items, request, locked, onExclude, onSwap, onUnlock }: {
  result: BuildResult; level: number; role: Role; cls: string; elements: Element[];
  items: Item[]; request: BuildRequest; locked: BuildSlots;
  onExclude: (id: number) => void; onSwap: (slot: BuildSlot, item: Item) => void; onUnlock: (slot: BuildSlot) => void;
}) {
  const [picker, setPicker] = useState<BuildSlot | null>(null);
  const { totals, derived } = result;
  const roleLabel = ROLES.find((r) => r.id === role)!.label;
  const keyStats: [string, string][] = [
    ['PA', fmt(totals.ap ?? 0)], ['PM', fmt(totals.mp ?? 0)], ['PW', fmt(totals.wp ?? 0)],
    ['Alcance', fmt(totals.range ?? 0)], ['PdV', fmt(derived.hp)],
    [role === 'heal' ? 'Dominio (curas)' : 'Dominio efectivo', fmt(derived.mastery)],
    ['% Crítico', `${fmt(derived.critChance)}%`], ['Reducción por res.', `${fmt(derived.resPct)}%`],
    ['PdV efectivos', fmt(derived.ehp)],
  ];

  // Las recetas se cargan al mostrar la primera build (recetas por pieza y lista de materiales).
  const [recipes, setRecipes] = useState<RecipeData | null>(null);
  const [openRecipe, setOpenRecipe] = useState<number | null>(null);
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/recipes.json').then((r) => r.json()).then(setRecipes).catch(() => undefined);
  }, []);
  const toggleRecipe = (id: number) => setOpenRecipe((cur) => (cur === id ? null : id));

  // Ficha de características: opcionalmente con el bonus de las runas recomendadas (lo calcula EnchantPanel).
  const [runeBonus, setRuneBonus] = useState<Record<string, number> | null>(null);
  const [withRunes, setWithRunes] = useState(true);
  const sheetResult = withRunes && runeBonus ? evaluateBuild(result.slots, request, runeBonus) : result;

  return (
    <>
      <div className="panel">
        <h2>{cls} {roleLabel.toLowerCase()} · nivel {level}</h2>
        <p className="muted">Elementos: {elements.map((e) => ELEMENTS.find((x) => x.id === e)!.label).join(', ')}</p>
        <div className="stats">
          {keyStats.map(([k, v]) => (
            <div key={k} className="stat"><span>{k}</span><b>{v}</b></div>
          ))}
        </div>
      </div>

      <StatSheet result={sheetResult} elements={elements} withRunes={withRunes}
        runesAvailable={!!runeBonus} onToggleRunes={setWithRunes} />

      <StatValuePanel slots={result.slots} request={request} extra={withRunes && runeBonus ? runeBonus : NO_EXTRA} />

      <div className="equip">
        {BUILD_SLOTS.map((s) => {
          const item = result.slots[s.id];
          return (
            <div key={s.id} className="panel item" style={{ '--rar': item ? RARITIES[item.rarity].color : '#444' } as React.CSSProperties}>
              <div className="slot-label">{s.label}</div>
              {item ? (
                <>
                  <div className="item-head">
                    <img src={itemImage(item.gfx)} alt="" loading="lazy" referrerPolicy="no-referrer"
                      onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
                    <div>
                      <div className="item-name">{item.name}</div>
                      <div className="item-meta">Nv. {item.lvl} · {RARITIES[item.rarity].label}</div>
                    </div>
                    <button className="x" title="Excluir este objeto y recalcular" onClick={() => onExclude(item.id)}>✕</button>
                  </div>
                  <div className="source">
                    <span className={`src src-${item.src}`}>
                      {SOURCE_LABELS[item.src]}{item.craft && ` · ${item.craft.job} nv. ${item.craft.lvl}`}
                    </span>
                    {item.src === 'craft' && (
                      <button className="link" onClick={() => toggleRecipe(item.id)}>
                        {openRecipe === item.id ? 'Ocultar receta' : 'Ver receta'}
                      </button>
                    )}
                  </div>
                  <div className="item-actions">
                    <button className="small-btn" onClick={() => setPicker(s.id)}>Cambiar</button>
                    {locked[s.id]?.id === item.id && (
                      <button className="pin" title="Dejar que el optimizador elija esta ranura" onClick={() => onUnlock(s.id)}>
                        Fijado ✕
                      </button>
                    )}
                  </div>
                  {openRecipe === item.id && <RecipeView item={item} data={recipes} />}
                  <ul className="item-stats">
                    {item.multiMast && <li>+{item.multiMast.v} Dominio en {item.multiMast.n} elementos</li>}
                    {item.multiRes && <li>+{item.multiRes.v} Resistencia en {item.multiRes.n} elementos</li>}
                    {Object.entries(item.stats).map(([k, v]) => (
                      <li key={k} className={v < 0 ? 'neg' : ''}>{v > 0 ? '+' : ''}{v} {STAT_LABELS[k] ?? k}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="item-actions">
                  <span className="muted">—</span>
                  <button className="small-btn" onClick={() => setPicker(s.id)}>Elegir</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <EnchantPanel result={result} request={request} onRunes={setRuneBonus} />

      <MaterialsPanel slots={result.slots} recipes={recipes} />

      {picker && (
        <SlotPicker slot={picker} items={items} result={result} request={request}
          onPick={(item) => { onSwap(picker, item); setPicker(null); }} onClose={() => setPicker(null)} />
      )}

      <div className="panel">
        <h2>Aptitudes recomendadas</h2>
        <div className="apt">
          {result.aptitudes.branches.map((b) => (
            <div key={b.branch} className="apt-branch">
              <h3>{b.branch} <small>{b.total} pts</small></h3>
              {b.lines.length === 0 && <p className="muted">Sin puntos todavía</p>}
              {b.lines.map((l, i) => (
                <div key={i} className="apt-line"><span>{l.stat}</span><b>{b.branch === 'Mayor' ? '✓' : l.points}</b></div>
              ))}
            </div>
          ))}
        </div>
        <p className="muted small">La recomendación es heurística: modela daño esperado (dominios × crítico), supervivencia
          (PdV, resistencias, anticipación) y objetivos de PA/PM/alcance. No tiene en cuenta efectos especiales de objetos
          ni sublimaciones. Usa ✕ en un objeto que no puedas conseguir para recalcular sin él.</p>
      </div>
    </>
  );
}

function RecipeView({ item, data }: { item: Item; data: RecipeData | null }) {
  const [mode, setMode] = useState<'chain' | 'last'>('chain');
  if (!data) return <div className="recipe muted">Cargando receta…</div>;

  // Nombre con rareza para el equipamiento: en una mejora, base y resultado se llaman igual.
  const name = (id: number) => {
    const n = id === item.id ? item.name : data.ingredients[id]?.[0] ?? `#${id}`;
    const rarity = id === item.id ? item.rarity : data.ingredients[id]?.[2];
    return rarity === undefined ? n : `${n} (${RARITIES[rarity].label.toLowerCase()})`;
  };

  const chain = upgradeChain(item.id, data);
  const hasChain = chain.steps.length > 1;
  const steps = mode === 'chain' && hasChain
    ? chain.steps.map((s, i) => ({ ...s, title: `Paso ${i + 1}: ${name(s.id)}` }))
    : (data.recipes[item.id] ?? []).map((recipe, i, all) => ({
      id: item.id, recipe, title: all.length > 1 ? `Receta ${i + 1}/${all.length}` : name(item.id),
    }));
  const total = mode === 'chain' && hasChain
    ? materialsFor([item.id], data, { expand: false, fullChain: true }).materials
    : null;

  const ingredientList = (ing: [number, number][]) => (
    <ul>
      {ing.map(([id, qty]) => (
        <li key={id}>
          <img src={itemImage(data.ingredients[id]?.[1] ?? 0)} alt="" loading="lazy" referrerPolicy="no-referrer"
            onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
          <span className="qty">{qty}×</span> {name(id)}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="recipe">
      {hasChain && (
        <div className="seg">
          <button className={mode === 'chain' ? 'on' : ''} onClick={() => setMode('chain')}>
            Cadena completa ({chain.steps.length} pasos)
          </button>
          <button className={mode === 'last' ? 'on' : ''} onClick={() => setMode('last')}>Solo último paso</button>
        </div>
      )}
      {mode === 'chain' && chain.base !== undefined && (
        <div className="plan">Parte de {name(chain.base)}: no se craftea, consíguelo por drop u otras vías.</div>
      )}
      {steps.map(({ recipe: r, title }, i) => (
        <div key={i} className="recipe-block">
          <div className="recipe-head"><b>{title}</b></div>
          <div className="muted">{r.job} · nivel {r.lvl}{r.upgradeOf !== undefined && ` · mejora de ${name(r.upgradeOf)}`}</div>
          {r.plan !== undefined && <div className="plan">Requiere plano: {name(r.plan)}</div>}
          {ingredientList(r.ing)}
        </div>
      ))}
      {total && (
        <div className="recipe-block">
          <div className="recipe-head"><b>Total de la cadena</b></div>
          {ingredientList(total.map((m) => [m.id, m.qty]))}
        </div>
      )}
    </div>
  );
}

const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1).replace('.', ',')} %`;

type RarityMode = 'same' | 'all';
type LevelMode = 'same' | 'band' | 'all';

function SlotPicker({ slot, items, result, request, onPick, onClose }: {
  slot: BuildSlot; items: Item[]; result: BuildResult; request: BuildRequest;
  onPick: (item: Item) => void; onClose: () => void;
}) {
  const slotInfo = BUILD_SLOTS.find((s) => s.id === slot)!;
  const current = result.slots[slot];
  const [rarityMode, setRarityMode] = useState<RarityMode>(current ? 'same' : 'all');
  const [levelMode, setLevelMode] = useState<LevelMode>(current ? 'same' : 'all');
  const [craftOnly, setCraftOnly] = useState(request.craftOnly);
  const [query, setQuery] = useState('');

  const alternatives = useMemo(() => {
    const q = query.trim().toLowerCase();
    const candidates = items.filter((i) => slotInfo.accepts.includes(i.slot)
      && i.lvl <= request.level && i.id !== current?.id && !request.excluded.has(i.id)
      && (rarityMode === 'all' || i.rarity === current?.rarity)
      && (levelMode === 'all' || !current
        || (levelMode === 'same' ? i.lvl === current.lvl : Math.abs(i.lvl - current.lvl) <= 15))
      && (!craftOnly || i.src === 'craft')
      && (!q || i.name.toLowerCase().includes(q)));
    return rankAlternatives(candidates, result, slot, request).slice(0, 80);
    // `request` se recrea en cada render del padre; sus campos relevantes ya cambian `result`.
  }, [items, slotInfo, current, rarityMode, levelMode, craftOnly, query, result, slot]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel picker" onClick={(e) => e.stopPropagation()}>
        <div className="picker-head">
          <div>
            <h2>Cambiar {slotInfo.label.toLowerCase()}</h2>
            {current && <p className="muted">Actual: {current.name} · Nv. {current.lvl} · {RARITIES[current.rarity].label}</p>}
          </div>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="picker-filters">
          <select value={rarityMode} disabled={!current} onChange={(e) => setRarityMode(e.target.value as RarityMode)}>
            <option value="same">Misma rareza</option>
            <option value="all">Todas las rarezas</option>
          </select>
          <select value={levelMode} disabled={!current} onChange={(e) => setLevelMode(e.target.value as LevelMode)}>
            <option value="same">Mismo nivel</option>
            <option value="band">Nivel parecido (±15)</option>
            <option value="all">Cualquier nivel hasta {request.level}</option>
          </select>
          <input type="search" placeholder="Buscar por nombre…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <label className="check">
            <input type="checkbox" checked={craftOnly} onChange={(e) => setCraftOnly(e.target.checked)} />
            <span>Solo crafteables</span>
          </label>
        </div>

        <p className="muted small">Ordenadas por cómo quedaría tu build. "Valoración" resume el cambio completo;
          debajo, el efecto en daño/cura y en PdV efectivos.</p>

        <div className="alt-list">
          {alternatives.length === 0 && <p className="muted">No hay objetos con estos filtros. Prueba a ampliar el nivel o la rareza.</p>}
          {alternatives.map(({ item, result: r, reason, delta }) => (
            <div key={item.id} className={`alt ${reason ? 'disabled' : ''}`}
              style={{ '--rar': RARITIES[item.rarity].color } as React.CSSProperties}>
              <img src={itemImage(item.gfx)} alt="" loading="lazy" referrerPolicy="no-referrer"
                onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
              <div className="alt-main">
                <div className="item-name">{item.name}</div>
                <div className="item-meta">
                  Nv. {item.lvl} · {RARITIES[item.rarity].label} · {SOURCE_LABELS[item.src]}{item.craft && ` (${item.craft.job})`}
                </div>
                <div className="alt-stats">
                  {item.multiMast && <span>+{item.multiMast.v} Dominio en {item.multiMast.n} elem.</span>}
                  {Object.entries(item.stats).slice(0, 8).map(([k, v]) => (
                    <span key={k} className={v < 0 ? 'neg' : ''}>{v > 0 ? '+' : ''}{v} {STAT_LABELS[k] ?? k}</span>
                  ))}
                </div>
              </div>
              <div className="alt-delta">
                {r ? (
                  <>
                    <b className={delta >= 0 ? 'up' : 'down'}>{pct((Math.exp(delta) - 1) * 100)}</b>
                    <small>Daño/cura {pct((r.derived.output / result.derived.output - 1) * 100)}</small>
                    <small>PdV ef. {pct((r.derived.ehp / result.derived.ehp - 1) * 100)}</small>
                    <small>{r.totals.ap ?? 0} PA · {r.totals.mp ?? 0} PM</small>
                  </>
                ) : <small className="neg">{reason}</small>}
              </div>
              <button className="small-btn" disabled={!!reason} onClick={() => onPick(item)}>Usar</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
