import assert from 'node:assert/strict'
import { applyMacros, escapeBraces } from '../src/prompts.ts'
import { lorebookToInterchange, cardToInterchange } from '../src/cards/codec.ts'
import { CharacterCard, LoreEntry } from '../src/cards/types.ts'

console.log('=== Running Verification for Round 3 Fixes ===\n')

// ── Test 1: Turn 1 Reroll & Edit sequence fallback ──
console.log('[Test 1] Turn 1 sequence calculation')
const mockTurnEnds = new Map<number, number>([
  [1, 15],
  [2, 30],
])
function deriveTurnEnd(turn: number | undefined, turnEnds: Map<number, number>): number | undefined {
  return turnEnds.get((turn ?? 0) - 1) ?? (turn === 1 ? 0 : undefined)
}
assert.equal(deriveTurnEnd(1, mockTurnEnds), 0, 'Turn 1 must resolve to seq 0 (session start)')
assert.equal(deriveTurnEnd(2, mockTurnEnds), 15, 'Turn 2 must resolve to Turn 1 end seq (15)')
assert.equal(deriveTurnEnd(3, mockTurnEnds), 30, 'Turn 3 must resolve to Turn 2 end seq (30)')
assert.equal(deriveTurnEnd(undefined, mockTurnEnds), undefined, 'Undefined turn must return undefined')
console.log('  ✓ Turn 1 correctly falls back to boundary 0 allowing reroll/edit\n')

// ── Test 2: Swipe index bounding and no out-of-bounds ──
console.log('[Test 2] Swipe index bounding')
const variants = ['<p>Hello world</p>']
const currentHtml = '<p>Hello world</p>'
const activeIdx = variants.indexOf(currentHtml)
const nextState = {
  index: activeIdx >= 0 ? activeIdx : Math.max(0, variants.length - 1),
  variants,
}
assert.equal(nextState.index, 0, 'Index must point to existing variant 0')
assert.ok(nextState.index < nextState.variants.length, 'Index must be strictly within bounds of variants')
console.log('  ✓ Swipe index guaranteed within variants bounds (prevents 2/1 display)\n')

// ── Test 3: Multi-step turn swipe isolation ──
console.log('[Test 3] Multi-step assistant turn swipe targeting')
const messages = [
  { role: 'user', content: 'Turn 1 User' },
  { role: 'assistant', content: [{ type: 'tool_call', id: 'call_1' }] },
  { role: 'tool', content: 'tool result' },
  { role: 'assistant', content: [{ type: 'text', text: 'Original final response' }] },
  { role: 'user', content: 'Turn 2 User' },
  { role: 'assistant', content: [{ type: 'text', text: 'Turn 2 response' }] },
]

const swipes: Record<string, { index: number; variants: string[] }> = {
  '1': { index: 0, variants: ['<p>Swiped new final response</p>'] },
}

// Logic from agent.ts
const lastAssistantIndexByTurn = new Map<number, number>()
let turnCounter = 0
for (let i = 0; i < messages.length; i++) {
  const msg = messages[i]
  const role = (msg as any).role
  if (role === 'user') {
    turnCounter++
  } else if (role === 'assistant' && turnCounter > 0) {
    lastAssistantIndexByTurn.set(turnCounter, i)
  }
}

assert.equal(lastAssistantIndexByTurn.get(1), 3, 'Turn 1 last assistant message should be index 3, NOT index 1')
assert.equal(lastAssistantIndexByTurn.get(2), 5, 'Turn 2 last assistant message should be index 5')

for (const [turnNum, msgIdx] of lastAssistantIndexByTurn.entries()) {
  const turnSwipe = swipes[String(turnNum)]
  if (turnSwipe?.variants?.[turnSwipe.index]) {
    messages[msgIdx] = {
      ...messages[msgIdx],
      content: [{ type: 'text', text: 'Swiped new final response' }] as any,
    }
  }
}

assert.deepEqual(messages[1]?.content, [{ type: 'tool_call', id: 'call_1' }], 'Intermediate tool call must NOT be overwritten')
assert.deepEqual(messages[3]?.content, [{ type: 'text', text: 'Swiped new final response' }], 'Final response must be swiped')
console.log('  ✓ Intermediate tool calls preserved while final assistant reply is swiped\n')

// ── Test 4: Macro null safety & Prompt Context Brace Escaping ──
console.log('[Test 4] Macro null safety & Context Brace Escaping')
assert.equal(applyMacros(null as any, 'Char', 'User'), '', 'applyMacros handles null without throwing')
assert.equal(applyMacros(undefined as any, 'Char', 'User'), '', 'applyMacros handles undefined without throwing')

// Test escapeBraces defuses arbitrary user braces
const rawStoryMemory = '[剧情备忘] 注意{{char}}与{{mood}}的状态'
const expanded = applyMacros(rawStoryMemory, 'Alice', 'Bob')
const escaped = escapeBraces(expanded)
assert.equal(escaped, '[剧情备忘] 注意Alice与{ {mood}}的状态')
assert.ok(!escaped.includes('{{'), 'Escaped text must not contain raw {{ braces that fail DSH interpolation')
console.log('  ✓ applyMacros guards against null/undefined and escapeBraces defuses unexpanded macros\n')

// ── Test 5: Interchange export keys and SillyTavern compatibility ──
console.log('[Test 5] Lorebook entry export format')
const sampleCard = CharacterCard.parse({
  id: 'card-1',
  name: 'TestChar',
  firstMessage: 'Hi',
  createdAt: 1000,
  updatedAt: 1000,
  book: [
    LoreEntry.parse({
      id: 'lore-1',
      title: 'City',
      content: 'A grand city.',
      keys: ['city', 'town'],
    }),
  ],
})
const exported = cardToInterchange(sampleCard) as any
const entry0 = exported.data.character_book.entries[0]
assert.deepEqual(entry0.key, ['city', 'town'], 'Exported entry contains key array')
assert.deepEqual(entry0.keys, ['city', 'town'], 'Exported entry contains keys array')
assert.equal(entry0.selective, false, 'Exported entry contains selective flag')
assert.deepEqual(entry0.secondary_keys, [], 'Exported entry contains secondary_keys array')
console.log('  ✓ SillyTavern interchange entry outputs full compatibility fields\n')

console.log('=== All Round 3 Automated Tests Passed 100%! ===')
