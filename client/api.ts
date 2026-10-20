/** Typed fetch helpers over the plugin's same-origin HTTP surface. */

/** Which store an item lives in. */
export type StoreScope = 'global' | 'workspace'

export interface UserPersonaValue {
  id: string
  name: string
  persona: string
  avatar?: string
}

export interface CardSummary {
  id: string
  name: string
  description: string
  creatorNotes: string
  tags: string[]
  favorite: boolean
  updatedAt: number
  avatarUrl: string | null
  bookEntries: number
  userPersonaId?: string
  lorebookIds?: string[]
  scope: StoreScope
}

export interface GroupCardSummary {
  id: string
  name: string
  avatarUrl: string | null
  firstMessage: string
  alternateGreetings?: string[]
  updatedAt: number
}

export interface SwipeTurnValue {
  index: number
  variants: string[]
}

export interface SessionState {
  binding: {
    mode: string
    characterId?: string
    groupCardIds?: string[]
    activeSpeakerId?: string
    speakerMode?: 'auto' | 'round_robin' | 'manual'
    customOpening?: string
    userPersonaId?: string
    choiceMode?: boolean
    pendingInstruction?: string
    authorNote?: string
    storyMemory?: string
    greetingIndex?: number
    swipes?: Record<string, SwipeTurnValue>
    workspacePath?: string
  } | null
  card: {
    id: string
    name: string
    firstMessage: string
    alternateGreetings?: string[]
    avatarUrl: string | null
    regexScripts: RegexScriptValue[]
    userPersonaId?: string
    lorebookIds?: string[]
    updatedAt: number
  } | null
  groupCards?: GroupCardSummary[]
  choiceModeDefault: boolean
  userPersonas?: UserPersonaValue[]
  defaultUserName?: string
}

/** Card-carried regex script (the client applies the display-coloring subset). */
export interface RegexScriptValue {
  name: string
  find: string
  replace: string
  flags: string
  enabled: boolean
  markdownOnly: boolean
  promptOnly: boolean
  placement: number[]
}

export interface LoreEntryValue {
  id: string
  title: string
  content: string
  keys: string[]
  useRegex: boolean
  constant: boolean
  position: 'system_top' | 'before_char' | 'after_char' | 'user_top' | 'assistant_top' | 'at_depth'
  order: number
  depth: number
  scanDepth: number
  probability: number
  enabled: boolean
}


export interface LoreInspectEntry {
  id: string
  title: string
  source: string
  keys: string[]
  constant: boolean
  matched: boolean
  matchedKey?: string
  position: string
  contentLength: number
  estimatedTokens: number
}

export interface PromptInspectionReport {
  sessionId: string
  mode: 'single' | 'group'
  characters: { id: string; name: string }[]
  activeSpeaker?: { id: string; name: string }
  totalEstimatedTokens: number
  breakdown: {
    systemRulesTokens: number
    characterTokens: number
    lorebookTokens: number
    storyMemoryTokens: number
    authorNoteTokens: number
    historyTokens: number
  }
  loreEntries: LoreInspectEntry[]
  rawPromptPreview: string
  recentMessagesCount: number
}

export interface CharacterCardDetail {
  card: {
    id: string
    name: string
    description: string
    personality: string
    systemPrompt: string
    postHistoryInstructions: string
    alternateGreetings: string[]
    scenario: string
    firstMessage: string
    exampleDialogs: string
    creatorNotes: string
    tags: string[]
    book: LoreEntryValue[]
    regexScripts: RegexScriptValue[]
    userPersonaId?: string
    lorebookIds?: string[]
    avatar?: string
    favorite: boolean
    createdAt: number
    updatedAt: number
  }
  avatarUrl: string | null
}



export interface LorebookSummary {
  id: string
  name: string
  description: string
  entriesCount: number
  createdAt: number
  updatedAt: number
  scope: StoreScope
}

export interface LorebookDetail {
  book: {
    id: string
    name: string
    description: string
    entries: LoreEntryValue[]
    createdAt: number
    updatedAt: number
  }
  scope: StoreScope
}

export interface RoleplaySettingsValue {
  userName: string
  userPersona: string
  userPersonas: UserPersonaValue[]
  allowFileTools: boolean
  allowWebTools: boolean
  workspaceSubfolder: string
  cardStore: StoreScope
  choiceMode: boolean
  choiceCount: number
  readingFontSize?: '13' | '14' | '15' | '16'
  readingFontFamily?: 'default' | 'serif' | 'sans'
  dialogueHighlight?: boolean
}

const BASE = '/x-roleplay'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, init)
  const body = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`)
  return body
}

/** Append the current-workspace query (store-aware routes). */
function withWs(path: string, ws?: string): string {
  if (!ws) return path
  return `${path}${path.includes('?') ? '&' : '?'}ws=${encodeURIComponent(ws)}`
}

export const api = {
  settings: () => request<{ value: RoleplaySettingsValue }>('/settings'),
  updateSettings: (patch: Partial<RoleplaySettingsValue>) =>
    request<{ value: RoleplaySettingsValue }>('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  cards: (ws?: string) => request<{ cards: CardSummary[] }>(withWs('/cards', ws)),
  deleteCard: (id: string, ws?: string) => request<{ deleted: boolean }>(withWs(`/cards/${id}`, ws), { method: 'DELETE' }),
  cloneCard: (id: string, ws?: string) =>
    request<{ card: unknown; avatarUrl: string | null; scope: StoreScope }>(withWs(`/cards/${id}/clone`, ws), {
      method: 'POST',
    }),
  updateCard: (id: string, patch: object, ws?: string) =>
    request<{ card: unknown }>(withWs(`/cards/${id}`, ws), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  getCard: (id: string, ws?: string) => request<CharacterCardDetail>(withWs(`/cards/${id}`, ws)),
  moveCard: (id: string, to: StoreScope, ws?: string) =>
    request<{ card: unknown; scope: StoreScope }>(withWs(`/cards/${id}/move`, ws), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to }),
    }),
  updateCardAvatar: (id: string, bytes: ArrayBuffer, ws?: string) =>
    request<{ card: unknown; avatarUrl: string | null }>(withWs(`/cards/${id}/avatar`, ws), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: bytes,
    }),
  deleteCardAvatar: (id: string, ws?: string) =>
    request<{ card: unknown; avatarUrl: null }>(withWs(`/cards/${id}/avatar`, ws), { method: 'DELETE' }),
  importCard: (bytes: ArrayBuffer, ws?: string) =>
    request<{ card: { id: string; name: string }; scope: StoreScope }>(withWs('/cards/import', ws), {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: bytes,
    }),
  lorebooks: (ws?: string) => request<{ lorebooks: LorebookSummary[] }>(withWs('/lorebooks', ws)),
  getLorebook: (id: string, ws?: string) => request<LorebookDetail>(withWs(`/lorebooks/${id}`, ws)),
  saveLorebook: (raw: object, ws?: string) =>
    request<{ book: unknown }>(withWs('/lorebooks', ws), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(raw),
    }),
  updateLorebook: (id: string, patch: object, ws?: string) =>
    request<{ book: unknown }>(withWs(`/lorebooks/${id}`, ws), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  deleteLorebook: (id: string, ws?: string) =>
    request<{ deleted: boolean }>(withWs(`/lorebooks/${id}`, ws), { method: 'DELETE' }),
  importLorebook: (bytes: ArrayBuffer, ws?: string) =>
    request<{ book: unknown; scope: StoreScope }>(withWs('/lorebooks/import', ws), {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: bytes,
    }),
  exportLorebookUrl: (id: string, ws?: string) => `${BASE}${withWs(`/lorebooks/${id}/export.json`, ws)}`,
  session: (sessionId: string) => request<SessionState>(`/session/${encodeURIComponent(sessionId)}`),
  updateSession: (sessionId: string, patch: {
    mode?: string
    characterId?: string | null
    userPersonaId?: string | null
    choiceMode?: boolean | null
    /** One-shot stage direction sent with the next message; null clears it. */
    pendingInstruction?: string | null
    /** Persistent scene direction or author's note; null clears it. */
    authorNote?: string | null
    /** Persistent story milestones, promises and facts; null clears it. */
    storyMemory?: string | null
    /** Currently selected greeting index for the session. */
    greetingIndex?: number
    /** Per-turn swipe candidates and active branch index. */
    swipes?: Record<string, SwipeTurnValue>
    /** The session's workspace path (recorded by the dock); null forgets it. */
    workspacePath?: string | null
    groupCardIds?: string[]
    activeSpeakerId?: string | null
    speakerMode?: 'auto' | 'round_robin' | 'manual'
    customOpening?: string | null
  }) =>
    request<{ binding: unknown }>(`/session/${encodeURIComponent(sessionId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  recap: (sessionId: string, ws?: string) =>
    request<{ recap: string }>(withWs(`/session/${encodeURIComponent(sessionId)}/recap`, ws), { method: 'POST' }),
  fuseGreetings: (sessionId: string, ws?: string) =>
    request<{ opening: string }>(withWs(`/session/${encodeURIComponent(sessionId)}/fuse-greetings`, ws), { method: 'POST' }),
  inspectPrompt: (sessionId: string, ws?: string) =>
    request<PromptInspectionReport>(withWs(`/session/${encodeURIComponent(sessionId)}/inspector`, ws)),
  exportJsonUrl: (id: string, ws?: string) => `${BASE}${withWs(`/cards/${id}/export.json`, ws)}`,
  exportPngUrl: (id: string, ws?: string) => `${BASE}${withWs(`/cards/${id}/export.png`, ws)}`,
  images: (ws?: string) => request<GalleryResponse>(withWs('/images', ws)),
  starImage: (id: string, starred: boolean, ws?: string) =>
    request<{ ok: boolean }>(withWs('/images/star', ws), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, starred }),
    }),
  deleteImages: (ids: string[], ws?: string) =>
    request<{ deleted: number }>(withWs('/images/delete', ws), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }),
  moveImages: (ids: string[], to: StoreScope, ws?: string) =>
    request<{ moved: number }>(withWs('/images/move', ws), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, to }),
    }),
  probeWorkspaceFolder: (ws: string, sub: string) =>
    request<{ exists: boolean }>(withWs(`/workspace/probe?sub=${encodeURIComponent(sub)}`, ws)),
  migrateWorkspaceFolder: (ws: string, from: string, to: string) =>
    request<{ moved: boolean }>(withWs('/workspace/migrate', ws), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to }),
    }),
}

export interface GalleryImage {
  id: string
  prompt: string
  provider: string
  width?: number
  height?: number
  createdAt: number
  starred: boolean
  size: number
  url: string
  scope: StoreScope
}

export interface GalleryUsage {
  usedBytes: number
  freeBytes: number
  totalBytes: number
  /** Present only when the workspace store sits on a different partition. */
  wsFreeBytes?: number
  wsTotalBytes?: number
}

export interface GalleryResponse {
  images: GalleryImage[]
  usage: GalleryUsage
}

/**
 * Cache-bust a stored-file URL with a content stamp (e.g. the card's
 * updatedAt): avatar files are overwritten IN PLACE under a fixed name, so an
 * unchanged src would keep showing the browser-cached old image.
 */
export function stampedUrl(url: string, stamp: number | undefined): string {
  if (!stamp) return url
  return `${url}${url.includes('?') ? '&' : '?'}t=${stamp}`
}

/** Human-readable byte size. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(units.length - 1, Math.floor(Math.log2(bytes) / 10))
  const value = bytes / 2 ** (10 * exponent)
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`
}
