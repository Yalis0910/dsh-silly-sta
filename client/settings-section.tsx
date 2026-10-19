/** The「角色扮演」settings page: user identity, storage, gallery and card library + sub-pages. */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { IconQuestionOutlineRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { api, formatBytes, stampedUrl, type CardSummary, type GalleryUsage, type RoleplaySettingsValue, type StoreScope, type UserPersonaValue } from './api.ts'
import { CardEditor } from './card-editor.tsx'
import { ImageGalleryPage } from './gallery.tsx'
import { currentWorkspace, subscribeWorkspaces, type WorkspaceInfo } from './runtime.ts'
import { useT, tf } from './i18n.ts'

type Draft = RoleplaySettingsValue

function Field({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div className="rp-field">
      <label>{label}</label>
      {children}
    </div>
  )
}

/** One opt-in row in the risky-features block: label + hover-help on the left, a switch on the right. */
function RiskToggle({ label, hint, value, onToggle }: { label: string; hint: string; value: boolean; onToggle: () => void }): ReactNode {
  return (
    <div className="rp-risk-row">
      <span className="rp-risk-label">
        {label}
        <Tooltip label={hint} side="bottom" maxWidth={320}>
          <span className="rp-risk-help" tabIndex={0}><IconQuestionOutlineRegular size={14} /></span>
        </Tooltip>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        className={`rp-switch${value ? ' rp-on' : ''}`}
        onClick={onToggle}
      >
        <span className="rp-switch-knob" />
      </button>
    </div>
  )
}

export function RoleplaySettingsSection(): ReactNode {
  const t = useT()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  /** Card id being edited; set = the card-editor sub-page replaces the list. */
  const [editing, setEditing] = useState<string | null>(null)
  /** Whether the image-gallery sub-page replaces the section body. */
  const [gallery, setGallery] = useState(false)
  const [tab, setTab] = useState<'cards' | 'player' | 'prefs'>('cards')
  const saveTimer = useRef<number | undefined>(undefined)
  /** The workspace the open session belongs to — the workspace-store target. */
  const ws = useSyncExternalStore(subscribeWorkspaces, currentWorkspace)

  useEffect(() => {
    api.settings()
      .then(result => {
        setDraft(result.value)
      })
      .catch(err => setError(String(err instanceof Error ? err.message : err)))
  }, [])

  const patch = useCallback((partial: Partial<Draft>) => {
    setDraft(current => (current ? { ...current, ...partial } : current))
    setMessage('')
    if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void api.updateSettings(partial)
        .then(() => {
          setMessage(t('rp.settings.saved'))
        })
        .catch(err => setError(String(err instanceof Error ? err.message : err)))
    }, 500)
  }, [t])

  // ── sub-pages ──
  if (editing) {
    return <CardEditor cardId={editing} onClose={() => setEditing(null)} ws={ws?.path} />
  }
  if (gallery) {
    return <ImageGalleryPage onClose={() => setGallery(false)} ws={ws?.path} />
  }

  if (error && !draft) return <div className="rp-settings"><span className="rp-error">{error}</span></div>
  if (!draft) return <div className="rp-settings"><span className="rp-note">{t('rp.settings.loading')}</span></div>

  const text = (key: keyof Draft, label: string, props?: { placeholder?: string; secret?: boolean }) => (
    <Field label={label}>
      <input
        type={props?.secret ? 'password' : 'text'}
        placeholder={props?.placeholder}
        value={String(draft[key] ?? '')}
        onChange={event => patch({ [key]: event.target.value } as Partial<Draft>)}
      />
    </Field>
  )

  return (
    <div className="rp-settings">
      <div>
        <h3>{t('rp.settings.title')}</h3>
        <span className="rp-note">
          {t('rp.settings.note')}{message ? ` · ${message}` : ''}
        </span>
        {error ? <div className="rp-error">{error}</div> : null}
      </div>

      <div className="rp-editor-tabs rp-settings-tabs">
        <button
          type="button"
          className={`rp-editor-tab${tab === 'cards' ? ' rp-active' : ''}`}
          onClick={() => setTab('cards')}
        >
          {t('rp.settings.tab.cards')}
        </button>
        <button
          type="button"
          className={`rp-editor-tab${tab === 'player' ? ' rp-active' : ''}`}
          onClick={() => setTab('player')}
        >
          {t('rp.settings.tab.player')}
        </button>
        <button
          type="button"
          className={`rp-editor-tab${tab === 'prefs' ? ' rp-active' : ''}`}
          onClick={() => setTab('prefs')}
        >
          {t('rp.settings.tab.prefs')}
        </button>
      </div>

      {tab === 'cards' ? (
        <div className="rp-settings-tab-pane">
          <CardManager onEdit={setEditing} ws={ws} />
          <GalleryEntry onOpen={() => setGallery(true)} ws={ws?.path} />
        </div>
      ) : null}

      {tab === 'player' ? (
        <div className="rp-settings-tab-pane">
          <div>
            <h4>{t('rp.player.heading')}</h4>
            <div className="rp-inline">
              {text('userName', t('rp.player.name'))}
            </div>
            <Field label={t('rp.player.persona')}>
              <textarea value={draft.userPersona} onChange={event => patch({ userPersona: event.target.value })} />
            </Field>
            <UserPersonaManager
              personas={draft.userPersonas ?? []}
              onChange={userPersonas => patch({ userPersonas })}
            />
          </div>
        </div>
      ) : null}

      {tab === 'prefs' ? (
        <div className="rp-settings-tab-pane">
          <div>
            <h4>{t('rp.choice.heading')}</h4>
            <div className="rp-inline">
              <Field label={t('rp.choice.mode')}>
                <select value={draft.choiceMode ? 'on' : 'off'} onChange={event => patch({ choiceMode: event.target.value === 'on' })}>
                  <option value="off">{t('rp.choice.off')}</option>
                  <option value="on">{t('rp.choice.on')}</option>
                </select>
              </Field>
              <Field label={t('rp.choice.count')}>
                <input
                  type="number" min={2} max={8} value={draft.choiceCount}
                  onChange={event => patch({ choiceCount: Math.min(8, Math.max(2, Number(event.target.value) || 2)) })}
                />
              </Field>
            </div>
          </div>

          <div>
            <h4>{t('rp.risk.heading')}</h4>
            <span className="rp-note">{t('rp.risk.warning')}</span>
            <RiskToggle
              label={t('rp.risk.fileTools')}
              hint={t('rp.risk.fileTools.hint')}
              value={draft.allowFileTools}
              onToggle={() => patch({ allowFileTools: !draft.allowFileTools })}
            />
            <RiskToggle
              label={t('rp.risk.webTools')}
              hint={t('rp.risk.webTools.hint')}
              value={draft.allowWebTools}
              onToggle={() => patch({ allowWebTools: !draft.allowWebTools })}
            />
          </div>

          <StorageBlock draft={draft} patch={patch} ws={ws} />
        </div>
      ) : null}
    </div>
  )
}

function UserPersonaManager({ personas, onChange }: {
  personas: UserPersonaValue[]
  onChange: (personas: UserPersonaValue[]) => void
}): ReactNode {
  const t = useT()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftPersona, setDraftPersona] = useState('')

  const startCreate = () => {
    setEditingId('new')
    setDraftName('')
    setDraftPersona('')
  }

  const startEdit = (p: UserPersonaValue) => {
    setEditingId(p.id)
    setDraftName(p.name)
    setDraftPersona(p.persona)
  }

  const cancel = () => {
    setEditingId(null)
  }

  const save = () => {
    const trimmedName = draftName.trim()
    if (!trimmedName) return
    if (editingId === 'new') {
      const newPersona: UserPersonaValue = {
        id: crypto.randomUUID(),
        name: trimmedName,
        persona: draftPersona.trim(),
      }
      onChange([...personas, newPersona])
    } else {
      onChange(personas.map(p => (p.id === editingId ? { ...p, name: trimmedName, persona: draftPersona.trim() } : p)))
    }
    setEditingId(null)
  }

  const remove = (p: UserPersonaValue) => {
    if (window.confirm(tf('rp.player.personas.deleteConfirm', { name: p.name }))) {
      onChange(personas.filter(item => item.id !== p.id))
      if (editingId === p.id) setEditingId(null)
    }
  }

  return (
    <div className="rp-persona-manager">
      <div className="rp-cardmanager-head" style={{ marginTop: 12 }}>
        <div>
          <span className="rp-cardname" style={{ fontSize: 13 }}>{t('rp.player.personas')}</span>
          <span className="rp-note" style={{ display: 'block', marginTop: 2 }}>{t('rp.player.personas.hint')}</span>
        </div>
        <button type="button" className="rp-btn rp-btn-primary" onClick={startCreate}>
          + {t('rp.player.personas.add')}
        </button>
      </div>

      {editingId !== null ? (
        <div className="rp-persona-editbox">
          <Field label={t('rp.player.personas.name')}>
            <input
              value={draftName}
              placeholder={t('rp.player.personas.name')}
              onChange={e => setDraftName(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label={t('rp.player.personas.desc')}>
            <textarea
              rows={3}
              value={draftPersona}
              placeholder={t('rp.player.personas.desc')}
              onChange={e => setDraftPersona(e.target.value)}
            />
          </Field>
          <div className="rp-actions">
            <button type="button" className="rp-btn rp-btn-primary" disabled={!draftName.trim()} onClick={save}>
              {t('rp.editor.save')}
            </button>
            <button type="button" className="rp-btn" onClick={cancel}>
              {t('rp.dock.cancel')}
            </button>
          </div>
        </div>
      ) : null}

      {personas.length === 0 ? (
        <span className="rp-note" style={{ display: 'block', marginTop: 4 }}>{t('rp.player.personas.empty')}</span>
      ) : (
        <div className="rp-persona-list">
          {personas.map(p => (
            <div key={p.id} className="rp-persona-card">
              <div className="rp-persona-card-head">
                <span className="rp-persona-card-name">{p.name}</span>
                <span className="rp-spacer" />
                <button type="button" className="rp-btn" onClick={() => startEdit(p)}>
                  {t('rp.cards.edit')}
                </button>
                <button type="button" className="rp-btn rp-btn-danger" onClick={() => remove(p)}>
                  {t('rp.cards.delete')}
                </button>
              </div>
              {p.persona ? (
                <div className="rp-persona-card-desc">{p.persona}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Storage placement: which store new cards land in, the current
 * workspace, and the per-workspace data subfolder. Changing the subfolder
 * offers to move the current workspace's existing data along.
 */
function StorageBlock({ draft, patch, ws }: {
  draft: Draft
  patch: (partial: Partial<Draft>) => void
  ws: WorkspaceInfo | undefined
}): ReactNode {
  const t = useT()
  const [folder, setFolder] = useState(draft.workspaceSubfolder)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  useEffect(() => setFolder(draft.workspaceSubfolder), [draft.workspaceSubfolder])

  const applyFolder = useCallback(async () => {
    const next = folder.trim()
    const prev = draft.workspaceSubfolder
    if (next === prev) return
    if (next === '' || /[\\/]/.test(next) || next === '.' || next === '..') {
      setNote(t('rp.storage.folderInvalid'))
      setFolder(prev)
      return
    }
    setBusy(true)
    setNote('')
    try {
      // Saved directly (not via the debounced patch): a migration right after
      // must already see the new subfolder setting host-side.
      await api.updateSettings({ workspaceSubfolder: next })
      patch({ workspaceSubfolder: next })
      if (ws) {
        const probe = await api.probeWorkspaceFolder(ws.path, prev).catch(() => ({ exists: false }))
        if (probe.exists && window.confirm(tf('rp.storage.migrateConfirm', { from: prev, to: next }))) {
          await api.migrateWorkspaceFolder(ws.path, prev, next)
          setNote(t('rp.storage.migrated'))
        }
      }
    } catch (err) {
      setNote(String(err instanceof Error ? err.message : err))
    } finally {
      setBusy(false)
    }
  }, [folder, draft.workspaceSubfolder, ws, patch, t])

  return (
    <div>
      <h4>{t('rp.storage.heading')}</h4>
      <div className="rp-field">
        <label>{t('rp.storage.currentWs')}</label>
        <span className="rp-note">
          {ws ? `${ws.title} · ${ws.path}` : t('rp.storage.noWs')}
        </span>
      </div>
      <div className="rp-inline">
        <Field label={t('rp.storage.cardStore')}>
          <select value={draft.cardStore} onChange={event => patch({ cardStore: event.target.value as StoreScope })}>
            <option value="workspace">{t('rp.storage.workspace')}</option>
            <option value="global">{t('rp.storage.global')}</option>
          </select>
        </Field>
        <Field label={t('rp.storage.subfolder')}>
          <div className="rp-keyrow">
            <input
              value={folder}
              disabled={busy}
              onChange={event => setFolder(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') void applyFolder() }}
            />
            <button className="rp-btn" disabled={busy || folder.trim() === draft.workspaceSubfolder} onClick={() => void applyFolder()}>
              {t('rp.storage.apply')}
            </button>
          </div>
        </Field>
      </div>
      <span className="rp-note">
        {ws ? `${t('rp.storage.pathHint')}：${ws.path}${ws.path.includes('\\') ? '\\' : '/'}${draft.workspaceSubfolder}` : t('rp.storage.hint')}
        {note ? ` · ${note}` : ''}
      </span>
    </div>
  )
}

/** Gallery entry row: usage summary outside, the full page one click away. */
function GalleryEntry({ onOpen, ws }: { onOpen: () => void; ws?: string | undefined }): ReactNode {
  const t = useT()
  const [usage, setUsage] = useState<GalleryUsage | null>(null)
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    api.images(ws)
      .then(result => {
        setUsage(result.usage)
        setCount(result.images.length)
      })
      .catch(() => {})
  }, [ws])
  return (
    <div>
      <h4>{t('rp.gallery.title')}</h4>
      <div className="rp-cardrow">
        <div className="rp-grow">
          <div className="rp-name">{t('rp.gallery.title')}{count !== null ? ` · ${count}` : ''}</div>
          <div className="rp-tags">
            {usage
              ? usage.wsFreeBytes !== undefined
                ? `${tf('rp.gallery.used', { used: formatBytes(usage.usedBytes) })} · ${tf('rp.gallery.freeGlobal', { free: formatBytes(usage.freeBytes) })} · ${tf('rp.gallery.freeWs', { free: formatBytes(usage.wsFreeBytes) })}`
                : `${tf('rp.gallery.used', { used: formatBytes(usage.usedBytes) })} · ${tf('rp.gallery.free', { free: formatBytes(usage.freeBytes) })}`
              : t('rp.gallery.loading')}
          </div>
        </div>
        <div className="rp-actions">
          <button className="rp-btn" onClick={onOpen}>{t('rp.gallery.open')}</button>
        </div>
      </div>
    </div>
  )
}

function CardManager({ onEdit, ws }: { onEdit: (cardId: string) => void; ws: WorkspaceInfo | undefined }): ReactNode {
  const t = useT()
  const [cards, setCards] = useState<CardSummary[] | null>(null)
  const [search, setSearch] = useState('')
  const [filterScope, setFilterScope] = useState<'all' | 'fav' | 'workspace' | 'global'>('all')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const wsPath = ws?.path

  const reload = useCallback(() => {
    api.cards(wsPath).then(result => setCards(result.cards)).catch(err => setError(String(err instanceof Error ? err.message : err)))
  }, [wsPath])
  useEffect(reload, [reload])

  const importFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusy(true)
    setError('')
    try {
      for (const file of Array.from(files)) {
        await api.importCard(await file.arrayBuffer(), wsPath)
      }
      reload()
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [reload, wsPath])

  const move = useCallback((card: CardSummary) => {
    void api.moveCard(card.id, card.scope === 'global' ? 'workspace' : 'global', wsPath)
      .then(reload)
      .catch(err => setError(String(err instanceof Error ? err.message : err)))
  }, [reload, wsPath])

  const counts = useMemo(() => {
    if (!cards) return { all: 0, fav: 0, ws: 0, global: 0 }
    return {
      all: cards.length,
      fav: cards.filter(c => c.favorite).length,
      ws: cards.filter(c => c.scope === 'workspace').length,
      global: cards.filter(c => c.scope === 'global').length,
    }
  }, [cards])

  const filteredCards = useMemo(() => {
    if (!cards) return null
    return cards.filter(card => {
      if (filterScope === 'fav' && !card.favorite) return false
      if (filterScope === 'workspace' && card.scope !== 'workspace') return false
      if (filterScope === 'global' && card.scope !== 'global') return false
      if (search.trim()) {
        const query = search.trim().toLowerCase()
        const nameMatch = card.name.toLowerCase().includes(query)
        const descMatch = (card.description || '').toLowerCase().includes(query)
        const notesMatch = (card.creatorNotes || '').toLowerCase().includes(query)
        const tagsMatch = card.tags.some(tag => tag.toLowerCase().includes(query))
        if (!nameMatch && !descMatch && !notesMatch && !tagsMatch) return false
      }
      return true
    })
  }, [cards, filterScope, search])

  return (
    <div className="rp-cardmanager">
      <div className="rp-cardmanager-head">
        <h4>{t('rp.cards.heading')}</h4>
        <div className="rp-actions">
          <button className="rp-btn rp-btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}>
            + {t('rp.cards.import')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".png,.json,application/json,image/png"
            multiple
            style={{ display: 'none' }}
            onChange={event => void importFiles(event.target.files)}
          />
        </div>
      </div>
      <span className="rp-note" style={{ display: 'block', marginBottom: 10 }}>{t('rp.cards.importHint')}</span>

      {cards && cards.length > 0 ? (
        <div className="rp-card-toolbar">
          <div className="rp-search-box">
            <input
              className="rp-card-search"
              placeholder={t('rp.cards.search')}
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            {search ? (
              <button type="button" className="rp-search-clear" onClick={() => setSearch('')}>×</button>
            ) : null}
          </div>
          <div className="rp-filter-pills">
            <button
              type="button"
              className={`rp-filter-pill${filterScope === 'all' ? ' rp-active' : ''}`}
              onClick={() => setFilterScope('all')}
            >
              {t('rp.cards.filterAll')} <span className="rp-pill-count">{counts.all}</span>
            </button>
            <button
              type="button"
              className={`rp-filter-pill${filterScope === 'fav' ? ' rp-active' : ''}`}
              onClick={() => setFilterScope('fav')}
            >
              {t('rp.cards.filterFav')} <span className="rp-pill-count">{counts.fav}</span>
            </button>
            <button
              type="button"
              className={`rp-filter-pill${filterScope === 'workspace' ? ' rp-active' : ''}`}
              onClick={() => setFilterScope('workspace')}
            >
              {t('rp.cards.filterWorkspace')} <span className="rp-pill-count">{counts.ws}</span>
            </button>
            <button
              type="button"
              className={`rp-filter-pill${filterScope === 'global' ? ' rp-active' : ''}`}
              onClick={() => setFilterScope('global')}
            >
              {t('rp.cards.filterGlobal')} <span className="rp-pill-count">{counts.global}</span>
            </button>
          </div>
        </div>
      ) : null}

      {error ? <div className="rp-error">{error}</div> : null}

      {cards === null ? (
        <span className="rp-note">{t('rp.settings.loading')}</span>
      ) : cards.length === 0 ? (
        <span className="rp-note">{t('rp.cards.empty')}</span>
      ) : filteredCards && filteredCards.length === 0 ? (
        <span className="rp-note">{t('rp.cards.noMatch')}</span>
      ) : (
        <div className="rp-cardlist">
          {filteredCards?.map(card => {
            const desc = (card.creatorNotes || card.description || '').trim()
            return (
              <div key={`${card.scope}-${card.id}`} className="rp-cardrow">
                {card.avatarUrl
                  ? <img className="rp-cardrow-avatar" src={stampedUrl(card.avatarUrl, card.updatedAt)} alt={card.name} />
                  : <div className="rp-cardrow-avatar rp-avatar-fallback">{card.name.slice(0, 1)}</div>}
                
                <div className="rp-grow rp-cardrow-info">
                  <div className="rp-cardrow-head">
                    <button
                      className="rp-star"
                      title={card.favorite ? t('rp.cards.unfavorite') : t('rp.cards.favorite')}
                      onClick={() => void api.updateCard(card.id, { favorite: !card.favorite }, wsPath).then(reload).catch(() => {})}
                    >
                      {card.favorite ? '★' : '☆'}
                    </button>
                    <span className={`rp-scope-tag rp-scope-${card.scope}`}>
                      {card.scope === 'global' ? t('rp.scope.global') : t('rp.scope.workspace')}
                    </span>
                    <span className="rp-cardrow-name" title={card.name}>{card.name}</span>
                    {card.bookEntries > 0 ? (
                      <span className="rp-lore-badge" title={`${card.bookEntries} ${t('rp.cards.lore')}`}>
                        {card.bookEntries} {t('rp.cards.lore')}
                      </span>
                    ) : null}
                  </div>

                  <div className="rp-cardrow-desc" title={desc || card.name}>
                    {desc || '—'}
                  </div>
                </div>

                <div className="rp-actions rp-cardrow-actions">
                  <button className="rp-btn rp-btn-primary" onClick={() => onEdit(card.id)}>{t('rp.cards.edit')}</button>
                  <button
                    className="rp-btn"
                    title={t('rp.cards.clone')}
                    disabled={busy}
                    onClick={() => {
                      void api.cloneCard(card.id, wsPath).then(reload).catch(err => setError(String(err)))
                    }}
                  >
                    {t('rp.cards.clone')}
                  </button>
                  <button
                    className={`rp-btn ${card.scope === 'global' ? 'rp-btn-green' : 'rp-btn-blue'}`}
                    disabled={card.scope === 'global' && !ws}
                    title={card.scope === 'global' ? t('rp.cards.toWorkspace') : t('rp.cards.toGlobal')}
                    onClick={() => move(card)}
                  >
                    {card.scope === 'global' ? t('rp.cards.toWorkspace') : t('rp.cards.toGlobal')}
                  </button>
                  <div className="rp-btn-group" title="导出角色卡文件">
                    <a className="rp-btn" href={api.exportPngUrl(card.id, wsPath)} download>PNG</a>
                    <a className="rp-btn" href={api.exportJsonUrl(card.id, wsPath)} download>JSON</a>
                  </div>
                  <button
                    className="rp-btn rp-btn-danger"
                    onClick={() => {
                      if (window.confirm(tf('rp.cards.deleteConfirm', { name: card.name }))) {
                        void api.deleteCard(card.id, wsPath).then(reload).catch(err => setError(String(err)))
                      }
                    }}
                  >
                    {t('rp.cards.delete')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
