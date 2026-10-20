/**
 * The plugin's own browser-facing HTTP surface under `/x-roleplay`. The
 * plugin's client half talks to this rather than the harness settings RPC:
 * that one redacts the API keys the settings page edits, and this surface
 * also carries cards, images and bindings. Loopback-only, mirroring the
 * posture of the built-in `/api` bridge.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { RoleplayService } from './service.ts'

function isLoopback(req: IncomingMessage): boolean {
  const address = req.socket.remoteAddress ?? ''
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage, limit = 32 * 1024 * 1024): Promise<Buffer> {
  const parts: Buffer[] = []
  let total = 0
  for await (const part of req) {
    const chunk = part as Buffer
    total += chunk.length
    if (total > limit) throw new Error('request body too large')
    parts.push(chunk)
  }
  return Buffer.concat(parts)
}

export function registerRoutes(ctx: Context, service: RoleplayService): void {
  ctx.webServer.register({
    kind: 'prefix',
    path: '/x-roleplay',
    handler: async (req, res) => {
      if (!isLoopback(req)) {
        sendJson(res, 403, { error: 'loopback only' })
        return
      }
      try {
        await route(req, res, service)
      } catch (error) {
        sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })
}

async function route(req: IncomingMessage, res: ServerResponse, service: RoleplayService): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname.replace(/^\/x-roleplay/, '') || '/'
  const method = req.method ?? 'GET'
  /** Current workspace path, sent by the client on store-aware routes. */
  const ws = url.searchParams.get('ws')?.trim() || undefined

  // ── settings ──
  if (path === '/settings' && method === 'GET') {
    sendJson(res, 200, { value: service.settings.get() })
    return
  }
  if (path === '/settings' && method === 'PUT') {
    const patch = JSON.parse((await readBody(req)).toString('utf8')) as object
    sendJson(res, 200, { value: await service.settings.update(patch) })
    return
  }

  // ── cards ──
  if (path === '/cards' && method === 'GET') {
    sendJson(res, 200, {
      cards: service.listCards(ws).map(card => ({
        id: card.id,
        name: card.name,
        description: card.description,
        creatorNotes: card.creatorNotes,
        tags: card.tags,
        favorite: card.favorite,
        updatedAt: card.updatedAt,
        avatarUrl: service.avatarUrl(card, card.scope, ws) ?? null,
        bookEntries: card.book.length,
        userPersonaId: card.userPersonaId,
        lorebookIds: card.lorebookIds ?? [],
        scope: card.scope,
      })),
    })
    return
  }
  if (path === '/cards' && method === 'POST') {
    const card = await service.saveCard(
      JSON.parse((await readBody(req)).toString('utf8')),
      { store: service.settings.get().cardStore, wsPath: ws },
    )
    sendJson(res, 200, { card })
    return
  }
  if (path === '/cards/import' && method === 'POST') {
    const card = await service.importCard(await readBody(req), ws)
    const scope = service.cardScope(card.id, ws) ?? 'global'
    sendJson(res, 200, { card, avatarUrl: service.avatarUrl(card, scope, ws) ?? null, scope })
    return
  }

  const cardMatch = path.match(/^\/cards\/([A-Za-z0-9-]+)(\/.*)?$/)
  if (cardMatch) {
    const id = cardMatch[1]!
    const rest = cardMatch[2] ?? ''
    const scopeOf = () => service.cardScope(id, ws) ?? 'global'
    if (rest === '' && method === 'GET') {
      const card = service.getCard(id, ws)
      if (!card) return sendJson(res, 404, { error: 'card not found' })
      sendJson(res, 200, { card, avatarUrl: service.avatarUrl(card, scopeOf(), ws) ?? null, scope: scopeOf() })
      return
    }
    if (rest === '' && method === 'PUT') {
      const body = JSON.parse((await readBody(req)).toString('utf8')) as object
      const card = await service.saveCard({ ...service.getCard(id, ws), ...body, id }, { wsPath: ws })
      sendJson(res, 200, { card })
      return
    }
    if (rest === '/clone' && method === 'POST') {
      const { card, scope } = await service.cloneCard(id, ws)
      sendJson(res, 200, { card, avatarUrl: service.avatarUrl(card, scope, ws) ?? null, scope })
      return
    }
    if (rest === '' && method === 'DELETE') {
      sendJson(res, 200, { deleted: await service.deleteCard(id, ws) })
      return
    }
    if (rest === '/move' && method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString('utf8')) as { to?: string }
      if (body.to !== 'global' && body.to !== 'workspace') return sendJson(res, 400, { error: 'to must be global|workspace' })
      const card = await service.moveCard(id, body.to, ws)
      sendJson(res, 200, { card, scope: card.scope })
      return
    }
    if (rest === '/export.json' && method === 'GET') {
      const card = service.getCard(id, ws)
      if (!card) return sendJson(res, 404, { error: 'card not found' })
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(card.name)}.json`,
      })
      res.end(service.exportCardJson(id, ws))
      return
    }
    if (rest === '/export.png' && method === 'GET') {
      const card = service.getCard(id, ws)
      if (!card) return sendJson(res, 404, { error: 'card not found' })
      const png = await service.exportCardPng(id, ws)
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(card.name)}.png`,
      })
      res.end(png)
      return
    }
    if (rest === '/avatar' && method === 'PUT') {
      const card = await service.setAvatar(id, await readBody(req), ws)
      sendJson(res, 200, { card, avatarUrl: service.avatarUrl(card, scopeOf(), ws) ?? null })
      return
    }
    if (rest === '/avatar' && method === 'DELETE') {
      const card = await service.deleteAvatar(id, ws)
      sendJson(res, 200, { card, avatarUrl: null })
      return
    }
  }

  // ── lorebooks ──
  if (path === '/lorebooks' && method === 'GET') {
    sendJson(res, 200, {
      lorebooks: service.listLorebooks(ws).map(book => ({
        id: book.id,
        name: book.name,
        description: book.description,
        entriesCount: book.entries.length,
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
        scope: book.scope,
      })),
    })
    return
  }
  if (path === '/lorebooks' && method === 'POST') {
    const book = await service.saveLorebook(
      JSON.parse((await readBody(req)).toString('utf8')),
      { store: service.settings.get().cardStore, wsPath: ws },
    )
    sendJson(res, 200, { book })
    return
  }
  if (path === '/lorebooks/import' && method === 'POST') {
    const book = await service.importLorebook(await readBody(req), ws)
    const scope = service.lorebookScope(book.id, ws) ?? 'global'
    sendJson(res, 200, { book, scope })
    return
  }

  const lorebookMatch = path.match(/^\/lorebooks\/([A-Za-z0-9-]+)(\/.*)?$/)
  if (lorebookMatch) {
    const id = lorebookMatch[1]!
    const rest = lorebookMatch[2] ?? ''
    const scopeOf = () => service.lorebookScope(id, ws) ?? 'global'
    if (rest === '' && method === 'GET') {
      const book = service.getLorebook(id, ws)
      if (!book) return sendJson(res, 404, { error: 'lorebook not found' })
      sendJson(res, 200, { book, scope: scopeOf() })
      return
    }
    if (rest === '' && method === 'PUT') {
      const body = JSON.parse((await readBody(req)).toString('utf8')) as object
      const book = await service.saveLorebook({ ...service.getLorebook(id, ws), ...body, id }, { wsPath: ws })
      sendJson(res, 200, { book })
      return
    }
    if (rest === '' && method === 'DELETE') {
      sendJson(res, 200, { deleted: await service.deleteLorebook(id, ws) })
      return
    }
    if (rest === '/export.json' && method === 'GET') {
      const book = service.getLorebook(id, ws)
      if (!book) return sendJson(res, 404, { error: 'lorebook not found' })
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(book.name)}.json`,
      })
      res.end(service.exportLorebookJson(id, ws))
      return
    }
  }

  // ── session bindings ──
  const sessionMatch = path.match(/^\/session(?:\/([A-Za-z0-9._-]*))?$/)
  if (sessionMatch) {
    const sessionId = (sessionMatch[1] && sessionMatch[1].trim() !== '') ? sessionMatch[1] : 'new'
    if (method === 'GET') {
      const settings = service.settings.get()
      const binding = service.getBinding(sessionId)
      const cardWs = binding?.workspacePath ?? ws
      const card = binding?.characterId ? service.getCard(binding.characterId, cardWs) : undefined
      const cardScope = binding?.characterId ? service.cardScope(binding.characterId, cardWs) : undefined
      const groupCards = binding ? service.resolveGroupCards(binding, cardWs).map(c => ({
        id: c.id,
        name: c.name,
        avatarUrl: service.avatarUrl(c, service.cardScope(c.id, cardWs), cardWs) ?? null,
        updatedAt: c.updatedAt,
      })) : []
      sendJson(res, 200, {
        binding: binding ?? null,
        card: card
          ? {
              id: card.id,
              name: card.name,
              firstMessage: card.firstMessage,
              alternateGreetings: card.alternateGreetings,
              avatarUrl: service.avatarUrl(card, cardScope, cardWs) ?? null,
              regexScripts: card.regexScripts,
              userPersonaId: card.userPersonaId,
              lorebookIds: card.lorebookIds ?? [],
              updatedAt: card.updatedAt,
            }
          : null,
        groupCards,
        choiceModeDefault: settings.choiceMode,
        userPersonas: settings.userPersonas ?? [],
        defaultUserName: settings.userName,
      })
      return
    }
    if (method === 'PUT') {
      const patch = JSON.parse((await readBody(req)).toString('utf8')) as object
      const binding = await service.updateBinding(sessionId, patch)
      sendJson(res, 200, { binding })
      return
    }
  }

  const sessionActionMatch = path.match(/^\/session\/([A-Za-z0-9._-]+)\/(recap|fuse-greetings|inspector)$/)
  if (sessionActionMatch) {
    const sessionId = sessionActionMatch[1]!
    const action = sessionActionMatch[2]!
    if (action === 'recap' && method === 'POST') {
      const result = await service.generateRecap(sessionId, ws)
      sendJson(res, 200, result)
      return
    }
    if (action === 'fuse-greetings' && method === 'POST') {
      const result = await service.fuseGroupGreetings(sessionId, ws)
      sendJson(res, 200, result)
      return
    }
    if (action === 'inspector' && method === 'GET') {
      const result = await service.inspectSessionPrompt(sessionId, ws)
      sendJson(res, 200, result)
      return
    }
  }

  // ── gallery ──
  if (path === '/images' && method === 'GET') {
    sendJson(res, 200, await service.listImages(ws))
    return
  }
  if (path === '/images/state' && method === 'GET') {
    const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean)
    sendJson(res, 200, { states: service.imageStates(ids, ws) })
    return
  }
  if (path === '/images/star' && method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8')) as { id?: string; starred?: boolean }
    if (typeof body.id !== 'string') return sendJson(res, 400, { error: 'id required' })
    await service.setImageStarred(body.id, body.starred === true, ws)
    sendJson(res, 200, { ok: true })
    return
  }
  if (path === '/images/delete' && method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8')) as { ids?: string[] }
    const ids = Array.isArray(body.ids) ? body.ids.filter(id => typeof id === 'string') : []
    sendJson(res, 200, { deleted: await service.deleteImages(ids, ws) })
    return
  }
  if (path === '/images/move' && method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8')) as { ids?: string[]; to?: string }
    const ids = Array.isArray(body.ids) ? body.ids.filter(id => typeof id === 'string') : []
    if (body.to !== 'global' && body.to !== 'workspace') return sendJson(res, 400, { error: 'to must be global|workspace' })
    sendJson(res, 200, { moved: await service.moveImages(ids, body.to, ws) })
    return
  }

  // ── workspace data folder ──
  if (path === '/workspace/probe' && method === 'GET') {
    const sub = url.searchParams.get('sub')?.trim() ?? ''
    if (!ws || sub === '') return sendJson(res, 400, { error: 'ws and sub required' })
    sendJson(res, 200, { exists: await service.hasWorkspaceData(ws, sub) })
    return
  }
  if (path === '/workspace/migrate' && method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8')) as { from?: string; to?: string }
    if (!ws || typeof body.from !== 'string' || typeof body.to !== 'string') {
      return sendJson(res, 400, { error: 'ws, from and to required' })
    }
    sendJson(res, 200, await service.migrateWorkspaceFolder(ws, body.from, body.to))
    return
  }

  // ── data files ──
  // no-cache (not immutable): avatar replacement overwrites files in place
  // under the same name, so revalidation must reach the host.
  const fileMatch = path.match(/^\/files\/(avatars|images)\/([A-Za-z0-9._-]+)$/)
  if (fileMatch && method === 'GET') {
    const bytes = await service.readDataFile(fileMatch[1] as 'avatars' | 'images', fileMatch[2]!, ws)
    if (!bytes) return sendJson(res, 404, { error: 'file not found' })
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' })
    res.end(bytes)
    return
  }

  sendJson(res, 404, { error: `no route for ${method} ${path}` })
}
