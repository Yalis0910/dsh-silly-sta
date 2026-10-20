import assert from 'node:assert/strict'

const BASE = 'http://127.0.0.1:3080/x-roleplay'

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  return { status: res.status, ok: res.ok, data }
}

async function runAudit() {
  console.log('--- Phase 1: Settings & Cards Audit ---')
  const settingsRes = await request('/settings')
  assert.equal(settingsRes.status, 200, 'Settings should return 200')
  assert.ok(settingsRes.data.value, 'Settings value should be present')
  console.log('✓ Settings GET ok')

  // Create a character card
  const testCardId = `audit-card-${Date.now()}`
  const createCardRes = await request('/cards', {
    method: 'POST',
    body: JSON.stringify({
      id: testCardId,
      name: '审计测试角色A',
      description: '用于全量审计的测试角色A描述',
      personality: '性格活泼、认真负责',
      firstMessage: '你好！我是审计测试角色A，欢迎来到酒馆！',
      alternateGreetings: ['备选开场白1：今天天气真好！', '备选开场白2：准备好冒险了吗？'],
      systemPrompt: '始终称呼用户为伙伴。',
      userPersonaId: null,
      book: [
        {
          id: 'lore-1',
          title: '世界观：星界灯塔',
          content: '星界灯塔是连接虚空与现实的枢纽。',
          keys: ['灯塔', '星界'],
          constant: true,
          position: 'before_char',
          enabled: true,
        },
      ],
    }),
  })
  assert.equal(createCardRes.status, 200, 'Create card should return 200')
  console.log('✓ Card creation ok')

  // Create a second character card for group test
  const testCardId2 = `audit-card-b-${Date.now()}`
  const createCardRes2 = await request('/cards', {
    method: 'POST',
    body: JSON.stringify({
      id: testCardId2,
      name: '审计测试角色B',
      description: '用于全量审计的测试角色B描述',
      personality: '性格沉稳冷酷',
      firstMessage: '我是测试角色B。有何贵干？',
      book: [],
    }),
  })
  assert.equal(createCardRes2.status, 200, 'Create card B should return 200')
  console.log('✓ Card B creation ok')

  // Verify get card
  const getCardRes = await request(`/cards/${testCardId}`)
  assert.equal(getCardRes.status, 200)
  assert.equal(getCardRes.data.card.name, '审计测试角色A')
  assert.equal(getCardRes.data.card.alternateGreetings.length, 2)
  console.log('✓ Card detail with alternateGreetings ok')

  // Test card update with null persona and avatar
  const updateCardRes = await request(`/cards/${testCardId}`, {
    method: 'PUT',
    body: JSON.stringify({
      userPersonaId: null,
      description: '更新后的描述',
    }),
  })
  assert.equal(updateCardRes.status, 200)
  console.log('✓ Card update with null userPersonaId ok')

  console.log('\n--- Phase 2: Standalone Lorebooks Audit ---')
  const testLbId = `audit-lb-${Date.now()}`
  const createLbRes = await request('/lorebooks', {
    method: 'POST',
    body: JSON.stringify({
      id: testLbId,
      name: '独立测试世界书',
      description: '测试世界书描述',
      entries: [
        {
          id: 'lb-entry-1',
          title: '古代遗迹',
          content: '隐藏在密林深处的上古遗迹，藏有失落的秘宝。',
          keys: ['遗迹', '秘宝'],
          constant: false,
          position: 'after_char',
          enabled: true,
        },
      ],
    }),
  })
  assert.equal(createLbRes.status, 200)
  console.log('✓ Lorebook creation ok')

  const getLbRes = await request(`/lorebooks/${testLbId}`)
  assert.equal(getLbRes.status, 200)
  assert.equal(getLbRes.data.book.entries.length, 1)
  console.log('✓ Lorebook detail ok')

  console.log('\n--- Phase 3: Session Binding, Group Chat & State Machine Audit ---')
  const testSessionId = `audit-session-${Date.now()}`

  // Step 1: Bind single card
  const bindSingleRes = await request(`/session/${testSessionId}`, {
    method: 'PUT',
    body: JSON.stringify({
      mode: 'roleplay',
      characterId: testCardId,
      groupCardIds: [testCardId],
      greetingIndex: 1,
    }),
  })
  assert.equal(bindSingleRes.status, 200)
  assert.equal(bindSingleRes.data.binding.characterId, testCardId)
  assert.equal(bindSingleRes.data.binding.greetingIndex, 1)
  console.log('✓ Single card binding & greetingIndex ok')

  // Step 2: Inspect single session prompt
  const inspectSingleRes = await request(`/session/${testSessionId}/inspector`)
  assert.equal(inspectSingleRes.status, 200)
  assert.equal(inspectSingleRes.data.mode, 'single')
  assert.ok(inspectSingleRes.data.totalEstimatedTokens > 0)
  assert.ok(inspectSingleRes.data.breakdown.characterTokens > 0)
  assert.ok(inspectSingleRes.data.loreEntries.length >= 1)
  console.log('✓ Prompt inspection (single mode) ok, token estimation:', inspectSingleRes.data.totalEstimatedTokens)

  // Step 3: Upgrade to group chat (add Card B)
  const bindGroupRes = await request(`/session/${testSessionId}`, {
    method: 'PUT',
    body: JSON.stringify({
      groupCardIds: [testCardId, testCardId2],
      speakerMode: 'round_robin',
      activeSpeakerId: testCardId,
    }),
  })
  assert.equal(bindGroupRes.status, 200)
  assert.equal(bindGroupRes.data.binding.groupCardIds.length, 2)
  console.log('✓ Group chat binding (2 members) ok')

  // Step 4: Inspect group session prompt
  const inspectGroupRes = await request(`/session/${testSessionId}/inspector`)
  assert.equal(inspectGroupRes.status, 200)
  assert.equal(inspectGroupRes.data.mode, 'group')
  assert.equal(inspectGroupRes.data.characters.length, 2)
  assert.equal(inspectGroupRes.data.activeSpeaker.name, '审计测试角色A')
  console.log('✓ Prompt inspection (group mode) ok, characters:', inspectGroupRes.data.characters.map(c => c.name))

  // Step 5: Test Fused Opening setting & Null clearing
  const setFusedOpeningRes = await request(`/session/${testSessionId}`, {
    method: 'PUT',
    body: JSON.stringify({
      customOpening: '【多人同场开局】角色A与角色B正在酒馆吧台边商议探索计划。',
    }),
  })
  assert.equal(setFusedOpeningRes.status, 200)
  assert.equal(setFusedOpeningRes.data.binding.customOpening, '【多人同场开局】角色A与角色B正在酒馆吧台边商议探索计划。')
  console.log('✓ Custom fused opening set ok')

  // Step 6: Test Revert Opening (customOpening: null)
  const revertOpeningRes = await request(`/session/${testSessionId}`, {
    method: 'PUT',
    body: JSON.stringify({
      customOpening: null,
    }),
  })
  assert.equal(revertOpeningRes.status, 200)
  assert.equal(revertOpeningRes.data.binding.customOpening, undefined)
  console.log('✓ Revert fused opening (customOpening: null) ok')

  // Step 7: Test Null clearing for all optional fields
  const nullClearRes = await request(`/session/${testSessionId}`, {
    method: 'PUT',
    body: JSON.stringify({
      activeSpeakerId: null,
      userPersonaId: null,
      pendingInstruction: null,
      authorNote: null,
      storyMemory: null,
      choiceMode: null,
    }),
  })
  assert.equal(nullClearRes.status, 200)
  assert.equal(nullClearRes.data.binding.activeSpeakerId, undefined)
  assert.equal(nullClearRes.data.binding.userPersonaId, undefined)
  assert.equal(nullClearRes.data.binding.authorNote, undefined)
  assert.equal(nullClearRes.data.binding.storyMemory, undefined)
  assert.equal(nullClearRes.data.binding.choiceMode, undefined)
  console.log('✓ All nullable/optional session fields null-cleared without error ok')

  // Step 8: Exit Group Chat
  const exitGroupRes = await request(`/session/${testSessionId}`, {
    method: 'PUT',
    body: JSON.stringify({
      groupCardIds: [testCardId],
      characterId: testCardId,
      activeSpeakerId: null,
      speakerMode: 'auto',
      customOpening: null,
    }),
  })
  assert.equal(exitGroupRes.status, 200)
  assert.equal(exitGroupRes.data.binding.groupCardIds.length, 1)
  console.log('✓ Exit group chat & restore single member ok')

  // Step 9: Verify Session GET payload
  const sessionGetRes = await request(`/session/${testSessionId}`)
  assert.equal(sessionGetRes.status, 200)
  assert.equal(sessionGetRes.data.binding.characterId, testCardId)
  assert.ok(sessionGetRes.data.card)
  assert.equal(sessionGetRes.data.card.name, '审计测试角色A')
  console.log('✓ Session GET payload & card detail ok')

  console.log('\n--- Phase 4: Cleanup Audit Resources ---')
  await request(`/cards/${testCardId}`, { method: 'DELETE' })
  await request(`/cards/${testCardId2}`, { method: 'DELETE' })
  await request(`/lorebooks/${testLbId}`, { method: 'DELETE' })
  console.log('✓ Cleaned up test cards & lorebooks')

  console.log('\n=============================================')
  console.log('🎉 ALL AUDIT PHASES PASSED WITH 100% SUCCESS!')
  console.log('=============================================')
}

runAudit().catch(err => {
  console.error('Audit failed:', err)
  process.exit(1)
})
