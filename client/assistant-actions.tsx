/**
 * Role-play additions to the assistant message action strip (the native
 * `conversation.chat.assistant-actions` list slot): regenerate the reply
 * from its own user prompt with swipe candidate branching. Renders nothing outside role-play sessions.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { IconRefreshOutlineRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { api } from './api.ts'
import { rewindAndResend } from './runtime.ts'
import { turnOf, useAgentPreset, useChatFlow, useSessionRunning, type ChatFlow, type SessionSlotProps } from './compat.ts'
import { useT } from './i18n.ts'

interface ActionProps extends SessionSlotProps {
  messageId?: string
  [extra: string]: unknown
}

interface SwipeState {
  index: number
  variants: string[]
}

function loadSwipe(key: string): SwipeState {
  try {
    const raw = sessionStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw) as SwipeState
      if (Array.isArray(parsed.variants) && typeof parsed.index === 'number') {
        return parsed
      }
    }
  } catch {
    // fallback
  }
  return { index: 0, variants: [] }
}

function saveSwipe(key: string, state: SwipeState): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(state))
  } catch {
    // ignore quota
  }
}

function findProseElement(btn: HTMLElement | null): HTMLElement | null {
  const step = btn?.closest('[data-chat-flow-kind="assistant-step"]')
  if (!step) return null
  return (step.querySelector('.markdown, .prose, [class*="markdown"], [class*="content"]') ?? step.querySelector('p')?.parentElement) as HTMLElement | null
}

/** Derive the acted-on turn and its opening user text. */
function deriveContext(flow: ChatFlow, messageId: string): {
  turn: number
  userText: string
  prevTurnEnd: number | undefined
} | undefined {
  let turn: number | undefined
  for (const key of flow.order) {
    const node = flow.node(key)
    if (node?.kind !== 'assistant-step') continue
    const finalNode = node.data?.finalNode as { messageId?: string } | undefined
    if (finalNode?.messageId === messageId) {
      turn = (node.data?.turn as number | undefined) ?? turnOf(node)
      break
    }
  }
  if (turn === undefined) return undefined
  let userText = ''
  for (const key of flow.order) {
    const node = flow.node(key)
    if (!node || turnOf(node) !== turn) continue
    if (node.kind === 'user' && userText === '') {
      const content = (node.data?.content ?? []) as readonly { type?: string; text?: string }[]
      userText = content.filter(block => block.type === 'text').map(block => block.text ?? '').join('')
    }
  }
  return { turn, userText, prevTurnEnd: flow.turnEnds.get(turn - 1) }
}

export function RoleplayAssistantActions(props: ActionProps): ReactNode {
  const t = useT()
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const [busy, setBusy] = useState<false | 'reply'>(false)
  const preset = useAgentPreset(props, props.sessionId)
  const flow = useChatFlow(props)
  const running = useSessionRunning(props)

  const context = useMemo(() => {
    if (!flow || typeof props.messageId !== 'string') return undefined
    return deriveContext(flow, props.messageId)
  }, [flow, props.messageId])

  const swipeKey = useMemo(() => {
    return context ? `rp_swipes_${props.sessionId}_${context.turn}` : ''
  }, [props.sessionId, context])

  const [swipe, setSwipe] = useState<SwipeState>(() => {
    return swipeKey ? loadSwipe(swipeKey) : { index: 0, variants: [] }
  })

  // Sync swipe on key changes & re-pull from session binding for durable persistence
  useEffect(() => {
    if (swipeKey) {
      setSwipe(loadSwipe(swipeKey))
    }
    if (!props.sessionId || !context?.turn) return
    let active = true
    api.session(props.sessionId)
      .then(st => {
        if (!active) return
        const turnKey = String(context.turn)
        const saved = st.binding?.swipes?.[turnKey]
        if (saved && Array.isArray(saved.variants) && saved.variants.length > 0) {
          setSwipe(prev => {
            const mergedVariants = Array.from(new Set([...saved.variants, ...prev.variants]))
            const next = { index: saved.index < mergedVariants.length ? saved.index : prev.index, variants: mergedVariants }
            if (swipeKey) saveSwipe(swipeKey, next)
            return next
          })
        }
      })
      .catch(() => {})
    return () => { active = false }
  }, [props.sessionId, context?.turn, swipeKey])

  const persistSwipe = useCallback((nextState: SwipeState) => {
    if (!props.sessionId || !context?.turn) return
    const turnKey = String(context.turn)
    api.session(props.sessionId)
      .then(st => {
        const currentSwipes = st.binding?.swipes ? { ...st.binding.swipes } : {}
        currentSwipes[turnKey] = nextState
        return api.updateSession(props.sessionId as string, { swipes: currentSwipes })
      })
      .catch(() => {})
  }, [props.sessionId, context?.turn])

  // Capture current prose text once generation completes
  useEffect(() => {
    if (running || !swipeKey || preset !== 'roleplay') return
    const timer = setTimeout(() => {
      const proseEl = findProseElement(btnRef.current)
      const currentHtml = proseEl?.innerHTML
      if (!currentHtml || currentHtml.trim() === '') return
      setSwipe(prev => {
        if (prev.variants.includes(currentHtml)) {
          const idx = prev.variants.indexOf(currentHtml)
          if (idx !== prev.index) {
            const next = { ...prev, index: idx }
            saveSwipe(swipeKey, next)
            persistSwipe(next)
            return next
          }
          return prev
        }
        const nextVariants = [...prev.variants, currentHtml]
        const next = { index: nextVariants.length - 1, variants: nextVariants }
        saveSwipe(swipeKey, next)
        persistSwipe(next)
        return next
      })
    }, 100)
    return () => clearTimeout(timer)
  }, [running, swipeKey, preset, persistSwipe])

  const handleSwitch = useCallback((targetIndex: number) => {
    if (!swipeKey || targetIndex < 0 || targetIndex >= swipe.variants.length) return
    const targetHtml = swipe.variants[targetIndex]
    const proseEl = findProseElement(btnRef.current)
    if (proseEl && targetHtml) {
      proseEl.innerHTML = targetHtml
    }
    const next = { ...swipe, index: targetIndex }
    setSwipe(next)
    saveSwipe(swipeKey, next)
    persistSwipe(next)
  }, [swipe, swipeKey, persistSwipe])

  const handleReroll = useCallback(() => {
    if (!context || context.prevTurnEnd === undefined || context.userText.trim() === '' || running || busy !== false) return
    const proseEl = findProseElement(btnRef.current)
    const currentHtml = proseEl?.innerHTML
    if (currentHtml && swipeKey) {
      setSwipe(prev => {
        const nextVariants = prev.variants.includes(currentHtml) ? prev.variants : [...prev.variants, currentHtml]
        const nextState = { index: nextVariants.length, variants: nextVariants }
        saveSwipe(swipeKey, nextState)
        persistSwipe(nextState)
        return nextState
      })
    }
    setBusy('reply')
    rewindAndResend(props.sessionId as string, context.prevTurnEnd as number, context.userText)
      .catch(() => setBusy(false))
  }, [context, running, busy, swipeKey, props.sessionId, persistSwipe])

  if (preset !== 'roleplay' || !context) return null

  const canRegenerate = context.prevTurnEnd !== undefined && context.userText.trim() !== '' && !running && busy === false
  const showSwipe = swipe.variants.length > 1

  return (
    <>
      {showSwipe ? (
        <div className="rp-swipe-control">
          <button
            type="button"
            className="rp-swipe-btn"
            disabled={swipe.index <= 0 || running}
            onClick={() => handleSwitch(swipe.index - 1)}
            title={t('rp.swipe.prev')}
          >
            ‹
          </button>
          <span className="rp-swipe-num">{swipe.index + 1} / {swipe.variants.length}</span>
          <button
            type="button"
            className="rp-swipe-btn"
            disabled={swipe.index >= swipe.variants.length - 1 || running}
            onClick={() => handleSwitch(swipe.index + 1)}
            title={t('rp.swipe.next')}
          >
            ›
          </button>
        </div>
      ) : null}
      <Tooltip label={canRegenerate ? (showSwipe ? t('rp.swipe.reroll') : t('rp.regen.reply')) : t('rp.regen.unavailable')} side="bottom">
        <button
          ref={btnRef}
          type="button"
          className="rp-msg-action"
          disabled={!canRegenerate}
          onClick={handleReroll}
        >
          {busy === 'reply' ? <span className="rp-imgspin" /> : <IconRefreshOutlineRegular size={16} />}
        </button>
      </Tooltip>
    </>
  )
}
