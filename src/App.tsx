import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BUILD_SLOTS, CLASSES, ELEMENTS, EPIC, RARITIES, RELIC, ROLES, ROLE_DEFAULT_TARGETS, SOURCE_LABELS, STAT_LABELS,
  isDamageRole, itemImage,
  type BuildSlot, type EnchantData, type Element, type Item, type RecipeData, type Role, type SocketColor, type Sublimation,
} from './lib/game';
import {
  evaluateBuild, rankAlternatives, recommend, requiredItems, swapItem,
  type BuildRequest, type BuildResult, type BuildSlots,
} from './lib/optimizer';
import { condLabel, condMet, registerItems } from './lib/conditions';
import { materialsFor, upgradeChain } from './lib/materials';
import { planRunes, runeBonus, runeGroups } from './lib/runes';
import {
  EMPTY_ENCHANT, decodeBuild, encodeBuild, loadStored, readHashCode, saveStored, shareUrl, slotIds, slotsFromIds,
  type BuildSettings, type EnchantState, type SavedBuild, type StoredBuild,
} from './lib/share';
import { bestSublimation, sublimationBonus } from './lib/sublimations';
import { EMPTY_DECK, NO_DECK_BONUS, classSpells, deckBonus, fitDeck, type Deck, type DeckBonus, type Spell, type SpellData } from './lib/spells';
import DeckPanel from './DeckPanel';
import {
  LANGS, LangContext, fmt, initialLang, jobName, locale, pct, setLang as applyLang, setNames, t, tk, type Lang, type LangData,
} from './lib/i18n';
import { localizeEnchant, localizeItems, localizeRecipes, localizeSpells } from './lib/localize';
import EnchantPanel, { Socket } from './EnchantPanel';
import MaterialsPanel from './MaterialsPanel';
import StatSheet from './StatSheet';
import StatValuePanel from './StatValuePanel';

const NO_EXTRA: Record<string, number> = {};

interface Dataset { version: string; items: Item[] }


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
  const [lang, setLangState] = useState<Lang>(() => initialLang());
  const [names, setNamesState] = useState<LangData | null>(null);
  const changeLang = useCallback((l: Lang) => { applyLang(l); setLangState(l); }, []);

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
      .catch((e) => setError(t('app.loadError', { error: e.message })));
    fetch(import.meta.env.BASE_URL + 'data/spells.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setSpellData)
      .catch(() => setSpellData({ version: '', common: [], classes: {} }));
  }, []);

  // Nombres de objetos, runas, hechizos… en el idioma elegido.
  useEffect(() => {
    applyLang(lang);
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}data/lang/${lang}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: LangData) => { if (alive) { setNames(d); setNamesState(d); } })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [lang]);
  // Los nombres se aplican sobre los mismos objetos para que la build actual también cambie de idioma.
  if (names && data) localizeItems(data.items, names);
  if (data) registerItems(data.items);
  if (names && spellData) localizeSpells(spellData, names);

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
      level: s.level, classId: s.classId, role: s.role, elements: s.elements, targets: s.targets, allowedRarities: s.rarities,
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
    if (!saved || !openSaved(saved, data.items)) notify(t('app.badLink'));
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
    const slots = swapItem(result.slots, slot, item);
    const lock: BuildSlots = { ...locked, [slot]: item };
    // Lo que swapItem equipa o quita además (anillo de nación, segunda mano) también queda fijado o liberado.
    for (const s of BUILD_SLOTS.map((b) => b.id)) {
      if (!slots[s]) { if (result.slots[s]) delete lock[s]; }
      else if (slots[s] !== result.slots[s]) lock[s] = slots[s];
    }
    setLocked(lock);
    setResult(evaluateBuild(slots, makeRequest(excluded, lock)));
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
  const buildTitle = `${cls.label} · ${roleLabel(role)} · ${t('common.lvlShort', { n: level })}`;

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
      notify(t('app.saved', { name: entry.name }));
    } else {
      notify(t('app.saveFailed'));
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
      notify(t('app.opened', { name: s.name }));
    } else {
      notify(t('app.openFailed'));
    }
  };

  return (
    <LangContext.Provider value={{ lang, setLang: changeLang }}>
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>Wakfu Build Advisor</h1>
          <p className="tagline">{t('app.tagline')}</p>
        </div>
        <div className="top-actions">
          {data && <span className="badge" title={t('app.itemsCount', { n: fmt(data.items.length) })}>{t('app.dataVersion', { v: data.version })}</span>}
          <select className="lang-select" value={lang} onChange={(e) => changeLang(e.target.value as Lang)} aria-label={t('app.language')}>
            {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <button className="btn ghost" onClick={() => setDialog('library')}>
            {t('app.myBuilds')}{stored.length > 0 && <span className="count">{stored.length}</span>}
          </button>
        </div>
      </header>

      <main className="layout">
        <aside className="panel form" aria-label={t('form.aria')}>
          <div className="form-scroll">
            <FormStep n={1} title={t('form.character')}>
              <div className="field">
                <label htmlFor="level" className="label">{t('form.level')}</label>
                <div className="level-row">
                  <input id="level-range" type="range" min={1} max={245} value={level} aria-label={t('form.level')}
                    onChange={(e) => changeLevel(+e.target.value)} />
                  <input id="level" className="input level-input" type="number" min={1} max={245} value={level}
                    onChange={(e) => changeLevel(Math.min(245, Math.max(1, +e.target.value || 1)))} />
                </div>
              </div>
              <div className="field">
                <span className="label">{t('form.class')}</span>
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

            <FormStep n={2} title={t('form.playstyle')}>
              <div className="roles">
                {ROLES.map((r) => (
                  <button key={r.id} className={`role ${r.id === role ? 'on' : ''}`} aria-pressed={r.id === role}
                    onClick={() => changeRole(r.id)}>
                    <strong>{r.label}</strong>
                    <small>{r.hint}</small>
                    {cls.roles.includes(r.id) && <em>{t('form.usualIn', { cls: cls.label })}</em>}
                  </button>
                ))}
              </div>

              {isDamageRole(role) && (
                <div className="field">
                  <span className="label">{t('form.alsoPrioritize')}</span>
                  <div className="toggles">
                    <Toggle checked={critFocus} onChange={setCritFocus} label={t('form.crits')} hint={t('form.crits.hint')} />
                    <Toggle checked={backFocus} onChange={setBackFocus} label={t('form.back')} hint={t('form.back.hint')} />
                    {cls.berserk && (
                      <Toggle checked={berserk} onChange={setBerserk} label={t('form.berserk')} hint={t('form.berserk.hint')} />
                    )}
                  </div>
                </div>
              )}

              <div className="field">
                <span className="label">{t('form.elements')} <span className="muted">({elements.length})</span></span>
                <div className="el-grid">
                  {ELEMENTS.map((e) => (
                    <button key={e.id} className={`chip el ${elements.includes(e.id) ? 'on' : ''}`} aria-pressed={elements.includes(e.id)}
                      style={{ '--el': e.color } as React.CSSProperties} onClick={() => toggleElement(e.id)}>
                      {e.label}{cls.elements.includes(e.id) ? '' : ' *'}
                    </button>
                  ))}
                </div>
                <small className="muted">{t('form.elements.hint')}</small>
              </div>
            </FormStep>

            <FormStep n={3} title={t('form.filters')}>
              <Toggle checked={craftOnly} onChange={setCraftOnly} label={t('form.craftOnly')}
                hint={t('form.craftOnly.hint')} />
              <details className="advanced">
                <summary>{t('form.advanced')}</summary>
                <div className="targets">
                  {(['ap', 'mp', 'range'] as const).map((k) => (
                    <label key={k}>
                      <span>{t('form.target', { stat: STAT_LABELS[k]! })}</span>
                      <input className="input" type="number" min={0} max={20} value={targets[k]}
                        onChange={(e) => setTargets({ ...targets, [k]: +e.target.value })} />
                    </label>
                  ))}
                  <label>
                    <span>{t('form.minLevel')}</span>
                    <input className="input" type="number" min={0} max={level} value={minLevel}
                      onChange={(e) => setMinLevel(+e.target.value)} />
                  </label>
                </div>
                <span className="label">{t('form.rarities')}</span>
                <div className="row wrap">
                  {Object.entries(RARITIES).map(([r, info]) => (
                    <button key={r} className={`chip rar ${rarities.includes(+r) ? 'on' : ''}`} aria-pressed={rarities.includes(+r)}
                      style={{ '--rar': info.color } as React.CSSProperties} onClick={() => toggleRarity(+r)}>{info.label}</button>
                  ))}
                </div>
                {excludedItems.length > 0 && (
                  <>
                    <span className="label">{t('form.excluded')}</span>
                    <div className="row wrap">
                      {excludedItems.map((i) => (
                        <button key={i.id} className="chip on" title={t('form.allowAgain')}
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
                <span>{t('form.lockedNote', { n: Object.keys(locked).length })}</span>
                <button className="link" onClick={() => setLocked({})}>{t('form.unlockAll')}</button>
              </div>
            )}
            <button className="go" disabled={!data || busy} onClick={() => run()}>
              {busy ? t('form.computing') : data ? (result ? t('form.recompute') : t('form.recommend')) : t('form.loadingItems')}
            </button>
            {error && <p className="error" role="alert">{error}</p>}
          </div>
        </aside>

        <section className="results" ref={resultsRef} aria-live="polite">
          {!result && !busy && <EmptyState />}
          {busy && !result && <div className="panel skeleton" aria-label={t('form.computing')} />}
          {result && data && (
            <BuildView result={result} level={level} role={role} cls={cls.label} elements={elements}
              items={data.items} request={makeRequest()} locked={locked} busy={busy} names={names}
              enchant={enchant} onEnchant={setEnchant}
              spells={spells} deck={deck} onDeck={setDeck} deckBonus={bonusOfDeck}
              onExclude={exclude} onSwap={swap} onUnlock={unlock}
              onShare={share} onSave={() => setDialog('save')} />
          )}
        </section>
      </main>

      <footer className="site-footer">
        {t('footer.fan')}{' '}
        {t('footer.wiki')} <a href="https://wakfu.wiki.gg" target="_blank" rel="noreferrer">wakfu.wiki.gg</a> (CC BY-SA).{' '}
        {t('footer.version', { v: data?.version ?? '—' })}
      </footer>

      {dialog === 'share' && result && (
        <ShareDialog url={shareUrl(currentCode())} onClose={() => setDialog(null)} onCopied={() => notify(t('app.linkCopied'))} />
      )}
      {dialog === 'save' && result && (
        <SaveDialog defaultName={buildTitle} onSave={saveCurrent} onClose={() => setDialog(null)} />
      )}
      {dialog === 'library' && (
        <LibraryDialog builds={stored} onOpen={openStored} onDelete={removeStored}
          onCopy={(s) => navigator.clipboard?.writeText(shareUrl(s.code)).then(() => notify(t('app.linkCopied')), () => undefined)}
          onClose={() => setDialog(null)} canOpen={!!data} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
    </LangContext.Provider>
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
      <h2>{t('empty.title')}</h2>
      <ol className="empty-steps">
        <li><b>{t('empty.s1.title')}</b> {t('empty.s1')}</li>
        <li><b>{t('empty.s2.title')}</b> {t('empty.s2')}</li>
        <li><b>{t('empty.s3.title')}</b> {t('empty.s3')}</li>
      </ol>
      <p className="muted">{t('empty.after')}</p>
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
          <button className="x" aria-label={t('common.close')} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ShareDialog({ url, onClose, onCopied }: { url: string; onClose: () => void; onCopied: () => void }) {
  const copy = () => navigator.clipboard?.writeText(url).then(onCopied, () => undefined);
  return (
    <Modal title={t('share.title')} onClose={onClose}>
      <p className="muted">{t('share.body')}</p>
      <div className="copy-row">
        <input className="input" readOnly value={url} onFocus={(e) => e.target.select()} aria-label={t('share.linkAria')} />
        <button className="btn primary" onClick={copy}>{t('common.copyLink')}</button>
      </div>
    </Modal>
  );
}

function SaveDialog({ defaultName, onSave, onClose }: { defaultName: string; onSave: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState(defaultName);
  return (
    <Modal title={t('save.title')} onClose={onClose}>
      <form className="save-form" onSubmit={(e) => { e.preventDefault(); onSave(name); }}>
        <label className="field">
          <span className="label">{t('save.name')}</span>
          <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </label>
        <p className="muted small">{t('save.hint')}</p>
        <div className="actions end">
          <button type="button" className="btn ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" className="btn primary">{t('save.title')}</button>
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
    <Modal title={t('app.myBuilds')} onClose={onClose} wide>
      {builds.length === 0 ? (
        <div className="empty-inline">
          <p><b>{t('library.empty')}</b></p>
          <p className="muted">{t('library.emptyHint')}</p>
        </div>
      ) : (
        <ul className="library">
          {builds.map((b) => (
            <li key={b.id}>
              <div className="library-main">
                <b>{b.name}</b>
                <span className="muted">{b.summary} · {new Date(b.date).toLocaleDateString(locale())}</span>
              </div>
              {confirm === b.id ? (
                <div className="actions">
                  <button className="btn danger" onClick={() => { onDelete(b.id); setConfirm(null); }}>{t('library.deleteNamed', { name: b.name })}</button>
                  <button className="btn ghost" onClick={() => setConfirm(null)}>{t('common.cancel')}</button>
                </div>
              ) : (
                <div className="actions">
                  <button className="btn primary" disabled={!canOpen} onClick={() => onOpen(b)}>{t('library.open')}</button>
                  <button className="btn ghost" onClick={() => onCopy(b)}>{t('common.copyLink')}</button>
                  <button className="btn ghost" onClick={() => setConfirm(b.id)}>{t('library.delete')}</button>
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
const VIEW_TABS: ViewTab[] = ['equip', 'stats', 'deck', 'enchant', 'craft', 'apt'];

function BuildView({ result, level, role, cls, elements, items, request, locked, busy, enchant, onEnchant,
  spells, deck, onDeck, deckBonus: deckEffect, names, onExclude, onSwap, onUnlock, onShare, onSave }: {
  result: BuildResult; level: number; role: Role; cls: string; elements: Element[];
  items: Item[]; request: BuildRequest; locked: BuildSlots; busy: boolean;
  enchant: EnchantState; onEnchant: (e: EnchantState) => void;
  spells: Spell[] | null; deck: Deck; onDeck: (d: Deck) => void; deckBonus: DeckBonus; names: LangData | null;
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
  if (names && recipes) localizeRecipes(recipes, names);
  if (names && enchantData) localizeEnchant(enchantData, names);
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
  const epicItem = Object.values(result.slots).find((i) => i?.rarity === EPIC);
  const relicItem = Object.values(result.slots).find((i) => i?.rarity === RELIC);

  // Sublimaciones elegidas que están en una pieza equipada.
  const chosenSubs = useMemo(() => {
    const list: Sublimation[] = [];
    for (const [slot, id] of Object.entries(enchant.subs)) {
      const s = subById.get(id!);
      if (s && result.slots[slot as BuildSlot]) list.push(s);
    }
    if (epicItem && enchant.epic != null && subById.get(enchant.epic)) list.push(subById.get(enchant.epic)!);
    if (relicItem && enchant.relic != null && subById.get(enchant.relic)) list.push(subById.get(enchant.relic)!);
    return list;
  }, [enchant, subById, result, epicItem, relicItem]);
  const subsKey = chosenSubs.map((s) => s.id).join();

  // Runas + efectos permanentes de las sublimaciones: se suman a las características como "extra".
  const mineExtra = useMemo(() => {
    const runes = mine.length ? runeBonus(mine) : {};
    if (!mine.length && !chosenSubs.some((s) => s.stats)) return null;
    const before = evaluateBuild(result.slots, request, runes);
    const subs = sublimationBonus(chosenSubs, level, (k) => before.totals[k] ?? 0);
    const stats = { ...runes };
    for (const [k, v] of Object.entries(subs.stats)) stats[k] = (stats[k] ?? 0) + v;
    return { stats, zero: subs.zero };
    // request se recrea en cada render; reqKey resume sus campos.
  }, [bonusKey, subsKey, result, reqKey, level]);
  const bonus = mineExtra && (Object.keys(mineExtra.stats).length || mineExtra.zero.length) ? mineExtra.stats : null;
  const withMine = useMemo(() => {
    if (!mineExtra || !bonus) return null;
    const req = mineExtra.zero.length
      ? { ...request, deck: { stats: request.deck?.stats ?? {}, zero: [...(request.deck?.zero ?? []), ...mineExtra.zero] } }
      : request;
    return evaluateBuild(result.slots, req, bonus);
  }, [mineExtra, bonus, result, reqKey]);

  // Propone la sublimación épica y la de reliquia más afines mientras el usuario no haya elegido.
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
    [t('stat.ap'), fmt(totals.ap ?? 0)], [t('stat.mp'), fmt(totals.mp ?? 0)], [t('stat.wp'), fmt(totals.wp ?? 0)],
    [t('stat.range'), fmt(totals.range ?? 0)], [t('stat.hp'), fmt(derived.hp)],
    [role === 'heal' ? t('summary.masteryHeal') : t('summary.mastery'), fmt(derived.mastery)],
    [t('summary.crit'), `${fmt(derived.critChance)} %`], [t('summary.resReduction'), `${fmt(derived.resPct)} %`],
    [t('summary.ehp'), fmt(derived.ehp)],
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
            <span className="eyebrow">{t('summary.eyebrow')}</span>
            <h2>{cls} · {roleLabel(role)} · {t('common.level', { n: level })}</h2>
            <div className="row wrap el-tags">
              {elements.map((e) => (
                <span key={e} className="el-tag" style={{ '--el': ELEMENTS.find((x) => x.id === e)!.color } as React.CSSProperties}>
                  {elementLabel(e)}
                </span>
              ))}
            </div>
          </div>
          <div className="actions">
            <button className="btn primary" onClick={onShare}>{t('summary.share')}</button>
            <button className="btn" onClick={onSave}>{t('summary.save')}</button>
          </div>
        </div>
        <div className="stats">
          {keyStats.map(([k, v]) => (
            <div key={k} className="stat"><span>{k}</span><b>{v}</b></div>
          ))}
        </div>
      </div>

      <nav className="tabs" role="tablist" aria-label={t('tabs.aria')}>
        {VIEW_TABS.map((id) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {t(`tab.${id}`)}
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
                    <button className="pin" title={t('equip.unlockHint')} onClick={() => onUnlock(s.id)}>
                      {t('equip.locked')} ✕
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
                        <div className="item-meta">{t('common.lvlShort', { n: item.lvl })} · {RARITIES[item.rarity].label}</div>
                      </div>
                    </div>
                    <div className="source">
                      <span className={`src src-${item.src}`}>
                        {SOURCE_LABELS[item.src]}{item.craft && ` · ${jobName(item.craft.job)} ${t('common.lvlShort', { n: item.craft.lvl })}`}
                      </span>
                      {item.src === 'craft' && (
                        <button className="link" aria-expanded={openRecipe === item.id} onClick={() => toggleRecipe(item.id)}>
                          {openRecipe === item.id ? t('equip.hideRecipe') : t('equip.showRecipe')}
                        </button>
                      )}
                    </div>
                    {(runes || subs.length > 0) && (
                      <div className="item-enchant">
                        {runes && (
                          <span className="sockets" title={t('equip.chosenRunes')}>
                            {runes.sockets.map((r, i) => <Socket key={i} color={r.mine?.color} title={r.mine?.shard.name ?? t('socket.empty')} />)}
                          </span>
                        )}
                        {subs.map((n) => <span key={n} className="tag">{n}</span>)}
                      </div>
                    )}
                    {openRecipe === item.id && <RecipeView item={item} data={recipes} />}
                    <ul className="item-stats">
                      {item.multiMast && <li>{t('item.multiMast', { v: item.multiMast.v, n: item.multiMast.n })}</li>}
                      {item.multiRes && <li>{t('item.multiRes', { v: item.multiRes.v, n: item.multiRes.n })}</li>}
                      {Object.entries(item.stats).map(([k, v]) => (
                        <li key={k} className={v < 0 ? 'neg' : ''}>{v > 0 ? '+' : ''}{v} {STAT_LABELS[k] ?? k}</li>
                      ))}
                    </ul>
                    <ItemConds item={item} slots={result.slots} totals={sheetResult.totals} classId={request.classId} />
                    <div className="item-actions">
                      <button className="btn" onClick={() => setPicker(s.id)}>{t('common.change')}</button>
                      <button className="btn ghost" title={t('equip.excludeHint')} onClick={() => onExclude(item.id)}>
                        {t('equip.exclude')}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="item-actions">
                    <span className="muted">{t('socket.empty')}</span>
                    <button className="btn" onClick={() => setPicker(s.id)}>{t('common.choose')}</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
        <p className="muted small">{t('equip.note')}</p>
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
          <h2>{t('apt.title')}</h2>
          <div className="apt">
            {result.aptitudes.branches.map((b) => (
              <div key={b.branch} className="apt-branch">
                <h3>{t(`apt.branch.${b.branch}`)} <small>{t('apt.pts', { n: b.total })}</small></h3>
                {b.lines.length === 0 && <p className="muted">{t('apt.noPoints')}</p>}
                {b.lines.map((l, i) => (
                  <div key={i} className="apt-line"><span>{tk(l.key)}</span><b>{b.branch === 'major' ? '✓' : l.points}</b></div>
                ))}
              </div>
            ))}
          </div>
          <p className="muted small">{t('apt.note')}</p>
        </div>
      </div>

      {picker && (
        <SlotPicker slot={picker} items={items} result={result} request={request}
          onPick={(item) => { onSwap(picker, item); setPicker(null); }} onClose={() => setPicker(null)} />
      )}
    </div>
  );
}

// Condiciones para equipar la pieza: en verde si se cumplen, en rojo si no, en gris si la app no puede comprobarlas.
function ItemConds({ item, slots, totals, classId }: {
  item: Item; slots: BuildSlots; totals: Record<string, number>; classId: string;
}) {
  if (!item.cond?.length) return null;
  const equipped = Object.values(slots);
  const state = { equipped: (id: number) => equipped.some((i) => i?.id === id), total: (k: string) => totals[k] ?? 0, classId };
  const met = item.cond.map((c) => condMet(c, state));
  return (
    <div className="item-conds">
      <span className="eyebrow">{t('cond.title')}</span>
      <ul>
        {item.cond.map((c, i) => (
          <li key={i} className={met[i] === false ? 'neg' : met[i] ? 'ok' : 'muted'}
            title={met[i] === undefined ? t('cond.unchecked') : undefined}>
            {met[i] === false ? '✕' : met[i] ? '✓' : '?'} {condLabel(c)}
          </li>
        ))}
      </ul>
      {met.includes(false) && <p className="neg small">{t('cond.broken')}</p>}
    </div>
  );
}

function RecipeView({ item, data }: { item: Item; data: RecipeData | null }) {
  const [mode, setMode] = useState<'chain' | 'last'>('chain');
  if (!data) return <div className="recipe muted">{t('recipe.loading')}</div>;

  // Nombre con rareza para el equipamiento: en una mejora, base y resultado se llaman igual.
  const name = (id: number) => {
    const n = id === item.id ? item.name : data.ingredients[id]?.[0] ?? `#${id}`;
    const rarity = id === item.id ? item.rarity : data.ingredients[id]?.[2];
    return rarity === undefined ? n : `${n} (${RARITIES[rarity].label.toLowerCase()})`;
  };

  const chain = upgradeChain(item.id, data);
  const hasChain = chain.steps.length > 1;
  const steps = mode === 'chain' && hasChain
    ? chain.steps.map((s, i) => ({ ...s, title: t('recipe.step', { n: i + 1, name: name(s.id) }) }))
    : (data.recipes[item.id] ?? []).map((recipe, i, all) => ({
      id: item.id, recipe, title: all.length > 1 ? t('recipe.nOf', { n: i + 1, total: all.length }) : name(item.id),
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
            {t('recipe.fullChain', { n: chain.steps.length })}
          </button>
          <button className={mode === 'last' ? 'on' : ''} onClick={() => setMode('last')}>{t('recipe.lastStep')}</button>
        </div>
      )}
      {mode === 'chain' && chain.base !== undefined && (
        <div className="plan">{t('recipe.base', { name: name(chain.base) })}</div>
      )}
      {steps.map(({ recipe: r, title }, i) => (
        <div key={i} className="recipe-block">
          <div className="recipe-head"><b>{title}</b></div>
          <div className="muted">{jobName(r.job)} · {t('common.level', { n: r.lvl })}{r.upgradeOf !== undefined && ` · ${t('recipe.upgradeOf', { name: name(r.upgradeOf) })}`}</div>
          {r.plan !== undefined && <div className="plan">{t('recipe.plan', { name: name(r.plan) })}</div>}
          {ingredientList(r.ing)}
        </div>
      ))}
      {total && (
        <div className="recipe-block">
          <div className="recipe-head"><b>{t('recipe.total')}</b></div>
          {ingredientList(total.map((m) => [m.id, m.qty]))}
        </div>
      )}
    </div>
  );
}

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
    <Modal title={t('picker.title', { slot: slotInfo.label.toLowerCase() })} onClose={onClose} wide>
      {current && <p className="muted picker-current">{t('picker.current', { name: current.name, lvl: current.lvl, rarity: RARITIES[current.rarity].label })}</p>}

      <div className="picker-filters">
        <input className="input" type="search" placeholder={t('picker.search')} aria-label={t('picker.searchAria')}
          value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input" aria-label={t('picker.rarity')} value={rarityMode} disabled={!current}
          onChange={(e) => setRarityMode(e.target.value as RarityMode)}>
          <option value="same">{t('picker.sameRarity')}</option>
          <option value="all">{t('picker.allRarities')}</option>
        </select>
        <select className="input" aria-label={t('form.level')} value={levelMode} disabled={!current}
          onChange={(e) => setLevelMode(e.target.value as LevelMode)}>
          <option value="same">{t('picker.sameLevel')}</option>
          <option value="band">{t('picker.bandLevel')}</option>
          <option value="all">{t('picker.anyLevel', { n: request.level })}</option>
        </select>
        <Toggle checked={craftOnly} onChange={setCraftOnly} label={t('picker.craftOnly')} />
      </div>

      <p className="muted small">{t('picker.note')}</p>

      <div className="alt-list">
        {alternatives.length === 0 && <p className="muted">{t('picker.none')}</p>}
        {alternatives.map(({ item, result: r, reason, delta }) => (
          <div key={item.id} className={`alt ${reason ? 'disabled' : ''}`}
            style={{ '--rar': RARITIES[item.rarity].color } as React.CSSProperties}>
            <img src={itemImage(item.gfx)} alt="" loading="lazy" referrerPolicy="no-referrer"
              onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
            <div className="alt-main">
              <div className="item-name">{item.name}</div>
              <div className="item-meta">
                {t('common.lvlShort', { n: item.lvl })} · {RARITIES[item.rarity].label} · {SOURCE_LABELS[item.src]}{item.craft && ` (${jobName(item.craft.job)})`}
              </div>
              <div className="alt-stats">
                {item.multiMast && <span>{t('item.multiMastShort', { v: item.multiMast.v, n: item.multiMast.n })}</span>}
                {Object.entries(item.stats).slice(0, 8).map(([k, v]) => (
                  <span key={k} className={v < 0 ? 'neg' : ''}>{v > 0 ? '+' : ''}{v} {STAT_LABELS[k] ?? k}</span>
                ))}
              </div>
              {(!!item.cond?.length || !reason && requiredItems(result.slots, item).length > 0) && (
                <div className="alt-conds">
                  {item.cond?.map((c, i) => <span key={i}>{condLabel(c)}</span>)}
                  {!reason && requiredItems(result.slots, item).length > 0 && (
                    <span className="also">{t('picker.alsoEquips', { items: requiredItems(result.slots, item).map((i) => i.name).join(', ') })}</span>
                  )}
                </div>
              )}
            </div>
            <div className="alt-delta">
              {r ? (
                <>
                  <b className={delta >= 0 ? 'up' : 'down'}>{pct((Math.exp(delta) - 1) * 100)}</b>
                  <small>{t('picker.output')} {pct((r.derived.output / result.derived.output - 1) * 100)}</small>
                  <small>{t('picker.ehp')} {pct((r.derived.ehp / result.derived.ehp - 1) * 100)}</small>
                  <small>{r.totals.ap ?? 0} {t('stat.ap')} · {r.totals.mp ?? 0} {t('stat.mp')}</small>
                </>
              ) : <small className="neg">{reason}</small>}
            </div>
            <button className="btn" disabled={!!reason} onClick={() => onPick(item)}>{t('picker.use')}</button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
