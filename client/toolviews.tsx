/** Keyed tool-call renderers for the plugin's model tools. */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { CardEditor } from './card-editor.tsx'
import { imageUrlWithRev, currentWorkspace, subscribeWorkspaces, workspaceOfSession } from './runtime.ts'
import { ImageLightbox } from './lightbox.tsx'
import { useT } from './i18n.ts'

interface ToolViewProps {
  /** Session-scope standard prop: the conversation this call belongs to. */
  sessionId?: string
  callId: string
  toolName: string
  /** Frozen running call or settled result node (settled forms carry `kind`). */
  block: Record<string, unknown>
}

function parseArgs(block: Record<string, unknown>): Record<string, unknown> {
  // Running calls carry `argsRaw` at the top level; settled result nodes
  // carry the call head under `call.argsRaw`.
  const settled = block as { call?: { argsRaw?: string } | null; argsRaw?: string; arguments?: string }
  const raw = settled.call?.argsRaw ?? settled.argsRaw ?? settled.arguments
  if (typeof raw !== 'string') return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function isSettled(block: Record<string, unknown>): boolean {
  return 'kind' in block
}

function metaOf(block: Record<string, unknown>): Record<string, unknown> | undefined {
  const meta = (block as { meta?: unknown }).meta
  return typeof meta === 'object' && meta !== null ? (meta as Record<string, unknown>) : undefined
}

export function GenerateImageView({ block }: ToolViewProps): ReactNode {
  const t = useT()
  const args = parseArgs(block)
  const prompt = typeof args.prompt === 'string' ? args.prompt : ''
  if (!isSettled(block)) {
    return (
      <div className="rp-toolcard rp-genimg">
        <span className="rp-toolcard-title">{t('rp.tool.genRunning')}{prompt ? `（${prompt.slice(0, 80)}）` : ''}</span>
      </div>
    )
  }
  const meta = metaOf(block)
  const images = Array.isArray(meta?.images) ? (meta.images as { id?: unknown; url?: unknown; width?: unknown; height?: unknown }[]) : []
  const isError = (block as { isError?: boolean }).isError === true
  if (isError || images.length === 0) {
    const content = (block as { content?: { type?: string; text?: string }[] }).content
    const text = Array.isArray(content) ? content.filter(part => part.type === 'text').map(part => part.text ?? '').join('') : ''
    return (
      <div className="rp-toolcard rp-genimg">
        <span className="rp-toolcard-title">{isError ? t('rp.tool.genFailed') : t('rp.tool.genDone')}</span>
        {text ? <span className="rp-note">{text}</span> : null}
      </div>
    )
  }
  return (
    <div className="rp-toolcard rp-genimg rp-genimg-images">
      <span className="rp-toolcard-title">{t('rp.tool.genTitle')} · {prompt.slice(0, 100)}</span>
      <div className="rp-imggrid">
        {images.map((image, index) =>
          typeof image.url === 'string'
            ? (
                <GeneratedImage
                  key={String(image.id ?? index)}
                  url={image.url}
                  id={typeof image.id === 'string' ? image.id : ''}
                  width={typeof image.width === 'number' ? image.width : undefined}
                  height={typeof image.height === 'number' ? image.height : undefined}
                />
              )
            : null,
        )}
      </div>
    </div>
  )
}

/** The scrollable ancestor that owns the conversation viewport. */
function nearestScroller(element: HTMLElement): HTMLElement | null {
  for (let current = element.parentElement; current; current = current.parentElement) {
    if (current.scrollHeight > current.clientHeight + 20) {
      const overflow = getComputedStyle(current).overflowY
      if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') return current
    }
  }
  return null
}

/**
 * If the user was following the conversation (near the bottom), keep them
 * pinned there after `element` changed the page height — an asynchronously
 * arriving image must not silently break the auto-scroll.
 */
function stickToBottom(element: HTMLElement): void {
  const scroller = nearestScroller(element)
  if (!scroller) return
  const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
  if (distance < 480) scroller.scrollTop = scroller.scrollHeight
}

/**
 * One stored image: rendered from the gallery or an existing generation's
 * result. A load failure flips the tile into a failed state (the file may
 * have been deleted from the gallery); a successful load sizes the box from
 * the file's natural dimensions so the thumbnail is never stretched.
 */
function GeneratedImage({ url, id, width, height }: {
  url: string
  id: string
  width?: number | undefined
  height?: number | undefined
}): ReactNode {
  const t = useT()
  const [preview, setPreview] = useState(false)
  const [failed, setFailed] = useState(false)
  // Actual file dimensions, read once the image loads.
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  // Display box under the grid's 280×340 cap: from the actual file size once
  // loaded, from the declared size before that (placeholder sizing).
  const source = natural ?? (width && height ? { width, height } : undefined)
  const scale = source ? Math.min(280 / source.width, 340 / source.height, 1) : undefined
  const box = source && scale
    ? { width: Math.round(source.width * scale), height: Math.round(source.height * scale) }
    : undefined

  // The ratio correction can change the tile height after the load event —
  // re-pin the viewport the same way a late-arriving image does.
  useEffect(() => {
    if (natural && imgRef.current) stickToBottom(imgRef.current)
  }, [natural])

  if (failed) {
    return <div className="rp-imgtile rp-imgfail" style={box}>{t('rp.tool.genFailed')}</div>
  }
  return (
    <>
      <img
        ref={imgRef}
        src={imageUrlWithRev(url, id)}
        alt=""
        {...(box ? { width: box.width, height: box.height } : {})}
        onClick={() => setPreview(true)}
        onLoad={event => {
          const el = event.currentTarget
          if (el.naturalWidth > 0 && el.naturalHeight > 0
            && (natural?.width !== el.naturalWidth || natural?.height !== el.naturalHeight)) {
            setNatural({ width: el.naturalWidth, height: el.naturalHeight })
          }
          stickToBottom(el)
        }}
        onError={() => setFailed(true)}
      />
      {preview && <ImageLightbox src={imageUrlWithRev(url, id)} onClose={() => setPreview(false)} />}
    </>
  )
}

/**
 * The forge-mode result card: the freshly generated card rendered as an
 * interactive, editable surface — no separate editor visit needed.
 */
export function SaveCardView({ block, sessionId }: ToolViewProps): ReactNode {
  const t = useT()
  // The store lookup needs the workspace the card was saved under. Newer
  // results name it; older ones resolve through the call's own session — not
  // the shown one, which is a different session whenever this transcript is
  // not the one on screen. The shown workspace is only a last resort.
  const sessionWs = useSyncExternalStore(
    subscribeWorkspaces,
    () => (sessionId !== undefined ? workspaceOfSession(sessionId)?.path : undefined) ?? currentWorkspace()?.path,
  )
  if (!isSettled(block)) {
    return (
      <div className="rp-toolcard">
        <span className="rp-toolcard-title">{t('rp.tool.cardRunning')}</span>
      </div>
    )
  }
  const meta = metaOf(block)
  const cardId = typeof meta?.card_id === 'string' ? meta.card_id : undefined
  const name = typeof meta?.name === 'string' ? meta.name : undefined
  const ws = typeof meta?.workspace_path === 'string' ? meta.workspace_path : sessionWs
  const isError = (block as { isError?: boolean }).isError === true
  if (isError || !cardId) {
    return (
      <div className="rp-toolcard">
        <span className="rp-toolcard-title">{isError ? t('rp.tool.cardFailed') : t('rp.tool.cardSaved')}</span>
      </div>
    )
  }
  return (
    <div className="rp-toolcard rp-forge-result">
      <div className="rp-toolcard-head">
        <span className="rp-toolcard-title">
          {t('rp.tool.cardSaved')}{name ? ` · ${name}` : ''}
        </span>
        <span className="rp-note">{t('rp.tool.cardHint')}</span>
      </div>
      <CardEditor cardId={cardId} ws={ws} />
      <span className="rp-note">{t('rp.tool.cardManage')}</span>
    </div>
  )
}
