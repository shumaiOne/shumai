import React, { useState, useEffect, useCallback } from 'react'
import type { Project, Sequence } from '@adobe/premierepro'
import type { LinkedSequenceAsset } from '../types/link'
import {
  getActiveProject,
  getActiveSequence,
  getAllSequences,
  openSequenceInTimeline,
  getPremiereModule,
} from '../services/premiere'
import { getAllLinkedSequences, removeSequenceLink } from '../services/linkStorage'
import { fetchAssetComments, syncCommentsToSequence } from '../services/markers'
import { resolveAssetUrl } from '../utils/url'
import { formatDateAgo } from '../utils/date'
import { ProgressCircle } from '@swc-react/progress-circle'

export interface SequencesViewProps {
  endpoint: string
  apiKey: string
  onSwitchToBrowse?: () => void
  onLinkCountChange?: (count: number) => void
}

export const SequencesView: React.FC<SequencesViewProps> = ({
  endpoint,
  apiKey,
  onLinkCountChange,
}) => {
  const [project, setProject] = useState<Project | null>(null)
  const [activeSeq, setActiveSeq] = useState<Sequence | null>(null)
  const [allSeqs, setAllSeqs] = useState<Sequence[]>([])
  const [linkedSequences, setLinkedSequences] = useState<LinkedSequenceAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [syncingGuid, setSyncingGuid] = useState<string | null>(null)
  const [unlinkingGuid, setUnlinkingGuid] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const pr = await getActiveProject()
      setProject(pr)
      if (!pr) {
        setActiveSeq(null)
        setAllSeqs([])
        setLinkedSequences([])
        onLinkCountChange?.(0)
        return
      }

      const [currentActive, seqsList] = await Promise.all([
        getActiveSequence(pr),
        getAllSequences(pr),
      ])

      setActiveSeq(currentActive)
      setAllSeqs(seqsList)

      const links = await getAllLinkedSequences(pr, seqsList)
      setLinkedSequences(links)
      onLinkCountChange?.(links.length)
    } catch (err) {
      console.error('[SequencesView] Failed to load sequences data:', err)
    } finally {
      setLoading(false)
    }
  }, [onLinkCountChange])

  useEffect(() => {
    void loadData()

    // Listen for sequence activation events in Premiere Pro
    const ppro = getPremiereModule()
    if (ppro?.EventManager && ppro.Constants?.SequenceEvent?.ACTIVATED) {
      const handleActivated = () => {
        void loadData()
      }
      try {
        ppro.EventManager.addGlobalEventListener(
          ppro.Constants.SequenceEvent.ACTIVATED,
          handleActivated,
          true,
        )
        return () => {
          try {
            ppro.EventManager.removeGlobalEventListener(
              ppro.Constants.SequenceEvent.ACTIVATED,
              handleActivated,
            )
          } catch {
            // Ignore error on unmount
          }
        }
      } catch (err) {
        console.warn('[SequencesView] Could not add SequenceEvent listener:', err)
      }
    }
  }, [loadData])

  // Sync Now handler
  const handleSyncNow = async (link: LinkedSequenceAsset) => {
    if (!project || syncingGuid) return
    const targetSeq = allSeqs.find((s) => s.guid && s.guid.toString() === link.sequenceGuid)
    if (!targetSeq) return

    setSyncingGuid(link.sequenceGuid)
    try {
      const comments = await fetchAssetComments(endpoint, apiKey, link.assetId)
      const { updatedLink, addedCount } = await syncCommentsToSequence(
        project,
        targetSeq,
        comments,
        link,
      )

      setLinkedSequences((prev) =>
        prev.map((item) => (item.sequenceGuid === updatedLink.sequenceGuid ? updatedLink : item)),
      )

      setToastMessage(
        addedCount > 0
          ? `Synced ${addedCount} new comment ${addedCount === 1 ? 'marker' : 'markers'} for "${link.sequenceName}".`
          : `All comments are already synced for "${link.sequenceName}".`,
      )
      setTimeout(() => setToastMessage(null), 4000)
    } catch (err) {
      console.error('[SequencesView] Failed to sync comments:', err)
    } finally {
      setSyncingGuid(null)
    }
  }

  // Unlink handler
  const handleUnlink = async (link: LinkedSequenceAsset) => {
    if (!project || unlinkingGuid) return
    const targetSeq = allSeqs.find((s) => s.guid && s.guid.toString() === link.sequenceGuid)
    if (!targetSeq) return

    setUnlinkingGuid(link.sequenceGuid)
    try {
      await removeSequenceLink(project, targetSeq)
      setLinkedSequences((prev) => {
        const next = prev.filter((item) => item.sequenceGuid !== link.sequenceGuid)
        onLinkCountChange?.(next.length)
        return next
      })
      setToastMessage(`Unlinked "${link.sequenceName}" from "${link.assetName}".`)
      setTimeout(() => setToastMessage(null), 3000)
    } catch (err) {
      console.error('[SequencesView] Failed to unlink sequence:', err)
    } finally {
      setUnlinkingGuid(null)
    }
  }

  // Open Sequence in Timeline handler
  const handleOpenSequence = async (link: LinkedSequenceAsset) => {
    if (!project) return
    const targetSeq = allSeqs.find((s) => s.guid && s.guid.toString() === link.sequenceGuid)
    if (!targetSeq) return

    await openSequenceInTimeline(targetSeq, project)
    setActiveSeq(targetSeq)
  }

  if (loading) {
    return (
      <div
        className="sequences-view-container"
        style={{ justifyContent: 'center', alignItems: 'center' }}
      >
        <ProgressCircle indeterminate size="m" label="Loading sequences..." />
      </div>
    )
  }

  const activeGuidStr = activeSeq?.guid ? activeSeq.guid.toString() : ''
  const currentSequenceLink = linkedSequences.find((item) => item.sequenceGuid === activeGuidStr)

  if (linkedSequences.length === 0) {
    return (
      <div className="sequences-view-container sequences-empty-container">
        {toastMessage && (
          <div
            style={{
              marginBottom: 10,
              padding: '6px 10px',
              borderRadius: 4,
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#60a5fa',
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <sp-icon-checkmark-circle
              size="s"
              style={{ marginRight: 6, flexShrink: 0 }}
            ></sp-icon-checkmark-circle>
            <span>{toastMessage}</span>
          </div>
        )}

        <div className="sequence-empty-state unified-empty">
          <sp-icon-movie-camera
            size="xxl"
            style={{ color: '#60a5fa', opacity: 0.7, marginBottom: 12 }}
          ></sp-icon-movie-camera>
          <div className="sequence-empty-state-title" style={{ fontSize: 14, marginBottom: 6 }}>
            No Linked Sequences
          </div>
          <div style={{ fontSize: 11, marginBottom: 8, maxWidth: 280, lineHeight: 1.4 }}>
            {activeSeq
              ? `Active sequence "${activeSeq.name}" is not linked to any Shumai asset.`
              : 'Open a sequence in Premiere Pro and link it to a Shumai asset.'}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              marginBottom: 16,
              maxWidth: 280,
              lineHeight: 1.4,
            }}
          >
            Linking a sequence enables automatic synchronization of comments from Shumai as timeline
            markers.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sequences-view-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            marginBottom: 10,
            padding: '6px 10px',
            borderRadius: 4,
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            color: '#60a5fa',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <sp-icon-checkmark-circle
            size="s"
            style={{ marginRight: 6, flexShrink: 0 }}
          ></sp-icon-checkmark-circle>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* SECTION 1: Current Sequence Asset */}
      <div className="sequence-section">
        <div className="sequence-section-title">Current Sequence Asset</div>

        {currentSequenceLink ? (
          <div className="sequence-link-card current-active">
            <div className="sequence-card-row">
              <div className="sequence-card-left">
                <div className="sequence-card-thumb">
                  {currentSequenceLink.assetThumbnailUrl ? (
                    <img
                      src={resolveAssetUrl(currentSequenceLink.assetThumbnailUrl, endpoint)}
                      alt={currentSequenceLink.assetName}
                    />
                  ) : (
                    <sp-icon-movie-camera
                      size="m"
                      style={{ color: '#3b82f6' }}
                    ></sp-icon-movie-camera>
                  )}
                </div>
                <div className="sequence-card-info">
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="sequence-card-title">{currentSequenceLink.sequenceName}</span>
                    <span
                      style={{
                        fontSize: '9px',
                        marginLeft: 6,
                        padding: '1px 4px',
                        borderRadius: 3,
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        color: '#60a5fa',
                        fontWeight: 600,
                      }}
                    >
                      Active
                    </span>
                  </div>
                  <span className="sequence-card-subtitle" title={currentSequenceLink.assetName}>
                    Asset: {currentSequenceLink.assetName}
                  </span>
                </div>
              </div>

              <div className="sequence-card-actions">
                <sp-action-button
                  quiet
                  size="xs"
                  label="Sync comments now"
                  title="Sync comments now"
                  disabled={syncingGuid === currentSequenceLink.sequenceGuid}
                  onClick={() => handleSyncNow(currentSequenceLink)}
                >
                  {syncingGuid === currentSequenceLink.sequenceGuid ? (
                    <ProgressCircle indeterminate size="s" slot="icon" label="Syncing..." />
                  ) : (
                    <sp-icon-refresh size="s" slot="icon"></sp-icon-refresh>
                  )}
                </sp-action-button>

                <sp-action-button
                  quiet
                  size="xs"
                  label="Unlink sequence"
                  title="Unlink sequence"
                  disabled={unlinkingGuid === currentSequenceLink.sequenceGuid}
                  onClick={() => handleUnlink(currentSequenceLink)}
                >
                  {unlinkingGuid === currentSequenceLink.sequenceGuid ? (
                    <ProgressCircle indeterminate size="s" slot="icon" label="Unlinking..." />
                  ) : (
                    <sp-icon-unlink
                      size="s"
                      slot="icon"
                      style={{ color: '#f87171' }}
                    ></sp-icon-unlink>
                  )}
                </sp-action-button>
              </div>
            </div>

            <div className="sequence-card-footer">
              <span>
                {currentSequenceLink.totalCommentsSynced}{' '}
                {currentSequenceLink.totalCommentsSynced === 1 ? 'comment' : 'comments'} synced
              </span>
              <span>Last sync: {formatDateAgo(currentSequenceLink.lastSyncAt) || 'Just now'}</span>
            </div>
          </div>
        ) : (
          <div className="sequence-empty-state compact">
            <sp-icon-movie-camera
              size="l"
              style={{ color: '#60a5fa', opacity: 0.6, marginBottom: 4 }}
            ></sp-icon-movie-camera>
            <div className="sequence-empty-state-title">
              {activeSeq ? activeSeq.name : 'No Active Sequence'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
              {activeSeq
                ? 'This sequence is not linked to any Shumai asset.'
                : 'Open a sequence in the timeline to view its linked asset.'}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: All Sequence Assets */}
      <div className="sequence-section" style={{ marginTop: 8 }}>
        <div className="sequence-section-title">All Sequence Assets ({linkedSequences.length})</div>

        {linkedSequences.map((link) => {
          const isActive = link.sequenceGuid === activeGuidStr
          const isSyncing = syncingGuid === link.sequenceGuid
          const isUnlinking = unlinkingGuid === link.sequenceGuid

          return (
            <div
              key={link.sequenceGuid}
              className={`sequence-link-card ${isActive ? 'current-active' : ''}`}
            >
              <div className="sequence-card-row">
                <div className="sequence-card-left">
                  <div className="sequence-card-thumb">
                    {link.assetThumbnailUrl ? (
                      <img
                        src={resolveAssetUrl(link.assetThumbnailUrl, endpoint)}
                        alt={link.assetName}
                      />
                    ) : (
                      <sp-icon-movie-camera
                        size="m"
                        style={{ color: '#60a5fa' }}
                      ></sp-icon-movie-camera>
                    )}
                  </div>
                  <div className="sequence-card-info">
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span className="sequence-card-title">{link.sequenceName}</span>
                      {isActive && (
                        <span
                          style={{
                            fontSize: '9px',
                            marginLeft: 6,
                            padding: '1px 4px',
                            borderRadius: 3,
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            color: '#60a5fa',
                            fontWeight: 600,
                          }}
                        >
                          Active
                        </span>
                      )}
                    </div>
                    <span className="sequence-card-subtitle" title={link.assetName}>
                      Asset: {link.assetName}
                    </span>
                  </div>
                </div>

                <div className="sequence-card-actions">
                  {!isActive && (
                    <sp-action-button
                      quiet
                      size="xs"
                      label="Open sequence in timeline"
                      title="Open sequence in timeline"
                      onClick={() => handleOpenSequence(link)}
                    >
                      <sp-icon-link-out size="s" slot="icon"></sp-icon-link-out>
                    </sp-action-button>
                  )}

                  <sp-action-button
                    quiet
                    size="xs"
                    label="Sync comments now"
                    title="Sync comments now"
                    disabled={isSyncing}
                    onClick={() => handleSyncNow(link)}
                  >
                    {isSyncing ? (
                      <ProgressCircle indeterminate size="s" slot="icon" label="Syncing..." />
                    ) : (
                      <sp-icon-refresh size="s" slot="icon"></sp-icon-refresh>
                    )}
                  </sp-action-button>

                  <sp-action-button
                    quiet
                    size="xs"
                    label="Unlink sequence"
                    title="Unlink sequence"
                    disabled={isUnlinking}
                    onClick={() => handleUnlink(link)}
                  >
                    {isUnlinking ? (
                      <ProgressCircle indeterminate size="s" slot="icon" label="Unlinking..." />
                    ) : (
                      <sp-icon-unlink
                        size="s"
                        slot="icon"
                        style={{ color: '#f87171' }}
                      ></sp-icon-unlink>
                    )}
                  </sp-action-button>
                </div>
              </div>

              <div className="sequence-card-footer">
                <span>
                  {link.totalCommentsSynced}{' '}
                  {link.totalCommentsSynced === 1 ? 'comment' : 'comments'} synced
                </span>
                <span>Last sync: {formatDateAgo(link.lastSyncAt) || 'Just now'}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
