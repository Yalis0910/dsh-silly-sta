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
import { useAgentPreset, useComposerTakenOver, useSessionBlank, useSessionRunning, type SessionSlotProps } from './compat.ts'
import { colorizeProse, compileCardRules, replaceMacros, startProseHighlighter, type CardColorRule } from './colorize.tsx'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
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
function OpeningBubble({ card, rules, greetingIndex = 0, onSwitchGreeting, canSwitch = true }: {
  card: BoundCard
  rules: readonly CardColorRule[]
  greetingIndex?: number
  onSwitchGreeting?: (index: number) => void
  canSwitch?: boolean
}): React.ReactNode {
  const t = useT()
  const userName = useUserName()
  const allGreetings = useMemo(() => [card.firstMessage, ...(card.alternateGreetings ?? [])].filter(Boolean), [card])
  const activeIndex = Math.min(Math.max(0, greetingIndex), Math.max(0, allGreetings.length - 1))
  const message = allGreetings[activeIndex] ?? card.firstMessage

  return (
    <div className="rp-opening">
      <div className="rp-opening-head">
        <Avatar url={card.avatarUrl ? stampedUrl(card.avatarUrl, card.updatedAt) : null} name={card.name} />
        <span className="rp-opening-name">{card.name}</span>
        <span className="rp-opening-tag">{t('rp.opening.tag')}</span>
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
      </div>
      <div className="rp-opening-body">{colorizeProse(replaceMacros(message, card.name, userName), rules)}</div>
    </div>
  )
}

/** Compact opening preview inside the dock (blank sessions, before the first send). */
function OpeningInline({ card, rules, greetingIndex = 0, onSwitchGreeting }: {
  card: BoundCard
  rules: readonly CardColorRule[]
  greetingIndex?: number
  onSwitchGreeting?: (index: number) => void
}): React.ReactNode {
  const userName = useUserName()
  const allGreetings = useMemo(() => [card.firstMessage, ...(card.alternateGreetings ?? [])].filter(Boolean), [card])
  const activeIndex = Math.min(Math.max(0, greetingIndex), Math.max(0, allGreetings.length - 1))
  const message = allGreetings[activeIndex] ?? card.firstMessage

  return (
    <div className="rp-greeting-wrap">
      {allGreetings.length > 1 ? (
        <div className="rp-greeting-bar">
          <span className="rp-note">可选开场 ({activeIndex + 1}/{allGreetings.length})</span>
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
        </div>
      ) : null}
      <div className="rp-greeting">{colorizeProse(replaceMacros(message, card.name, userName), rules)}</div>
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
  const [activeTray, setActiveTray] = useState<'none' | 'instruction' | 'note'>('none')

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
    reload()
  }, [reload])

  // A turn starting consumes the staged one-shot instruction host-side;
  // re-pull the binding on run-state flips so the button state stays honest.
  useEffect(() => {
    if (state) reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const bound = state?.binding?.characterId ? state.card : null
  // Avatar files are overwritten in place; updatedAt busts the browser cache.
  const boundAvatar = bound?.avatarUrl ? stampedUrl(bound.avatarUrl, bound.updatedAt) : null

  // A late-arriving workspace path must refresh the picker (workspace cards).
  useEffect(() => {
    setCards(null)
  }, [wsPath])

  useEffect(() => {
    if (state && !bound && cards === null) {
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
      await api.updateSession(targetSessionId, { mode, characterId: cardId, ...(wsPath ? { workspacePath: wsPath } : {}) })
      reload()
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setBusy(false)
    }
  }, [sessionId, mode, reload, wsPath])

  const sendInstruction = useCallback((instruction: string) => {
    inputActions.setDraft(`[系统指令: ${instruction}]`)
    inputActions.submit()
  }, [inputActions])

  const choiceMode = state ? (state.binding?.choiceMode ?? state.choiceModeDefault) : false
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
          {error ? <span className="rp-error">{error}</span> : null}
        </div>
        {cards === null ? (
          <span className="rp-muted">{t('rp.dock.loading')}</span>
        ) : cards.length === 0 ? (
          <span className="rp-muted">{t('rp.dock.noCards')}</span>
        ) : (
          <div className="rp-cardgrid">
            {cards.map(card => (
              <button key={`${card.scope}-${card.id}`} className="rp-cardcell" disabled={busy} onClick={() => void pick(card.id)}>
                <Avatar url={card.avatarUrl ? stampedUrl(card.avatarUrl, card.updatedAt) : null} name={card.name} />
                <span className="rp-cardcell-text">
                  <span className="rp-cardname">
                    <span className={`rp-scope-tag rp-scope-${card.scope}`}>
                      {card.scope === 'global' ? t('rp.scope.global') : t('rp.scope.workspace')}
                    </span>
                    {card.favorite ? '★ ' : ''}{card.name}
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

  const hasAuthorNote = (state.binding?.authorNote ?? '').trim() !== ''
  const authorNoteButton = !isForge ? (
    <button
      type="button"
      className={`rp-btn${activeTray === 'note' ? ' rp-active' : ''}${hasAuthorNote ? ' rp-on' : ''}`}
      title={t('rp.dock.an.title')}
      onClick={() => setActiveTray(prev => (prev === 'note' ? 'none' : 'note'))}
    >
      {t('rp.dock.an')}{hasAuthorNote ? ' ●' : ''}
    </button>
  ) : null

  const hasInstruction = (state.binding?.pendingInstruction ?? '').trim() !== ''
  const stagedInstructionButton = !isForge ? (
    <button
      type="button"
      className={`rp-btn${activeTray === 'instruction' ? ' rp-active' : ''}${hasInstruction ? ' rp-on' : ''}`}
      title={t('rp.dock.instruction.title')}
      onClick={() => setActiveTray(prev => (prev === 'instruction' ? 'none' : 'instruction'))}
    >
      {t('rp.dock.instruction')}{hasInstruction ? ' ●' : ''}
    </button>
  ) : null

  const continueButton = !isForge
    ? <button type="button" className="rp-btn" onClick={() => { inputActions.setDraft('（继续）'); inputActions.submit() }}>{t('rp.dock.continue')}</button>
    : null
  const switchButton = (
    <button
      type="button"
      className="rp-btn"
      onClick={() => {
        void api.updateSession(sessionId, { characterId: null }).then(() => { setCards(null); reload() }).catch(() => {})
      }}
    >
      {isForge ? t('rp.dock.switchCard') : t('rp.dock.switchChar')}
    </button>
  )

  const questionBar = holder ? createPortal(
    <div className="rp-dock">
      <div className="rp-dock-row rp-dock-row-oneline">
        <Avatar url={boundAvatar} name={bound.name} />
        <Tooltip label={bound.name} side="bottom">
          <span className="rp-name">{bound.name}</span>
        </Tooltip>
        <span className="rp-muted">{t('rp.dock.answering')}</span>
        <span className="rp-spacer" />
        {toggles}
        {authorNoteButton}
        {stagedInstructionButton}
        {continueButton}
        {switchButton}
      </div>
      {activeTray === 'instruction' ? (
        <InstructionTray
          sessionId={sessionId}
          staged={state.binding?.pendingInstruction ?? ''}
          reload={reload}
          onClose={() => setActiveTray('none')}
        />
      ) : null}
      {activeTray === 'note' ? (
        <AuthorNoteTray
          sessionId={sessionId}
          note={state.binding?.authorNote ?? ''}
          reload={reload}
          onClose={() => setActiveTray('none')}
        />
      ) : null}
    </div>,
    holder,
  ) : null

  return (
    <>
      <div className="rp-dock">
        <div className="rp-dock-row rp-dock-row-oneline">
          <Avatar url={boundAvatar} name={bound.name} />
          <Tooltip label={bound.name} side="bottom">
            <span className="rp-name">{bound.name}</span>
          </Tooltip>
          {isForge ? <span className="rp-muted">{t('rp.dock.forge.editing')}</span> : null}
          <span className="rp-spacer" />
          {toggles}
          {authorNoteButton}
          {stagedInstructionButton}
          {continueButton}
          {switchButton}
        </div>
        {activeTray === 'instruction' ? (
          <InstructionTray
            sessionId={sessionId}
            staged={state.binding?.pendingInstruction ?? ''}
            reload={reload}
            onClose={() => setActiveTray('none')}
          />
        ) : null}
        {activeTray === 'note' ? (
          <AuthorNoteTray
            sessionId={sessionId}
            note={state.binding?.authorNote ?? ''}
            reload={reload}
            onClose={() => setActiveTray('none')}
          />
        ) : null}
        {blank && bound.firstMessage ? (
          <OpeningInline
            card={bound}
            rules={cardRules}
            greetingIndex={activeGreetingIndex}
            onSwitchGreeting={switchGreeting}
          />
        ) : null}
        {error ? <span className="rp-error">{error}</span> : null}
      </div>
      {questionBar}
      {openingHolder && bound.firstMessage ? createPortal(
        <OpeningBubble
          card={bound}
          rules={cardRules}
          greetingIndex={activeGreetingIndex}
          onSwitchGreeting={switchGreeting}
        />,
        openingHolder
      ) : null}
    </>
  )
}

function InstructionTray({ sessionId, staged, reload, onClose }: {
  sessionId: string
  staged: string
  reload: () => void
  onClose: () => void
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

  const stage = useCallback((value: string) => {
    setText(value)
    if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void api.updateSession(sessionId, { pendingInstruction: value.trim() === '' ? null : value })
        .then(reload)
        .catch(() => {})
    }, 350)
  }, [sessionId, reload])

  const clear = useCallback(() => {
    stage('')
    ref.current?.focus()
  }, [stage])

  return (
    <div className="rp-tray-panel">
      <div className="rp-tray-header">
        <span className="rp-tray-title">{t('rp.dock.instruction')}</span>
        <div className="rp-tray-actions">
          {text.trim() ? (
            <button type="button" className="rp-btn-subtle" onClick={clear}>
              {t('rp.dock.instruction.clear')}
            </button>
          ) : null}
          <button type="button" className="rp-popover-close" onClick={onClose} title="关闭">×</button>
        </div>
      </div>
      <textarea
        ref={ref}
        className="rp-textarea"
        placeholder={t('rp.dock.instruction.hint')}
        value={text}
        onChange={event => stage(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Escape') onClose()
        }}
      />
      <span className="rp-note">{t('rp.dock.instruction.note')}</span>
    </div>
  )
}

function AuthorNoteTray({ sessionId, note, reload, onClose }: {
  sessionId: string
  note: string
  reload: () => void
  onClose: () => void
}): React.ReactNode {
  const t = useT()
  const [text, setText] = useState(note)
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  useEffect(() => {
    setText(note)
  }, [note])

  const save = useCallback((value: string) => {
    setText(value)
    if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
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
    <div className="rp-tray-panel">
      <div className="rp-tray-header">
        <span className="rp-tray-title">{t('rp.dock.an')}</span>
        <div className="rp-tray-actions">
          {text.trim() ? (
            <button type="button" className="rp-btn-subtle" onClick={clear}>
              {t('rp.dock.instruction.clear')}
            </button>
          ) : null}
          <button type="button" className="rp-popover-close" onClick={onClose} title="关闭">×</button>
        </div>
      </div>
      <textarea
        ref={ref}
        className="rp-textarea"
        placeholder={t('rp.dock.an.hint')}
        value={text}
        onChange={event => save(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Escape') onClose()
        }}
      />
      <span className="rp-note">{t('rp.dock.an.note')}</span>
    </div>
  )
}


