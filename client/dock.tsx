/**
 * The role-play dock above the composer card: character picker / character
 * bar for role-play sessions, and a card picker for BLANK forge sessions
 * (the pick belongs to session creation; once the conversation started the
 * card is fixed). Renders nothing for every other session.
 *
 * While a pending interaction (e.g. the native question card) takes over the
 * composer chain, the whole fallback — this dock included — is hidden by the
 * shell; a compact character bar is then PORTALed into a holder right above
 * the composer seat so the character context never disappears mid-question.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { api, stampedUrl, type CardSummary, type RegexScriptValue, type SessionState } from './api.ts'
import { currentWorkspace, openSessionId, subscribeWorkspaces, takeResend, workspaceOfSession } from './runtime.ts'
import { useAgentPreset, useComposerTakenOver, useSessionBlank, useSessionRunning, useTrayDismiss, type SessionSlotProps } from './compat.ts'
import { colorizeProse, compileCardRules, replaceMacros, startProseHighlighter, type CardColorRule } from './colorize.tsx'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { InspectorTray } from './inspector.tsx'
import { useT, tf } from './i18n.ts'

interface DockProps extends SessionSlotProps {
  sessionId?: string
  inputActions?: { setDraft(text: string): void; submit(): void }
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) return <img className="rp-avatar" src={url} alt={name} />
  return <div className="rp-avatar-fallback">{name.slice(0, 1) || '?'}</div>
}

export function RoleplayDock(props: DockProps): React.ReactNode {
  const activeSessionId =
    props.sessionId ||
    (props.session as Record<string, unknown> | undefined)?.sessionId as string ||
    (props.session as Record<string, unknown> | undefined)?.id as string ||
    openSessionId() ||
    ''
  const preset = useAgentPreset(props, activeSessionId)
  const blank = useSessionBlank(props, activeSessionId)
  const pending = useComposerTakenOver(props, activeSessionId)
  const running = useSessionRunning(props)
  const inputActions = props.inputActions ?? { setDraft: () => {}, submit: () => {} }

  // Scope flag for the role-play bubble CSS (styles.ts): set only while a
  // role-play session is current, removed on unmount/session switch, so the
  // styling can never leak into other modes.
  useEffect(() => {
    if (preset !== 'roleplay') return
    document.body.setAttribute('data-rp-active', '1')
    return () => document.body.removeAttribute('data-rp-active')
  }, [preset])

  // A rewind fork staged a resend for this session: fill the draft and send.
  useEffect(() => {
    if (!activeSessionId) return
    const text = takeResend(activeSessionId)
    if (text === undefined) return
    inputActions.setDraft(text)
    const timer = window.setTimeout(() => inputActions.submit(), 80)
    return () => window.clearTimeout(timer)
  }, [activeSessionId, inputActions])

  if (preset === 'roleplay') {
    return <RoleplayBar sessionId={activeSessionId} inputActions={inputActions} blank={blank} mode="roleplay" pending={pending} running={running} />
  }
  // Forge sessions pick their card at creation time only; a running forge
  // conversation keeps its card and shows no picker chrome.
  if (preset === 'character-forge' && blank) {
    return <RoleplayBar sessionId={activeSessionId} inputActions={inputActions} blank={blank} mode="forge" pending={false} running={running} />
  }
  return null
}

/** The player name for client-side macro replacement (loaded once per mount). */
function useUserName(): string {
  const [name, setName] = useState('你')
  useEffect(() => {
    let alive = true
    api.settings()
      .then(result => {
        if (alive && result.value.userName.trim() !== '') setName(result.value.userName.trim())
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return name
}

/**
 * Effect-managed holder prepended to the chat flow column, so the opening
 * message renders as the character's first bubble above the real messages.
 * Re-ensured on an interval: the column only exists once the conversation
 * has its first message, and rerenders may recreate it.
 */
function useOpeningHolder(active: boolean): HTMLElement | null {
  const [holder, setHolder] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!active) return
    let element: HTMLElement | null = null
    const ensure = () => {
      const container = document.querySelector('[data-chat-flow-kind]')?.parentElement ?? null
      if (!container) return
      if (element && element.parentElement === container && container.firstChild === element) return
      element?.remove()
      element = document.createElement('div')
      element.setAttribute('data-rp-opening', '')
      container.insertBefore(element, container.firstChild)
      setHolder(element)
    }
    ensure()
    const timer = window.setInterval(ensure, 700)
    return () => {
      window.clearInterval(timer)
      element?.remove()
      setHolder(null)
    }
  }, [active])
  return holder
}

type BoundCard = NonNullable<SessionState['card']>

/** The bound card's opening message as a character bubble (macros resolved, prose colored). */
function OpeningBubble({
  card,
  customOpening,
  isGroup = false,
  rules,
  greetingIndex = 0,
  onSwitchGreeting,
  canSwitch = true,
  userName: propUserName,
  userPersona,
  onFuseOpening,
  onRevertOpening,
  fusing,
}: {
  card: BoundCard
  customOpening?: string | null
  isGroup?: boolean
  rules: readonly CardColorRule[]
  greetingIndex?: number
  onSwitchGreeting?: (index: number) => void
  canSwitch?: boolean
  userName?: string
  userPersona?: string
  onFuseOpening?: () => void
  onRevertOpening?: () => void
  fusing?: boolean
}): React.ReactNode {
  const t = useT()
  const fallbackUserName = useUserName()
  const userName = propUserName || fallbackUserName
  const allGreetings = useMemo(() => [card.firstMessage, ...(card.alternateGreetings ?? [])].filter(Boolean), [card])
  const activeIndex = Math.min(Math.max(0, greetingIndex), Math.max(0, allGreetings.length - 1))
  const isCustom = Boolean(isGroup && customOpening && customOpening.trim() !== '')
  const message = isCustom ? customOpening! : (allGreetings[activeIndex] ?? card.firstMessage)
  const macroCtx = useMemo(() => ({
    charDescription: card.description,
    charPersonality: card.personality,
    scenario: card.scenario,
    userPersona: userPersona,
    charVersion: card.characterVersion,
    original: '',
  }), [card, userPersona])

  return (
    <div className="rp-opening">
      <div className="rp-opening-head">
        <Avatar url={card.avatarUrl ? stampedUrl(card.avatarUrl, card.updatedAt) : null} name={card.name} />
        <span className="rp-opening-name">{card.name}</span>
        <span className="rp-opening-tag">{t('rp.opening.tag')}</span>
        {isCustom ? (
          <>
            <span className="rp-scope-tag rp-scope-global" style={{ marginLeft: 6, fontSize: 11 }}>
              {t('rp.dock.group.fusedOpening')}
            </span>
            {onRevertOpening ? (
              <button
                type="button"
                className="rp-btn-subtle"
                style={{ fontSize: 11, marginLeft: 6 }}
                onClick={onRevertOpening}
                title={t('rp.dock.group.revertOpeningTitle')}
              >
                {t('rp.dock.group.revertOpening')}
              </button>
            ) : null}
            {onFuseOpening ? (
              <button
                type="button"
                className="rp-btn-subtle"
                style={{ fontSize: 11, marginLeft: 6 }}
                disabled={fusing}
                onClick={onFuseOpening}
                title="让 AI 重新融合生成新的群聊开场"
              >
                {fusing ? t('rp.dock.group.fusing') : t('rp.dock.group.refuseOpening')}
              </button>
            ) : null}
          </>
        ) : (
          <>
            {allGreetings.length > 1 && canSwitch ? (
              <div className="rp-greeting-switcher">
                <button
                  type="button"
                  className="rp-greeting-btn"
                  disabled={activeIndex <= 0}
                  onClick={() => onSwitchGreeting?.(activeIndex - 1)}
                  title={t('rp.greeting.prev')}
                >
                  ‹
                </button>
                <span className="rp-greeting-count">{activeIndex + 1} / {allGreetings.length}</span>
                <button
                  type="button"
                  className="rp-greeting-btn"
                  disabled={activeIndex >= allGreetings.length - 1}
                  onClick={() => onSwitchGreeting?.(activeIndex + 1)}
                  title={t('rp.greeting.next')}
                >
                  ›
                </button>
              </div>
            ) : null}
            {onFuseOpening ? (
              <button
                type="button"
                className="rp-btn-subtle"
                style={{ fontSize: 11, marginLeft: 6 }}
                disabled={fusing}
                onClick={onFuseOpening}
                title="让 AI 将全员的开场情境无缝融合为同一时空的群戏开局"
              >
                {fusing ? t('rp.dock.group.fusing') : t('rp.dock.group.fuse')}
              </button>
            ) : null}
          </>
        )}
      </div>
      <div className="rp-opening-body">{colorizeProse(replaceMacros(message, card.name, userName, macroCtx), rules)}</div>
    </div>
  )
}

/** Compact opening preview inside the dock (blank sessions, before the first send). */
function OpeningInline({
  card,
  customOpening,
  isGroup = false,
  rules,
  greetingIndex = 0,
  onSwitchGreeting,
  userName: propUserName,
  userPersona,
  onFuseOpening,
  onRevertOpening,
  fusing,
}: {
  card: BoundCard
  customOpening?: string | null
  isGroup?: boolean
  rules: readonly CardColorRule[]
  greetingIndex?: number
  onSwitchGreeting?: (index: number) => void
  userName?: string
  userPersona?: string
  onFuseOpening?: () => void
  onRevertOpening?: () => void
  fusing?: boolean
}): React.ReactNode {
  const fallbackUserName = useUserName()
  const userName = propUserName || fallbackUserName
  const t = useT()
  const allGreetings = useMemo(() => [card.firstMessage, ...(card.alternateGreetings ?? [])].filter(Boolean), [card])
  const activeIndex = Math.min(Math.max(0, greetingIndex), Math.max(0, allGreetings.length - 1))
  const isCustom = Boolean(isGroup && customOpening && customOpening.trim() !== '')
  const message = isCustom ? customOpening! : (allGreetings[activeIndex] ?? card.firstMessage)
  const macroCtx = useMemo(() => ({
    charDescription: card.description,
    charPersonality: card.personality,
    scenario: card.scenario,
    userPersona: userPersona,
    charVersion: card.characterVersion,
    original: '',
  }), [card, userPersona])

  return (
    <div className="rp-greeting-wrap">
      <div className="rp-greeting-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isCustom ? (
            <span className="rp-scope-tag rp-scope-global" style={{ fontSize: 11 }}>
              {t('rp.dock.group.fusedOpening')}
            </span>
          ) : (
            <span className="rp-note">可选开场 ({activeIndex + 1}/{allGreetings.length})</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isCustom ? (
            <>
              {onRevertOpening ? (
                <button
                  type="button"
                  className="rp-btn-subtle"
                  style={{ fontSize: 11 }}
                  onClick={onRevertOpening}
                  title={t('rp.dock.group.revertOpeningTitle')}
                >
                  {t('rp.dock.group.revertOpening')}
                </button>
              ) : null}
              {onFuseOpening ? (
                <button
                  type="button"
                  className="rp-btn-subtle"
                  style={{ fontSize: 11 }}
                  disabled={fusing}
                  onClick={onFuseOpening}
                  title="让 AI 重新融合生成新的群聊开场"
                >
                  {fusing ? t('rp.dock.group.fusing') : t('rp.dock.group.refuseOpening')}
                </button>
              ) : null}
            </>
          ) : (
            <>
              {allGreetings.length > 1 ? (
                <div className="rp-greeting-switcher">
                  <button
                    type="button"
                    className="rp-greeting-btn"
                    disabled={activeIndex <= 0}
                    onClick={() => onSwitchGreeting?.(activeIndex - 1)}
                  >
                    ‹
                  </button>
                  <span className="rp-greeting-count">{activeIndex + 1} / {allGreetings.length}</span>
                  <button
                    type="button"
                    className="rp-greeting-btn"
                    disabled={activeIndex >= allGreetings.length - 1}
                    onClick={() => onSwitchGreeting?.(activeIndex + 1)}
                  >
                    ›
                  </button>
                </div>
              ) : null}
              {onFuseOpening ? (
                <button
                  type="button"
                  className="rp-btn-subtle"
                  style={{ fontSize: 11 }}
                  disabled={fusing}
                  onClick={onFuseOpening}
                  title="让 AI 将全员的开场情境无缝融合为同一时空的群戏开局"
                >
                  {fusing ? t('rp.dock.group.fusing') : t('rp.dock.group.fuse')}
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
      <div className="rp-greeting">{colorizeProse(replaceMacros(message, card.name, userName, macroCtx), rules)}</div>
    </div>
  )
}

/** Effect-managed holder element inserted just above the composer seat. */
function usePendingHolder(active: boolean): HTMLElement | null {
  const [holder, setHolder] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!active) return
    const seat = document.querySelector('[data-composer-seat]')
    const parent = seat?.parentElement
    if (!seat || !parent) return
    const element = document.createElement('div')
    element.setAttribute('data-rp-question-dock', '')
    parent.insertBefore(element, seat)
    setHolder(element)
    return () => {
      setHolder(null)
      element.remove()
    }
  }, [active])
  return holder
}

function InviteCardTray({
  availableCards,
  joinedNames = [],
  onPick,
  onClose,
}: {
  availableCards: CardSummary[]
  joinedNames?: string[]
  onPick: (cardId: string) => void
  onClose: () => void
}): React.ReactNode {
  const panelRef = useRef<HTMLDivElement | null>(null)
  useTrayDismiss(panelRef, onClose)
  const t = useT()
  const [filter, setFilter] = useState('')
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return availableCards
    return availableCards.filter(c => c.name.toLowerCase().includes(q) || (c.creatorNotes ?? '').toLowerCase().includes(q))
  }, [availableCards, filter])

  return (
    <div ref={panelRef} className="rp-tray-panel" style={{ maxHeight: 400, overflowY: 'auto' }}>
      <div className="rp-tray-header">
        <span className="rp-tray-title">{t('rp.dock.group.inviteCard')} ({availableCards.length})</span>
        <div className="rp-tray-actions">
          {availableCards.length > 4 ? (
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="搜索角色…"
              className="rp-input"
              style={{ width: 120, fontSize: 12, padding: '2px 6px' }}
            />
          ) : null}
          <button type="button" className="rp-popover-close" onClick={onClose} title="关闭">×</button>
        </div>
      </div>
      {availableCards.length === 0 ? (
        <div style={{ padding: '16px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--yh-neutral-9)' }}>
            {t('rp.dock.group.allCardsJoined')}
          </span>
          {joinedNames.length > 0 ? (
            <span className="rp-muted" style={{ fontSize: 12 }}>
              当前房间成员（{joinedNames.length}人）：{joinedNames.join('、')}
            </span>
          ) : null}
          <span className="rp-muted" style={{ fontSize: 12 }}>
            酒馆中已无其他可选角色卡。如需同台演出更多角色，请先在酒馆「角色卡」管理中导入或创建新角色。
          </span>
        </div>
      ) : (
        <div className="rp-cardgrid" style={{ maxHeight: 260, overflowY: 'auto', padding: '4px 0' }}>
          {filtered.map(card => (
            <button
              key={`${card.scope}-${card.id}`}
              type="button"
              className="rp-cardcell"
              onClick={() => onPick(card.id)}
            >
              <Avatar url={card.avatarUrl ? stampedUrl(card.avatarUrl, card.updatedAt) : null} name={card.name} />
              <span className="rp-cardcell-text">
                <span className="rp-cardname">
                  <span className={`rp-scope-tag rp-scope-${card.scope}`}>
                    {card.scope === 'global' ? t('rp.scope.global') : t('rp.scope.workspace')}
                  </span>
                  {card.favorite ? '[收藏] ' : ''}{card.name}
                </span>
                <span className="rp-cardnote">{card.creatorNotes || card.description || `${card.bookEntries}${t('rp.cards.lore')}`}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function RoleplayBar({ sessionId, inputActions, blank, mode, pending, running }: {
  sessionId: string
  inputActions: { setDraft(text: string): void; submit(): void }
  blank: boolean
  mode: 'roleplay' | 'forge'
  pending: boolean
  running: boolean
}): React.ReactNode {
  const t = useT()
  const [state, setState] = useState<SessionState | null>(null)
  const [cards, setCards] = useState<CardSummary[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [activeTray, setActiveTray] = useState<'none' | 'studio' | 'more'>('none')
  const [studioTab, setStudioTab] = useState<'an' | 'memory' | 'instruction' | 'inspector'>('an')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [fusingOpening, setFusingOpening] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerFilter, setPickerFilter] = useState<'all' | 'fav' | 'workspace' | 'global'>('all')
  const [dietModeOverride, setDietModeOverride] = useState<boolean | null>(null)

  /** This session's workspace path — recorded on the binding for host-side stores.
      Subscribed: the workspaces feed loads async and this must follow it in. */
  const wsPath = useSyncExternalStore(subscribeWorkspaces, () => workspaceOfSession(sessionId)?.path ?? currentWorkspace()?.path)

  const reload = useCallback(() => {
    api.session(sessionId)
      .then(setState)
      .catch(err => {
        setError(String(err instanceof Error ? err.message : err))
        setState(prev => prev ?? { binding: null, card: null, choiceModeDefault: false })
      })
  }, [sessionId])

  useEffect(() => {
    setState(null)
    setDietModeOverride(null)
    reload()
  }, [reload])

  // A turn starting consumes the staged one-shot instruction host-side;
  // re-pull the binding on run-state flips so the button state stays honest.
  useEffect(() => {
    if (state) reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  useEffect(() => {
    api.settings().then(res => {
      const s = res.value
      document.body.dataset.rpFontSize = s.readingFontSize ?? '14'
      document.body.dataset.rpFont = s.readingFontFamily ?? 'default'
      document.body.dataset.rpHighlight = s.dialogueHighlight !== false ? 'true' : 'false'
    }).catch(() => {})
  }, [])

  const bound = state?.binding?.characterId ? state.card : null
  // Avatar files are overwritten in place; updatedAt busts the browser cache.
  const boundAvatar = bound?.avatarUrl ? stampedUrl(bound.avatarUrl, bound.updatedAt) : null

  // A late-arriving workspace path must refresh the picker (workspace cards).
  useEffect(() => {
    setCards(null)
  }, [wsPath])

  useEffect(() => {
    if (state && cards === null) {
      api.cards(wsPath)
        .then(result => setCards(result.cards))
        .catch(err => setError(String(err instanceof Error ? err.message : err)))
    }
  }, [state, bound, cards, wsPath])

  // Keep the binding's workspace path current — image generation, workspace
  // card lookups and forge card creation on the host resolve through it.
  // Creates the binding when absent (forge sessions may never pick a card).
  useEffect(() => {
    if (!state || !wsPath || !sessionId || state.binding?.workspacePath === wsPath) return
    void api.updateSession(sessionId, { mode, workspacePath: wsPath }).then(reload).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, wsPath, sessionId, mode])

  const pick = useCallback(async (cardId: string) => {
    setBusy(true)
    try {
      const targetSessionId = sessionId || openSessionId() || 'new'
      const selectedCard = cards?.find(c => c.id === cardId)
      await api.updateSession(targetSessionId, {
        mode,
        characterId: cardId,
        groupCardIds: [cardId],
        activeSpeakerId: null,
        customOpening: null,
        greetingIndex: 0,
        userPersonaId: selectedCard?.userPersonaId ?? null,
        ...(wsPath ? { workspacePath: wsPath } : {}),
      })
      reload()
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setBusy(false)
    }
  }, [sessionId, mode, reload, wsPath, cards])

  const sendInstruction = useCallback((instruction: string) => {
    inputActions.setDraft(`[系统指令: ${instruction}]`)
    inputActions.submit()
  }, [inputActions])


  const isGroup = (state?.binding?.groupCardIds?.length ?? 0) >= 2

  const groupCards = useMemo(() => {
    if (state?.groupCards && state.groupCards.length > 0) return state.groupCards
    const ids = state?.binding?.groupCardIds && state.binding.groupCardIds.length > 0
      ? state.binding.groupCardIds
      : (state?.binding?.characterId ? [state.binding.characterId] : [])
    return ids.map(id => {
      const match = cards?.find(c => c.id === id)
      if (match) {
        return {
          id: match.id,
          name: match.name,
          avatarUrl: match.avatarUrl ?? null,
          updatedAt: match.updatedAt,
        }
      }
      if (state?.card?.id === id) {
        return {
          id: state.card.id,
          name: state.card.name,
          avatarUrl: state.card.avatarUrl ?? null,
          updatedAt: state.card.updatedAt,
        }
      }
      return { id, name: id, avatarUrl: null, updatedAt: 0 }
    })
  }, [state?.groupCards, state?.binding?.groupCardIds, state?.binding?.characterId, state?.card, cards])

  const activeSpeakerId = state?.binding?.activeSpeakerId ?? null
  const activeSpeaker = isGroup && activeSpeakerId ? (groupCards.find(c => c.id === activeSpeakerId) ?? null) : null

  const currentGroupIds = state?.binding?.groupCardIds && state.binding.groupCardIds.length > 0
    ? state.binding.groupCardIds
    : (state?.binding?.characterId ? [state.binding.characterId] : [])
  const availableCards = useMemo(() => {
    return (cards ?? []).filter(c => !currentGroupIds.includes(c.id))
  }, [cards, currentGroupIds])

  const filteredPickerCards = useMemo(() => {
    if (!cards) return null
    return cards.filter(card => {
      if (pickerFilter === 'fav' && !card.favorite) return false
      if (pickerFilter === 'workspace' && card.scope !== 'workspace') return false
      if (pickerFilter === 'global' && card.scope !== 'global') return false
      if (pickerSearch.trim()) {
        const q = pickerSearch.trim().toLowerCase()
        const nameMatch = card.name.toLowerCase().includes(q)
        const descMatch = (card.description || '').toLowerCase().includes(q)
        const notesMatch = (card.creatorNotes || '').toLowerCase().includes(q)
        const tagsMatch = card.tags.some(tag => tag.toLowerCase().includes(q))
        if (!nameMatch && !descMatch && !notesMatch && !tagsMatch) return false
      }
      return true
    })
  }, [cards, pickerFilter, pickerSearch])

  const addMember = useCallback(async (cardId: string) => {
    if (!state?.binding) return
    const current = state.binding.groupCardIds && state.binding.groupCardIds.length > 0
      ? [...state.binding.groupCardIds]
      : (state.binding.characterId ? [state.binding.characterId] : [])
    if (current.includes(cardId)) return
    current.push(cardId)
    await api.updateSession(sessionId, {
      groupCardIds: current,
      characterId: current[0] ?? null,
      activeSpeakerId: state.binding.activeSpeakerId ?? current[0] ?? null,
    })
    reload()
  }, [sessionId, state, reload])

  const removeMember = useCallback(async (cardId: string) => {
    if (!state?.binding) return
    const current = (state.binding.groupCardIds ?? []).filter(id => id !== cardId)
    const nextSpeaker = state.binding.activeSpeakerId === cardId ? (current[0] ?? null) : state.binding.activeSpeakerId
    const patch: Parameters<typeof api.updateSession>[1] = {
      groupCardIds: current,
      characterId: current[0] ?? null,
      activeSpeakerId: nextSpeaker,
    }
    if (current.length < 2) {
      patch.customOpening = null
    }
    await api.updateSession(sessionId, patch)
    reload()
  }, [sessionId, state, reload])

  const exitGroup = useCallback(async () => {
    if (!state?.binding) return
    const hostId = state.binding.characterId || state.binding.groupCardIds?.[0] || null
    await api.updateSession(sessionId, {
      groupCardIds: hostId ? [hostId] : [],
      characterId: hostId,
      activeSpeakerId: null,
      speakerMode: 'auto',
      customOpening: null,
    })
    reload()
  }, [sessionId, state, reload])

  const setSpeaker = useCallback(async (cardId: string | null) => {
    const nextSpeaker = state?.binding?.activeSpeakerId === cardId ? null : cardId
    await api.updateSession(sessionId, { activeSpeakerId: nextSpeaker })
    reload()
  }, [sessionId, state?.binding?.activeSpeakerId, reload])

  const setSpeakerMode = useCallback(async (speakerMode: 'auto' | 'round_robin' | 'manual') => {
    await api.updateSession(sessionId, { speakerMode })
    reload()
  }, [sessionId, reload])

  const fuseOpening = useCallback(async () => {
    setFusingOpening(true)
    try {
      await api.fuseGreetings(sessionId, wsPath)
      reload()
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setFusingOpening(false)
    }
  }, [sessionId, wsPath, reload])

  const revertOpening = useCallback(async () => {
    try {
      await api.updateSession(sessionId, { customOpening: null })
      reload()
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    }
  }, [sessionId, reload])

  const choiceMode = state ? (state.binding?.choiceMode ?? state.choiceModeDefault) : false
  const groupDietMode = dietModeOverride !== null
    ? dietModeOverride
    : (state ? Boolean(state.binding?.groupDietMode ?? state.groupDietModeDefault) : false)
  const holder = usePendingHolder(pending && mode === 'roleplay' && bound !== null)
  // The opening bubble lives at the top of the flow once real messages exist;
  // on a blank session it previews inside the dock instead (no flow column yet).
  const openingHolder = useOpeningHolder(mode === 'roleplay' && !blank && (bound?.firstMessage ?? '').trim() !== '')

  // Prose coloring for native assistant messages: built-in dialogue/thought
  // rules plus the bound card's own coloring regexes. Restarted whenever the
  // card (or its scripts) change; active only for role-play sessions.
  const scriptsJson = JSON.stringify(bound?.regexScripts ?? [])
  const cardRules = useMemo(() => compileCardRules(JSON.parse(scriptsJson) as RegexScriptValue[]), [scriptsJson])
  useEffect(() => {
    if (mode !== 'roleplay') return
    return startProseHighlighter(cardRules)
  }, [mode, cardRules])

  const switchGreeting = useCallback((index: number) => {
    void api.updateSession(sessionId, { greetingIndex: index }).then(reload).catch(() => {})
  }, [sessionId, reload])

  if (!state) {
    return (
      <div className="rp-dock">
        <div className="rp-dock-row">
          <span className="rp-name">{mode === 'forge' ? t('rp.dock.forge.title') : t('rp.dock.rp.title')}</span>
          <span className="rp-muted">{t('rp.dock.loading')}</span>
        </div>
      </div>
    )
  }

  if (!bound) {
    return (
      <div className="rp-dock">
        <div className="rp-dock-row">
          <span className="rp-name">{mode === 'forge' ? t('rp.dock.forge.title') : t('rp.dock.rp.title')}</span>
          <span className="rp-muted">{mode === 'forge' ? t('rp.dock.forge.pick') : t('rp.dock.pick')}</span>
          {error ? (
          <span className="rp-error" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 2px', fontSize: 13, lineHeight: 1 }}>×</button>
          </span>
        ) : null}
        </div>
        {cards && cards.length > 3 ? (
          <div className="rp-card-toolbar" style={{ marginTop: 2, marginBottom: 4 }}>
            <div className="rp-search-box">
              <input
                className="rp-card-search"
                placeholder={t('rp.cards.searchPlaceholder')}
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
              />
              {pickerSearch ? (
                <button type="button" className="rp-search-clear" onClick={() => setPickerSearch('')}>×</button>
              ) : null}
            </div>
            <div className="rp-filter-pills">
              <button
                type="button"
                className={`rp-filter-pill${pickerFilter === 'all' ? ' rp-active' : ''}`}
                onClick={() => setPickerFilter('all')}
              >
                {t('rp.cards.filterAll')}
              </button>
              <button
                type="button"
                className={`rp-filter-pill${pickerFilter === 'fav' ? ' rp-active' : ''}`}
                onClick={() => setPickerFilter('fav')}
              >
                {t('rp.cards.filterFav')}
              </button>
              <button
                type="button"
                className={`rp-filter-pill${pickerFilter === 'workspace' ? ' rp-active' : ''}`}
                onClick={() => setPickerFilter('workspace')}
              >
                {t('rp.scope.workspace')}
              </button>
              <button
                type="button"
                className={`rp-filter-pill${pickerFilter === 'global' ? ' rp-active' : ''}`}
                onClick={() => setPickerFilter('global')}
              >
                {t('rp.scope.global')}
              </button>
            </div>
          </div>
        ) : null}
        {cards === null ? (
          <span className="rp-muted">{t('rp.dock.loading')}</span>
        ) : cards.length === 0 ? (
          <span className="rp-muted">{t('rp.dock.noCards')}</span>
        ) : filteredPickerCards && filteredPickerCards.length === 0 ? (
          <span className="rp-muted">{t('rp.cards.noMatch')}</span>
        ) : (
          <div className="rp-cardgrid">
            {filteredPickerCards?.map(card => (
              <button key={`${card.scope}-${card.id}`} className="rp-cardcell" disabled={busy} onClick={() => void pick(card.id)}>
                <Avatar url={card.avatarUrl ? stampedUrl(card.avatarUrl, card.updatedAt) : null} name={card.name} />
                <span className="rp-cardcell-text">
                  <span className="rp-cardname">
                    <span className={`rp-scope-tag rp-scope-${card.scope}`}>
                      {card.scope === 'global' ? t('rp.scope.global') : t('rp.scope.workspace')}
                    </span>
                    {card.favorite ? '[收藏] ' : ''}{card.name}
                  </span>
                  <span className="rp-cardnote">{card.creatorNotes || card.description || `${card.bookEntries}${t('rp.cards.lore')}`}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const isForge = mode === 'forge'
  const toggles = !isForge ? (
    <button
      type="button"
      className={`rp-btn${choiceMode ? ' rp-on' : ''}`}
      title={t('rp.dock.choiceMode')}
      onClick={() => {
        void api.updateSession(sessionId, { choiceMode: !choiceMode }).then(reload).catch(() => {})
      }}
    >
      {t('rp.dock.choiceMode')}{choiceMode ? t('rp.dock.choiceOn') : t('rp.dock.choiceOff')}
    </button>
  ) : null

  const activeGreetingIndex = state.binding?.greetingIndex ?? 0

  const userPersonas = state.userPersonas ?? []
  const activePersonaId = state.binding?.userPersonaId || bound.userPersonaId || ''
  const matchedPersona = activePersonaId && userPersonas.length > 0
    ? userPersonas.find(p => p.id === activePersonaId)
    : undefined
  const effectiveUserName = matchedPersona?.name || state.defaultUserName || '你'

  const personaSelect = !isForge ? (
    <select
      className="rp-persona-select"
      value={activePersonaId}
      title={t('rp.dock.persona')}
      onChange={e => {
        const val = e.target.value.trim() === '' ? null : e.target.value
        void api.updateSession(sessionId, { userPersonaId: val }).then(reload).catch(() => {})
      }}
    >
      <option value="">{t('rp.dock.persona.default')} ({state.defaultUserName || '你'})</option>
      {userPersonas.map(p => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  ) : null

  const hasStoryMemory = (state.binding?.storyMemory ?? '').trim() !== ''
  const hasAuthorNote = (state.binding?.authorNote ?? '').trim() !== ''
  const hasInstruction = (state.binding?.pendingInstruction ?? '').trim() !== ''
  const hasAnyStudio = hasAuthorNote || hasStoryMemory || hasInstruction

  const studioButton = !isForge ? (
    <button
      type="button"
      className={`rp-btn${activeTray === 'studio' ? ' rp-active' : ''}${hasAnyStudio ? ' rp-on' : ''}`}
      title={t('rp.dock.studio.title')}
      onClick={() => setActiveTray(prev => (prev === 'studio' ? 'none' : 'studio'))}
    >
      {t('rp.dock.studio')}{hasAnyStudio ? ' (已设)' : ''}
    </button>
  ) : null

  const continueButton = !isForge
    ? <button type="button" className="rp-btn" onClick={() => { inputActions.setDraft('（继续）'); inputActions.submit() }}>{t('rp.dock.continue')}</button>
    : null

  const morePopover = !isForge ? (
    <div className="rp-popover rp-dock-more-wrap">
      <button
        type="button"
        className={`rp-btn rp-dock-more-btn${activeTray === 'more' ? ' rp-active' : ''}`}
        title={t('rp.dock.more')}
        onClick={() => setActiveTray(prev => (prev === 'more' ? 'none' : 'more'))}
      >
        ···
      </button>
      {activeTray === 'more' ? (
        <MoreMenuPopover
          choiceMode={Boolean(choiceMode)}
          onToggleChoice={() => {
            void api.updateSession(sessionId, { choiceMode: !choiceMode }).then(reload).catch(() => {})
          }}
          hasAnyStudio={hasAnyStudio}
          onOpenStudio={() => {
            setActiveTray('studio')
          }}
          onContinue={() => {
            inputActions.setDraft('（继续）')
            inputActions.submit()
          }}
          onSwitch={() => {
            void api.updateSession(sessionId, {
              characterId: null,
              groupCardIds: [],
              activeSpeakerId: null,
              customOpening: null,
            }).then(() => { setCards(null); reload() }).catch(() => {})
          }}
          onClose={() => setActiveTray('none')}
        />
      ) : null}
    </div>
  ) : null
  const switchButton = (
    <button
      type="button"
      className="rp-btn"
      onClick={() => {
        void api.updateSession(sessionId, {
          characterId: null,
          groupCardIds: [],
          activeSpeakerId: null,
          customOpening: null,
        }).then(() => { setCards(null); reload() }).catch(() => {})
      }}
    >
      {isForge ? t('rp.dock.switchCard') : t('rp.dock.switchChar')}
    </button>
  )

  const dockBody = (
    <div className={`rp-dock${holder ? ' rp-dock-teleported' : ''}`}>
      {isGroup && !isForge ? (
          <div className="rp-dock-group-row">
            <div className="rp-group-roster">
              <span className="rp-muted" style={{ fontSize: 12, marginRight: 2 }}>{t('rp.dock.group.title')}:</span>
              {groupCards.map(member => {
                const isSpeaker = Boolean(activeSpeakerId && member.id === activeSpeakerId)
                return (
                  <div
                    key={member.id}
                    className={`rp-group-pill${isSpeaker ? ' rp-speaker-active' : ''}`}
                    onClick={() => void setSpeaker(member.id)}
                    title={isSpeaker ? t('rp.dock.group.activeSpeaker') : t('rp.dock.group.clickToSpeak')}
                  >
                    <Avatar url={member.avatarUrl ? stampedUrl(member.avatarUrl, member.updatedAt) : null} name={member.name} />
                    <span>{member.name}</span>
                    {isSpeaker ? <span className="rp-group-crown">[主讲]</span> : null}
                    {groupCards.length > 1 ? (
                      <span
                        className="rp-group-remove"
                        title={t('rp.dock.group.remove')}
                        onClick={e => {
                          e.stopPropagation()
                          void removeMember(member.id)
                        }}
                      >
                        ×
                      </span>
                    ) : null}
                  </div>
                )
              })}
              <button
                type="button"
                className="rp-btn-subtle"
                onClick={() => setInviteOpen(prev => !prev)}
                title={t('rp.dock.group.inviteCard')}
              >
                {t('rp.dock.group.invite')}
              </button>
            </div>

            <span className="rp-spacer" />

            <div className="rp-group-controls" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                className="rp-persona-select"
                value={state.binding?.speakerMode ?? 'auto'}
                onChange={e => void setSpeakerMode(e.target.value as any)}
                title={t('rp.dock.group.mode')}
              >
                <option value="auto">{t('rp.dock.group.mode.auto')}</option>
                <option value="round_robin">{t('rp.dock.group.mode.roundRobin')}</option>
                <option value="manual">{t('rp.dock.group.mode.manual')}</option>
              </select>

              <button
                type="button"
                className={`rp-btn-subtle${groupDietMode ? ' rp-btn-diet-on' : ''}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '3px 8px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => {
                  const next = !groupDietMode
                  setDietModeOverride(next)
                  void api.updateSession(sessionId, { groupDietMode: next })
                    .then(reload)
                    .catch(err => {
                      setError(String(err instanceof Error ? err.message : err))
                    })
                }}
                title={t('rp.dock.group.dietTitle')}
              >
                {t('rp.dock.group.diet')}{groupDietMode ? '·开' : '·关'}
              </button>

              {activeSpeaker ? (
                <button
                  type="button"
                  className="rp-btn-subtle rp-btn-talk-to"
                  onClick={() => {
                    inputActions.setDraft(`【对${activeSpeaker.name}说】 `)
                  }}
                  title={tf(t('rp.dock.group.talkTo'), { name: activeSpeaker.name })}
                >
                  对{activeSpeaker.name}说
                </button>
              ) : null}

              <button
                type="button"
                className="rp-btn-subtle rp-btn-exit-group"
                onClick={exitGroup}
                title={t('rp.dock.group.exitTitle')}
              >
                {t('rp.dock.group.exit')}
              </button>
            </div>
          </div>
        ) : null}

        <div className="rp-dock-row rp-dock-row-oneline">
          <Avatar url={boundAvatar} name={bound.name} />
          <Tooltip label={bound.name} side="bottom">
            <span className="rp-name">{bound.name}</span>
          </Tooltip>
          {!isForge && !isGroup ? (
            <button
              type="button"
              className="rp-btn-subtle"
              style={{ fontSize: 12, padding: '2px 8px', marginLeft: 4 }}
              onClick={() => setInviteOpen(prev => !prev)}
              title={t('rp.dock.group.inviteCard')}
            >
              {t('rp.dock.group.invite')}
            </button>
          ) : null}
          {personaSelect}
          {isForge ? <span className="rp-muted">{t('rp.dock.forge.editing')}</span> : null}
          <span className="rp-spacer" />
          <div className="rp-dock-secondary-group">
            {toggles}
            {studioButton}
            {continueButton}
          </div>
          {morePopover}
          {switchButton}
        </div>

        {inviteOpen ? (
          <InviteCardTray
            availableCards={availableCards}
            joinedNames={groupCards.map(c => c.name)}
            onPick={cardId => {
              void addMember(cardId)
              setInviteOpen(false)
            }}
            onClose={() => setInviteOpen(false)}
          />
        ) : null}

        {activeTray === 'studio' ? (
          <StoryStudioTray
            sessionId={sessionId}
            wsPath={wsPath}
            binding={state.binding}
            authorNoteDefaultDepth={state.authorNoteDepthDefault ?? 0}
            authorNoteDefaultRole={state.authorNoteRoleDefault ?? 'system'}
            initialTab={studioTab}
            reload={reload}
            onClose={() => setActiveTray('none')}
          />
        ) : null}
        {blank && (bound.firstMessage || (isGroup && state.binding?.customOpening)) ? (
          <OpeningInline
            card={bound}
            customOpening={state.binding?.customOpening}
            isGroup={isGroup}
            rules={cardRules}
            greetingIndex={activeGreetingIndex}
            onSwitchGreeting={switchGreeting}
            userName={effectiveUserName}
            userPersona={matchedPersona?.persona}
            onFuseOpening={isGroup ? fuseOpening : undefined}
            onRevertOpening={revertOpening}
            fusing={fusingOpening}
          />
        ) : null}
        {error ? (
          <span className="rp-error" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 2px', fontSize: 13, lineHeight: 1 }}>×</button>
          </span>
        ) : null}
      </div>
  )

  const dockNode = holder ? createPortal(dockBody, holder) : dockBody

  return (
    <>
      {dockNode}
      {openingHolder && (bound.firstMessage || (isGroup && state.binding?.customOpening)) ? createPortal(
        <OpeningBubble
          card={bound}
          customOpening={state.binding?.customOpening}
          isGroup={isGroup}
          rules={cardRules}
          greetingIndex={activeGreetingIndex}
          onSwitchGreeting={switchGreeting}
          userName={effectiveUserName}
          userPersona={matchedPersona?.persona}
          onFuseOpening={isGroup ? fuseOpening : undefined}
          onRevertOpening={revertOpening}
          fusing={fusingOpening}
        />,
        openingHolder
      ) : null}
    </>
  )
}

const INSTRUCTION_PRESETS = [
  { labelKey: 'rp.dock.preset.nextDay', textKey: 'rp.dock.preset.nextDay.text' },
  { labelKey: 'rp.dock.preset.monologue', textKey: 'rp.dock.preset.monologue.text' },
  { labelKey: 'rp.dock.preset.sensory', textKey: 'rp.dock.preset.sensory.text' },
  { labelKey: 'rp.dock.preset.twist', textKey: 'rp.dock.preset.twist.text' },
  { labelKey: 'rp.dock.preset.clash', textKey: 'rp.dock.preset.clash.text' },
] as const

function InstructionContent({ sessionId, staged, reload }: {
  sessionId: string
  staged: string
  reload: () => void
}): React.ReactNode {
  const t = useT()
  const [text, setText] = useState(staged)
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  useEffect(() => {
    setText(staged)
  }, [staged])

  const flush = useCallback((valToSave?: string) => {
    if (saveTimer.current !== undefined) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = undefined
    }
    const val = (valToSave !== undefined ? valToSave : text).trim()
    void api.updateSession(sessionId, { pendingInstruction: val === '' ? null : val })
      .then(reload)
      .catch(() => {})
  }, [sessionId, text, reload])

  useEffect(() => {
    return () => {
      if (saveTimer.current !== undefined) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = undefined
        const val = text.trim()
        void api.updateSession(sessionId, { pendingInstruction: val === '' ? null : val })
          .then(reload)
          .catch(() => {})
      }
    }
  }, [sessionId, text, reload])

  const stage = useCallback((value: string) => {
    setText(value)
    if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = undefined
      void api.updateSession(sessionId, { pendingInstruction: value.trim() === '' ? null : value })
        .then(reload)
        .catch(() => {})
    }, 350)
  }, [sessionId, reload])

  const clear = useCallback(() => {
    stage('')
    ref.current?.focus()
  }, [stage])

  const applyPreset = useCallback((presetText: string) => {
    const current = text.trim()
    const next = current ? `${current}；${presetText}` : presetText
    stage(next)
    ref.current?.focus()
  }, [text, stage])

  return (
    <div>
      <div className="rp-tray-actions" style={{ marginBottom: 6, display: 'flex', justifyContent: 'flex-end' }}>
        {text.trim() ? (
          <button type="button" className="rp-btn-subtle" onClick={clear}>
            {t('rp.dock.instruction.clear')}
          </button>
        ) : null}
      </div>
      <div className="rp-chip-row">
        {INSTRUCTION_PRESETS.map((p) => (
          <button
            key={p.labelKey}
            type="button"
            className="rp-chip"
            title={t(p.textKey)}
            onClick={() => applyPreset(t(p.textKey))}
          >
            + {t(p.labelKey)}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        className="rp-textarea"
        placeholder={t('rp.dock.instruction.hint')}
        value={text}
        onBlur={() => flush()}
        onChange={event => stage(event.target.value)}
      />
      <span className="rp-note">{t('rp.dock.instruction.note')}</span>
    </div>
  )
}

function AuthorNoteContent({ sessionId, note, depth, role, reload }: {
  sessionId: string
  note: string
  depth: number
  role: 'system' | 'user' | 'assistant'
  reload: () => void
}): React.ReactNode {
  const t = useT()
  const [text, setText] = useState(note)
  const [currentDepth, setCurrentDepth] = useState(depth)
  const [currentRole, setCurrentRole] = useState(role)
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  useEffect(() => {
    setText(note)
  }, [note])

  useEffect(() => {
    setCurrentDepth(depth)
  }, [depth])

  useEffect(() => {
    setCurrentRole(role)
  }, [role])

  const flush = useCallback((valToSave?: string) => {
    if (saveTimer.current !== undefined) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = undefined
    }
    const val = (valToSave !== undefined ? valToSave : text).trim()
    void api.updateSession(sessionId, { authorNote: val === '' ? null : val })
      .then(reload)
      .catch(() => {})
  }, [sessionId, text, reload])

  useEffect(() => {
    return () => {
      if (saveTimer.current !== undefined) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = undefined
        const val = text.trim()
        void api.updateSession(sessionId, { authorNote: val === '' ? null : val })
          .then(reload)
          .catch(() => {})
      }
    }
  }, [sessionId, text, reload])

  const save = useCallback((value: string) => {
    setText(value)
    if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = undefined
      void api.updateSession(sessionId, { authorNote: value.trim() === '' ? null : value })
        .then(reload)
        .catch(() => {})
    }, 350)
  }, [sessionId, reload])

  const clear = useCallback(() => {
    save('')
    ref.current?.focus()
  }, [save])

  return (
    <div>
      <div className="rp-tray-actions" style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="rp-inline" style={{ gap: 10, fontSize: 12, alignItems: 'center' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span className="rp-muted" title={t('rp.dock.an.depthHint')}>{t('rp.dock.an.depth')}:</span>
            <input
              type="number"
              min={0}
              max={100}
              className="rp-input"
              style={{ width: 52, padding: '2px 4px', fontSize: 12 }}
              value={currentDepth}
              onChange={e => {
                const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                setCurrentDepth(val)
                void api.updateSession(sessionId, { authorNoteDepth: val }).then(reload).catch(() => {})
              }}
            />
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span className="rp-muted">{t('rp.dock.an.role')}:</span>
            <select
              className="rp-persona-select"
              style={{ padding: '2px 4px', fontSize: 12 }}
              value={currentRole}
              onChange={e => {
                const val = e.target.value as 'system' | 'user' | 'assistant'
                setCurrentRole(val)
                void api.updateSession(sessionId, { authorNoteRole: val }).then(reload).catch(() => {})
              }}
            >
              <option value="system">system</option>
              <option value="user">user</option>
              <option value="assistant">assistant</option>
            </select>
          </label>
        </div>
        {text.trim() ? (
          <button type="button" className="rp-btn-subtle" onClick={clear}>
            {t('rp.dock.instruction.clear')}
          </button>
        ) : null}
      </div>
      <textarea
        ref={ref}
        className="rp-textarea"
        placeholder={t('rp.dock.an.hint')}
        value={text}
        onBlur={() => flush()}
        onChange={event => save(event.target.value)}
      />
      <span className="rp-note">{t('rp.dock.an.note')}</span>
    </div>
  )
}

function MoreMenuPopover({
  choiceMode,
  onToggleChoice,
  hasAnyStudio,
  onOpenStudio,
  onContinue,
  onSwitch,
  onClose,
}: {
  choiceMode: boolean
  onToggleChoice: () => void
  hasAnyStudio: boolean
  onOpenStudio: () => void
  onContinue: () => void
  onSwitch: () => void
  onClose: () => void
}): React.ReactNode {
  const panelRef = useRef<HTMLDivElement | null>(null)
  useTrayDismiss(panelRef, onClose)
  const t = useT()

  return (
    <div ref={panelRef} className="rp-popover-panel rp-more-popover rp-more-tray">
      <div className="rp-more-menu-list rp-more-grid">
        <button
          type="button"
          className={`rp-more-menu-item${choiceMode ? ' rp-on' : ''}`}
          onClick={() => { onToggleChoice(); onClose() }}
        >
          <span>{t('rp.dock.choiceMode')}{choiceMode ? t('rp.dock.choiceOn') : t('rp.dock.choiceOff')}</span>
        </button>
        <button
          type="button"
          className={`rp-more-menu-item${hasAnyStudio ? ' rp-on' : ''}`}
          onClick={() => { onClose(); onOpenStudio() }}
        >
          <span>{t('rp.dock.studio')}{hasAnyStudio ? ' (已设)' : ''}</span>
        </button>
        <button
          type="button"
          className="rp-more-menu-item"
          onClick={() => { onContinue(); onClose() }}
        >
          <span>{t('rp.dock.continue')}</span>
        </button>
        <button
          type="button"
          className="rp-more-menu-item"
          onClick={() => { onSwitch(); onClose() }}
        >
          <span>{t('rp.dock.switchChar')}</span>
        </button>
      </div>
    </div>
  )
}

const MEMORY_CHIPS = [
  { labelKey: 'rp.dock.memory.chip.promise', prefix: '[约定] ' },
  { labelKey: 'rp.dock.memory.chip.secret', prefix: '[秘密] ' },
  { labelKey: 'rp.dock.memory.chip.item', prefix: '[信物] ' },
  { labelKey: 'rp.dock.memory.chip.status', prefix: '[状态] ' },
] as const

function MemoryContent({ sessionId, memory, wsPath, reload }: {
  sessionId: string
  memory: string
  wsPath?: string
  reload: () => void
}): React.ReactNode {
  const t = useT()
  const [text, setText] = useState(memory)
  const [recapLoading, setRecapLoading] = useState(false)
  const [recapError, setRecapError] = useState('')
  const [recapResult, setRecapResult] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)

  const triggerRecap = useCallback(() => {
    setRecapLoading(true)
    setRecapError('')
    setRecapResult(null)
    api.recap(sessionId, wsPath)
      .then(res => setRecapResult(res.recap))
      .catch(err => setRecapError(String(err instanceof Error ? err.message : err)))
      .finally(() => setRecapLoading(false))
  }, [sessionId, wsPath])

  const applyRecapAppend = useCallback(() => {
    if (!recapResult) return
    const current = text.trim()
    const next = current ? `${current}\n\n${recapResult}` : recapResult
    setText(next)
    void api.updateSession(sessionId, { storyMemory: next }).then(reload).catch(() => {})
    setRecapResult(null)
  }, [sessionId, text, recapResult, reload])

  const applyRecapReplace = useCallback(() => {
    if (!recapResult) return
    setText(recapResult)
    void api.updateSession(sessionId, { storyMemory: recapResult }).then(reload).catch(() => {})
    setRecapResult(null)
  }, [sessionId, recapResult, reload])

  useEffect(() => {
    ref.current?.focus()
  }, [])

  useEffect(() => {
    setText(memory)
  }, [memory])

  const flush = useCallback((valToSave?: string) => {
    if (saveTimer.current !== undefined) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = undefined
    }
    const val = (valToSave !== undefined ? valToSave : text).trim()
    void api.updateSession(sessionId, { storyMemory: val === '' ? null : val })
      .then(reload)
      .catch(() => {})
  }, [sessionId, text, reload])

  useEffect(() => {
    return () => {
      if (saveTimer.current !== undefined) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = undefined
        const val = text.trim()
        void api.updateSession(sessionId, { storyMemory: val === '' ? null : val })
          .then(reload)
          .catch(() => {})
      }
    }
  }, [sessionId, text, reload])

  const save = useCallback((value: string) => {
    setText(value)
    if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = undefined
      void api.updateSession(sessionId, { storyMemory: value.trim() === '' ? null : value })
        .then(reload)
        .catch(() => {})
    }, 350)
  }, [sessionId, reload])

  const clear = useCallback(() => {
    save('')
    ref.current?.focus()
  }, [save])

  const appendChip = useCallback((prefix: string) => {
    const current = text.trim()
    const next = current ? `${current}\n${prefix}` : prefix
    save(next)
    ref.current?.focus()
  }, [text, save])

  return (
    <div>
      <div className="rp-tray-actions" style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          className="rp-btn-subtle rp-btn-recap"
          disabled={recapLoading}
          onClick={triggerRecap}
          title={t('rp.dock.memory.recapTitle')}
        >
          {recapLoading ? t('rp.dock.memory.recapping') : t('rp.dock.memory.recap')}
        </button>
        {text.trim() ? (
          <button type="button" className="rp-btn-subtle" onClick={clear}>
            {t('rp.dock.instruction.clear')}
          </button>
        ) : null}
      </div>
      <div className="rp-chip-row">
        {MEMORY_CHIPS.map(chip => (
          <button
            key={chip.labelKey}
            type="button"
            className="rp-chip"
            onClick={() => appendChip(chip.prefix)}
          >
            + {t(chip.labelKey)}
          </button>
        ))}
      </div>
      {recapError ? <div className="rp-error" style={{ marginBottom: 6 }}>{recapError}</div> : null}
      {recapResult ? (
        <div className="rp-recap-preview">
          <div className="rp-recap-header">
            <span className="rp-recap-title">{t('rp.dock.memory.recapDone')}</span>
            <div className="rp-tray-actions">
              <button type="button" className="rp-btn-subtle" onClick={applyRecapAppend}>
                {t('rp.dock.memory.recapAppend')}
              </button>
              <button type="button" className="rp-btn-subtle" onClick={applyRecapReplace}>
                {t('rp.dock.memory.recapReplace')}
              </button>
              <button type="button" className="rp-popover-close" onClick={() => setRecapResult(null)}>×</button>
            </div>
          </div>
          <pre className="rp-recap-text">{recapResult}</pre>
        </div>
      ) : null}
      <textarea
        ref={ref}
        className="rp-textarea"
        rows={4}
        placeholder={t('rp.dock.memory.hint')}
        value={text}
        onBlur={() => flush()}
        onChange={event => save(event.target.value)}
      />
      <span className="rp-note">{t('rp.dock.memory.note')}</span>
    </div>
  )
}

function StoryStudioTray({
  sessionId,
  wsPath,
  binding,
  authorNoteDefaultDepth = 0,
  authorNoteDefaultRole = 'system',
  initialTab = 'an',
  reload,
  onClose,
}: {
  sessionId: string
  wsPath?: string
  binding: SessionState['binding']
  authorNoteDefaultDepth?: number
  authorNoteDefaultRole?: 'system' | 'user' | 'assistant'
  initialTab?: 'an' | 'memory' | 'instruction' | 'inspector'
  reload: () => void
  onClose: () => void
}): React.ReactNode {
  const panelRef = useRef<HTMLDivElement | null>(null)
  useTrayDismiss(panelRef, onClose)
  const t = useT()
  const [tab, setTab] = useState<'an' | 'memory' | 'instruction' | 'inspector'>(initialTab)

  const hasAuthorNote = Boolean((binding?.authorNote ?? '').trim())
  const hasStoryMemory = Boolean((binding?.storyMemory ?? '').trim())
  const hasInstruction = Boolean((binding?.pendingInstruction ?? '').trim())

  return (
    <div ref={panelRef} className="rp-tray-panel rp-studio-tray">
      <div className="rp-studio-header">
        <div className="rp-studio-tabs">
          <button
            type="button"
            className={`rp-studio-tab${tab === 'an' ? ' rp-active' : ''}`}
            onClick={() => setTab('an')}
          >
            {t('rp.dock.an')}
            {hasAuthorNote ? <span className="rp-tab-dot" /> : null}
          </button>
          <button
            type="button"
            className={`rp-studio-tab${tab === 'memory' ? ' rp-active' : ''}`}
            onClick={() => setTab('memory')}
          >
            {t('rp.dock.memory')}
            {hasStoryMemory ? <span className="rp-tab-dot" /> : null}
          </button>
          <button
            type="button"
            className={`rp-studio-tab${tab === 'instruction' ? ' rp-active' : ''}`}
            onClick={() => setTab('instruction')}
          >
            {t('rp.dock.instruction')}
            {hasInstruction ? <span className="rp-tab-dot" /> : null}
          </button>
          <button
            type="button"
            className={`rp-studio-tab${tab === 'inspector' ? ' rp-active' : ''}`}
            onClick={() => setTab('inspector')}
          >
            {t('rp.dock.inspector')}
          </button>
        </div>
        <button type="button" className="rp-popover-close" onClick={onClose} title="关闭">×</button>
      </div>

      <div className="rp-studio-content">
        {tab === 'an' ? (
          <AuthorNoteContent
            sessionId={sessionId}
            note={binding?.authorNote ?? ''}
            depth={binding?.authorNoteDepth ?? authorNoteDefaultDepth}
            role={binding?.authorNoteRole ?? authorNoteDefaultRole}
            reload={reload}
          />
        ) : null}
        {tab === 'memory' ? (
          <MemoryContent
            sessionId={sessionId}
            memory={binding?.storyMemory ?? ''}
            wsPath={wsPath}
            reload={reload}
          />
        ) : null}
        {tab === 'instruction' ? (
          <InstructionContent
            sessionId={sessionId}
            staged={binding?.pendingInstruction ?? ''}
            reload={reload}
          />
        ) : null}
        {tab === 'inspector' ? (
          <InspectorTray
            sessionId={sessionId}
            wsPath={wsPath}
            embedded={true}
          />
        ) : null}
      </div>
    </div>
  )
}

