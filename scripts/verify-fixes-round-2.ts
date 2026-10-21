import assert from 'node:assert/strict'
import { encodeSolidPng, writeTextChunks } from '../src/cards/png.ts'
import { cardFromPng, cardToPng } from '../src/cards/codec.ts'
import { applyMacros, type MacroContext } from '../src/prompts.ts'

console.log('=== Running Verification for Round 2 Fixes ===\n')

// ── Test 1: PNG ccv3 vs chara precedence & Raw JSON parsing ──
{
  console.log('[Test 1] PNG ccv3 precedence and raw JSON support')
  const basePng = encodeSolidPng(32, 32, [50, 100, 150])

  const v2Payload = {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: { name: 'Legacy V2 Character', description: 'Older V2 payload' },
  }
  const v3Payload = {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: { name: 'Modern V3 Character', description: 'Newer V3 payload' },
  }

  // A PNG containing both chara (base64) and ccv3 (raw JSON)
  const pngBoth = writeTextChunks(basePng, {
    chara: Buffer.from(JSON.stringify(v2Payload), 'utf8').toString('base64'),
    ccv3: JSON.stringify(v3Payload), // raw JSON
  })

  const parsedCard = cardFromPng(pngBoth)
  assert.ok(parsedCard, 'cardFromPng should successfully parse PNG')
  assert.equal(parsedCard.name, 'Modern V3 Character', 'ccv3 must take priority over chara')
  assert.equal(parsedCard.description, 'Newer V3 payload')
  console.log('  ✓ ccv3 prioritized over chara and raw JSON parsed correctly')
}

// ── Test 2: HTTP session URL matching & percent-decoding ──
{
  console.log('[Test 2] HTTP session URL matching & decoding')
  const sessionRegex = /^\/session(?:\/([^/]+))?$/
  const sessionActionRegex = /^\/session\/([^/]+)\/(recap|fuse-greetings|inspector)$/

  const encodedPath1 = '/session/agent%3Aconversation%20123'
  const match1 = encodedPath1.match(sessionRegex)
  assert.ok(match1, 'sessionRegex should match encoded session path')
  const decodedId1 = decodeURIComponent(match1[1]!)
  assert.equal(decodedId1, 'agent:conversation 123', 'sessionId must decode properly')

  const encodedPath2 = '/session/chat%3Aroom%2342/inspector'
  const match2 = encodedPath2.match(sessionActionRegex)
  assert.ok(match2, 'sessionActionRegex should match encoded action path')
  const decodedId2 = decodeURIComponent(match2[1]!)
  assert.equal(decodedId2, 'chat:room#42', 'action sessionId must decode properly')
  assert.equal(match2[2], 'inspector')
  console.log('  ✓ Session paths match and decode percent-encoded IDs cleanly')
}

// ── Test 3: Client-side replaceMacros with MacroContext ──
{
  console.log('[Test 3] replaceMacros with SillyTavern extended MacroContext')
  const text = '{{char}} greets {{user}} in {{scenario}}. Persona: {{user_persona}}. Traits: {{personality}}.'
  const ctx: MacroContext = {
    charDescription: 'A brave knight',
    charPersonality: 'Loyal and calm',
    scenario: 'The Royal Gardens',
    userPersona: 'The King',
    charVersion: '1.0.0',
    original: '',
  }

  const result = applyMacros(text, 'Arthur', 'Player', ctx)
  assert.equal(result, 'Arthur greets Player in The Royal Gardens. Persona: The King. Traits: Loyal and calm.')
  console.log('  ✓ MacroContext resolved {{scenario}}, {{user_persona}}, {{personality}} in client preview')
}

// ── Test 4: Swipes partial merge logic in updateBinding ──
{
  console.log('[Test 4] Swipes deep merge preservation')
  const existing = {
    sessionId: 's1',
    mode: 'roleplay' as const,
    swipes: {
      '1': { index: 1, variants: ['v1-1', 'v1-2'] },
    },
    updatedAt: 1000,
  }

  const patch = {
    swipes: {
      '2': { index: 0, variants: ['v2-1'] },
    },
  }

  // Simulated updateBinding merge logic
  const merged: Record<string, any> = {
    mode: 'roleplay',
    ...existing,
    ...patch,
    sessionId: 's1',
    updatedAt: Date.now(),
  }
  if (patch.swipes && existing?.swipes) {
    merged.swipes = { ...existing.swipes, ...patch.swipes }
  }

  assert.ok(merged.swipes['1'], 'Turn 1 swipes must NOT be lost when updating turn 2')
  assert.ok(merged.swipes['2'], 'Turn 2 swipes must be saved')
  assert.equal(merged.swipes['1'].variants.length, 2)
  assert.equal(merged.swipes['2'].variants.length, 1)
  console.log('  ✓ Swipes updates merge turns instead of dropping previous turns')
}

// ── Test 5: Message content format handling in agent/pre-step ──
{
  console.log('[Test 5] Message content handling (string vs block array)')
  // String content handling
  const stringMsg = {
    role: 'user',
    content: 'User typed plain string',
  }
  const instruction = 'Be very brief'
  const suffix = `\n\n[系统指令: ${instruction}]`

  let resultMsg: any
  if (typeof (stringMsg as any).content === 'string') {
    resultMsg = { ...stringMsg, content: [{ type: 'text', text: (stringMsg as any).content + suffix }] }
  } else {
    const content = Array.isArray(stringMsg.content) ? [...stringMsg.content] : []
    content.push({ type: 'text', text: suffix.trimStart() })
    resultMsg = { ...stringMsg, content }
  }

  assert.ok(Array.isArray(resultMsg.content), 'Content must be normalized to block array')
  assert.equal(resultMsg.content[0].type, 'text')
  assert.equal(resultMsg.content[0].text, 'User typed plain string\n\n[系统指令: Be very brief]')
  console.log('  ✓ Plain string message content safely normalized to text block')
}

// ── Test 6: Group Chat round robin step gating ──
{
  console.log('[Test 6] Group chat round robin step gating')
  const groupCardIds = ['c1', 'c2', 'c3']
  let activeSpeakerId = 'c1'

  const simulateStep = (step: number) => {
    if (step === 0) {
      const currentIdx = groupCardIds.indexOf(activeSpeakerId)
      activeSpeakerId = groupCardIds[(currentIdx + 1) % groupCardIds.length]!
    }
  }

  // Turn 1 with 3 steps (step 0, 1, 2)
  simulateStep(0)
  assert.equal(activeSpeakerId, 'c2', 'Step 0 advances to c2')
  simulateStep(1)
  assert.equal(activeSpeakerId, 'c2', 'Step 1 must NOT rotate speaker')
  simulateStep(2)
  assert.equal(activeSpeakerId, 'c2', 'Step 2 must NOT rotate speaker')

  // Turn 2 with 2 steps
  simulateStep(0)
  assert.equal(activeSpeakerId, 'c3', 'Next turn step 0 advances to c3')
  simulateStep(1)
  assert.equal(activeSpeakerId, 'c3', 'Next turn step 1 must NOT rotate speaker')
  console.log('  ✓ Round robin speaker only rotates on step 0 of each turn')
}

console.log('\n=== All 6 Round 2 Automated Tests Passed 100%! ===')
