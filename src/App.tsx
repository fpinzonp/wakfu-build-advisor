import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BUILD_SLOTS, CLASSES, ELEMENTS, EPIC, RARITIES, RELIC, ROLES, ROLE_DEFAULT_TARGETS, SOURCE_LABELS, STAT_LABELS,
  isDamageRole, itemImage,
  type BuildSlot, type EnchantData, type Element, type Item, type RecipeData, type Role, type SocketColor,
} from './lib/game';
import {
  evaluateBuild, rankAlternatives, recommend, swapItem,
  type BuildRequest, type BuildResult, type BuildSlots,
} from './lib/optimizer';
import { materialsFor, upgradeChain } from './lib/materials';
import { planRunes, runeBonus, runeGroups } from './lib/runes';
import {
  EMPTY_ENCHANT, decodeBuild, encodeBuild, loadStored, readHashCode, saveStored, shareUrl, slotIds, slotsFromIds,
  type BuildSettings, type EnchantState, type SavedBuild, type StoredBuild,
} from './lib/share';
import { bestSublimation } from './lib/sublimations';
import { EMPTY_DECK, NO_DECK_BONUS, classSpells, deckBonus, fitDeck, type Deck, type DeckBonus, type Spell, type SpellData } from './lib/spells';
import DeckPanel from './DeckPanel';
import EnchantPanel, { Socket } from './EnchantPanel';
import MaterialsPanel from './MaterialsPanel';
import StatSheet from './StatSheet';
import StatValuePanel from './StatValuePanel';

const NO_EXTRA: Record<string, number> = {};

interface Dataset { version: string; items: Item[] }

const fmt = (n: number) => Math.round(n).toLocaleString('es-ES');

/** Efecto de la baraja: solo cuentan las pasivas de la clase que caben a este nivel. */
function bonusFor(data: SpellData | null, classId: string, deck: Deck, level: number): DeckBonus {
  if (!data) return NO_DECK_BONUS;
  const spells = classSpells(data, classId);
  const byId = new Map(spells.map((s) => [s.id, s]));
  return deckBonus(fitDeck(deck, spells, level).passives.map((id) => byId.get(id)!), level);
}
const elementLabel = (e: Element) => ELEMENTS.find((x) => x.id === e)!.label;
const roleLabel = (r: Role) => ROLES.find((x) => x.id === r)!.label;

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
  const [enchant, setEnchant] = useState<EnchantState>(EMPTY_ENCHANT);
  const [deck, setDeck] = useState<Deck>(EMPTY_DECK);
  const [spellData, setSpellData] = useState<SpellData | null>(null);
  const [busy, setBusy] = useState(false);

  const [stored, setStored] = useState<StoredBuild[]>(() => loadStored());
  const [dialog, setDialog] = useState<'share' | 'save' | 'library' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const resultsRef = useRef<HTMLElement>(null);

  const notify = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 2600);
  }, []);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/items.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e) => setError(`No se pudieron cargar los objetos (${e.message}). Recarga la página para reintentarlo.`));
    fetch(import.meta.env.BASE_URL + 'data/spells.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setSpellData)
      .catch(() => setSpellData({ version: '', common: [], classes: {} }));
  }, []);

  const cls = CLASSES.find((c) => c.id === classId)!;

  const spells = useMemo(() => (spellData ? classSpells(spellData, classId) : null), [spellData, classId]);
  const deckKey = JSON.stringify(deck);
  const bonusOfDeck = useMemo(() => bonusFor(spellData, classId, deck, level), [spellData, classId, deckKey, level]);
  const spellDataRef = useRef(spellData);
  spellDataRef.current = spellData;

  const settings: BuildSettings = {
    level, classId, role, elements, targets, rarities, minLevel, craftOnly,
    berserk, crit: critFocus, back: backFocus, excluded: [...excluded],
  };

  const requestFor = (s: BuildSettings, lock: BuildSlots, deckEffect = bonusOfDeck): BuildRequest => {
    const c = CLASSES.find((x) => x.id === s.classId)!;
    // Las piezas fijadas por encima del nivel actual dejan de aplicarse.
    const usable: BuildSlots = {};
    for (const [slot, item] of Object.entries(lock)) if (item && item.lvl <= s.level) usable[slot as BuildSlot] = item;
    return {
      level: s.level, role: s.role, elements: s.elements, targets: s.targets, allowedRarities: s.rarities,
      minLevel: s.minLevel, craftOnly: s.craftOnly, berserk: s.berserk && !!c.berserk, crit: s.crit, back: s.back,
      excluded: new Set(s.excluded), locked: usable, deck: deckEffect,
    };
  };
  const makeRequest = (excl = excluded, lock = locked) => requestFor({ ...settings, excluded: [...excl] }, lock);

  // Abre una build guardada o compartida tal cual (sin volver a optimizar).
  const openSaved = useCallback((saved: SavedBuild, items: Item[]) => {
    const s = saved.settings;
    if (!CLASSES.some((c) => c.id === s.classId)) return false;
    const slots = slotsFromIds(saved.slots, items);
    const lock: BuildSlots = {};
    for (const slot of saved.locked) if (slots[slot]) lock[slot] = slots[slot];
    setLevel(s.level); setClassId(s.classId); setRole(s.role); setElements(s.elements); setTargets(s.targets);
    setRarities(s.rarities); setMinLevel(s.minLevel); setCraftOnly(s.craftOnly); setBerserk(s.berserk);
    setCritFocus(s.crit); setBackFocus(s.back); setExcluded(new Set(s.excluded)); setLocked(lock);
    setEnchant(saved.enchant);
    setDeck(saved.deck);
    setResult(evaluateBuild(slots, requestFor(s, lock, bonusFor(spellDataRef.current, s.classId, saved.deck, s.level))));
    return true;
    // requestFor solo usa sus argumentos
  }, []);

  // Enlace compartido (#b=…): se abre en cuanto cargan los objetos.
  useEffect(() => {
    if (!data) return;
    const code = readHashCode();
    if (!code) return;
    const saved = decodeBuild(code);
    if (!saved || !openSaved(saved, data.items)) notify('El enlace no contiene una build válida.');
  }, [data, openSaved, notify]);

  // Al cambiar la baraja (o al cargar los hechizos) la build se recalcula sin reoptimizar.
  const bonusKey = JSON.stringify(bonusOfDeck);
  useEffect(() => {
    setResult((r) => (r ? evaluateBuild(r.slots, makeRequest()) : r));
    // makeRequest usa el estado de este render; basta con reaccionar al efecto de la baraja.
  }, [bonusKey]);

  const changeLevel = (l: number) => { setLevel(l); setTargets(ROLE_DEFAULT_TARGETS(role, l)); };
  const changeRole = (r: Role) => { setRole(r); setTargets(ROLE_DEFAULT_TARGETS(r, level)); };

  const chooseClass = (id: string) => {
    const c = CLASSES.find((x) => x.id === id)!;
    if (id !== classId) setDeck(EMPTY_DECK);
    setClassId(id);
    setElements(c.elements.slice(0, 2));
    changeRole(c.roles[0]);
    setBerserk(!!c.berserk);
    setCritFocus(!!c.focus?.includes('crit'));
    setBackFocus(!!c.focus?.includes('back'));
  };

  const toggleElement = (e: Element) =>
    setElements((cur) => (cur.includes(e) ? (cur.length > 1 ? cur.filter((x) => x !== e) : cur) : [...cur, e]));

  const toggleRarity = (r: number) =>
    setRarities((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  const run = (excl = excluded, lock = locked) => {
    if (!data) return;
    setBusy(true);
    // Deja que la interfaz pinte el estado "calculando" antes de bloquear el hilo.
    setTimeout(() => {
      setResult(recommend(data.items, makeRequest(excl, lock)));
      setBusy(false);
      if (window.matchMedia('(max-width: 960px)').matches) resultsRef.current?.scrollIntoView({ block: 'start' });
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

  const currentCode = () => (result ? encodeBuild({
    settings, slots: slotIds(result.slots), locked: Object.keys(locked) as BuildSlot[], enchant, deck,
  }) : '');
  const buildTitle = `${cls.label} · ${roleLabel(role)} · nv. ${level}`;

  const share = () => {
    const code = currentCode();
    history.replaceState(null, '', `#b=${code}`);
    setDialog('share');
  };

  const saveCurrent = (name: string) => {
    const entry: StoredBuild = {
      id: Date.now().toString(36), name: name.trim() || buildTitle, date: new Date().toISOString(),
      code: currentCode(), summary: `${buildTitle} · ${elements.map(elementLabel).join(', ')}`,
    };
    const list = [entry, ...stored];
    if (saveStored(list)) {
      setStored(list);
      notify(`Build "${entry.name}" guardada en este navegador.`);
    } else {
      notify('No se pudo guardar: el navegador no permite almacenamiento local. Usa "Compartir" para conservar el enlace.');
    }
    setDialog(null);
  };

  const removeStored = (id: string) => {
    const list = stored.filter((s) => s.id !== id);
    saveStored(list);
    setStored(list);
  };

  const openStored = (s: StoredBuild) => {
    const saved = decodeBuild(s.code);
    if (data && saved && openSaved(saved, data.items)) {
      history.replaceState(null, '', `#b=${s.code}`);
      setDialog(null);
      notify(`Build "${s.name}" abierta.`);
    } else {
      notify('Esta build guardada está dañada y no se puede abrir.');
    }
  };

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>Wakfu Build Advisor</h1>
          <p className="tagline">Equipamiento recomendado para tu nivel, clase y estilo de juego</p>
        </div>
        <div className="top-actions">
          {data && <span className="badge" title={`${fmt(data.items.length)} objetos`}>Datos v{data.version}</span>}
          <button className="btn ghost" onClick={() => setDialog('library')}>
            Mis builds{stored.length > 0 && <span className="count">{stored.length}</span>}
          </button>
        </div>
      </header>

      <main className="layout">
        <aside className="panel form" aria-label="Configuración del personaje">
          <div className="form-scroll">
            <FormStep n={1} title="Personaje">
              <div className="field">
                <label htmlFor="level" className="label">Nivel</label>
                <div className="level-row">
                  <input id="level-range" type="range" min={1} max={245} value={level} aria-label="Nivel"
                    onChange={(e) => changeLevel(+e.target.value)} />
                  <input id="level" className="input level-input" type="number" min={1} max={245} value={level}
                    onChange={(e) => changeLevel(Math.min(245, Math.max(1, +e.target.value || 1)))} />
                </div>
              </div>
              <div className="field">
                <span className="label">Clase</span>
                <div className="class-grid">
                  {CLASSES.map((c) => (
                    <button key={c.id} className={`chip ${c.id === classId ? 'on' : ''}`} aria-pressed={c.id === classId}
                      onClick={() => chooseClass(c.id)}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </FormStep>

            <FormStep n={2} title="Estilo de juego">
              <div className="roles">
                {ROLES.map((r) => (
                  <button key={r.id} className={`role ${r.id === role ? 'on' : ''}`} aria-pressed={r.id === role}
                    onClick={() => changeRole(r.id)}>
                    <strong>{r.label}</strong>
                    <small>{r.hint}</small>
                    {cls.roles.includes(r.id) && <em>Habitual en {cls.label}</em>}
                  </button>
                ))}
              </div>

              {isDamageRole(role) && (
                <div className="field">
                  <span className="label">Priorizar también</span>
                  <div className="toggles">
                    <Toggle checked={critFocus} onChange={setCritFocus} label="Críticos" hint="% golpe crítico y dominio crítico" />
                    <Toggle checked={backFocus} onChange={setBackFocus} label="Espalda" hint="dominio espalda" />
                    {cls.berserk && (
                      <Toggle checked={berserk} onChange={setBerserk} label="Berserker" hint="activo bajo el 50 % de PdV" />
                    )}
                  </div>
                </div>
              )}

              <div className="field">
                <span className="label">Elementos <span className="muted">({elements.length})</span></span>
                <div className="el-grid">
                  {ELEMENTS.map((e) => (
                    <button key={e.id} className={`chip el ${elements.includes(e.id) ? 'on' : ''}`} aria-pressed={elements.includes(e.id)}
                      style={{ '--el': e.color } as React.CSSProperties} onClick={() => toggleElement(e.id)}>
                      {e.label}{cls.elements.includes(e.id) ? '' : ' *'}
                    </button>
                  ))}
                </div>
                <small className="muted">Menos elementos, más dominio en cada uno. * No es una rama habitual de la clase.</small>
              </div>
            </FormStep>

            <FormStep n={3} title="Filtros">
              <Toggle checked={craftOnly} onChange={setCraftOnly} label="Solo objetos crafteables"
                hint="La mascota y la montura no se filtran" />
              <details className="advanced">
                <summary>Opciones avanzadas</summary>
                <div className="targets">
                  {(['ap', 'mp', 'range'] as const).map((k) => (
                    <label key={k}>
                      <span>Objetivo de {STAT_LABELS[k]}</span>
                      <input className="input" type="number" min={0} max={20} value={targets[k]}
                        onChange={(e) => setTargets({ ...targets, [k]: +e.target.value })} />
                    </label>
                  ))}
                  <label>
                    <span>Nivel mínimo de objetos</span>
                    <input className="input" type="number" min={0} max={level} value={minLevel}
                      onChange={(e) => setMinLevel(+e.target.value)} />
                  </label>
                </div>
                <span className="label">Rarezas permitidas</span>
                <div className="row wrap">
                  {Object.entries(RARITIES).map(([r, info]) => (
                    <button key={r} className={`chip rar ${rarities.includes(+r) ? 'on' : ''}`} aria-pressed={rarities.includes(+r)}
                      style={{ '--rar': info.color } as React.CSSProperties} onClick={() => toggleRarity(+r)}>{info.label}</button>
                  ))}
                </div>
                {excludedItems.length > 0 && (
                  <>
                    <span className="label">Objetos excluidos</span>
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
            </FormStep>
          </div>

          <div className="form-footer">
            {Object.keys(locked).length > 0 && (
              <div className="locked-note">
                <span>{Object.keys(locked).length} pieza(s) fijada(s): se respetan al recalcular.</span>
                <button className="link" onClick={() => setLocked({})}>Soltar todas</button>
              </div>
            )}
            <button className="go" disabled={!data || busy} onClick={() => run()}>
              {busy ? 'Calculando…' : data ? (result ? 'Recalcular build' : 'Recomendar build') : 'Cargando objetos…'}
            </button>
            {error && <p className="error" role="alert">{error}</p>}
          </div>
        </aside>

        <section className="results" ref={resultsRef} aria-live="polite">
          {!result && !busy && <EmptyState />}
          {busy && !result && <div className="panel skeleton" aria-label="Calculando build" />}
          {result && data && (
            <BuildView result={result} level={level} role={role} cls={cls.label} elements={elements}
              items={data.items} request={makeRequest()} locked={locked} busy={busy}
              enchant={enchant} onEnchant={setEnchant}
              spells={spells} deck={deck} onDeck={setDeck} deckBonus={bonusOfDeck}
              onExclude={exclude} onSwap={swap} onUnlock={unlock}
              onShare={share} onSave={() => setDialog('save')} />
          )}
        </section>
      </main>

      <footer className="site-footer">
        Sitio de fans sin afiliación con Ankama. WAKFU, sus nombres, datos e imágenes son propiedad de Ankama Games.
        Textos de sublimaciones: <a href="https://wakfu.wiki.gg" target="_blank" rel="noreferrer">wakfu.wiki.gg</a> (CC BY-SA).
        Datos del juego: versión {data?.version ?? '—'}.
      </footer>

      {dialog === 'share' && result && (
        <ShareDialog url={shareUrl(currentCode())} onClose={() => setDialog(null)} onCopied={() => notify('Enlace copiado.')} />
      )}
      {dialog === 'save' && result && (
        <SaveDialog defaultName={buildTitle} onSave={saveCurrent} onClose={() => setDialog(null)} />
      )}
      {dialog === 'library' && (
        <LibraryDialog builds={stored} onOpen={openStored} onDelete={removeStored}
          onCopy={(s) => navigator.clipboard?.writeText(shareUrl(s.code)).then(() => notify('Enlace copiado.'), () => undefined)}
          onClose={() => setDialog(null)} canOpen={!!data} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function FormStep({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <fieldset className="step">
      <legend><span className="step-n">{n}</span>{title}</legend>
      {children}
    </fieldset>
  );
}

function Toggle({ checked, onChange, label, hint }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string;
}) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}{hint && <small className="muted">{hint}</small>}</span>
    </label>
  );
}

function EmptyState() {
  return (
    <div className="panel empty">
      <h2>Configura tu personaje</h2>
      <ol className="empty-steps">
        <li><b>Nivel y clase.</b> La clase propone sus elementos y su estilo habitual.</li>
        <li><b>Estilo de juego.</b> Tanque, curas, daño a distancia o cuerpo a cuerpo.</li>
        <li><b>Recomendar build.</b> Se revisa todo el equipamiento de tu nivel respetando las reglas del juego: una reliquia,
          un épico, anillos distintos y armas a dos manos.</li>
      </ol>
      <p className="muted">Después podrás cambiar piezas, elegir runas y sublimaciones, ver qué craftear, y guardar o compartir la
        build con un enlace.</p>
    </div>
  );
}

// Ventana modal: Escape cierra, el foco entra al abrir y vuelve al cerrar.
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, button:not(.x), select')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div ref={ref} className={`panel modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="x" aria-label="Cerrar" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ShareDialog({ url, onClose, onCopied }: { url: string; onClose: () => void; onCopied: () => void }) {
  const copy = () => navigator.clipboard?.writeText(url).then(onCopied, () => undefined);
  return (
    <Modal title="Compartir build" onClose={onClose}>
      <p className="muted">Cualquiera que abra este enlace verá esta build exacta: equipo, runas, sublimaciones, baraja y opciones. La build
        va dentro del propio enlace; no se guarda en ningún servidor.</p>
      <div className="copy-row">
        <input className="input" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Enlace de la build" />
        <button className="btn primary" onClick={copy}>Copiar enlace</button>
      </div>
    </Modal>
  );
}

function SaveDialog({ defaultName, onSave, onClose }: { defaultName: string; onSave: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState(defaultName);
  return (
    <Modal title="Guardar build" onClose={onClose}>
      <form className="save-form" onSubmit={(e) => { e.preventDefault(); onSave(name); }}>
        <label className="field">
          <span className="label">Nombre</span>
          <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </label>
        <p className="muted small">Se guarda en este navegador. Para verla en otro dispositivo o enviarla a alguien, usa Compartir.</p>
        <div className="actions end">
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn primary">Guardar build</button>
        </div>
      </form>
    </Modal>
  );
}

function LibraryDialog({ builds, onOpen, onDelete, onCopy, onClose, canOpen }: {
  builds: StoredBuild[]; onOpen: (b: StoredBuild) => void; onDelete: (id: string) => void;
  onCopy: (b: StoredBuild) => void; onClose: () => void; canOpen: boolean;
}) {
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <Modal title="Mis builds" onClose={onClose} wide>
      {builds.length === 0 ? (
        <div className="empty-inline">
          <p><b>Aún no tienes builds guardadas.</b></p>
          <p className="muted">Calcula una build y pulsa "Guardar" en el resumen para tenerla aquí.</p>
        </div>
      ) : (
        <ul className="library">
          {builds.map((b) => (
            <li key={b.id}>
              <div className="library-main">
                <b>{b.name}</b>
                <span className="muted">{b.summary} · {new Date(b.date).toLocaleDateString('es-ES')}</span>
              </div>
              {confirm === b.id ? (
                <div className="actions">
                  <button className="btn danger" onClick={() => { onDelete(b.id); setConfirm(null); }}>Borrar "{b.name}"</button>
                  <button className="btn ghost" onClick={() => setConfirm(null)}>Cancelar</button>
                </div>
              ) : (
                <div className="actions">
                  <button className="btn primary" disabled={!canOpen} onClick={() => onOpen(b)}>Abrir</button>
                  <button className="btn ghost" onClick={() => onCopy(b)}>Copiar enlace</button>
                  <button className="btn ghost" onClick={() => setConfirm(b.id)}>Borrar</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

type ViewTab = 'equip' | 'stats' | 'deck' | 'enchant' | 'craft' | 'apt';
const VIEW_TABS: [ViewTab, string][] = [
  ['equip', 'Equipo'], ['stats', 'Características'], ['deck', 'Hechizos'], ['enchant', 'Runas y sublimaciones'],
  ['craft', 'Crafteo'], ['apt', 'Aptitudes'],
];

function BuildView({ result, level, role, cls, elements, items, request, locked, busy, enchant, onEnchant,
  spells, deck, onDeck, deckBonus: deckEffect, onExclude, onSwap, onUnlock, onShare, onSave }: {
  result: BuildResult; level: number; role: Role; cls: string; elements: Element[];
  items: Item[]; request: BuildRequest; locked: BuildSlots; busy: boolean;
  enchant: EnchantState; onEnchant: (e: EnchantState) => void;
  spells: Spell[] | null; deck: Deck; onDeck: (d: Deck) => void; deckBonus: DeckBonus;
  onExclude: (id: number) => void; onSwap: (slot: BuildSlot, item: Item) => void; onUnlock: (slot: BuildSlot) => void;
  onShare: () => void; onSave: () => void;
}) {
  const [picker, setPicker] = useState<BuildSlot | null>(null);
  const [tab, setTab] = useState<ViewTab>('equip');
  const { totals, derived } = result;

  // Recetas y datos de runas/sublimaciones se cargan al mostrar la primera build.
  const [recipes, setRecipes] = useState<RecipeData | null>(null);
  const [enchantData, setEnchantData] = useState<EnchantData | null>(null);
  const [openRecipe, setOpenRecipe] = useState<number | null>(null);
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/recipes.json').then((r) => r.json()).then(setRecipes).catch(() => undefined);
    fetch(import.meta.env.BASE_URL + 'data/enchant.json').then((r) => r.json()).then(setEnchantData).catch(() => undefined);
  }, []);
  const toggleRecipe = (id: number) => setOpenRecipe((cur) => (cur === id ? null : id));

  const reqKey = JSON.stringify({ ...request, excluded: [...request.excluded], locked: undefined });
  const subById = useMemo(() => new Map(enchantData?.sublimations.map((s) => [s.id, s]) ?? []), [enchantData]);
  const patterns = useMemo(() => {
    const p: Partial<Record<BuildSlot, SocketColor[]>> = {};
    for (const [slot, id] of Object.entries(enchant.subs)) {
      const sub = subById.get(id!);
      if (sub && result.slots[slot as BuildSlot]) p[slot as BuildSlot] = sub.pattern;
    }
    return p;
  }, [enchant.subs, subById, result]);
  const suggested = useMemo(
    () => (enchantData ? planRunes(result.slots, request, enchantData.shards, patterns) : null),
    // request se recrea en cada render; reqKey resume sus campos.
    [enchantData, result, patterns, reqKey],
  );
  const groups = useMemo(
    () => (enchantData ? runeGroups(result.slots, enchantData.shards, patterns, enchant.runes, suggested) : []),
    [enchantData, result, patterns, enchant.runes, suggested],
  );
  const mine = groups.flatMap((g) => g.sockets.flatMap((s) => (s.mine ? [s.mine] : [])));
  const bonusKey = mine.map((m) => `${m.shard.id}:${m.value}`).join();
  const bonus = useMemo(() => (mine.length ? runeBonus(mine) : null), [bonusKey]);
  const withMine = useMemo(() => (bonus ? evaluateBuild(result.slots, request, bonus) : null), [bonus, result, reqKey]);

  // Propone la sublimación épica y la de reliquia más afines mientras el usuario no haya elegido.
  const epicItem = Object.values(result.slots).find((i) => i?.rarity === EPIC);
  const relicItem = Object.values(result.slots).find((i) => i?.rarity === RELIC);
  useEffect(() => {
    if (!enchantData) return;
    const focus = { crit: request.crit, back: request.back, berserk: request.berserk };
    const next = { ...enchant };
    if (next.epic === undefined && epicItem) next.epic = bestSublimation(enchantData.sublimations, 'epic', role, focus)?.id ?? null;
    if (next.relic === undefined && relicItem) next.relic = bestSublimation(enchantData.sublimations, 'relic', role, focus)?.id ?? null;
    if (next.epic !== enchant.epic || next.relic !== enchant.relic) onEnchant(next);
  }, [enchantData, epicItem, relicItem, enchant, role, reqKey, onEnchant]);

  const [withRunes, setWithRunes] = useState(true);
  const sheetResult = withRunes && withMine ? withMine : result;

  const keyStats: [string, string][] = [
    ['PA', fmt(totals.ap ?? 0)], ['PM', fmt(totals.mp ?? 0)], ['PW', fmt(totals.wp ?? 0)],
    ['Alcance', fmt(totals.range ?? 0)], ['PdV', fmt(derived.hp)],
    [role === 'heal' ? 'Dominio (curas)' : 'Dominio efectivo', fmt(derived.mastery)],
    ['Crítico', `${fmt(derived.critChance)} %`], ['Reducción por res.', `${fmt(derived.resPct)} %`],
    ['PdV efectivos', fmt(derived.ehp)],
  ];

  // Sublimaciones a mostrar en la tarjeta de cada pieza
  const subsOf = (slot: BuildSlot, item: Item) => {
    const out: string[] = [];
    const normal = enchant.subs[slot];
    if (normal !== undefined && subById.get(normal)) out.push(subById.get(normal)!.name);
    if (item.rarity === EPIC && enchant.epic != null && subById.get(enchant.epic)) out.push(subById.get(enchant.epic)!.name);
    if (item.rarity === RELIC && enchant.relic != null && subById.get(enchant.relic)) out.push(subById.get(enchant.relic)!.name);
    return out;
  };

  return (
    <div className={`build ${busy ? 'is-busy' : ''}`}>
      <div className="panel summary">
        <div className="summary-head">
          <div>
            <span className="eyebrow">Build recomendada</span>
            <h2>{cls} · {roleLabel(role)} · nivel {level}</h2>
            <div className="row wrap el-tags">
              {elements.map((e) => (
                <span key={e} className="el-tag" style={{ '--el': ELEMENTS.find((x) => x.id === e)!.color } as React.CSSProperties}>
                  {elementLabel(e)}
                </span>
              ))}
            </div>
          </div>
          <div className="actions">
            <button className="btn primary" onClick={onShare}>Compartir</button>
            <button className="btn" onClick={onSave}>Guardar</button>
          </div>
        </div>
        <div className="stats">
          {keyStats.map(([k, v]) => (
            <div key={k} className="stat"><span>{k}</span><b>{v}</b></div>
          ))}
        </div>
      </div>

      <nav className="tabs" role="tablist" aria-label="Secciones de la build">
        {VIEW_TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {/* Las pestañas ocultas siguen montadas para conservar su estado. */}
      <div hidden={tab !== 'equip'} className="tab-body">
        <div className="equip">
          {BUILD_SLOTS.map((s) => {
            const item = result.slots[s.id];
            const runes = groups.find((g) => g.slot === s.id);
            const subs = item ? subsOf(s.id, item) : [];
            return (
              <article key={s.id} className={`panel item ${item ? '' : 'is-empty'}`}
                style={{ '--rar': item ? RARITIES[item.rarity].color : 'var(--line)' } as React.CSSProperties}>
                <div className="slot-label">
                  <span>{s.label}</span>
                  {item && locked[s.id]?.id === item.id && (
                    <button className="pin" title="Dejar que el optimizador elija esta ranura" onClick={() => onUnlock(s.id)}>
                      Fijada ✕
                    </button>
                  )}
                </div>
                {item ? (
                  <>
                    <div className="item-head">
                      <img src={itemImage(item.gfx)} alt="" loading="lazy" referrerPolicy="no-referrer"
                        onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
                      <div>
                        <div className="item-name">{item.name}</div>
                        <div className="item-meta">Nv. {item.lvl} · {RARITIES[item.rarity].label}</div>
                      </div>
                    </div>
                    <div className="source">
                      <span className={`src src-${item.src}`}>
                        {SOURCE_LABELS[item.src]}{item.craft && ` · ${item.craft.job} nv. ${item.craft.lvl}`}
                      </span>
                      {item.src === 'craft' && (
                        <button className="link" aria-expanded={openRecipe === item.id} onClick={() => toggleRecipe(item.id)}>
                          {openRecipe === item.id ? 'Ocultar receta' : 'Ver receta'}
                        </button>
                      )}
                    </div>
                    {(runes || subs.length > 0) && (
                      <div className="item-enchant">
                        {runes && (
                          <span className="sockets" title="Runas elegidas">
                            {runes.sockets.map((r, i) => <Socket key={i} color={r.mine?.color} title={r.mine?.shard.name ?? 'Vacío'} />)}
                          </span>
                        )}
                        {subs.map((n) => <span key={n} className="tag">{n}</span>)}
                      </div>
                    )}
                    {openRecipe === item.id && <RecipeView item={item} data={recipes} />}
                    <ul className="item-stats">
                      {item.multiMast && <li>+{item.multiMast.v} Dominio en {item.multiMast.n} elementos</li>}
                      {item.multiRes && <li>+{item.multiRes.v} Resistencia en {item.multiRes.n} elementos</li>}
                      {Object.entries(item.stats).map(([k, v]) => (
                        <li key={k} className={v < 0 ? 'neg' : ''}>{v > 0 ? '+' : ''}{v} {STAT_LABELS[k] ?? k}</li>
                      ))}
                    </ul>
                    <div className="item-actions">
                      <button className="btn" onClick={() => setPicker(s.id)}>Cambiar</button>
                      <button className="btn ghost" title="No usar este objeto y recalcular" onClick={() => onExclude(item.id)}>
                        Excluir
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="item-actions">
                    <span className="muted">Vacío</span>
                    <button className="btn" onClick={() => setPicker(s.id)}>Elegir</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
        <p className="muted small">Usa "Excluir" en un objeto que no puedas conseguir para recalcular sin él. Al cambiar una pieza
          a mano queda fijada y se respeta en los siguientes cálculos.</p>
      </div>

      <div hidden={tab !== 'stats'} className="tab-body">
        <StatSheet result={sheetResult} elements={elements} withRunes={withRunes}
          runesAvailable={!!bonus} onToggleRunes={setWithRunes} runeBonus={bonus} />
        <StatValuePanel slots={result.slots} request={request} extra={withRunes && bonus ? bonus : NO_EXTRA} />
      </div>

      <div hidden={tab !== 'deck'} className="tab-body">
        <DeckPanel spells={spells} deck={deck} level={level} bonus={deckEffect} onChange={onDeck} onShare={onShare} />
      </div>

      <div hidden={tab !== 'enchant'} className="tab-body">
        <EnchantPanel data={enchantData} result={result} request={request} enchant={enchant} onChange={onEnchant}
          suggested={suggested} groups={groups} withMine={withMine} />
      </div>

      <div hidden={tab !== 'craft'} className="tab-body">
        <MaterialsPanel slots={result.slots} recipes={recipes} />
      </div>

      <div hidden={tab !== 'apt'} className="tab-body">
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
            (PdV, resistencias, anticipación) y objetivos de PA/PM/alcance, más los efectos permanentes de las pasivas de tu
            baraja. No tiene en cuenta efectos especiales de objetos ni sublimaciones.</p>
        </div>
      </div>

      {picker && (
        <SlotPicker slot={picker} items={items} result={result} request={request}
          onPick={(item) => { onSwap(picker, item); setPicker(null); }} onClose={() => setPicker(null)} />
      )}
    </div>
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

  return (
    <Modal title={`Cambiar ${slotInfo.label.toLowerCase()}`} onClose={onClose} wide>
      {current && <p className="muted picker-current">Actual: {current.name} · Nv. {current.lvl} · {RARITIES[current.rarity].label}</p>}

      <div className="picker-filters">
        <input className="input" type="search" placeholder="Buscar por nombre…" aria-label="Buscar objeto"
          value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input" aria-label="Rareza" value={rarityMode} disabled={!current}
          onChange={(e) => setRarityMode(e.target.value as RarityMode)}>
          <option value="same">Misma rareza</option>
          <option value="all">Todas las rarezas</option>
        </select>
        <select className="input" aria-label="Nivel" value={levelMode} disabled={!current}
          onChange={(e) => setLevelMode(e.target.value as LevelMode)}>
          <option value="same">Mismo nivel</option>
          <option value="band">Nivel parecido (±15)</option>
          <option value="all">Cualquier nivel hasta {request.level}</option>
        </select>
        <Toggle checked={craftOnly} onChange={setCraftOnly} label="Solo crafteables" />
      </div>

      <p className="muted small">Ordenadas por cómo quedaría tu build. El porcentaje grande resume el cambio completo; debajo,
        el efecto en daño/cura y en PdV efectivos.</p>

      <div className="alt-list">
        {alternatives.length === 0 && <p className="muted">Ningún objeto cumple estos filtros. Prueba con otro nivel o rareza.</p>}
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
            <button className="btn" disabled={!!reason} onClick={() => onPick(item)}>Usar</button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
