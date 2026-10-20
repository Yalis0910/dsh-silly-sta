/**
 * The `roleplay` service: character cards, per-session bindings, settings and
 * image generation, shared by the HTTP surface and the per-session agent
 * plugin.
 */
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rename, rm, stat, statfs, writeFile } from 'node:fs/promises'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { isAbsolute, join, parse, resolve } from 'node:path'
import { Service, type Context } from '@deepseek-ai/cordis'
import { defineDomain, domainTable, type Domain } from '@deepseek-ai/dsh-storage-domain'
import { CharacterCard, GeneratedImage, SessionBinding, StandaloneLorebook, type LoreEntry } from './cards/types.ts'
import { BlockAssembler } from '@deepseek-ai/dsh-llm'
import {
  roleplayStandingRules,
  characterSection,
  groupCharacterSection,
  pureCharacterSection,
  pureGroupCharacterSection,
  applyMacros,
  selectLore,
  matchLoreEntry,
  loreContext,
} from './prompts.ts'
import { resolveUserIdentity } from './settings.ts'
import { cardFromInterchange, cardFromPng, cardToInterchange, cardToPng, lorebookFromInterchange, lorebookToInterchange } from './cards/codec.ts'
import { encodeSolidPng, isPng } from './cards/png.ts'
import type { SettingsStore } from './settings.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    roleplay: RoleplayService
  }
}

const domainSpec = defineDomain({
  name: 'roleplay',
  version: 1,
  tables: {
    cards: domainTable<string, CharacterCard>(CharacterCard),
    sessions: domainTable<string, SessionBinding>(SessionBinding),
    images: domainTable<string, GeneratedImage>(GeneratedImage),
    lorebooks: domainTable<string, StandaloneLorebook>(StandaloneLorebook),
  },
})

/** Which store a card/image lives in: the global data dir, or the current workspace's subfolder. */
export type StoreScope = 'global' | 'workspace'


export interface LoreInspectEntry {
  id: string
  title: string
  source: string
  keys: string[]
  constant: boolean
  matched: boolean
  matchedKey?: string | undefined
  position: string
  contentLength: number
  estimatedTokens: number
}

export interface PromptInspectionReport {
  sessionId: string
  mode: 'single' | 'group'
  characters: { id: string; name: string }[]
  activeSpeaker?: { id: string; name: string } | undefined
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

export class RoleplayService extends Service {
  readonly settings: SettingsStore
  private domain!: Domain<typeof domainSpec>
  private readonly dataDir: string

  constructor(ctx: Context, dataDir: string, settings: SettingsStore) {
    super(ctx, 'roleplay')
    this.dataDir = dataDir
    this.settings = settings
  }

  /** Open storage and prepare the data directories; runs once before use. */
  async start(): Promise<void> {
    await mkdir(join(this.dataDir, 'avatars'), { recursive: true })
    await mkdir(join(this.dataDir, 'images'), { recursive: true })
    await mkdir(join(this.dataDir, 'lorebooks'), { recursive: true })
    this.domain = await this.ctx.storageDomain.open(domainSpec)
    this.ctx.effect(() => () => void this.domain.close())
  }

  // ── workspace stores ─────────────────────────────────────────────────────
  // A workspace's role-play data lives in <workspace>/<subfolder>/ with
  // cards/*.json, avatars/*.png, images/*.png and an images.json record
  // index. The workspace path always arrives from the caller (the client
  // knows the current workspace; sessions record theirs on the binding).

  /** Root of a workspace's role-play data, or undefined for unusable paths. */
  wsRoot(wsPath: string | null | undefined): string | undefined {
    if (!wsPath || !isAbsolute(wsPath) || !existsSync(wsPath)) return undefined
    const sub = this.settings.get().workspaceSubfolder.trim() || '.silly-sta'
    if (sub.split(/[\\/]/).some(part => part === '' || part === '.' || part === '..')) return undefined
    return join(wsPath, sub)
  }

  private async ensureWsDirs(root: string): Promise<void> {
    await mkdir(join(root, 'cards'), { recursive: true })
    await mkdir(join(root, 'avatars'), { recursive: true })
    await mkdir(join(root, 'images'), { recursive: true })
    await mkdir(join(root, 'lorebooks'), { recursive: true })
  }

  private readWsCard(root: string, id: string): CharacterCard | undefined {
    if (!/^[A-Za-z0-9-]+$/.test(id)) return undefined
    try {
      const card = CharacterCard.parse(JSON.parse(readFileSync(join(root, 'cards', `${id}.json`), 'utf8')))
      return RoleplayService.backfillCard(card)
    } catch {
      return undefined
    }
  }

  private listWsCards(root: string): CharacterCard[] {
    let files: string[]
    try {
      files = readdirSync(join(root, 'cards'))
    } catch {
      return []
    }
    const cards: CharacterCard[] = []
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const card = this.readWsCard(root, file.slice(0, -'.json'.length))
      if (card) cards.push(card)
    }
    return cards.sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.createdAt - a.createdAt)
  }

  private async writeWsCard(root: string, card: CharacterCard): Promise<void> {
    await this.ensureWsDirs(root)
    await writeFile(join(root, 'cards', `${card.id}.json`), JSON.stringify(card, null, 2))
  }

  private readWsLorebook(root: string, id: string): StandaloneLorebook | undefined {
    if (!/^[A-Za-z0-9-]+$/.test(id)) return undefined
    try {
      return StandaloneLorebook.parse(JSON.parse(readFileSync(join(root, 'lorebooks', `${id}.json`), 'utf8')))
    } catch {
      return undefined
    }
  }

  private listWsLorebooks(root: string): StandaloneLorebook[] {
    let files: string[]
    try {
      files = readdirSync(join(root, 'lorebooks'))
    } catch {
      return []
    }
    const books: StandaloneLorebook[] = []
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const book = this.readWsLorebook(root, file.slice(0, -'.json'.length))
      if (book) books.push(book)
    }
    return books.sort((a, b) => b.createdAt - a.createdAt)
  }

  private async writeWsLorebook(root: string, book: StandaloneLorebook): Promise<void> {
    await this.ensureWsDirs(root)
    await writeFile(join(root, 'lorebooks', `${book.id}.json`), JSON.stringify(book, null, 2))
  }


  /** Find a card and where it lives; global wins over the workspace on id collisions. */
  locateCard(id: string, wsPath?: string | null): { card: CharacterCard; scope: StoreScope; root?: string } | undefined {
    const global = this.domain.table('cards').get(id)
    if (global) return { card: RoleplayService.backfillCard(global), scope: 'global' }
    const root = this.wsRoot(wsPath)
    if (root) {
      const card = this.readWsCard(root, id)
      if (card) return { card, scope: 'workspace', root }
    }
    return undefined
  }

  /** Per-workspace serialization of images.json read-modify-write cycles. */
  private readonly wsRecordChains = new Map<string, Promise<unknown>>()

  private queueWsRecords(root: string, fn: () => Promise<void>): Promise<void> {
    const prev = this.wsRecordChains.get(root) ?? Promise.resolve()
    const next = prev.then(fn, fn)
    this.wsRecordChains.set(root, next)
    return next
  }

  private async readWsImageRecords(root: string): Promise<Record<string, GeneratedImage>> {
    try {
      const raw = JSON.parse(await readFile(join(root, 'images.json'), 'utf8')) as Record<string, unknown>
      const records: Record<string, GeneratedImage> = {}
      for (const [id, value] of Object.entries(raw)) {
        try {
          records[id] = GeneratedImage.parse(value)
        } catch {
          // drop malformed rows
        }
      }
      return records
    } catch {
      return {}
    }
  }

  private async writeWsImageRecords(root: string, records: Record<string, GeneratedImage>): Promise<void> {
    await writeFile(join(root, 'images.json'), JSON.stringify(records, null, 1))
  }

  /** True when the given subfolder of a workspace holds any role-play data. */
  async hasWorkspaceData(wsPath: string, sub: string): Promise<boolean> {
    if (!isAbsolute(wsPath) || sub.split(/[\\/]/).some(part => part === '' || part === '.' || part === '..')) return false
    const root = join(wsPath, sub)
    if (existsSync(join(root, 'images.json'))) return true
    for (const kind of ['cards', 'avatars', 'images', 'lorebooks'] as const) {
      try {
        if ((await readdir(join(root, kind))).length > 0) return true
      } catch {
        // missing dir
      }
    }
    return false
  }

  /**
   * Move a workspace's role-play data from one subfolder to another (called
   * after the user confirms, right after the subfolder setting changed).
   * A missing source is a no-op; an existing target gets a per-file merge
   * (existing target files win).
   */
  async migrateWorkspaceFolder(wsPath: string, fromSub: string, toSub: string): Promise<{ moved: boolean }> {
    if (!isAbsolute(wsPath) || !existsSync(wsPath)) throw new Error('工作区路径无效')
    for (const sub of [fromSub, toSub]) {
      if (sub.trim() === '' || sub.split(/[\\/]/).some(part => part === '' || part === '.' || part === '..')) {
        throw new Error('子文件夹名无效')
      }
    }
    const from = join(wsPath, fromSub)
    const to = join(wsPath, toSub)
    if (from === to || !existsSync(from)) return { moved: false }
    if (!existsSync(to)) {
      await rename(from, to)
      return { moved: true }
    }
    for (const kind of ['cards', 'avatars', 'images', 'lorebooks'] as const) {
      let files: string[]
      try {
        files = await readdir(join(from, kind))
      } catch {
        continue
      }
      await mkdir(join(to, kind), { recursive: true })
      for (const file of files) {
        if (existsSync(join(to, kind, file))) continue
        await rename(join(from, kind, file), join(to, kind, file)).catch(() => {})
      }
    }
    if (existsSync(join(from, 'images.json'))) {
      const source = await this.readWsImageRecords(from)
      const target = await this.readWsImageRecords(to)
      await this.writeWsImageRecords(to, { ...source, ...target })
      await rm(join(from, 'images.json'), { force: true })
    }
    return { moved: true }
  }

  // ── cards ────────────────────────────────────────────────────────────────

  /** Global cards first (the user-facing priority order), then the workspace's. */
  listCards(wsPath?: string): (CharacterCard & { scope: StoreScope })[] {
    const global = [...this.domain.table('cards').entries()]
      .map(([, card]) => ({ ...RoleplayService.backfillCard(card), scope: 'global' as const }))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.createdAt - a.createdAt)
    const root = this.wsRoot(wsPath)
    const workspace = root
      ? this.listWsCards(root).map(card => ({ ...card, scope: 'workspace' as const }))
      : []
    return [...global, ...workspace]
  }

  getCard(id: string, wsPath?: string | null): CharacterCard | undefined {
    return this.locateCard(id, wsPath)?.card
  }

  cardScope(id: string, wsPath?: string | null): StoreScope | undefined {
    return this.locateCard(id, wsPath)?.scope
  }

  /** Rows written before newer schema fields existed get their defaults on read. */
  private static backfillCard(card: CharacterCard): CharacterCard {
    return card.regexScripts === undefined ? { ...card, regexScripts: [] } : card
  }

  /**
   * Create or update a card. Updates stay in the store the card lives in;
   * creations go to `store` (default global; workspace requires a usable
   * `wsPath` and falls back to global without one).
   */
  async saveCard(raw: unknown, opts?: { store?: StoreScope | undefined; wsPath?: string | undefined }): Promise<CharacterCard> {
    const now = Date.now()
    const input = CharacterCard.parse({
      createdAt: now,
      updatedAt: now,
      ...(typeof raw === 'object' && raw !== null ? raw : {}),
      id: (raw as { id?: string })?.id || randomUUID(),
    })
    const located = this.locateCard(input.id, opts?.wsPath)
    const card: CharacterCard = {
      ...input,
      createdAt: located?.card.createdAt ?? now,
      updatedAt: now,
      ...(input.avatar === undefined && located?.card.avatar !== undefined ? { avatar: located.card.avatar } : {}),
    }
    const root = located?.scope === 'workspace'
      ? located.root
      : located ? undefined : (opts?.store === 'workspace' ? this.wsRoot(opts.wsPath) : undefined)
    if (root) {
      await this.writeWsCard(root, card)
    } else {
      await this.domain.table('cards').put(card.id, card)
    }
    return card
  }

  async deleteCard(id: string, wsPath?: string): Promise<boolean> {
    const located = this.locateCard(id, wsPath)
    if (!located) return false
    const { card, scope, root } = located
    let deleted = false
    if (scope === 'workspace' && root) {
      if (card.avatar) await rm(join(root, 'avatars', card.avatar), { force: true })
      await rm(join(root, 'cards', `${id}.json`), { force: true })
      deleted = true
    } else {
      if (card.avatar) await rm(join(this.dataDir, 'avatars', card.avatar), { force: true })
      deleted = await this.domain.table('cards').delete(id)
    }
    if (deleted) {
      await this.cleanupOrphanedCardSessions(id)
    }
    return deleted
  }

  private async cleanupOrphanedCardSessions(cardId: string): Promise<void> {
    try {
      const table = this.domain.table('sessions')
      for (const [sessionId, binding] of table.entries()) {
        let changed = false
        let nextCharId = binding.characterId
        let nextGroupIds = binding.groupCardIds
        let nextSpeakerId = binding.activeSpeakerId

        if (nextCharId === cardId) {
          nextCharId = undefined
          changed = true
        }

        if (nextGroupIds && nextGroupIds.includes(cardId)) {
          nextGroupIds = nextGroupIds.filter(id => id !== cardId)
          changed = true
        }

        if (nextSpeakerId === cardId) {
          nextSpeakerId = nextGroupIds && nextGroupIds.length > 0 ? nextGroupIds[0] : undefined
          changed = true
        }

        if (changed) {
          const nextBinding: SessionBinding = {
            ...binding,
            characterId: nextCharId,
            groupCardIds: nextGroupIds ?? [],
            activeSpeakerId: nextSpeakerId,
            updatedAt: Date.now(),
          }
          await table.put(sessionId, nextBinding)
        }
      }
    } catch {
      // safe fallback
    }
  }

  /** Clone an existing card with a new identity, duplicating its avatar if present. */
  async cloneCard(id: string, wsPath?: string): Promise<{ card: CharacterCard; scope: StoreScope }> {
    const located = this.locateCard(id, wsPath)
    if (!located) throw new Error(`unknown card ${id}`)
    const { card: source, scope, root } = located
    const newId = randomUUID()
    const now = Date.now()
    const clonedCard: CharacterCard = {
      ...source,
      id: newId,
      name: `${source.name} (副本)`,
      createdAt: now,
      updatedAt: now,
      avatar: undefined,
    }
    if (source.avatar) {
      const avatarBytes = await this.readAvatar(source, root)
      if (avatarBytes) {
        const file = `${newId}.png`
        clonedCard.avatar = file
        if (scope === 'workspace' && root) {
          await this.ensureWsDirs(root)
          await writeFile(join(root, 'avatars', file), avatarBytes)
        } else {
          await writeFile(join(this.dataDir, 'avatars', file), avatarBytes)
        }
      }
    }
    if (scope === 'workspace' && root) {
      await this.writeWsCard(root, clonedCard)
    } else {
      await this.domain.table('cards').put(clonedCard.id, clonedCard)
    }
    return { card: clonedCard, scope }
  }

  /** Attach a portrait (PNG bytes) to a card, stored beside the card itself. */
  async setAvatar(cardId: string, png: Buffer, wsPath?: string): Promise<CharacterCard> {
    const located = this.locateCard(cardId, wsPath)
    if (!located) throw new Error(`unknown card ${cardId}`)
    if (!isPng(png)) throw new Error('avatar must be a PNG image')
    const file = `${cardId}.png`
    const next = { ...located.card, avatar: file, updatedAt: Date.now() }
    if (located.scope === 'workspace' && located.root) {
      await this.ensureWsDirs(located.root)
      await writeFile(join(located.root, 'avatars', file), png)
      await this.writeWsCard(located.root, next)
    } else {
      await writeFile(join(this.dataDir, 'avatars', file), png)
      await this.domain.table('cards').put(cardId, next)
    }
    return next
  }

  /** Detach a card's portrait and clear the reference. */
  async deleteAvatar(cardId: string, wsPath?: string): Promise<CharacterCard> {
    const located = this.locateCard(cardId, wsPath)
    if (!located) throw new Error(`unknown card ${cardId}`)
    const { card, scope, root } = located
    if (card.avatar) {
      const dir = scope === 'workspace' && root ? join(root, 'avatars') : join(this.dataDir, 'avatars')
      await rm(join(dir, card.avatar), { force: true })
    }
    const next = { ...card, avatar: undefined, updatedAt: Date.now() }
    if (scope === 'workspace' && root) {
      await this.writeWsCard(root, next)
    } else {
      await this.domain.table('cards').put(cardId, next)
    }
    return next
  }

  /** Use an already generated image (either store) as a card's portrait. */
  async setAvatarFromImage(cardId: string, imageId: string, wsPath?: string): Promise<CharacterCard> {
    const bytes = await this.readImageFile(imageId, wsPath)
    if (!bytes) throw new Error(`unknown image ${imageId}`)
    return this.setAvatar(cardId, bytes, wsPath)
  }

  /**
   * Archive a card's current portrait into the images store (content-hash id,
   * deduplicated) so a later `setAvatar` overwrite stays recoverable via
   * `setAvatarFromImage`. Returns the archived image id, or undefined when the
   * card is missing or has no portrait. No gallery record is written — the
   * backup is reachable by id but does not clutter the image gallery.
   */
  async archiveCurrentAvatar(cardId: string, wsPath?: string): Promise<string | undefined> {
    const located = this.locateCard(cardId, wsPath)
    if (!located) return undefined
    const bytes = await this.readAvatar(located.card, located.root)
    if (!bytes) return undefined
    const id = createHash('sha256').update(bytes).digest('hex').slice(0, 40)
    const root = located.scope === 'workspace' ? located.root : undefined
    if (root) await this.ensureWsDirs(root)
    const path = root ? join(root, 'images', `${id}.png`) : join(this.dataDir, 'images', `${id}.png`)
    if (!existsSync(path)) await writeFile(path, bytes)
    return id
  }

  /** A card's current portrait as PNG bytes, resolved across both stores; throws when absent. */
  async cardAvatarPng(cardId: string, wsPath?: string): Promise<Buffer> {
    const located = this.locateCard(cardId, wsPath)
    if (!located) throw new Error(`卡片 ${cardId} 不存在`)
    const bytes = await this.readAvatar(located.card, located.root)
    if (!bytes) throw new Error(`卡片「${located.card.name}」当前没有头像`)
    return bytes
  }

  async readAvatar(card: CharacterCard, wsRoot?: string): Promise<Buffer | undefined> {
    if (!card.avatar) return undefined
    try {
      const dir = wsRoot ? join(wsRoot, 'avatars') : join(this.dataDir, 'avatars')
      return await readFile(join(dir, card.avatar))
    } catch {
      return undefined
    }
  }

  /** Import one card from a JSON or PNG payload into the configured default store. */
  async importCard(bytes: Buffer, wsPath?: string): Promise<CharacterCard> {
    const opts = { store: this.settings.get().cardStore, wsPath }
    if (isPng(bytes)) {
      const parsed = cardFromPng(bytes)
      if (!parsed) throw new Error('该 PNG 中没有嵌入角色卡数据')
      const card = await this.saveCard(parsed, opts)
      return this.setAvatar(card.id, bytes, wsPath)
    }
    const json = JSON.parse(bytes.toString('utf8')) as unknown
    return this.saveCard(cardFromInterchange(json), opts)
  }

  /** Move a card (with its portrait) between the global and workspace stores. */
  async moveCard(id: string, to: StoreScope, wsPath?: string): Promise<CharacterCard & { scope: StoreScope }> {
    const located = this.locateCard(id, wsPath)
    if (!located) throw new Error(`unknown card ${id}`)
    if (located.scope === to) return { ...located.card, scope: to }
    const root = this.wsRoot(wsPath)
    if (to === 'workspace' && !root) throw new Error('当前没有可用的工作区')
    const avatar = await this.readAvatar(located.card, located.root)
    if (to === 'workspace' && root) {
      await this.writeWsCard(root, located.card)
      if (avatar && located.card.avatar) {
        await writeFile(join(root, 'avatars', located.card.avatar), avatar)
      }
      if (located.card.avatar) await rm(join(this.dataDir, 'avatars', located.card.avatar), { force: true })
      await this.domain.table('cards').delete(id)
    } else {
      await this.domain.table('cards').put(id, located.card)
      if (avatar && located.card.avatar) {
        await writeFile(join(this.dataDir, 'avatars', located.card.avatar), avatar)
      }
      if (located.root) {
        if (located.card.avatar) await rm(join(located.root, 'avatars', located.card.avatar), { force: true })
        await rm(join(located.root, 'cards', `${id}.json`), { force: true })
      }
    }
    return { ...located.card, scope: to }
  }

  exportCardJson(id: string, wsPath?: string): string {
    const card = this.getCard(id, wsPath)
    if (!card) throw new Error(`unknown card ${id}`)
    return JSON.stringify(cardToInterchange(card), null, 2)
  }

  async exportCardPng(id: string, wsPath?: string): Promise<Buffer> {
    const located = this.locateCard(id, wsPath)
    if (!located) throw new Error(`unknown card ${id}`)
    const portrait = (await this.readAvatar(located.card, located.root)) ?? encodeSolidPng(512, 768, [38, 41, 58])
    return cardToPng(located.card, portrait)
  }


  // ── lorebooks ─────────────────────────────────────────────────────────────

  locateLorebook(id: string, wsPath?: string | null): { book: StandaloneLorebook; scope: StoreScope; root?: string } | undefined {
    const global = this.domain.table('lorebooks').get(id)
    if (global) return { book: global, scope: 'global' }
    const root = this.wsRoot(wsPath)
    if (root) {
      const book = this.readWsLorebook(root, id)
      if (book) return { book, scope: 'workspace', root }
    }
    return undefined
  }

  listLorebooks(wsPath?: string | null): (StandaloneLorebook & { scope: StoreScope })[] {
    const global = [...this.domain.table('lorebooks').entries()]
      .map(([, book]) => ({ ...book, scope: 'global' as const }))
      .sort((a, b) => b.createdAt - a.createdAt)
    const root = this.wsRoot(wsPath)
    const workspace = root
      ? this.listWsLorebooks(root).map(book => ({ ...book, scope: 'workspace' as const }))
      : []
    return [...global, ...workspace]
  }

  getLorebook(id: string, wsPath?: string | null): StandaloneLorebook | undefined {
    return this.locateLorebook(id, wsPath)?.book
  }

  lorebookScope(id: string, wsPath?: string | null): StoreScope | undefined {
    return this.locateLorebook(id, wsPath)?.scope
  }

  async saveLorebook(
    raw: unknown,
    opts?: { store?: StoreScope | undefined; wsPath?: string | undefined },
  ): Promise<StandaloneLorebook> {
    const now = Date.now()
    const input = StandaloneLorebook.parse({
      createdAt: now,
      updatedAt: now,
      ...(typeof raw === 'object' && raw !== null ? raw : {}),
      id: (raw as { id?: string })?.id || randomUUID(),
    })
    const located = this.locateLorebook(input.id, opts?.wsPath)
    const book: StandaloneLorebook = {
      ...input,
      createdAt: located?.book.createdAt ?? now,
      updatedAt: now,
    }
    const root = located?.scope === 'workspace'
      ? located.root
      : located ? undefined : (opts?.store === 'workspace' ? this.wsRoot(opts?.wsPath) : undefined)
    if (root) {
      await this.writeWsLorebook(root, book)
    } else {
      await this.domain.table('lorebooks').put(book.id, book)
    }
    return book
  }

  async deleteLorebook(id: string, wsPath?: string): Promise<boolean> {
    const located = this.locateLorebook(id, wsPath)
    if (!located) return false
    const { scope, root } = located
    if (scope === 'workspace' && root) {
      await rm(join(root, 'lorebooks', `${id}.json`), { force: true })
      return true
    }
    return this.domain.table('lorebooks').delete(id)
  }

  async importLorebook(bytes: Buffer, wsPath?: string): Promise<StandaloneLorebook> {
    const json = JSON.parse(bytes.toString('utf8')) as unknown
    const parsed = lorebookFromInterchange(json)
    return this.saveLorebook(parsed, { store: this.settings.get().cardStore, wsPath })
  }

  exportLorebookJson(id: string, wsPath?: string): string {
    const book = this.getLorebook(id, wsPath)
    if (!book) throw new Error(`unknown lorebook ${id}`)
    return JSON.stringify(lorebookToInterchange(book), null, 2)
  }

  /**
   * Resolves all lore entries for a character card, merging its own entries with
   * all entries from mounted standalone lorebooks.
   */
  resolveCardAllLore(card: CharacterCard, wsPath?: string | null): LoreEntry[] {
    const ownEntries = card.book ?? []
    if (!card.lorebookIds || card.lorebookIds.length === 0) return ownEntries
    const all = [...ownEntries]
    for (const lbId of card.lorebookIds) {
      const lb = this.getLorebook(lbId, wsPath)
      if (lb?.entries) {
        all.push(...lb.entries)
      }
    }
    return all
  }

  // ── session bindings ─────────────────────────────────────────────────────

  getBinding(sessionId: string): SessionBinding | undefined {
    return this.domain.table('sessions').get(sessionId)
  }

  async updateBinding(
    sessionId: string,
    patch: Partial<Omit<SessionBinding, 'characterId' | 'userPersonaId' | 'pendingInstruction' | 'authorNote' | 'storyMemory' | 'workspacePath' | 'customOpening' | 'activeSpeakerId' | 'choiceMode'>> & {
      characterId?: string | null
      userPersonaId?: string | null
      /** null clears the staged one-shot instruction. */
      pendingInstruction?: string | null
      /** null clears the persistent Author's Note. */
      authorNote?: string | null
      /** null clears the persistent story memory. */
      storyMemory?: string | null
      greetingIndex?: number
      /** null forgets the recorded workspace path. */
      workspacePath?: string | null
      /** null clears the fused group opening. */
      customOpening?: string | null
      /** null clears the designated active speaker. */
      activeSpeakerId?: string | null
      /** null reverts per-session choice mode to global setting. */
      choiceMode?: boolean | null
    },
  ): Promise<SessionBinding> {
    const existing = this.getBinding(sessionId)
    const merged: Record<string, unknown> = {
      mode: 'roleplay',
      ...existing,
      ...patch,
      sessionId,
      updatedAt: Date.now(),
    }
    // null = "remove the override": the schema keeps these keys absent.
    for (const key of ['characterId', 'userPersonaId', 'pendingInstruction', 'authorNote', 'storyMemory', 'workspacePath', 'customOpening', 'activeSpeakerId', 'choiceMode'] as const) {
      if (merged[key] === null || merged[key] === '') delete merged[key]
    }
    const next = SessionBinding.parse(merged)
    await this.domain.table('sessions').put(sessionId, next)
    return next
  }

  // ── image storage ─────────────────────────────────────────────────────────

  imageUrl(id: string, wsPath?: string): string {
    const base = `/x-roleplay/files/images/${id}.png`
    return wsPath ? `${base}?ws=${encodeURIComponent(wsPath)}` : base
  }

  avatarUrl(card: CharacterCard, scope?: StoreScope, wsPath?: string): string | undefined {
    if (!card.avatar) return undefined
    const base = `/x-roleplay/files/avatars/${card.avatar}`
    return scope === 'workspace' && wsPath ? `${base}?ws=${encodeURIComponent(wsPath)}` : base
  }

  /** Read one generated image's bytes, trying the global store then the workspace. */
  async readImageFile(id: string, wsPath?: string): Promise<Buffer | undefined> {
    if (!/^[a-f0-9]{16,64}$/.test(id)) return undefined
    try {
      return await readFile(join(this.dataDir, 'images', `${id}.png`))
    } catch {
      const root = this.wsRoot(wsPath)
      if (!root) return undefined
      try {
        return await readFile(join(root, 'images', `${id}.png`))
      } catch {
        return undefined
      }
    }
  }

  /**
   * Serve one stored file. A workspace path serves from that workspace's
   * subfolder, falling back to the global dir so chat cards that reference a
   * since-moved image keep rendering.
   */
  async readDataFile(kind: 'avatars' | 'images', file: string, wsPath?: string): Promise<Buffer | undefined> {
    if (!/^[A-Za-z0-9._-]+\.png$/.test(file)) return undefined
    const root = this.wsRoot(wsPath)
    if (root) {
      try {
        return await readFile(join(root, kind, file))
      } catch {
        // fall through to the global dir
      }
    }
    try {
      return await readFile(join(this.dataDir, kind, file))
    } catch {
      return undefined
    }
  }

  /** Poll-facing state per id: ready (file on disk), or missing. */
  imageStates(ids: string[], wsPath?: string): Record<string, { status: 'ready' | 'pending' | 'failed'; error?: string }> {
    const root = this.wsRoot(wsPath)
    const states: Record<string, { status: 'ready' | 'pending' | 'failed'; error?: string }> = {}
    for (const id of ids) {
      if (!/^[a-f0-9]{16,64}$/.test(id)) continue
      const onDisk = existsSync(join(this.dataDir, 'images', `${id}.png`))
        || (root !== undefined && existsSync(join(root, 'images', `${id}.png`)))
      if (onDisk) {
        states[id] = { status: 'ready' }
      } else {
        states[id] = { status: 'failed', error: '图片不存在（可能已被删除）' }
      }
    }
    return states
  }

  // ── gallery ──────────────────────────────────────────────────────────────

  /**
   * Every stored image (global plus the workspace's) with its file size,
   * starred-then-newest first, plus disk usage across both stores. Records
   * whose file disappeared are pruned on the way.
   */
  async listImages(wsPath?: string): Promise<{
    images: (GeneratedImage & { size: number; url: string; scope: StoreScope })[]
    usage: {
      usedBytes: number
      freeBytes: number
      totalBytes: number
      /** Present only when the workspace lives on a DIFFERENT partition than the global dir. */
      wsFreeBytes?: number
      wsTotalBytes?: number
    }
  }> {
    const table = this.domain.table('images')
    const images: (GeneratedImage & { size: number; url: string; scope: StoreScope })[] = []
    let usedBytes = 0
    for (const [id, record] of [...table.entries()]) {
      try {
        const info = await stat(join(this.dataDir, 'images', `${id}.png`))
        usedBytes += info.size
        images.push({ ...record, size: info.size, url: this.imageUrl(id), scope: 'global' })
      } catch {
        await table.delete(id)
      }
    }
    const root = this.wsRoot(wsPath)
    if (root) {
      const records = await this.readWsImageRecords(root)
      let pruned = false
      for (const [id, record] of Object.entries(records)) {
        try {
          const info = await stat(join(root, 'images', `${id}.png`))
          usedBytes += info.size
          images.push({ ...record, size: info.size, url: this.imageUrl(id, wsPath), scope: 'workspace' })
        } catch {
          delete records[id]
          pruned = true
        }
      }
      if (pruned) await this.queueWsRecords(root, () => this.writeWsImageRecords(root, records))
    }
    images.sort((a, b) => Number(b.starred) - Number(a.starred) || b.createdAt - a.createdAt)
    let freeBytes = 0
    let totalBytes = 0
    let wsFreeBytes: number | undefined
    let wsTotalBytes: number | undefined
    try {
      const fs = await statfs(this.dataDir)
      freeBytes = fs.bavail * fs.bsize
      totalBytes = fs.blocks * fs.bsize
      if (root && wsPath) {
        try {
          // The subfolder may not exist yet — the workspace itself does.
          const wsFs = await statfs(root).catch(() => statfs(wsPath))
          // Same-partition check: drive roots on Windows, filesystem
          // fingerprint (type/block size/block count) elsewhere.
          const same = process.platform === 'win32'
            ? parse(resolve(this.dataDir)).root.toLowerCase() === parse(resolve(wsPath)).root.toLowerCase()
            : wsFs.type === fs.type && wsFs.bsize === fs.bsize && wsFs.blocks === fs.blocks
          if (!same) {
            wsFreeBytes = wsFs.bavail * wsFs.bsize
            wsTotalBytes = wsFs.blocks * wsFs.bsize
          }
        } catch {
          // workspace disk stats unavailable: only the global line shows
        }
      }
    } catch {
      // usage stays partial on filesystems without statfs
    }
    return {
      images,
      usage: {
        usedBytes,
        freeBytes,
        totalBytes,
        ...(wsFreeBytes !== undefined && wsTotalBytes !== undefined ? { wsFreeBytes, wsTotalBytes } : {}),
      },
    }
  }

  /** Find one image's record and which store holds it. */
  private async locateImage(id: string, wsPath?: string): Promise<
    { record: GeneratedImage; scope: StoreScope; root?: string } | undefined
  > {
    const global = this.domain.table('images').get(id)
    if (global) return { record: global, scope: 'global' }
    const root = this.wsRoot(wsPath)
    if (root) {
      const record = (await this.readWsImageRecords(root))[id]
      if (record) return { record, scope: 'workspace', root }
    }
    return undefined
  }

  async setImageStarred(id: string, starred: boolean, wsPath?: string): Promise<void> {
    const located = await this.locateImage(id, wsPath)
    if (!located) throw new Error(`unknown image ${id}`)
    if (located.scope === 'workspace' && located.root) {
      const root = located.root
      await this.queueWsRecords(root, async () => {
        const records = await this.readWsImageRecords(root)
        if (records[id]) records[id] = { ...records[id], starred }
        await this.writeWsImageRecords(root, records)
      })
      return
    }
    await this.domain.table('images').put(id, { ...located.record, starred })
  }

  /** Delete images (files + records) from whichever store holds each id. */
  async deleteImages(ids: string[], wsPath?: string): Promise<number> {
    let deleted = 0
    const root = this.wsRoot(wsPath)
    for (const id of ids) {
      if (!/^[a-f0-9]{16,64}$/.test(id)) continue
      if (this.domain.table('images').get(id)) {
        await rm(join(this.dataDir, 'images', `${id}.png`), { force: true })
        if (await this.domain.table('images').delete(id)) deleted++
        continue
      }
      if (root) {
        await rm(join(root, 'images', `${id}.png`), { force: true })
        await this.queueWsRecords(root, async () => {
          const records = await this.readWsImageRecords(root)
          if (records[id]) {
            delete records[id]
            deleted++
          }
          await this.writeWsImageRecords(root, records)
        })
      }
    }
    return deleted
  }

  /** Move images between the global and workspace stores (file + record, same id). */
  async moveImages(ids: string[], to: StoreScope, wsPath?: string): Promise<number> {
    const root = this.wsRoot(wsPath)
    if (to === 'workspace' && !root) throw new Error('当前没有可用的工作区')
    let moved = 0
    for (const id of ids) {
      const located = await this.locateImage(id, wsPath)
      if (!located || located.scope === to) continue
      const sourceDir = located.scope === 'workspace' && located.root ? join(located.root, 'images') : join(this.dataDir, 'images')
      let bytes: Buffer
      try {
        bytes = await readFile(join(sourceDir, `${id}.png`))
      } catch {
        continue
      }
      if (to === 'workspace' && root) {
        await this.ensureWsDirs(root)
        await writeFile(join(root, 'images', `${id}.png`), bytes)
        await this.queueWsRecords(root, async () => {
          const records = await this.readWsImageRecords(root)
          records[id] = located.record
          await this.writeWsImageRecords(root, records)
        })
        await rm(join(this.dataDir, 'images', `${id}.png`), { force: true })
        await this.domain.table('images').delete(id)
      } else {
        await writeFile(join(this.dataDir, 'images', `${id}.png`), bytes)
        await this.domain.table('images').put(id, located.record)
        if (located.root) {
          const sourceRoot = located.root
          await rm(join(sourceRoot, 'images', `${id}.png`), { force: true })
          await this.queueWsRecords(sourceRoot, async () => {
            const records = await this.readWsImageRecords(sourceRoot)
            delete records[id]
            await this.writeWsImageRecords(sourceRoot, records)
          })
        }
      }
      moved++
    }
    return moved
  }

  resolveGroupCards(binding: SessionBinding, wsPath?: string | null): CharacterCard[] {
    const cardIds = binding.groupCardIds && binding.groupCardIds.length > 0
      ? binding.groupCardIds
      : (binding.characterId ? [binding.characterId] : [])
    const cards: CharacterCard[] = []
    const ws = binding.workspacePath ?? wsPath
    for (const id of cardIds) {
      const card = this.getCard(id, ws)
      if (card) cards.push(card)
    }
    return cards
  }

  resolveGroupAllLore(cards: CharacterCard[], wsPath?: string | null): LoreEntry[] {
    const seen = new Set<string>()
    const entries: LoreEntry[] = []
    for (const card of cards) {
      const cardLore = this.resolveCardAllLore(card, wsPath)
      for (const entry of cardLore) {
        if (!seen.has(entry.id)) {
          seen.add(entry.id)
          entries.push(entry)
        }
      }
    }
    return entries
  }

  private resolveModelTarget(sessionId: string): { provider: string; model: string } | undefined {
    const agents = this.ctx.get('agents') as any
    const agent = agents?.get?.(sessionId)
    const latest = agent?.session?.requestHeader?.()?.config
    if (latest?.provider && latest?.model) return { provider: latest.provider, model: latest.model }
    const options = agent?.options
    if (options?.provider && options?.model) return { provider: options.provider, model: options.model }
    const dshSettings = (this.ctx.get('settings') as any)?.get?.()
    if (dshSettings?.provider && dshSettings?.model) {
      return { provider: dshSettings.provider, model: dshSettings.model }
    }
    const llm = this.ctx.get('llm') as any
    const providers = llm?.listProviders?.() ?? []
    for (const p of providers) {
      if (p.models && p.models.length > 0) {
        const m = p.models[0]
        const modelId = typeof m === 'object' && m !== null ? m.id : String(m)
        if (modelId) return { provider: p.id, model: modelId }
      }
    }
    return undefined
  }

  private getSessionRecentMessages(sessionId: string, count = 20): { role: string; text: string }[] {
    const agents = this.ctx.get('agents') as any
    const agent = agents?.get?.(sessionId)
    if (!agent?.session?.deriveMessages) return []
    const derived = agent.session.deriveMessages()
    const result: { role: string; text: string }[] = []
    for (const m of derived) {
      const role = m.role ?? (m.source?.kind === 'user' ? 'user' : 'assistant')
      if (role !== 'user' && role !== 'assistant') continue
      let text = ''
      if (typeof m.content === 'string') {
        text = m.content
      } else if (Array.isArray(m.content)) {
        for (const part of m.content) {
          if (part && typeof part === 'object' && part.type === 'text') {
            text += part.text ?? ''
          }
        }
      }
      if (text.trim()) {
        result.push({ role, text: text.trim() })
      }
    }
    return result.slice(-count)
  }

  async generateRecap(sessionId: string, wsPath?: string | null): Promise<{ recap: string }> {
    const target = this.resolveModelTarget(sessionId)
    if (!target) throw new Error('未找到可用的模型配置进行总结')
    const recent = this.getSessionRecentMessages(sessionId, 25)
    if (recent.length < 2) {
      throw new Error('当前会话暂无足够的剧情对话进行提炼，请先进行几轮对话')
    }
    const binding = this.getBinding(sessionId)
    const cards = binding ? this.resolveGroupCards(binding, wsPath) : []
    const charNames = cards.map(c => c.name).join('、') || '角色'
    const identity = resolveUserIdentity(this.settings.get(), binding, cards[0])

    const dialogueText = recent.map(m => `${m.role === 'user' ? identity.userName : charNames}: ${m.text}`).join('\n')

    const promptText = `你是一个角色扮演剧情分析提炼助手。
请根据以下最近的剧情对话，总结提炼出必须长期铭记的核心事实、约定与现状。
请严格输出为 Markdown 列表，包含以下 4 类标签（若无对应内容可省略对应标签）：
- [约定] 双方或各角色之间达成的明确承诺、契约或约定
- [秘密] 尚未公开、隐瞒的真相或潜藏线索
- [信物] 交换、携带或获得的重要道具与关键物品
- [状态] 当前两人/团队之间的关系阶段、好感度进展与核心心理现状

格式要求：每条一句话，简明扼要，直奔主题，不要任何客套前言、寒暄或多余解释。直接输出列表内容。

近期剧情对话片段：
${dialogueText}`

    const assembler = new BlockAssembler()
    const llm = this.ctx.get('llm') as any
    if (!llm?.stream) throw new Error('LLM 服务未就绪')
    const stream = llm.stream({
      provider: target.provider,
      model: target.model,
      messages: [{ role: 'user', content: [{ type: 'text', text: promptText }] }],
      maxTokens: 1024,
      sessionId,
    })

    for await (const chunk of stream) {
      assembler.push(chunk)
    }

    const text = assembler.blocks().filter(b => b.type === 'text').map(b => (b as any).text).join('').trim()
    if (!text) throw new Error('模型未返回有效总结内容')
    return { recap: text }
  }

  async fuseGroupGreetings(sessionId: string, wsPath?: string | null): Promise<{ opening: string }> {
    const binding = this.getBinding(sessionId)
    if (!binding) throw new Error('会话不存在')
    const cards = this.resolveGroupCards(binding, wsPath)
    if (cards.length < 2) {
      throw new Error('群聊至少需要 2 名角色才能进行开场融合')
    }
    const target = this.resolveModelTarget(sessionId)
    if (!target) throw new Error('未找到可用的模型配置进行融合')
    const identity = resolveUserIdentity(this.settings.get(), binding, cards[0])

    const charSnippets = cards.map(c => {
      const greeting = c.firstMessage || c.alternateGreetings?.[0] || '（无单独开场）'
      return `角色【${c.name}】：\n性格设定：${c.description || c.personality}\n原单人开场白：${greeting}`
    }).join('\n\n')

    const promptText = `你是一位高水平小说家与跑团主持人。
现在有多位角色即将与玩家【${identity.userName}】共同处于同一个群聊/冒险场景中。
以下是各个角色的基本设定与他们各自原有的单人开场白：

${charSnippets}

【任务要求】：
请将以上各位角色的单人开场情境无缝融合，编写一段生动、自然的「多人同场第一幕」开场白。
1. 让所有在场角色自然地出现在同一时间和空间内（例如共同在一间酒馆、冒险小队营地、书房或街道上）。
2. 展示他们各自鲜明的性格、动作互动或台词，并给玩家【${identity.userName}】留出自然接话回应的切入点。
3. 对白使用『』包裹，心理使用（）包裹。
4. 篇幅 300~600 字，直接输出融合后的开场白正文，不要任何前言、总结或解释。`

    const assembler = new BlockAssembler()
    const llm = this.ctx.get('llm') as any
    if (!llm?.stream) throw new Error('LLM 服务未就绪')
    const stream = llm.stream({
      provider: target.provider,
      model: target.model,
      messages: [{ role: 'user', content: [{ type: 'text', text: promptText }] }],
      maxTokens: 1024,
      sessionId,
    })

    for await (const chunk of stream) {
      assembler.push(chunk)
    }

    const text = assembler.blocks().filter(b => b.type === 'text').map(b => (b as any).text).join('').trim()
    if (!text) throw new Error('模型未返回有效开场白内容')
    await this.updateBinding(sessionId, { customOpening: text })
    return { opening: text }
  }

  async inspectSessionPrompt(sessionId: string, wsPath?: string | null): Promise<PromptInspectionReport> {
    const binding: SessionBinding = this.getBinding(sessionId) ?? SessionBinding.parse({
      sessionId,
      mode: 'roleplay',
    })
    const ws = binding.workspacePath ?? wsPath
    const isGroup = (binding.groupCardIds?.length ?? 0) >= 2
    const cards = isGroup
      ? this.resolveGroupCards(binding, ws)
      : (binding.characterId ? [this.getCard(binding.characterId, ws)].filter(Boolean) as CharacterCard[] : [])

    const activeCard = binding.activeSpeakerId ? cards.find(c => c.id === binding.activeSpeakerId) : undefined
    const identity = resolveUserIdentity(this.settings.get(), binding, cards[0])

    const recentMsgs = this.getSessionRecentMessages(sessionId, 30)
    const recentTexts = recentMsgs.map(m => m.text)
    const seed = String(binding.updatedAt || recentMsgs.length)

    const allLore = isGroup ? this.resolveGroupAllLore(cards, ws) : (cards[0] ? this.resolveCardAllLore(cards[0], ws) : [])
    const loreGroups = selectLore(allLore, recentTexts, seed)

    // Evaluate lore entries using unified matchLoreEntry respecting scanDepth and seed
    const loreEntries: LoreInspectEntry[] = allLore.map(entry => {
      const depth = (entry.scanDepth && entry.scanDepth > 0) ? entry.scanDepth : 6
      const textToScan = recentTexts.slice(-depth).join('\n')
      const matchRes = matchLoreEntry(entry, textToScan, seed)
      return {
        id: entry.id,
        title: entry.title || '无标题',
        source: '词条',
        keys: entry.keys,
        constant: entry.constant,
        matched: matchRes.matched,
        matchedKey: matchRes.matchedKey,
        position: entry.position,
        contentLength: entry.content.length,
        estimatedTokens: Math.ceil(entry.content.length / 2),
      }
    })

    const systemRules = roleplayStandingRules(identity.userName)
    const charSection = isGroup
      ? groupCharacterSection(cards, binding.activeSpeakerId, identity.userName, identity.userPersona, recentTexts, binding.customOpening, allLore, seed)
      : (cards[0] ? characterSection(cards[0], identity.userName, identity.userPersona, recentTexts, binding.greetingIndex, allLore, seed) : '')

    // Pure character tokens without lore overlap to avoid double counting
    const pureChar = isGroup
      ? pureGroupCharacterSection(cards, binding.activeSpeakerId, identity.userName, identity.userPersona, binding.customOpening)
      : (cards[0] ? pureCharacterSection(cards[0], identity.userName, identity.userPersona, binding.greetingIndex) : '')

    const memoryText = binding.storyMemory?.trim() ?? ''
    const noteText = binding.authorNote?.trim() ?? ''

    const allDerived = this.getSessionRecentMessages(sessionId, 100)
    const historyChars = allDerived.reduce((acc, m) => acc + m.text.length, 0)

    const sysTokens = Math.ceil(systemRules.length / 2)
    const charTokens = Math.ceil(pureChar.length / 2)
    const loreTokens = loreEntries.filter(l => l.matched).reduce((acc, l) => acc + l.estimatedTokens, 0)
    const memTokens = Math.ceil(memoryText.length / 2)
    const noteTokens = Math.ceil(noteText.length / 2)
    const histTokens = Math.ceil(historyChars / 2)

    // Dynamic runtime contexts for complete preview
    const activeName = activeCard?.name ?? (cards[0]?.name || '群聊')
    const depthContext = loreContext(loreGroups.depth, activeName, identity.userName)
    const userTopContext = loreContext(loreGroups.userTop, activeName, identity.userName, '[补充设定]')
    const asstTopContext = loreContext(loreGroups.assistantTop, activeName, identity.userName, '[对下一条回复的指示]')

    const rawPromptPreview = [
      '=== [系统站立规则] ===\n' + systemRules,
      '=== [角色与场景设定] ===\n' + charSection,
      depthContext ? '=== [动态深度设定 (At Depth)] ===\n' + depthContext : '',
      userTopContext ? '=== [用户补充设定 (User Top)] ===\n' + userTopContext : '',
      memoryText ? '=== [剧情备忘录] ===\n' + memoryText : '',
      noteText ? '=== [场景设定 (Author Note)] ===\n' + noteText : '',
      asstTopContext ? '=== [回复前置指示 (Assistant Top)] ===\n' + asstTopContext : '',
    ].filter(Boolean).join('\n\n')

    return {
      sessionId,
      mode: isGroup ? 'group' : 'single',
      characters: cards.map(c => ({ id: c.id, name: c.name })),
      ...(activeCard ? { activeSpeaker: { id: activeCard.id, name: activeCard.name } } : {}),
      totalEstimatedTokens: sysTokens + charTokens + loreTokens + memTokens + noteTokens + histTokens,
      breakdown: {
        systemRulesTokens: sysTokens,
        characterTokens: charTokens,
        lorebookTokens: loreTokens,
        storyMemoryTokens: memTokens,
        authorNoteTokens: noteTokens,
        historyTokens: histTokens,
      },
      loreEntries,
      rawPromptPreview,
      recentMessagesCount: allDerived.length,
    }
  }

}
