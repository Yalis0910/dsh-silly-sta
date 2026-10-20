import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, type PromptInspectionReport } from './api.ts'
import { useT } from './i18n.ts'

interface InspectorTrayProps {
  sessionId: string
  wsPath?: string
  onClose: () => void
}

export function InspectorTray({ sessionId, wsPath, onClose }: InspectorTrayProps): React.ReactNode {
  const t = useT()
  const [report, setReport] = useState<PromptInspectionReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'breakdown' | 'radar' | 'raw'>('breakdown')
  const [copied, setCopied] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    setError('')
    api.inspectPrompt(sessionId, wsPath)
      .then(setReport)
      .catch(err => setError(String(err instanceof Error ? err.message : err)))
      .finally(() => setLoading(false))
  }, [sessionId, wsPath])

  useEffect(() => {
    reload()
  }, [reload])

  const copyPrompt = useCallback(() => {
    if (!report?.rawPromptPreview) return
    void navigator.clipboard.writeText(report.rawPromptPreview).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [report])

  const stats = useMemo(() => {
    if (!report) return null
    const total = Math.max(1, report.totalEstimatedTokens)
    const bd = report.breakdown
    return {
      sysPct: ((bd.systemRulesTokens / total) * 100).toFixed(1),
      charPct: ((bd.characterTokens / total) * 100).toFixed(1),
      lorePct: ((bd.lorebookTokens / total) * 100).toFixed(1),
      memPct: ((bd.storyMemoryTokens / total) * 100).toFixed(1),
      notePct: ((bd.authorNoteTokens / total) * 100).toFixed(1),
      histPct: ((bd.historyTokens / total) * 100).toFixed(1),
    }
  }, [report])

  const triggeredCount = useMemo(() => {
    return report?.loreEntries.filter(l => l.matched).length ?? 0
  }, [report])

  return (
    <div className="rp-tray-panel rp-inspector-panel">
      <div className="rp-tray-header">
        <div className="rp-inspector-title-row">
          <span className="rp-tray-title">{t('rp.inspector.title')}</span>
          {report ? (
            <span className="rp-inspector-total-badge">
              ~ {report.totalEstimatedTokens.toLocaleString()} tokens
            </span>
          ) : null}
        </div>
        <div className="rp-tray-actions">
          <button type="button" className="rp-btn-subtle" onClick={reload} disabled={loading}>
            {loading ? t('rp.inspector.refreshing') : t('rp.inspector.refresh')}
          </button>
          <button type="button" className="rp-popover-close" onClick={onClose} title="关闭">×</button>
        </div>
      </div>

      <div className="rp-inspector-tabs">
        <button
          type="button"
          className={`rp-inspector-tab${activeTab === 'breakdown' ? ' rp-active' : ''}`}
          onClick={() => setActiveTab('breakdown')}
        >
          {t('rp.inspector.tab.breakdown')}
        </button>
        <button
          type="button"
          className={`rp-inspector-tab${activeTab === 'radar' ? ' rp-active' : ''}`}
          onClick={() => setActiveTab('radar')}
        >
          {t('rp.inspector.tab.radar')} ({triggeredCount}/{report?.loreEntries.length ?? 0})
        </button>
        <button
          type="button"
          className={`rp-inspector-tab${activeTab === 'raw' ? ' rp-active' : ''}`}
          onClick={() => setActiveTab('raw')}
        >
          {t('rp.inspector.tab.raw')}
        </button>
      </div>

      {loading && !report ? (
        <div className="rp-inspector-loading">{t('rp.inspector.loading')}</div>
      ) : error ? (
        <div className="rp-error">{error}</div>
      ) : report ? (
        <div className="rp-inspector-body">
          {activeTab === 'breakdown' && stats ? (
            <div className="rp-inspector-breakdown">
              <div className="rp-progress-bar">
                <div
                  className="rp-bar-seg rp-bar-sys"
                  style={{ width: `${stats.sysPct}%` }}
                  title={`${t('rp.inspector.seg.system')}: ${report.breakdown.systemRulesTokens}t (${stats.sysPct}%)`}
                />
                <div
                  className="rp-bar-seg rp-bar-char"
                  style={{ width: `${stats.charPct}%` }}
                  title={`${t('rp.inspector.seg.char')}: ${report.breakdown.characterTokens}t (${stats.charPct}%)`}
                />
                <div
                  className="rp-bar-seg rp-bar-lore"
                  style={{ width: `${stats.lorePct}%` }}
                  title={`${t('rp.inspector.seg.lore')}: ${report.breakdown.lorebookTokens}t (${stats.lorePct}%)`}
                />
                <div
                  className="rp-bar-seg rp-bar-mem"
                  style={{ width: `${stats.memPct}%` }}
                  title={`${t('rp.inspector.seg.memory')}: ${report.breakdown.storyMemoryTokens}t (${stats.memPct}%)`}
                />
                <div
                  className="rp-bar-seg rp-bar-note"
                  style={{ width: `${stats.notePct}%` }}
                  title={`${t('rp.inspector.seg.note')}: ${report.breakdown.authorNoteTokens}t (${stats.notePct}%)`}
                />
                <div
                  className="rp-bar-seg rp-bar-hist"
                  style={{ width: `${stats.histPct}%` }}
                  title={`${t('rp.inspector.seg.history')}: ${report.breakdown.historyTokens}t (${stats.histPct}%)`}
                />
              </div>

              <div className="rp-inspector-grid">
                <div className="rp-stat-card">
                  <span className="rp-stat-dot rp-dot-sys" />
                  <span className="rp-stat-label">{t('rp.inspector.seg.system')}</span>
                  <span className="rp-stat-val">{report.breakdown.systemRulesTokens} tokens</span>
                  <span className="rp-stat-pct">{stats.sysPct}%</span>
                </div>
                <div className="rp-stat-card">
                  <span className="rp-stat-dot rp-dot-char" />
                  <span className="rp-stat-label">{t('rp.inspector.seg.char')}</span>
                  <span className="rp-stat-val">{report.breakdown.characterTokens} tokens</span>
                  <span className="rp-stat-pct">{stats.charPct}%</span>
                </div>
                <div className="rp-stat-card">
                  <span className="rp-stat-dot rp-dot-lore" />
                  <span className="rp-stat-label">{t('rp.inspector.seg.lore')}</span>
                  <span className="rp-stat-val">{report.breakdown.lorebookTokens} tokens</span>
                  <span className="rp-stat-pct">{stats.lorePct}%</span>
                </div>
                <div className="rp-stat-card">
                  <span className="rp-stat-dot rp-dot-mem" />
                  <span className="rp-stat-label">{t('rp.inspector.seg.memory')}</span>
                  <span className="rp-stat-val">{report.breakdown.storyMemoryTokens} tokens</span>
                  <span className="rp-stat-pct">{stats.memPct}%</span>
                </div>
                <div className="rp-stat-card">
                  <span className="rp-stat-dot rp-dot-note" />
                  <span className="rp-stat-label">{t('rp.inspector.seg.note')}</span>
                  <span className="rp-stat-val">{report.breakdown.authorNoteTokens} tokens</span>
                  <span className="rp-stat-pct">{stats.notePct}%</span>
                </div>
                <div className="rp-stat-card">
                  <span className="rp-stat-dot rp-dot-hist" />
                  <span className="rp-stat-label">{t('rp.inspector.seg.history')}</span>
                  <span className="rp-stat-val">{report.breakdown.historyTokens} tokens</span>
                  <span className="rp-stat-pct">{stats.histPct}%</span>
                </div>
              </div>

              <div className="rp-inspector-meta">
                <span>{t('rp.inspector.mode')}: <strong>{report.mode === 'group' ? t('rp.inspector.mode.group') : t('rp.inspector.mode.single')}</strong></span>
                <span>{t('rp.inspector.characters')}: {report.characters.map(c => c.name).join('、')}</span>
                {report.activeSpeaker ? <span>{t('rp.inspector.activeSpeaker')}: <strong>{report.activeSpeaker.name}</strong></span> : null}
              </div>
            </div>
          ) : null}

          {activeTab === 'radar' ? (
            <div className="rp-inspector-radar">
              {report.loreEntries.length === 0 ? (
                <div className="rp-muted">{t('rp.inspector.noLore')}</div>
              ) : (
                <div className="rp-radar-list">
                  {report.loreEntries.map(entry => (
                    <div key={entry.id} className={`rp-radar-item${entry.matched ? ' rp-matched' : ''}`}>
                      <div className="rp-radar-item-top">
                        <span className={`rp-radar-badge ${entry.matched ? (entry.constant ? 'rp-badge-constant' : 'rp-badge-matched') : 'rp-badge-idle'}`}>
                          {entry.constant
                            ? t('rp.inspector.badge.constant')
                            : (entry.matched ? t('rp.inspector.badge.matched') : t('rp.inspector.badge.idle'))}
                        </span>
                        <strong className="rp-radar-item-title">{entry.title}</strong>
                        <span className="rp-spacer" />
                        <span className="rp-radar-tokens">~{entry.estimatedTokens} t</span>
                      </div>
                      <div className="rp-radar-item-detail">
                        {entry.matchedKey ? (
                          <span className="rp-radar-hit">
                            {t('rp.inspector.hitKey')}: <code>{entry.matchedKey}</code>
                          </span>
                        ) : null}
                        <span className="rp-radar-keys">
                          {t('rp.inspector.triggerKeys')}: {entry.keys.length > 0 ? entry.keys.join(', ') : t('rp.inspector.noKeys')}
                        </span>
                        <span className="rp-radar-pos">({entry.position})</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {activeTab === 'raw' ? (
            <div className="rp-inspector-raw">
              <div className="rp-raw-header">
                <span className="rp-note">{t('rp.inspector.rawHint')}</span>
                <button type="button" className="rp-btn-subtle" onClick={copyPrompt}>
                  {copied ? t('rp.inspector.copied') : t('rp.inspector.copy')}
                </button>
              </div>
              <textarea
                className="rp-textarea rp-raw-textarea"
                rows={12}
                readOnly
                value={report.rawPromptPreview}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
