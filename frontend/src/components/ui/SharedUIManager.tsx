import { useState, useCallback } from 'react'
import { useSharedUI, type SharedUIConfig } from '../../hooks/useSharedUI'
import { useLayout } from '../../context/LayoutContext'
import { useCustomFrames } from '../../hooks/useCustomFrames'
import { useAccount } from 'wagmi'

interface SharedUIManagerProps {
  onLayoutApplied?: () => void
}

export function SharedUIManager({ onLayoutApplied }: SharedUIManagerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'publish' | 'import' | 'saved'>('saved')
  const [publishName, setPublishName] = useState('')
  const [publishDescription, setPublishDescription] = useState('')
  const [importCode, setImportCode] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)
  const [generatedCode, setGeneratedCode] = useState('')

  const { address } = useAccount()
  const { layouts, applyLayout } = useLayout()
  const { boxFrames, assignFrameToBox } = useCustomFrames()
  const {
    sharedConfigs,
    publishUI,
    importUIFromCode,
    deleteSharedUI,
    generateShareCode,
  } = useSharedUI()

  // Publish current UI layout
  const handlePublish = useCallback(() => {
    if (!publishName.trim()) return

    const configId = publishUI({
      name: publishName.trim(),
      description: publishDescription.trim() || undefined,
      createdBy: address || 'anonymous',
      layouts,
      frameAssignments: boxFrames,
    })

    // Generate share code for the new config
    const newConfig = {
      id: configId,
      name: publishName.trim(),
      description: publishDescription.trim() || undefined,
      createdBy: address || 'anonymous',
      createdAt: Date.now(),
      layouts,
      frameAssignments: boxFrames,
    }
    const code = generateShareCode(newConfig)
    setGeneratedCode(code)

    // RALPH RL-006 VALIDATION
    console.log('[RALPH RL-006] UI published successfully:', {
      configId,
      name: publishName,
      codeGenerated: !!code,
    })

    setPublishName('')
    setPublishDescription('')
  }, [publishName, publishDescription, address, layouts, boxFrames, publishUI, generateShareCode])

  // Import UI from code
  const handleImport = useCallback(() => {
    if (!importCode.trim()) return

    const config = importUIFromCode(importCode.trim())
    if (config) {
      applyLayoutFromConfig(config)
      setImportCode('')
      setActiveTab('saved')

      // RALPH RL-006 VALIDATION
      console.log('[RALPH RL-006] UI imported and applied:', {
        configId: config.id,
        name: config.name,
      })
    } else {
      alert('Invalid share code. Please check and try again.')
    }
  }, [importCode, importUIFromCode])

  // Apply layout from config
  const applyLayoutFromConfig = useCallback((config: SharedUIConfig) => {
    // Apply layouts
    applyLayout(config.layouts)

    // Apply frame assignments
    Object.entries(config.frameAssignments).forEach(([boxId, frameId]) => {
      assignFrameToBox(boxId, frameId)
    })

    onLayoutApplied?.()

    // RALPH RL-006 VALIDATION
    console.log('[RALPH RL-006] Layout applied from config:', {
      configId: config.id,
      name: config.name,
      boxesUpdated: Object.keys(config.layouts).length,
      framesApplied: Object.keys(config.frameAssignments).length,
    })
  }, [applyLayout, assignFrameToBox, onLayoutApplied])

  // Copy share code to clipboard
  const handleCopyCode = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)

      // RALPH RL-006 VALIDATION
      console.log('[RALPH RL-006] Share code copied to clipboard')
    } catch (error) {
      console.error('[RALPH RL-006] Failed to copy code:', error)
    }
  }, [])

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          padding: '8px 12px',
          backgroundColor: 'rgba(168,85,247,0.2)',
          border: '1px solid rgba(168,85,247,0.4)',
          borderRadius: '8px',
          color: '#c084fc',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
        title="Share or import UI layouts"
      >
        <span>📤</span> Share UI
      </button>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'rgba(26,26,26,0.98)',
      border: '1px solid rgba(168,85,247,0.3)',
      borderRadius: '16px',
      padding: '24px',
      zIndex: 10000,
      minWidth: '400px',
      maxWidth: '500px',
      boxShadow: '0 16px 64px rgba(0,0,0,0.6)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
      }}>
        <h3 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: 600 }}>
          📤 Shared UI Layouts
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            fontSize: '18px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '16px',
        backgroundColor: '#252525',
        padding: '4px',
        borderRadius: '8px',
      }}>
        {(['saved', 'import', 'publish'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: activeTab === tab ? 'rgba(168,85,247,0.3)' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: activeTab === tab ? '#c084fc' : '#888',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ minHeight: '200px' }}>
        {/* Saved Layouts Tab */}
        {activeTab === 'saved' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sharedConfigs.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '32px',
                color: '#666',
                fontSize: '13px',
              }}>
                No saved layouts yet.<br />
                Publish your current layout or import one!
              </div>
            ) : (
              sharedConfigs.map((config) => (
                <div
                  key={config.id}
                  style={{
                    padding: '12px',
                    backgroundColor: 'rgba(40,40,40,0.8)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px',
                  }}>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 600, fontSize: '13px' }}>
                        {config.name}
                      </div>
                      {config.description && (
                        <div style={{ color: '#888', fontSize: '11px', marginTop: '4px' }}>
                          {config.description}
                        </div>
                      )}
                      <div style={{ color: '#666', fontSize: '10px', marginTop: '4px' }}>
                        {new Date(config.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteSharedUI(config.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => applyLayoutFromConfig(config)}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        backgroundColor: 'rgba(0,255,0,0.2)',
                        border: '1px solid rgba(0,255,0,0.4)',
                        borderRadius: '4px',
                        color: '#00ff00',
                        fontSize: '10px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => handleCopyCode(generateShareCode(config))}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        backgroundColor: 'rgba(168,85,247,0.2)',
                        border: '1px solid rgba(168,85,247,0.4)',
                        borderRadius: '4px',
                        color: '#c084fc',
                        fontSize: '10px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {copySuccess ? '✓ Copied!' : 'Copy Code'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Import Tab */}
        {activeTab === 'import' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ color: '#ccc', fontSize: '12px' }}>
              Paste share code:
            </label>
            <textarea
              value={importCode}
              onChange={(e) => setImportCode(e.target.value)}
              placeholder="Paste the share code here..."
              style={{
                width: '100%',
                height: '100px',
                padding: '10px',
                backgroundColor: '#252525',
                border: '1px solid rgba(168,85,247,0.2)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '11px',
                fontFamily: 'monospace',
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleImport}
              disabled={!importCode.trim()}
              style={{
                padding: '10px 16px',
                backgroundColor: importCode.trim() ? 'rgba(0,255,0,0.2)' : 'rgba(100,100,100,0.2)',
                border: `1px solid ${importCode.trim() ? 'rgba(0,255,0,0.4)' : 'rgba(100,100,100,0.4)'}`,
                borderRadius: '8px',
                color: importCode.trim() ? '#00ff00' : '#666',
                fontSize: '12px',
                fontWeight: 600,
                cursor: importCode.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Import & Apply Layout
            </button>
          </div>
        )}

        {/* Publish Tab */}
        {activeTab === 'publish' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ color: '#ccc', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                Layout Name *
              </label>
              <input
                type="text"
                value={publishName}
                onChange={(e) => setPublishName(e.target.value)}
                placeholder="My Awesome Layout"
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#252525',
                  border: '1px solid rgba(168,85,247,0.2)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '12px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ color: '#ccc', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                Description (optional)
              </label>
              <textarea
                value={publishDescription}
                onChange={(e) => setPublishDescription(e.target.value)}
                placeholder="Describe your layout..."
                style={{
                  width: '100%',
                  height: '60px',
                  padding: '10px',
                  backgroundColor: '#252525',
                  border: '1px solid rgba(168,85,247,0.2)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '12px',
                  resize: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              onClick={handlePublish}
              disabled={!publishName.trim()}
              style={{
                padding: '10px 16px',
                backgroundColor: publishName.trim() ? 'rgba(168,85,247,0.3)' : 'rgba(100,100,100,0.2)',
                border: `1px solid ${publishName.trim() ? 'rgba(168,85,247,0.5)' : 'rgba(100,100,100,0.4)'}`,
                borderRadius: '8px',
                color: publishName.trim() ? '#c084fc' : '#666',
                fontSize: '12px',
                fontWeight: 600,
                cursor: publishName.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              📤 Publish Layout
            </button>

            {/* Generated Code Display */}
            {generatedCode && (
              <div style={{
                padding: '12px',
                backgroundColor: 'rgba(0,255,0,0.1)',
                border: '1px solid rgba(0,255,0,0.3)',
                borderRadius: '8px',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}>
                  <span style={{ color: '#00ff00', fontSize: '11px', fontWeight: 600 }}>
                    ✓ Published! Share code:
                  </span>
                  <button
                    onClick={() => handleCopyCode(generatedCode)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: 'rgba(0,255,0,0.2)',
                      border: '1px solid rgba(0,255,0,0.4)',
                      borderRadius: '4px',
                      color: '#00ff00',
                      fontSize: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    {copySuccess ? '✓' : 'Copy'}
                  </button>
                </div>
                <div style={{
                  padding: '8px',
                  backgroundColor: '#1a1a1a',
                  borderRadius: '4px',
                  fontSize: '9px',
                  fontFamily: 'monospace',
                  color: '#888',
                  wordBreak: 'break-all',
                  maxHeight: '60px',
                  overflow: 'auto',
                }}>
                  {generatedCode.slice(0, 100)}...
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
