/**
 * Role-play additions to the assistant message action strip (the native
 * `conversation.chat.assistant-actions` list slot): regenerate the reply
 * from its own user prompt. Renders nothing outside role-play sessions.
 */
import { useState, type ReactNode } from 'react'
import { IconRefreshOutlineRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { rewindAndResend } from './runtime.ts'
import { turnOf, useAgentPreset, useChatFlow, useSessionRunning, type ChatFlow, type SessionSlotProps } from './compat.ts'
import { useT } from './i18n.ts'

interface ActionProps extends SessionSlotProps {
  messageId?: string
  [extra: string]: unknown
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
  const [busy, setBusy] = useState<false | 'reply'>(false)
  const preset = useAgentPreset(props, props.sessionId)
  const flow = useChatFlow(props)
  const running = useSessionRunning(props)
  if (preset !== 'roleplay' || !flow || typeof props.messageId !== 'string') return null

  const context = deriveContext(flow, props.messageId)
  if (!context) return null
  const canRegenerate = context.prevTurnEnd !== undefined && context.userText.trim() !== '' && !running && busy === false

  return (
    <Tooltip label={canRegenerate ? t('rp.regen.reply') : t('rp.regen.unavailable')} side="bottom">
      <button
        type="button"
        className="rp-msg-action"
        disabled={!canRegenerate}
        onClick={() => {
          setBusy('reply')
          rewindAndResend(props.sessionId as string, context.prevTurnEnd as number, context.userText)
            .catch(() => setBusy(false))
        }}
      >
        {busy === 'reply' ? <span className="rp-imgspin" /> : <IconRefreshOutlineRegular size={16} />}
      </button>
    </Tooltip>
  )
}
