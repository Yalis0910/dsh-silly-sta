/**
 * Shared macro replacement engine for character cards, system prompts,
 * greetings, and client preview rendering.
 *
 * Provides spec-compliant SillyTavern macro replacements:
 *  - Identity: {{char}}, {{user}}, {{char_name}}, {{user_name}}
 *  - Character profile: {{description}}, {{personality}}, {{char_persona}}, {{scenario}}, {{char_version}}, {{mesExamples}}
 *  - User profile: {{persona}}, {{user_persona}}
 *  - Runtime context: {{time}}, {{date}}, {{weekday}}, {{isodate}}, {{model}}
 *  - Utilities: {{random::a,b,c}}, {{original}}, {{input}}
 */

export interface MacroContext {
  charDescription?: string | undefined
  charPersonality?: string | undefined
  scenario?: string | undefined
  userPersona?: string | undefined
  charVersion?: string | undefined
  exampleDialogs?: string | undefined
  original?: string | undefined
  modelName?: string | undefined
}

/** Replace the card macros with live participant names and card attributes. */
export function applyMacros(
  text: string | null | undefined,
  charName: string,
  userName: string,
  context?: MacroContext,
): string {
  if (!text) return ''
  let result = text
    .replaceAll(/\{\{\s*char(?:_name)?\s*\}\}/gi, charName)
    .replaceAll(/\{\{\s*user(?:_name)?\s*\}\}/gi, userName)

  if (context?.charDescription !== undefined) {
    result = result
      .replaceAll(/\{\{\s*description\s*\}\}/gi, context.charDescription)
      .replaceAll(/\{\{\s*char_desc\s*\}\}/gi, context.charDescription)
  }
  if (context?.charPersonality !== undefined) {
    result = result
      .replaceAll(/\{\{\s*personality\s*\}\}/gi, context.charPersonality)
      .replaceAll(/\{\{\s*char_persona\s*\}\}/gi, context.charPersonality)
      .replaceAll(/\{\{\s*char_personality\s*\}\}/gi, context.charPersonality)
  }
  if (context?.scenario !== undefined) {
    result = result
      .replaceAll(/\{\{\s*scenario\s*\}\}/gi, context.scenario)
      .replaceAll(/\{\{\s*char_scenario\s*\}\}/gi, context.scenario)
  }
  if (context?.userPersona !== undefined) {
    result = result
      .replaceAll(/\{\{\s*persona\s*\}\}/gi, context.userPersona)
      .replaceAll(/\{\{\s*user_persona\s*\}\}/gi, context.userPersona)
  }
  if (context?.charVersion !== undefined) {
    result = result.replaceAll(/\{\{\s*char_version\s*\}\}/gi, context.charVersion)
  }
  if (context?.exampleDialogs !== undefined) {
    result = result
      .replaceAll(/\{\{\s*mes_examples\s*\}\}/gi, context.exampleDialogs)
      .replaceAll(/\{\{\s*mesExamples\s*\}\}/gi, context.exampleDialogs)
      .replaceAll(/\{\{\s*example_dialogs\s*\}\}/gi, context.exampleDialogs)
  }

  result = result
    .replaceAll(/\{\{\s*original\s*\}\}/gi, context?.original ?? '')
    .replaceAll(/\{\{\s*input\s*\}\}/gi, '')
    .replaceAll(/\{\{\s*model\s*\}\}/gi, context?.modelName ?? 'DeepSeek')

  if (/\{\{\s*(?:time|date|weekday|isodate)\s*\}\}/i.test(result)) {
    const now = new Date()
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
    const dateStr = now.toLocaleDateString('zh-CN')
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    const weekdayStr = weekdays[now.getDay()] ?? ''
    const isoDateStr = now.toISOString().split('T')[0] ?? ''

    result = result
      .replaceAll(/\{\{\s*time\s*\}\}/gi, timeStr)
      .replaceAll(/\{\{\s*date\s*\}\}/gi, dateStr)
      .replaceAll(/\{\{\s*weekday\s*\}\}/gi, weekdayStr)
      .replaceAll(/\{\{\s*isodate\s*\}\}/gi, isoDateStr)
  }

  result = result.replaceAll(/\{\{\s*random\s*::\s*([^}]+)\s*\}\}/gi, (_match, choicesStr: string) => {
    const sep = choicesStr.includes('|') ? '|' : (choicesStr.includes('，') ? '，' : ',')
    const options = choicesStr.split(sep).map(s => s.trim()).filter(Boolean)
    if (options.length === 0) return ''
    return options[Math.floor(Math.random() * options.length)] ?? options[0]!
  })

  return result
}
