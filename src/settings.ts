/**
 * User-facing settings.
 *
 * Since dsh 0.2 there is no settings registry to register a namespace with:
 * a plugin's live settings ARE the `.volatile()` fields of its own row
 * Config. The loader hands each one over as a stable reference, commits
 * edits into those references without remounting, and the `settings`
 * service persists form writes into the profile patch under the row's entry
 * id (`roleplay`, see cordis.patch.yml).
 *
 * Keeping the field names at the top level of the row Config is also what
 * migrates older installs: dsh 0.2 imports each section of the retired
 * `settings.yaml` into the entry of the same id, so a `roleplay:` section
 * lands on these fields unchanged.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/cordis-plugin-loader'

import type { UserPersona } from './cards/types.ts'

export interface RoleplaySettings {
  /** Display name used for the player and substituted for the user macro. */
  userName: string
  /** Optional player persona injected below the character definition. */
  userPersona: string
  /** Stored user personas library. */
  userPersonas: UserPersona[]
  /** When enabled, role-play sessions see the filesystem tools (read/search/write/edit). */
  allowFileTools: boolean
  /** When enabled, role-play sessions see the web-search tool (search only, no page fetch). */
  allowWebTools: boolean
  /** Subfolder inside each workspace holding that workspace's role-play data. */
  workspaceSubfolder: string
  /** Default home of newly imported/created cards. */
  cardStore: 'workspace' | 'global'
  /** Choice mode: every reply ends with 2-8 clickable options. */
  choiceMode: boolean
  /** How many options the model offers per reply in choice mode. */
  choiceCount: number
  /** Reading font size (13, 14, 15, 16). */
  readingFontSize: '13' | '14' | '15' | '16'
  /** Reading font family ('default' | 'serif' | 'sans'). */
  readingFontFamily: 'default' | 'serif' | 'sans'
  /** Subtle contrast emphasis on 『』 dialogue. */
  dialogueHighlight: boolean
  /** Default token diet mode for multi-character group chats. */
  groupDietMode: boolean
  /** Default insertion depth for Author's Note. */
  authorNoteDepth: number
  /** Default insertion role for Author's Note ('system' | 'user' | 'assistant'). */
  authorNoteRole: 'system' | 'user' | 'assistant'
}

type SettingsKey = keyof RoleplaySettings

const fields = {
  userName: z.string().default('你'),
  userPersona: z.string().default(''),
  userPersonas: z.array(z.any()).default([]),
  allowFileTools: z.boolean().default(false),
  allowWebTools: z.boolean().default(false),
  workspaceSubfolder: z.string().default('.silly-sta'),
  cardStore: z.union(['workspace', 'global']).default('workspace'),
  choiceMode: z.boolean().default(false),
  choiceCount: z.number().min(2).max(8).default(4),
  readingFontSize: z.union(['13', '14', '15', '16']).default('14'),
  readingFontFamily: z.union(['default', 'serif', 'sans']).default('default'),
  dialogueHighlight: z.boolean().default(true),
  groupDietMode: z.boolean().default(false),
  authorNoteDepth: z.number().min(0).max(100).default(0),
  authorNoteRole: z.union(['system', 'user', 'assistant']).default('system'),
} satisfies Record<SettingsKey, z>

/** Every settings field name, in declaration order. */
export const SETTINGS_KEYS = Object.keys(fields) as SettingsKey[]

/** Plain schema: validates a complete settings object and fills defaults. */
export const RoleplaySettings: z<RoleplaySettings> = z.object(fields)

/**
 * The same fields as live Config members, spread into the host row's Config.
 * `.volatile()` keeps each field's type and UI metadata; only the parsed
 * output changes, from the value to a reference.
 */
export const volatileSettingsFields: Record<SettingsKey, z> = Object.fromEntries(
  Object.entries(fields).map(([key, schema]) => [key, (schema as z).volatile()]),
) as Record<SettingsKey, z>

/** A loader-owned live reference (cosmokit `Volatile`). */
interface LiveRef<T> {
  get(): T
}

/** The parsed shape of the volatile fields inside the host row's config. */
export type LiveSettings = { readonly [K in SettingsKey]: LiveRef<RoleplaySettings[K]> }

/** Read/write view over the live settings, shared by the service and the routes. */
export interface SettingsStore {
  /** Current values, as one immutable-by-convention object. */
  get(): RoleplaySettings
  /**
   * Validate and persist a partial edit. Unknown keys are dropped.
   * @returns the settings with the edit applied.
   * @throws when the edit is invalid, the settings service is absent, or the
   *   profile does not accept form writes.
   */
  update(patch: object): Promise<RoleplaySettings>
  /**
   * Observe committed changes (from this plugin's own page, the native
   * config editor, or a hand edit of the profile patch).
   * @returns the disposer.
   */
  watch(listener: () => void): () => void
}

/**
 * Build the store over the row's live references.
 * @param ctx - the host row's own context: `loader/volatile-update` is
 *   delivered to the fiber that owns the config, and `ctx.fiber.entry` names
 *   the profile entry form writes address.
 * @param live - the volatile fields of the parsed row config.
 */
export function createSettingsStore(ctx: Context, live: LiveSettings): SettingsStore {
  const listeners = new Set<() => void>()
  let revision = 0
  const read = (): RoleplaySettings => {
    const value = {} as Record<SettingsKey, unknown>
    for (const key of SETTINGS_KEYS) value[key] = live[key].get()
    return value as unknown as RoleplaySettings
  }
  ctx.on('loader/volatile-update', () => {
    revision++
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch (error) {
        ctx.logger.warn('roleplay settings listener failed: %s', error)
      }
    }
  })

  /** Resolve once the loader has committed a write (or after a short grace). */
  const committed = (since: number) => new Promise<void>((resolveCommit) => {
    if (revision !== since) return resolveCommit()
    const done = () => {
      clearTimeout(timer)
      listeners.delete(done)
      resolveCommit()
    }
    const timer = setTimeout(done, 3000)
    listeners.add(done)
  })

  return {
    get: read,
    async update(patch) {
      const edit: Partial<Record<SettingsKey, unknown>> = {}
      for (const key of SETTINGS_KEYS) {
        if (Object.hasOwn(patch, key)) edit[key] = (patch as Record<string, unknown>)[key]
      }
      // Validate the merged result up front: the settings service would also
      // refuse it, but only after reaching the config editor, with a message
      // naming the whole row.
      const current = read()
      const next = RoleplaySettings({ ...current, ...edit } as RoleplaySettings)
      // Send only real changes: an unchanged value commits nothing, so the
      // loader would never announce it and the wait below would run out.
      const changed: Partial<Record<SettingsKey, unknown>> = {}
      for (const key of Object.keys(edit) as SettingsKey[]) {
        if (JSON.stringify(next[key]) !== JSON.stringify(current[key])) changed[key] = next[key]
      }
      if (Object.keys(changed).length === 0) return next
      const forms = ctx.get('settings')
      if (forms === undefined) throw new Error('settings service unavailable; edit the profile patch instead')
      if (!forms.writable) throw new Error('this dsh profile does not accept settings writes')
      const entryId = ctx.fiber.entry?.options.id ?? 'roleplay'
      const since = revision
      await forms.update(entryId, changed)
      await committed(since)
      return next
    },
    watch(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}


export function resolveUserIdentity(
  settings: RoleplaySettings,
  binding?: { userPersonaId?: string | null | undefined },
  card?: { userPersonaId?: string | null | undefined },
): { userName: string; userPersona: string } {
  const personaId = binding?.userPersonaId || card?.userPersonaId
  if (personaId && settings.userPersonas) {
    const persona = settings.userPersonas.find(p => p.id === personaId)
    if (persona) {
      return {
        userName: persona.name.trim() || settings.userName,
        userPersona: persona.persona.trim() || settings.userPersona,
      }
    }
  }
  return {
    userName: settings.userName,
    userPersona: settings.userPersona,
  }
}
