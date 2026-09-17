import React, { useState, useEffect, useCallback } from 'react'
import type { Sequence, Project } from '@adobe/premierepro'
import type { AssetSummary } from './FileItem'
import type { LinkedSequenceAsset } from '../types/link'
import { getActiveProject, getAllSequences, getActiveSequence } from '../services/premiere'
import { getAllLinkedSequences, normalizeGuid, removeSequenceLink } from '../services/linkStorage'
import { fetchAssetComments, syncCommentsToSequence } from '../services/markers'
import { resolveAssetUrl, isSameEndpoint } from '../utils/url'
import { formatBytes, formatDuration } from '../utils/format'
import { ProgressCircle } from '@swc-react/progress-circle'

export interface LinkSequenceDialogProps {
  asset: AssetSummary | null
  endpoint: string
  apiKey: string
  isOpen: boolean
  onClose: () => void
  onLinkSuccess: (link: LinkedSequenceAsset, addedMarkersCount: number) => void
}

interface SequenceOption {
  sequence: Sequence
  guid: string
  name: string
  isActive: boolean
  currentLink: LinkedSequenceAsset | null
}

export const LinkSequenceDialog: React.FC<LinkSequenceDialogProps> = ({
  asset,
  endpoint,
  apiKey,
  isOpen,
  onClose,
  onLinkSuccess,
}) => {
  const [project, setProject] = useState<Project | null>(null)
  const [sequences, setSequences] = useState<SequenceOption[]>([])
  const [selectedGuid, setSelectedGuid] = useState<string>('')
  const [loadingSequences, setLoadingSequences] = useState(true)
  const [linking, setLinking] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [thumbError, setThumbError] = useState(false)

  // Load project sequences and link states when opened
  useEffect(() => {
    if (!isOpen || !asset) {
      setProject(null)
      setSequences([])
      setSelectedGuid('')
      setErrorMessage(null)
      setLinking(false)
      setThumbError(false)
      return
    }

    let isMounted = true
    setLoadingSequences(true)
    setErrorMessage(null)

    async function loadProjectData() {
      try {
        const pr = await getActiveProject()
        if (!isMounted) return

        if (!pr) {
          setProject(null)
          setLoadingSequences(false)
          setErrorMessage('No active Premiere Pro project found. Please open a project first.')
          return
        }

        setProject(pr)

        const [allSeqs, activeSeq, existingLinks] = await Promise.all([
          getAllSequences(pr),
          getActiveSequence(pr),
          getAllLinkedSequences(pr),
        ])

        if (!isMounted) return

        if (!allSeqs || allSeqs.length === 0) {
          setLoadingSequences(false)
          setErrorMessage(
            'No sequences found in the current project. Please create a sequence first.',
          )
          return
        }

        const activeGuid = normalizeGuid(activeSeq?.guid)
        const linksMap = new Map<string, LinkedSequenceAsset>()
        for (const link of existingLinks) {
          if (!link.endpoint || isSameEndpoint(link.endpoint, endpoint)) {
            linksMap.set(normalizeGuid(link.sequenceGuid), link)
          }
        }

        const options: SequenceOption[] = allSeqs.map((seq) => {
          const guidStr = normalizeGuid(seq.guid)
          return {
            sequence: seq,
            guid: guidStr,
            name: seq.name || 'Untitled Sequence',
            isActive: Boolean(activeGuid && guidStr === activeGuid),
            currentLink: linksMap.get(guidStr) || null,
          }
        })

        setSequences(options)

        // Pre-select active sequence if found, else first sequence
        if (activeGuid && options.some((opt) => opt.guid === activeGuid)) {
          setSelectedGuid(activeGuid)
        } else if (options.length > 0) {
          setSelectedGuid(options[0].guid)
        }
      } catch (err) {
        if (!isMounted) return
        console.error('[LinkSequenceDialog] Error loading project data:', err)
        setErrorMessage('Failed to load project sequences from Premiere Pro.')
      } finally {
        if (isMounted) {
          setLoadingSequences(false)
        }
      }
    }

    void loadProjectData()

    return () => {
      isMounted = false
    }
  }, [isOpen, asset, endpoint])

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !linking) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, linking, onClose])

  const handleConfirm = useCallback(async () => {
    if (!asset || !project || !selectedGuid || linking) return
    const targetOption = sequences.find(
      (opt) => normalizeGuid(opt.guid) === normalizeGuid(selectedGuid),
    )
    if (!targetOption) return

    setLinking(true)
    try {
      // If sequence was linked to another asset, remove its previous link and markers first
      if (targetOption.currentLink && targetOption.currentLink.assetId !== asset.id) {
        await removeSequenceLink(project, targetOption.sequence)
      }

      // 1. Fetch timecoded comments for this asset
      const comments = await fetchAssetComments(endpoint, apiKey, asset.id)

      // 2. Prepare initial link metadata
      const prGuidStr = project.guid ? normalizeGuid(project.guid) : undefined
      const initialLink: LinkedSequenceAsset = {
        sequenceGuid: normalizeGuid(targetOption.guid),
        sequenceName: targetOption.name,
        assetId: asset.id,
        assetName: asset.name,
        assetThumbnailUrl: asset.preview?.thumbnailUrl,
        endpoint: endpoint.trim().replace(/\/+$/, ''),
        projectId: prGuidStr,
        syncedCommentIds:
          targetOption.currentLink?.assetId === asset.id
            ? targetOption.currentLink.syncedCommentIds
            : [],
        syncedMarkerGuids:
          targetOption.currentLink?.assetId === asset.id
            ? (targetOption.currentLink.syncedMarkerGuids || []).map(normalizeGuid)
            : [],
        lastSyncAt: Date.now(),
        totalCommentsSynced:
          targetOption.currentLink?.assetId === asset.id
            ? targetOption.currentLink.totalCommentsSynced
            : 0,
      }

      // 3. Translate comments to markers on the sequence
      const { updatedLink, addedCount } = await syncCommentsToSequence(
        project,
        targetOption.sequence,
        comments,
        initialLink,
      )

      onLinkSuccess(updatedLink, addedCount)
      onClose()
    } catch (err) {
      console.error('[LinkSequenceDialog] Failed to link sequence:', err)
      setErrorMessage('Failed to link sequence and sync markers. Please try again.')
    } finally {
      setLinking(false)
    }
  }, [asset, project, selectedGuid, linking, sequences, endpoint, apiKey, onLinkSuccess, onClose])

  if (!isOpen || !asset) return null

  const selectedOption = sequences.find((opt) => opt.guid === selectedGuid)
  const isReplacingOtherAsset =
    selectedOption?.currentLink && selectedOption.currentLink.assetId !== asset.id

  const effectiveSize = asset.sizeByte ?? asset.size
  const thumbUrl = resolveAssetUrl(asset.preview?.thumbnailUrl, endpoint)
  const duration = asset.preview?.duration ?? asset.media?.metadata?.duration
  const durationText = formatDuration(duration)

  return (
    <div
      className="shumai-dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !linking) {
          onClose()
        }
      }}
    >
      <div
        className="shumai-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="link-dialog-title"
      >
        {/* Header */}
        <div className="shumai-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <sp-icon-link size="s" style={{ marginRight: 6, color: '#3b82f6' }}></sp-icon-link>
            <span id="link-dialog-title" className="shumai-dialog-title">
              Link to Sequence
            </span>
          </div>
          <button
            type="button"
            className="shumai-dialog-close"
            onClick={onClose}
            disabled={linking}
            title="Close dialog"
            aria-label="Close dialog"
          >
            <sp-icon-close size="s"></sp-icon-close>
          </button>
        </div>

        {/* Asset Info Card */}
        <div className="shumai-dialog-asset-info">
          <div className="shumai-dialog-thumb">
            {thumbUrl && !thumbError ? (
              <img src={thumbUrl} alt={asset.name} onError={() => setThumbError(true)} />
            ) : asset.type === 'video' ? (
              <sp-icon-filmstrip size="xxl" style={{ color: '#60a5fa' }}></sp-icon-filmstrip>
            ) : asset.type === 'audio' ? (
              <sp-icon-audio size="xxl" style={{ color: '#a78bfa' }}></sp-icon-audio>
            ) : (
              <sp-icon-document size="xxl" style={{ color: '#999999' }}></sp-icon-document>
            )}
          </div>
          <div className="shumai-dialog-asset-meta">
            <span className="shumai-dialog-asset-name" title={asset.name}>
              {asset.name}
            </span>
            <span className="shumai-dialog-asset-details">
              {durationText ? `${durationText} • ` : ''}
              {effectiveSize ? `${formatBytes(effectiveSize)} • ` : ''}
              {asset.commentsCount != null && asset.commentsCount > 0
                ? `${asset.commentsCount} comments`
                : 'No comments'}
            </span>
          </div>
        </div>

        {/* Dialog Body */}
        <div className="shumai-dialog-body">
          <div className="shumai-dialog-section-label">Select Sequence in Project</div>

          {loadingSequences ? (
            <div className="shumai-dialog-loading">
              <ProgressCircle indeterminate size="s" label="Checking project sequences..." />
              <span>Checking project sequences...</span>
            </div>
          ) : errorMessage ? (
            <div className="shumai-dialog-empty-proxies" style={{ color: '#f87171' }}>
              <span>{errorMessage}</span>
            </div>
          ) : sequences.length > 0 ? (
            sequences.map((opt) => {
              const isSelected = selectedGuid === opt.guid
              const isLinkedToAnother = opt.currentLink && opt.currentLink.assetId !== asset.id
              const isLinkedToThis = opt.currentLink && opt.currentLink.assetId === asset.id

              return (
                <div
                  key={opt.guid}
                  className={`shumai-option-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => !linking && setSelectedGuid(opt.guid)}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (!linking) setSelectedGuid(opt.guid)
                    }
                  }}
                >
                  <div className="shumai-option-left">
                    <sp-icon-filmstrip
                      size="s"
                      className="shumai-option-icon"
                      style={{ color: '#3b82f6' }}
                    ></sp-icon-filmstrip>
                    <div className="shumai-option-texts">
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className="shumai-option-title">{opt.name}</span>
                        {opt.isActive && (
                          <span
                            style={{
                              fontSize: '10px',
                              marginLeft: 6,
                              padding: '1px 5px',
                              borderRadius: '3px',
                              backgroundColor: 'rgba(59, 130, 246, 0.2)',
                              color: '#60a5fa',
                              fontWeight: 500,
                            }}
                          >
                            Active
                          </span>
                        )}
                      </div>
                      <span className="shumai-option-meta">
                        {isLinkedToThis ? (
                          <span style={{ color: '#34d399' }}>Already linked to this asset</span>
                        ) : isLinkedToAnother ? (
                          <span style={{ color: '#fbbf24' }}>
                            Linked to &quot;{opt.currentLink?.assetName}&quot; (will replace)
                          </span>
                        ) : (
                          'Ready to link'
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="shumai-option-radio">
                    {isSelected && <div className="shumai-option-radio-dot" />}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="shumai-dialog-empty-proxies">
              <span>No sequences available in current project.</span>
            </div>
          )}

          {isReplacingOtherAsset && (
            <div
              style={{
                marginTop: 10,
                padding: '8px 10px',
                borderRadius: 4,
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                fontSize: 11,
                color: '#fbbf24',
              }}
            >
              <sp-icon-alert-triangle
                size="s"
                style={{ marginRight: 6, flexShrink: 0 }}
              ></sp-icon-alert-triangle>
              <span>
                This sequence is already linked to another asset. Proceeding will replace the link
                and sync markers for this asset.
              </span>
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
            Comments with timestamps will be placed on the sequence timeline as markers. Markers
            deleted in Premiere Pro will not be re-synced.
          </div>
        </div>

        {/* Footer */}
        <div className="shumai-dialog-footer">
          <sp-button quiet variant="secondary" size="s" onClick={onClose} disabled={linking}>
            Cancel
          </sp-button>
          <sp-button
            variant="accent"
            size="s"
            onClick={handleConfirm}
            disabled={!selectedGuid || loadingSequences || Boolean(errorMessage) || linking}
          >
            {linking ? (
              <>
                <ProgressCircle indeterminate size="s" slot="icon" label="Linking..." />
                Linking...
              </>
            ) : isReplacingOtherAsset ? (
              'Replace & Link'
            ) : (
              'Link Sequence'
            )}
          </sp-button>
        </div>
      </div>
    </div>
  )
}
