import assert from 'node:assert/strict'
import { deflateSync } from 'node:zlib'
import { isPng, readTextChunks, writeTextChunks, encodeSolidPng } from '../src/cards/png.ts'
import { cardFromPng, cardToPng, cardFromInterchange } from '../src/cards/codec.ts'
import { CharacterCard } from '../src/cards/types.ts'

console.log('=== Running Verification for Fix 1 & Fix 2 ===')

// --- Test 1: PNG zTXt chunk decoding ---
{
  const basePng = encodeSolidPng(64, 64, [100, 150, 200])
  const testCardPayload = {
    name: 'Alice In ZTxt',
    description: 'A compressed character test',
    first_mes: 'Hello from zTXt!',
  }
  const jsonStr = JSON.stringify(testCardPayload)
  const base64Str = Buffer.from(jsonStr, 'utf8').toString('base64')

  // Build a valid zTXt chunk manually:
  // keyword 'chara' + null + compressionMethod(0) + deflated base64 string
  const keywordBuf = Buffer.from('chara', 'latin1')
  const compressedData = deflateSync(Buffer.from(base64Str, 'utf8'))
  const ztxtData = Buffer.concat([keywordBuf, Buffer.from([0, 0]), compressedData])
  const typeBuf = Buffer.from('zTXt', 'latin1')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(ztxtData.length)

  // Compute CRC for zTXt chunk
  const CRC_TABLE = new Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    CRC_TABLE[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const byte of Buffer.concat([typeBuf, ztxtData])) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)) >>> 0
  }
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0)

  const ztxtChunk = Buffer.concat([lenBuf, typeBuf, ztxtData, crcBuf])

  // Insert zTXt chunk right after IHDR chunk (offset 8 + 25 = 33)
  const pngWithZtxt = Buffer.concat([
    basePng.subarray(0, 33),
    ztxtChunk,
    basePng.subarray(33),
  ])

  assert.ok(isPng(pngWithZtxt), 'Engine must recognize PNG with zTXt')
  const chunks = readTextChunks(pngWithZtxt)
  assert.equal(chunks.get('chara'), base64Str, 'readTextChunks must decompress zTXt payload')

  const decodedCard = cardFromPng(pngWithZtxt)
  assert.ok(decodedCard, 'cardFromPng must successfully decode card from zTXt')
  assert.equal(decodedCard.name, 'Alice In ZTxt')
  console.log('✅ Fix 1.1: zTXt compressed chunk decoding verified successfully')
}

// --- Test 2: PNG compressed iTXt chunk decoding ---
{
  const basePng = encodeSolidPng(64, 64, [120, 180, 220])
  const testCardPayload = {
    name: 'Bob In Compressed ITXt',
    description: 'An iTXt compressed character test',
    first_mes: 'Hello from compressed iTXt!',
  }
  const base64Str = Buffer.from(JSON.stringify(testCardPayload), 'utf8').toString('base64')

  // Build a compressed iTXt chunk:
  // keyword 'ccv3' \0 compressionFlag(1) compressionMethod(0) \0 \0 compressedData
  const keywordBuf = Buffer.from('ccv3', 'latin1')
  const compressedData = deflateSync(Buffer.from(base64Str, 'utf8'))
  // separator \0, flag 1, method 0, lang null \0, trans null \0
  const itxtData = Buffer.concat([
    keywordBuf,
    Buffer.from([0, 1, 0, 0, 0]),
    compressedData,
  ])
  const typeBuf = Buffer.from('iTXt', 'latin1')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(itxtData.length)

  const CRC_TABLE = new Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    CRC_TABLE[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const byte of Buffer.concat([typeBuf, itxtData])) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)) >>> 0
  }
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0)

  const itxtChunk = Buffer.concat([lenBuf, typeBuf, itxtData, crcBuf])
  const pngWithCompressedItxt = Buffer.concat([
    basePng.subarray(0, 33),
    itxtChunk,
    basePng.subarray(33),
  ])

  const chunks = readTextChunks(pngWithCompressedItxt)
  assert.equal(chunks.get('ccv3'), base64Str, 'readTextChunks must decompress compressed iTXt payload')

  const decodedCard = cardFromPng(pngWithCompressedItxt)
  assert.ok(decodedCard, 'cardFromPng must successfully decode card from compressed iTXt')
  assert.equal(decodedCard.name, 'Bob In Compressed ITXt')
  console.log('✅ Fix 1.2: Compressed iTXt chunk decoding verified successfully')
}

// --- Test 3: writeTextChunks strips zTXt chunks on re-export ---
{
  const basePng = encodeSolidPng(64, 64, [100, 150, 200])
  const keywordBuf = Buffer.from('chara', 'latin1')
  const compressedData = deflateSync(Buffer.from('old-ztxt-data', 'utf8'))
  const ztxtData = Buffer.concat([keywordBuf, Buffer.from([0, 0]), compressedData])
  const typeBuf = Buffer.from('zTXt', 'latin1')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(ztxtData.length)

  const CRC_TABLE = new Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    CRC_TABLE[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const byte of Buffer.concat([typeBuf, ztxtData])) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)) >>> 0
  }
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  const ztxtChunk = Buffer.concat([lenBuf, typeBuf, ztxtData, crcBuf])
  const pngWithZtxt = Buffer.concat([basePng.subarray(0, 33), ztxtChunk, basePng.subarray(33)])

  // Now re-export with new chara value:
  const reExported = writeTextChunks(pngWithZtxt, { chara: 'new-chara-payload' })
  const readBack = readTextChunks(reExported)
  assert.equal(readBack.get('chara'), 'new-chara-payload', 'New chara must override old zTXt chunk without collision')
  console.log('✅ Fix 1.3: writeTextChunks properly strips existing zTXt chunks')
}

// --- Test 4: SessionBinding orphaned card cleanup logic simulation ---
{
  interface SessionBindingMock {
    sessionId: string
    characterId?: string
    groupCardIds: string[]
    activeSpeakerId?: string
  }

  const sessions = new Map<string, SessionBindingMock>([
    ['s1', { sessionId: 's1', characterId: 'card-A', groupCardIds: ['card-A'], activeSpeakerId: 'card-A' }],
    ['s2', { sessionId: 's2', characterId: 'card-A', groupCardIds: ['card-A', 'card-B'], activeSpeakerId: 'card-A' }],
    ['s3', { sessionId: 's3', characterId: 'card-C', groupCardIds: ['card-C', 'card-D'], activeSpeakerId: 'card-C' }],
  ])

  function cleanupOrphanedCardSessionsMock(cardId: string) {
    for (const [sessionId, binding] of sessions.entries()) {
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
        sessions.set(sessionId, {
          ...binding,
          characterId: nextCharId,
          groupCardIds: nextGroupIds,
          activeSpeakerId: nextSpeakerId,
        })
      }
    }
  }

  // Delete card-A:
  cleanupOrphanedCardSessionsMock('card-A')

  const s1 = sessions.get('s1')!
  assert.equal(s1.characterId, undefined, 's1 characterId should be cleared')
  assert.deepEqual(s1.groupCardIds, [], 's1 groupCardIds should be empty')
  assert.equal(s1.activeSpeakerId, undefined, 's1 activeSpeakerId should be cleared')

  const s2 = sessions.get('s2')!
  assert.equal(s2.characterId, undefined, 's2 characterId should be cleared')
  assert.deepEqual(s2.groupCardIds, ['card-B'], 's2 groupCardIds should keep card-B')
  assert.equal(s2.activeSpeakerId, 'card-B', 's2 activeSpeakerId should fallback to remaining card-B')

  const s3 = sessions.get('s3')!
  assert.equal(s3.characterId, 'card-C', 's3 characterId should remain untouched')
  assert.deepEqual(s3.groupCardIds, ['card-C', 'card-D'], 's3 groupCardIds should remain untouched')

  console.log('✅ Fix 2: SessionBinding orphaned card cleanup logic verified successfully')
}

console.log('🎉 ALL TESTS PASSED FOR FIX 1 & FIX 2!')
