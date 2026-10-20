/**
 * Session-plane plugin, mounted only through the two agent presets this
 * bundle declares (cordis.patch.yml). It contributes the mode persona
 * (shadowing the global deployment persona for its preset's sessions), the
 * per-session character context, and the model-facing tools. The file/web
 * tool grants are enforced from the host plane (src/tool-grants.ts).
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { AssembleContext } from '@deepseek-ai/dsh-system-prompt'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-tools'
import {
  applyMacros,
  cardPostHistoryContext,
  characterSection,
  groupCharacterSection,
  choiceModeSection,
  escapeBraces,
  forgeBoundCardSection,
  forgePersona,
  loreContext,
  nsfwEnhanceSection,
  roleplayStandingRules,
  selectLore,
  unboundHint,
} from './prompts.ts'
import { PERSONA_SECTION_NAME, personaSectionOrder } from './dsh-compat.ts'
import { resolveUploadedImagePng } from './uploads.ts'
import type {} from './service.ts'
import type { RoleplaySettings } from './settings.ts'
import type { CharacterCard, SessionBinding } from './cards/types.ts'

export const name = 'roleplay-agent'
export const inject = ['roleplay', 'systemPrompt', 'tools']

export interface Config {
  mode: 'roleplay' | 'forge'
}

export const Config: z<Config> = z.object({
  mode: z.union(['roleplay', 'forge']).default('roleplay'),
})

/**
 * JSON as a `{ type: 'json' }` tool output accepts it. Declared here rather
 * than imported: the harness moved this type between packages (dsh-tools →
 * dsh-util-values), and a type-only need is not worth that version coupling.
 */
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

/**
 * Producer-owned message source for the messages this plugin injects. dsh 0.2
 * retired the generic `{ kind: 'plugin', plugin }` wrapper (session format v4
 * refuses it) and lifts old records to `plugin:<name>`; using the same kind
 * keeps new and migrated messages alike.
 */
const ROLEPLAY_SOURCE = 'plugin:silly-sta'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'plugin:silly-sta': { kind: 'plugin:silly-sta' }
  }
}

function htmlToText(html: string): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .trim()
}

function recentMessagesList(agent: Agent | undefined, maxCount = 30): string[] {
  if (!agent) return []
  try {
    const texts: string[] = []
    for (const message of agent.session.deriveMessages().slice(-maxCount)) {
      const content = (message as { content?: unknown }).content
      if (typeof content === 'string') {
        const t = content.trim()
        if (t) texts.push(t)
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block && typeof block === 'object' && (block as { type?: string }).type === 'text') {
            const t = String((block as { text?: unknown }).text ?? '').trim()
            if (t) texts.push(t)
          }
        }
      }
    }
    return texts
  } catch {
    return []
  }
}

/** Concatenated text of the last few derived messages, for lore keyword scans. */
function recentText(agent: Agent | undefined, count = 6): string {
  return recentMessagesList(agent, count).join('\n')
}

function agentOf(context: AssembleContext): Agent | undefined {
  return (context as AssembleContext & { agent?: Agent }).agent
}

function wsOf(binding?: { workspacePath?: string | null | undefined }): string | undefined {
  return binding?.workspacePath ?? undefined
}

/**
 * This session's event log.
 *
 * dsh 0.1.2 removed the `events` getter in favour of `snapshotEvents()` (a
 * cached immutable range read over the same append-only log), so the plugin
 * asks for whichever accessor the running harness has.
 */
function sessionEvents(session: Agent['session']): readonly SessionEvent[] {
  const log = session as unknown as {
    snapshotEvents?: () => readonly SessionEvent[]
    events?: readonly SessionEvent[]
  }
  if (typeof log.snapshotEvents === 'function') return log.snapshotEvents()
  return log.events ?? []
}

/** Whether the turn already offered its options through the native question tool. */
function calledAskUserQuestion(agent: Agent, turn: number): boolean {
  const events = sessionEvents(agent.session)
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]
    if (!event) continue
    if (event.type === 'turn/start' && event.data.turn === turn) return false
    if (event.type === 'tool/call' && event.data.turn === turn && event.data.name === 'ask_user_question') return true
  }
  return false
}

function resolveUserIdentity(
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

export function apply(ctx: Context, config: Config): void {
  const service = () => ctx.roleplay

  if (config.mode === 'forge') {
    ctx.systemPrompt.variable('user_macro', () => '{{user}}')
    ctx.systemPrompt.variable('char_macro', () => '{{char}}')
    ctx.systemPrompt.section({
      name: PERSONA_SECTION_NAME,
      order: personaSectionOrder(ctx),
      text: () => [forgePersona(), nsfwEnhanceSection()].join('\n\n'),
    })
    ctx.systemPrompt.section({
      name: 'roleplay:forge-card',
      order: 10,
      text: (context) => {
        const svc = service()
        const agent = agentOf(context)
        const binding = agent ? svc.getBinding(String(agent.id)) : undefined
        const card = binding?.characterId ? svc.getCard(binding.characterId, wsOf(binding)) : undefined
        if (!card) return ''
        return escapeBraces(forgeBoundCardSection(card))
      },
    })
    registerForgeTools(ctx)
    return
  }

  // ── role-play mode ──
  ctx.systemPrompt.section({
    name: PERSONA_SECTION_NAME,
    order: personaSectionOrder(ctx),
    text: (context) => {
      const svc = service()
      const settings = svc.settings.get()
      const agent = agentOf(context)
      const binding = agent ? svc.getBinding(String(agent.id)) : undefined
      const isGroup = (binding?.groupCardIds?.length ?? 0) >= 2
      const cards = binding ? svc.resolveGroupCards(binding, wsOf(binding)) : []
      const activeCard = binding?.activeSpeakerId
        ? (cards.find(c => c.id === binding.activeSpeakerId) ?? cards[0])
        : cards[0]
      const identity = resolveUserIdentity(settings, binding, activeCard)
      const parts = [roleplayStandingRules(identity.userName)]

      const recentMsgs = recentMessagesList(agent, 30)
      const seed = String(agent?.session?.deriveMessages?.().length ?? 0)

      if (isGroup && cards.length >= 2) {
        const allLore = svc.resolveGroupAllLore(cards, wsOf(binding))
        parts.push(groupCharacterSection(
          cards,
          binding?.activeSpeakerId,
          identity.userName,
          identity.userPersona,
          recentMsgs,
          binding?.customOpening,
          allLore,
          seed,
        ))
      } else if (cards.length > 0) {
        const card = cards[0]!
        const allLore = svc.resolveCardAllLore(card, wsOf(binding))
        parts.push(characterSection(card, identity.userName, identity.userPersona, recentMsgs, binding?.greetingIndex, allLore, seed))
      } else {
        parts.push(unboundHint())
      }
      return escapeBraces(parts.join('\n\n'))
    },
  })
  // ── dynamic runtime contexts ──
  // These render as a user-role snapshot AFTER the retained history — the
  // near-the-latest-message injection point the interchange format's
  // positions (at_depth / user_top / assistant_top) and the per-turn
  // illustration reminder call for. A section would sit at the top of the
  // system prompt instead; adherence for per-turn direction is much better
  // close to the user's input.
  const loreOf = (context: AssembleContext) => {
    const svc = service()
    const agent = agentOf(context)
    const binding = agent ? svc.getBinding(String(agent.id)) : undefined
    if (!binding) return undefined
    const isGroup = (binding.groupCardIds?.length ?? 0) >= 2
    const cards = svc.resolveGroupCards(binding, wsOf(binding))
    if (cards.length === 0) return undefined
    const activeCard = binding.activeSpeakerId
      ? (cards.find(c => c.id === binding.activeSpeakerId) ?? cards[0]!)
      : cards[0]!
    const identity = resolveUserIdentity(svc.settings.get(), binding, activeCard)
    const seed = String(agent?.session?.deriveMessages?.().length ?? 0)
    const recentMsgs = recentMessagesList(agent, 30)
    const allLore = isGroup ? svc.resolveGroupAllLore(cards, wsOf(binding)) : svc.resolveCardAllLore(activeCard, wsOf(binding))
    return { card: activeCard, groups: selectLore(allLore, recentMsgs, seed), userName: identity.userName }
  }
  ctx.systemPrompt.context({
    name: 'roleplay:lore-depth',
    order: 100,
    text: (context) => {
      const lore = loreOf(context)
      return lore ? loreContext(lore.groups.depth, lore.card.name, lore.userName) : ''
    },
  })
  ctx.systemPrompt.context({
    name: 'roleplay:lore-user-top',
    order: 200,
    text: (context) => {
      const lore = loreOf(context)
      return lore ? loreContext(lore.groups.userTop, lore.card.name, lore.userName, '[补充设定]') : ''
    },
  })
  ctx.systemPrompt.context({
    name: 'roleplay:choice',
    order: 240,
    text: (context) => {
      const svc = service()
      const settings = svc.settings.get()
      const agent = agentOf(context)
      const binding = agent ? svc.getBinding(String(agent.id)) : undefined
      const choice = binding?.choiceMode ?? settings.choiceMode
      if (!choice) return ''
      return choiceModeSection(settings.choiceCount)
    },
  })
  ctx.systemPrompt.context({
    name: 'roleplay:lore-assistant-top',
    order: 300,
    text: (context) => {
      const lore = loreOf(context)
      return lore ? loreContext(lore.groups.assistantTop, lore.card.name, lore.userName, '[对下一条回复的指示]') : ''
    },
  })
  ctx.systemPrompt.context({
    name: 'roleplay:story-memory',
    order: 305,
    text: (context) => {
      const svc = service()
      const agent = agentOf(context)
      const binding = agent ? svc.getBinding(String(agent.id)) : undefined
      const memory = binding?.storyMemory?.trim()
      if (!memory) return ''
      const card = binding?.characterId ? svc.getCard(binding.characterId, wsOf(binding)) : undefined
      const identity = resolveUserIdentity(svc.settings.get(), binding, card)
      return `[剧情核心备忘录]\n以下是此前剧情确立的核心事实、重大承诺与关键现状，必须严格遵守，保持情节前后连贯：\n${applyMacros(memory, card?.name ?? '', identity.userName)}`
    },
  })
  ctx.systemPrompt.context({
    name: 'roleplay:author-note',
    order: 310,
    text: (context) => {
      const svc = service()
      const agent = agentOf(context)
      const binding = agent ? svc.getBinding(String(agent.id)) : undefined
      const note = binding?.authorNote?.trim()
      if (!note) return ''
      return `[常驻场景指示与剧情备忘]\n${note}`
    },
  })
  // Last of the contexts: the interchange format puts the card's
  // post-history instructions after everything else the model reads.
  ctx.systemPrompt.context({
    name: 'roleplay:card-post-history',
    order: 320,
    text: (context) => {
      const svc = service()
      const agent = agentOf(context)
      const binding = agent ? svc.getBinding(String(agent.id)) : undefined
      if (!binding) return ''
      const cards = svc.resolveGroupCards(binding, wsOf(binding))
      const activeCard = binding.activeSpeakerId
        ? (cards.find(c => c.id === binding.activeSpeakerId) ?? cards[0])
        : cards[0]
      if (!activeCard) return ''
      const identity = resolveUserIdentity(svc.settings.get(), binding, activeCard)
      return cardPostHistoryContext(activeCard, identity.userName)
    },
  })

  // One-shot stage direction: staged from the dock, appended to the NEXT
  // user message exactly as the interchange convention writes it
  // (`\n\n[系统指令: …]` on the message itself), then cleared — the durable
  // log carries the direction with the message it steered.
  // Also handles group chat speaker targeting (`【对XXX说】`) and round-robin alternation.
  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (decision.kind !== 'enter') return decision
    const svc = service()
    const sessionId = String(payload.agent.id)
    const binding = svc.getBinding(sessionId)

    let index = -1
    for (let i = decision.messages.length - 1; i >= 0; i--) {
      const msg = decision.messages[i]
      const source = msg?.source as { kind?: string } | undefined
      if (source?.kind === 'user' || (msg as any)?.role === 'user') { index = i; break }
    }
    if (index < 0) return decision

    const original = decision.messages[index]!
    let userText = ''
    for (const block of original.content) {
      if (block && typeof block === 'object' && (block as any).type === 'text') {
        userText += (block as any).text ?? ''
      }
    }

    // ── Group Chat: Speaker rotation & targeting ──
    if (binding && binding.groupCardIds && binding.groupCardIds.length >= 2) {
      const match = userText.match(/【对\s*([^】]+?)\s*(?:说|讲|问)?】/)
      if (match) {
        const targetName = match[1]!.trim().toLowerCase()
        const cards = svc.resolveGroupCards(binding, wsOf(binding))
        const found = cards.find(c => c.name.toLowerCase() === targetName || c.name.toLowerCase().includes(targetName) || targetName.includes(c.name.toLowerCase()))
        if (found && found.id !== binding.activeSpeakerId) {
          try {
            await svc.updateBinding(sessionId, { activeSpeakerId: found.id })
          } catch {}
        }
      } else if (binding.speakerMode === 'round_robin') {
        const ids = binding.groupCardIds
        const currentIdx = ids.indexOf(binding.activeSpeakerId ?? '')
        const nextId = ids[(currentIdx + 1) % ids.length]
        if (nextId && nextId !== binding.activeSpeakerId) {
          try {
            await svc.updateBinding(sessionId, { activeSpeakerId: nextId })
          } catch {}
        }
      }
    }

    let messages = [...decision.messages]
    let modified = false

    // ── Swipe active variant context synchronization ──
    if (binding?.swipes && Object.keys(binding.swipes).length > 0) {
      let turnCounter = 0
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i]
        const source = msg?.source as { kind?: string } | undefined
        const role = (msg as any)?.role ?? (source?.kind === 'user' ? 'user' : source?.kind === 'assistant' ? 'assistant' : undefined)
        if (role === 'user') {
          turnCounter++
        } else if (role === 'assistant') {
          const turnSwipe = binding.swipes[String(turnCounter)]
          if (turnSwipe && turnSwipe.variants && turnSwipe.variants.length > 0) {
            const activeVariant = turnSwipe.variants[turnSwipe.index] ?? turnSwipe.variants[0]
            if (activeVariant) {
              const cleanText = htmlToText(activeVariant)
              if (cleanText && msg) {
                (messages as any[])[i] = {
                  ...msg,
                  content: [{ type: 'text', text: cleanText }],
                }
                modified = true
              }
            }
          }
        }
      }
    }

    // ── One-shot Stage Direction ──
    const instruction = binding?.pendingInstruction?.trim()
    if (instruction) {
      const targetMsg = messages[index]!
      const content = [...targetMsg.content]
      const last = content[content.length - 1]
      const suffix = `\n\n[系统指令: ${instruction}]`
      if (last && (last as { type?: string }).type === 'text') {
        content[content.length - 1] = { ...(last as object), text: `${(last as { text?: string }).text ?? ''}${suffix}` } as typeof last
      } else {
        content.push({ type: 'text', text: suffix.trimStart() } as (typeof content)[number])
      }
      messages[index] = { ...targetMsg, content } as typeof targetMsg
      try {
        await svc.updateBinding(sessionId, { pendingInstruction: null })
      } catch {}
      return { kind: 'enter' as const, messages }
    }

    if (modified) {
      return { kind: 'enter' as const, messages }
    }

    return decision
  })

  // Choice-mode enforcement: with the toggle on, a turn that is about to stop
  // without having called ask_user_question is steered ONCE to produce the
  // options — the setting is a guarantee, not a suggestion the model may
  // forget. The steering runs one more step inside the same turn.
  //
  // The whole body is guarded: this hook runs INSIDE the turn, so anything it
  // throws fails the turn itself. A missing safety net is what turned the
  // removal of `session.events` in dsh 0.1.2 into "本轮运行失败 Cannot read
  // properties of undefined (reading 'length')" on every choice-mode reply.
  // Losing the steer degrades the guarantee to a prompt-level request; losing
  // the turn loses the user's reply.
  const steeredTurn = new Map<string, number>()
  ctx.on('agent/turn-stopping', ({ agent, turn }) => {
    try {
      const svc = service()
      const binding = svc.getBinding(String(agent.id))
      if (!(binding?.choiceMode ?? svc.settings.get().choiceMode)) return
      const key = String(agent.id)
      if (steeredTurn.get(key) === turn) return
      if (calledAskUserQuestion(agent, turn)) return
      steeredTurn.set(key, turn)
      agent.steer(createUserMessage({
        content: [{
          type: 'text',
          text: '[系统指令: 本轮还没有给出行动选项。现在立即调用 ask_user_question 工具，给出本轮的下一步行动选项；不要重复或续写正文。]',
        }],
        source: { kind: ROLEPLAY_SOURCE },
      }))
    } catch (error) {
      ctx.logger.warn('choice-mode steering skipped: %s', error)
    }
  })
}

function registerForgeTools(ctx: Context): void {
  const positions = ['system_top', 'before_char', 'after_char', 'user_top', 'assistant_top', 'at_depth'] as const

  ctx.tools.register(defineTool({
    name: 'save_character_card',
    description:
      '创建或更新一张角色卡。传 card_id 表示更新已有卡片（未传的字段保持原值）；不传则新建。文本字段中指代用户写 {{user}}，指代角色写 {{char}}。',
    parameters: {
      card_id: { type: 'string', description: 'Existing card id when updating' },
      name: { type: 'string', description: 'Character display name (required when creating)' },
      description: { type: 'string', description: 'Short reader-facing intro (~100 chars)' },
      personality: { type: 'string', description: 'Full persona definition' },
      scenario: { type: 'string', description: 'Opening scene / situation' },
      first_message: { type: 'string', description: 'Opening message (600-1000 chars)' },
      alternate_greetings: {
        type: 'array',
        items: { type: 'string' },
        description: '备选开场白列表（Alternate Greetings）。当角色卡拥有多个不同开场白时提供。',
      },
      system_prompt: {
        type: 'string',
        description: '角色卡自带的系统提示词（System Prompt）。',
      },
      post_history_instructions: {
        type: 'string',
        description: '上下文历史末尾注入的专属指令（Post-History Instructions）。',
      },
      example_dialogs: { type: 'string', description: 'Optional example dialogue' },
      creator_notes: { type: 'string', description: 'Hashtag-style notes, e.g. "#奇幻 #校园"' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Topic tags' },
      avatar_image_id: { type: 'string', description: 'Image id from a previous generate_image call to use as the portrait' },
      avatar_upload_index: { type: 'number', description: '使用用户在本会话上传的第 N 张图片作为头像：按上传顺序 1 为第一张，-1 为最新一张；仅支持 PNG/JPEG。用户上传了图片并要求用作头像时用这个，与 avatar_image_id 二选一（同时给出时以本参数为准）' },
      regex_scripts: {
        type: 'array',
        description: 'Display-coloring regex rules applied to the character\'s replies',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', required: true, description: 'Short rule label' },
            find: { type: 'string', required: true, description: 'JS regex pattern; may use ONE capture group for the colored part' },
            replace: { type: 'string', required: true, description: 'Color carrier, e.g. <span style="color:#e5779a">$1</span> — only the color is applied' },
          },
        },
      },
      book: {
        type: 'array',
        description: 'Lorebook entries',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string', required: true },
            content: { type: 'string', required: true },
            keys: { type: 'array', items: { type: 'string' }, description: 'Trigger keywords; omit for constant entries' },
            constant: { type: 'boolean', description: 'Always inject, regardless of keywords' },
            position: { type: 'string', enum: [...positions], description: 'Injection position (default after_char)' },
            order: { type: 'number', description: 'Sort order within one position' },
          },
        },
      },
      user_persona: {
        type: 'object',
        description: '可选：为该剧本专属设定的玩家身份。若剧本对玩家有特定人设或玩家指定了身份，可提供此项自动创建并绑定到该卡。',
        additionalProperties: false,
        properties: {
          name: { type: 'string', required: true, description: '玩家角色名（如“勇者”、“指挥官”、“师尊”）' },
          persona: { type: 'string', description: '玩家背景人设描述' },
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          card_id: { type: 'string', required: true },
          name: { type: 'string', required: true },
          bound_user_persona: { type: 'string' },
          avatar_url: { type: 'string' },
          previous_avatar_image_id: { type: 'string' },
          // Where the card landed, for the client's card view: the store
          // lookup needs the workspace context (not part of the text the
          // model reads).
          workspace_path: { type: 'string' },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `角色卡「${value.name}」已保存（id: ${value.card_id}）。`
          + (value.bound_user_persona ? `已自动创建并绑定配套玩家身份「${value.bound_user_persona}」。` : '')
          + (value.previous_avatar_image_id
            ? `原头像已自动备份（image_id: ${value.previous_avatar_image_id}）；用户想换回原头像时，把它作为 avatar_image_id 再保存一次即可。`
            : '')
          + '用户可在「设置 → 角色扮演」中导出 PNG/JSON，或新建「角色扮演」会话使用它。',
      }],
      presentationMeta: (_args, value) => ({ ...value }),
    },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const svc = ctx.roleplay
      const agentId = exec.agent ? String(exec.agent.id) : undefined
      const wsPath = wsOf(agentId ? svc.getBinding(agentId) : undefined)
      const existing = args.card_id ? svc.getCard(args.card_id, wsPath) : undefined
      if (args.card_id && !existing) throw new Error(`卡片 ${args.card_id} 不存在`)
      const nextName = args.name ?? existing?.name
      if (!nextName) throw new Error('新建卡片必须提供 name')
      let boundPersonaId: string | undefined
      let boundPersonaName: string | undefined
      if (args.user_persona && args.user_persona.name?.trim()) {
        const currentPersonas = [...(svc.settings.get().userPersonas ?? [])]
        const pName = args.user_persona.name.trim()
        const pDesc = (args.user_persona.persona ?? '').trim()
        const found = currentPersonas.find(p => p.name === pName && p.persona === pDesc)
        if (found) {
          boundPersonaId = found.id
          boundPersonaName = found.name
        } else {
          const newId = crypto.randomUUID()
          currentPersonas.push({ id: newId, name: pName, persona: pDesc })
          await svc.settings.update({ userPersonas: currentPersonas })
          boundPersonaId = newId
          boundPersonaName = pName
        }
      }
      const regexScripts = args.regex_scripts?.map(script => ({
        name: script.name,
        find: script.find,
        replace: script.replace,
        flags: 'g',
        enabled: true,
        markdownOnly: true,
        promptOnly: false,
        placement: [2],
      }))
      const book = args.book?.map((entry, index) => ({
        id: `lore-${index}`,
        title: entry.title,
        content: entry.content,
        keys: entry.keys ?? [],
        constant: entry.constant ?? (entry.keys === undefined || entry.keys.length === 0),
        position: (positions as readonly string[]).includes(entry.position ?? '') ? entry.position : 'after_char',
        order: entry.order ?? 100,
      }))
      let card = await svc.saveCard({
        ...existing,
        ...(args.card_id ? { id: args.card_id } : {}),
        name: nextName,
        ...(args.description !== undefined ? { description: args.description } : {}),
        ...(args.personality !== undefined ? { personality: args.personality } : {}),
        ...(args.scenario !== undefined ? { scenario: args.scenario } : {}),
        ...(args.first_message !== undefined ? { firstMessage: args.first_message } : {}),
        ...(args.alternate_greetings !== undefined ? { alternateGreetings: args.alternate_greetings } : {}),
        ...(args.system_prompt !== undefined ? { systemPrompt: args.system_prompt } : {}),
        ...(args.post_history_instructions !== undefined ? { postHistoryInstructions: args.post_history_instructions } : {}),
        ...(args.example_dialogs !== undefined ? { exampleDialogs: args.example_dialogs } : {}),
        ...(args.creator_notes !== undefined ? { creatorNotes: args.creator_notes } : {}),
        ...(args.tags !== undefined ? { tags: args.tags } : {}),
        ...(regexScripts !== undefined ? { regexScripts } : {}),
        ...(book !== undefined ? { book } : {}),
        ...(boundPersonaId ? { userPersonaId: boundPersonaId } : {}),
      }, { store: svc.settings.get().cardStore, wsPath })
      let previousAvatarImageId: string | undefined
      if (args.avatar_upload_index !== undefined || args.avatar_image_id) {
        previousAvatarImageId = await svc.archiveCurrentAvatar(card.id, wsPath)
      }
      if (args.avatar_upload_index !== undefined) {
        const png = await resolveUploadedImagePng(ctx, exec.agent, args.avatar_upload_index)
        card = await svc.setAvatar(card.id, png, wsPath)
      } else if (args.avatar_image_id) {
        card = await svc.setAvatarFromImage(card.id, args.avatar_image_id, wsPath)
      }
      const scope = svc.cardScope(card.id, wsPath)
      const avatarUrl = svc.avatarUrl(card, scope, wsPath)
      return {
        card_id: card.id,
        name: card.name,
        ...(boundPersonaName ? { bound_user_persona: boundPersonaName } : {}),
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        ...(previousAvatarImageId ? { previous_avatar_image_id: previousAvatarImageId } : {}),
        ...(scope === 'workspace' && wsPath ? { workspace_path: wsPath } : {}),
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'list_character_cards',
    description: '列出本地保存的全部角色卡。',
    parameters: {},
    output: {
      schema: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', required: true },
            name: { type: 'string', required: true },
            tags: { type: 'array', items: { type: 'string' }, required: true },
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.length === 0 ? '本地还没有角色卡。' : value.map(card => `- ${card.name} (${card.id})`).join('\n'),
      }],
    },
    async execute(_args, exec) {
      const agentId = exec.agent ? String(exec.agent.id) : undefined
      const wsPath = wsOf(agentId ? ctx.roleplay.getBinding(agentId) : undefined)
      return ctx.roleplay.listCards(wsPath).map(card => ({ id: card.id, name: card.name, tags: card.tags }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'get_character_card',
    description: '读取一张角色卡的完整内容。',
    parameters: {
      card_id: { type: 'string', required: true },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const agentId = exec.agent ? String(exec.agent.id) : undefined
      const wsPath = wsOf(agentId ? ctx.roleplay.getBinding(agentId) : undefined)
      const card = ctx.roleplay.getCard(args.card_id, wsPath)
      if (!card) throw new Error(`卡片 ${args.card_id} 不存在`)
      return card as unknown as JsonValue
    },
  }))
}

// applyMacros is re-exported for tests of the prompt pipeline.
export { applyMacros }
