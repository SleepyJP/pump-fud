import { useState, useRef } from 'react'
import type { FrameConfig } from '../../hooks/useCustomFrames'

interface FrameSelectorProps {
  frames: FrameConfig[]
  selectedFrameId: string | null
  onSelect: (frameId: string | null) => void
  onAddFrame?: (frame: Omit<FrameConfig, 'id'>) => void
  boxId: string
}

export function FrameSelector({
  frames,
  selectedFrameId,
  onSelect,
  onAddFrame,
  boxId,
}: FrameSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !onAddFrame) return

    // Convert to base64 for localStorage storage
    const reader = new FileReader()
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string
      onAddFrame({
        name: uploadName || file.name.replace(/\.[^/.]+$/, ''),
        imageUrl,
        borderWidth: 10,
        borderRadius: 12,
        glowColor: '#00ff00',
        glowIntensity: 0.4,
      })
      setShowUpload(false)
      setUploadName('')

      // RALPH RL-005 VALIDATION
      console.log('[RALPH RL-005] Custom frame uploaded:', {
        boxId,
        fileName: file.name,
        fileSize: file.size,
      })
    }
    reader.readAsDataURL(file)
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          padding: '4px 8px',
          backgroundColor: 'rgba(0,255,0,0.1)',
          border: '1px solid rgba(0,255,0,0.3)',
          borderRadius: '4px',
          color: '#00ff00',
          fontSize: '10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
        title="Customize frame"
      >
        <span>🎨</span>
      </button>
    )
  }

  return (
    <div style={{
      position: 'absolute',
      top: '100%',
      right: 0,
      marginTop: '8px',
      backgroundColor: 'rgba(26,26,26,0.98)',
      border: '1px solid rgba(0,255,0,0.3)',
      borderRadius: '8px',
      padding: '12px',
      zIndex: 1000,
      minWidth: '200px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
      }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>
          Select Frame
        </span>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Frame Options */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px',
        marginBottom: '12px',
      }}>
        {/* No Frame Option */}
        <button
          onClick={() => {
            onSelect(null)
            setIsOpen(false)
          }}
          style={{
            padding: '8px',
            backgroundColor: selectedFrameId === null ? 'rgba(0,255,0,0.2)' : 'rgba(40,40,40,0.8)',
            border: `1px solid ${selectedFrameId === null ? '#00ff00' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '6px',
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '20px', marginBottom: '4px' }}>⬜</div>
          <div style={{ fontSize: '10px', color: '#888' }}>None</div>
        </button>

        {/* Available Frames */}
        {frames.map(frame => (
          <button
            key={frame.id}
            onClick={() => {
              onSelect(frame.id)
              setIsOpen(false)
            }}
            style={{
              padding: '8px',
              backgroundColor: selectedFrameId === frame.id ? 'rgba(0,255,0,0.2)' : 'rgba(40,40,40,0.8)',
              border: `1px solid ${selectedFrameId === frame.id ? '#00ff00' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '6px',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              margin: '0 auto 4px',
              borderRadius: '4px',
              border: `2px solid ${frame.glowColor || '#00ff00'}`,
              boxShadow: `0 0 8px ${frame.glowColor || '#00ff00'}`,
              backgroundColor: '#1a1a1a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {frame.imageUrl.startsWith('data:') ? (
                <img
                  src={frame.imageUrl}
                  alt={frame.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '2px',
                  }}
                />
              ) : (
                <span style={{ fontSize: '16px' }}>🖼️</span>
              )}
            </div>
            <div style={{ fontSize: '10px', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {frame.name}
            </div>
          </button>
        ))}
      </div>

      {/* Upload Custom Frame */}
      {onAddFrame && (
        <>
          {showUpload ? (
            <div style={{
              padding: '8px',
              backgroundColor: 'rgba(0,0,0,0.4)',
              borderRadius: '6px',
            }}>
              <input
                type="text"
                placeholder="Frame name"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  backgroundColor: '#252525',
                  border: '1px solid rgba(0,255,0,0.2)',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '11px',
                  marginBottom: '8px',
                  boxSizing: 'border-box',
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    backgroundColor: 'rgba(0,255,0,0.2)',
                    border: '1px solid rgba(0,255,0,0.4)',
                    borderRadius: '4px',
                    color: '#00ff00',
                    fontSize: '10px',
                    cursor: 'pointer',
                  }}
                >
                  Choose Image
                </button>
                <button
                  onClick={() => setShowUpload(false)}
                  style={{
                    padding: '6px 8px',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '4px',
                    color: '#888',
                    fontSize: '10px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowUpload(true)}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: 'rgba(168,85,247,0.1)',
                border: '1px dashed rgba(168,85,247,0.4)',
                borderRadius: '6px',
                color: '#c084fc',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <span>📤</span> Upload Custom Frame
            </button>
          )}
        </>
      )}
    </div>
  )
}
