/**
 * Cross-version bridge for the dsh browser contract.
 *
 * dsh 0.1.2 reshaped the client plane this plugin plugs into. One build has
 * to keep working on both generations, so every version-sensitive read goes
 * through this module instead of touching slot props directly.
 *
 * What moved (0.1.0-rc.6 → 0.1.2):
 *  - the transcript left `dsh-client-ui-conversation` for a new
 *    `dsh-client-ui-chat` package: chat nodes now arrive through a `useChat`
 *    session hook (`{ order, nodes, legacy.turnEnds }`) and the native node
 *    renderers bind the `chat` locale namespace instead of `conversation`
 *  - `useSession` narrowed to session lifecycle only — no `chat`, no
 *    `turnEnds`, and no `pending` array (reading `.pending.length` is what
 *    crashed the dock entry, which is why it stopped rendering at all)
 *  - a composer takeover is announced by the root
 *    `useSessionPendingInteraction` map instead of that `pending` array
 *  - the agent preset left the session-list row and became the `agentPreset`
 *    session projection, read through the keyed `useProjection` hook
 *  - the workspace snapshot dropped `recentWorkspaceId` (see runtime.ts)
 *
 * Feature detection is by prop presence, which is fixed for the lifetime of
 * a page, so the conditional hook calls below keep a stable hook order.
 */
import { useEffect, useMemo, useState } from 'react'

// ── build probe ──────────────────────────────────────────────────────────────

/** Package ids in the host-injected client module graph. */
function bootModuleIds(): readonly string[] {
  const boot = (globalThis as { __DSH_BOOT__?: { entries?: readonly { id?: unknown }[] } }).__DSH_BOOT__
  const entries = boot?.entries
  if (!Array.isArray(entries)) return []
  return entries.map(entry => (typeof entry?.id === 'string' ? entry.id : '')).filter(id => id !== '')
}

/** Whether the running harness ships a package as its own client module. */
export function hasClientModule(id: string): boolean {
  return bootModuleIds().includes(id)
}

/** True on the dsh generation that split the transcript into its own package. */
export const SPLIT_CHAT_BUILD = hasClientModule('@deepseek-ai/dsh-client-ui-chat')

/**
 * Locale namespace the native `conversation.chat.node` renderers are bound
 * to. The user-node shadow delegates to one of them, so it must claim the
 * same seat or the delegated renderer reads copy from the wrong dictionary.
 */
export const CHAT_NODE_LOCALE: 'chat' | 'conversation' = SPLIT_CHAT_BUILD ? 'chat' : 'conversation'

// ── slot prop shapes ─────────────────────────────────────────────────────────

/** One transcript row, as both generations shape it. */
export interface ChatNodeLike {
  kind?: string
  location?: { kind?: string; turn?: { turn: number } }
  data?: Record<string, unknown>
}

interface ChatNodeReader {
  get(key: string): ChatNodeLike | undefined
}

/** 0.1.2 `useChat` snapshot (only the parts this plugin reads). */
interface ChatSnapshotLike {
  order?: readonly string[]
  nodes?: ChatNodeReader
  legacy?: { turnEnds?: ReadonlyMap<number, number> }
}

/** rc.6 `useSession` snapshot (the conversation assembly). */
interface LegacySessionSnapshotLike {
  chat?: { order: readonly string[]; nodes: ChatNodeReader }
  turnEnds?: ReadonlyMap<number, number>
  pending?: readonly unknown[]
  running?: boolean
  blank?: boolean
}

interface SessionListLike {
  byId: Record<string, { agentPreset?: string; blank?: boolean; projectionValues?: { agentPreset?: string } } | undefined>
}

/**
 * The session-scope standard props every entry of this plugin receives. Each
 * member is optional: which ones the framework supplies depends on the dsh
 * generation, and the helpers below pick whichever is present.
 */
export interface SessionSlotProps {
  sessionId?: string
  session?: unknown
  inputActions?: { setDraft(text: string): void; submit(): void }
  useSessions?: (select: (state: SessionListLike) => unknown) => unknown
  useSession?: (select: (snapshot: LegacySessionSnapshotLike) => unknown) => unknown
  useChat?: (select: (snapshot: ChatSnapshotLike) => unknown) => unknown
  useProjection?: (key: string) => unknown
  useSessionPendingInteraction?: (select: (map: ReadonlyMap<string, unknown>) => unknown) => unknown
}

// ── derived reads ────────────────────────────────────────────────────────────

function extractPresetString(val: unknown): string | undefined {
  if (typeof val === 'string' && val.trim() !== '') return val.trim()
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>
    if (typeof obj.val === 'string' && obj.val.trim() !== '') return obj.val.trim()
    if (typeof obj.value === 'string' && obj.value.trim() !== '') return obj.value.trim()
    if (typeof obj.current === 'string' && obj.current.trim() !== '') return obj.current.trim()
    if (typeof obj.id === 'string' && obj.id.trim() !== '') return obj.id.trim()
  }
  return undefined
}

function detectDomPreset(): string | undefined {
  if (typeof document === 'undefined') return undefined
  // Scan preset chips in hero row, seat buttons or header
  const candidates = document.querySelectorAll(
    'button, [role="button"], [class*="seat"], [class*="Seat"], [class*="Preset"], [class*="preset"], [class*="hero"], [class*="Hero"], [class*="Chip"]'
  )
  for (const el of candidates) {
    const text = el.textContent || ''
    if (text.includes('角色扮演') || text.includes('Role-play')) return 'roleplay'
    if (text.includes('角色卡创作') || text.includes('Character Forge')) return 'character-forge'
  }
  const hero = document.querySelector('[class*="heroWorkspaceRow"], [class*="composerHero"], [class*="composerStack"]')
  if (hero) {
    const text = hero.textContent || ''
    if (text.includes('角色扮演') || text.includes('Role-play')) return 'roleplay'
    if (text.includes('角色卡创作') || text.includes('Character Forge')) return 'character-forge'
  }
  // Fallback: check all buttons on the page
  const buttons = document.getElementsByTagName('button')
  for (let i = 0; i < buttons.length; i++) {
    const text = buttons[i]?.textContent || ''
    if (text.includes('角色扮演') || text.includes('Role-play')) return 'roleplay'
    if (text.includes('角色卡创作') || text.includes('Character Forge')) return 'character-forge'
  }
  return undefined
}

/** The agent preset a session runs — 0.1.2 projection, else the list row. */
export function useAgentPreset(props: SessionSlotProps, sessionId: string | undefined): string | undefined {
  const projected = props.useProjection ? props.useProjection('agentPreset') : undefined
  const projStr = extractPresetString(projected)

  const fromSession = props.useSession
    ? extractPresetString(
        props.useSession(s => {
          const snap = s as Record<string, unknown> | undefined
          return (
            extractPresetString((snap?.projectionValues as Record<string, unknown> | undefined)?.agentPreset) ??
            extractPresetString(snap?.agentPreset)
          )
        })
      )
    : undefined

  const listed = props.useSessions
    ? extractPresetString(
        props.useSessions(state => {
          if (sessionId === undefined || sessionId === '') return undefined
          const row = state.byId[sessionId] as Record<string, unknown> | undefined
          return (
            extractPresetString((row?.projectionValues as Record<string, unknown> | undefined)?.agentPreset) ??
            extractPresetString(row?.agentPreset)
          )
        })
      )
    : undefined

  const ownerSession = props.session as Record<string, unknown> | undefined
  const fromOwner =
    extractPresetString((ownerSession?.projectionValues as Record<string, unknown> | undefined)?.agentPreset) ??
    extractPresetString(ownerSession?.agentPreset)

  const directProp = extractPresetString((props as unknown as { agentPreset?: unknown })?.agentPreset)

  // DOM observer hook for new blank sessions where server events/projections are not yet emitted
  const [domPreset, setDomPreset] = useState<string | undefined>(() => detectDomPreset())
  useEffect(() => {
    const update = () => {
      const found = detectDomPreset()
      setDomPreset(current => (current !== found ? found : current))
    }
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [])

  return projStr ?? fromSession ?? listed ?? fromOwner ?? directProp ?? domPreset
}

/** Whether the session's log is still empty (creation-time choices are live). */
export function useSessionBlank(props: SessionSlotProps, sessionId: string | undefined): boolean {
  const listed = props.useSessions
    ? props.useSessions(state => (sessionId === undefined ? undefined : state.byId[sessionId]?.blank))
    : undefined
  const snapshot = props.useSession ? props.useSession(state => (state as Record<string, unknown> | undefined)?.blank) : undefined
  const ownerBlank = (props as unknown as { session?: { blank?: boolean } })?.session?.blank
  if (typeof listed === 'boolean') return listed
  if (typeof snapshot === 'boolean') return snapshot
  if (typeof ownerBlank === 'boolean') return ownerBlank
  return true
}

/** Whether a turn is running (same field on both generations). */
export function useSessionRunning(props: SessionSlotProps): boolean {
  return props.useSession ? props.useSession(state => state.running === true) === true : false
}

/**
 * Whether a business-owned interaction (e.g. the native question card) has
 * taken the composer over — the dock then portals a compact bar instead.
 */
export function useComposerTakenOver(props: SessionSlotProps, sessionId: string | undefined): boolean {
  const interaction = props.useSessionPendingInteraction
    ? props.useSessionPendingInteraction(map => (sessionId === undefined ? false : map.get(sessionId) !== undefined))
    : false
  const legacy = props.useSession
    ? props.useSession(state => Array.isArray(state.pending) && state.pending.length > 0)
    : false
  return interaction === true || legacy === true
}

/** Version-neutral view of the transcript this plugin walks. */
export interface ChatFlow {
  order: readonly string[]
  node(key: string): ChatNodeLike | undefined
  /** `turn/end` seq by turn number — the fork anchor for rewind/edit. */
  turnEnds: ReadonlyMap<number, number>
}

const NO_TURN_ENDS: ReadonlyMap<number, number> = new Map()

/** The current session's transcript, from whichever hook carries it. */
export function useChatFlow(props: SessionSlotProps): ChatFlow | undefined {
  const chat = props.useChat ? (props.useChat(snapshot => snapshot) as ChatSnapshotLike | undefined) : undefined
  const legacy = props.useSession
    ? (props.useSession(snapshot => snapshot) as LegacySessionSnapshotLike | undefined)
    : undefined
  return useMemo(() => {
    const nodes = chat?.nodes
    if (nodes && chat?.order) {
      return { order: chat.order, node: key => nodes.get(key), turnEnds: chat.legacy?.turnEnds ?? NO_TURN_ENDS }
    }
    const legacyChat = legacy?.chat
    if (legacyChat) {
      return { order: legacyChat.order, node: key => legacyChat.nodes.get(key), turnEnds: legacy.turnEnds ?? NO_TURN_ENDS }
    }
    return undefined
  }, [chat, legacy])
}

/** The turn a transcript row belongs to, when it sits inside one. */
export function turnOf(node: ChatNodeLike | undefined): number | undefined {
  const location = node?.location
  return location && (location.kind === 'turn' || location.kind === 'step') ? location.turn?.turn : undefined
}
