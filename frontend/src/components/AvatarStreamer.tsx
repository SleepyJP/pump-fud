import { useEffect, useRef, useState, useCallback } from 'react'
import { FaceMesh } from '@mediapipe/face_mesh'
import type { Results as FaceMeshResults } from '@mediapipe/face_mesh'
import { Camera } from '@mediapipe/camera_utils'
import { SelfieSegmentation } from '@mediapipe/selfie_segmentation'
import type { Results as SegmentationResults } from '@mediapipe/selfie_segmentation'

interface AvatarStreamerProps {
  tokenImage?: string
  tokenSymbol?: string
  themeColor: string
  onStreamReady?: (stream: MediaStream) => void
}

// Predefined avatar styles
const AVATAR_STYLES = [
  { id: 'pepe', name: 'Pepe', emoji: '🐸', color: '#4ade80' },
  { id: 'doge', name: 'Doge', emoji: '🐕', color: '#f59e0b' },
  { id: 'wojak', name: 'Wojak', emoji: '😢', color: '#60a5fa' },
  { id: 'chad', name: 'Chad', emoji: '💪', color: '#a855f7' },
  { id: 'custom', name: 'Token', emoji: '🪙', color: '#ffd700' },
]

const BACKGROUNDS = [
  { id: 'none', name: 'Webcam', preview: '📷' },
  { id: 'blur', name: 'Blur', preview: '🌫️' },
  { id: 'matrix', name: 'Matrix', preview: '💚' },
  { id: 'space', name: 'Space', preview: '🌌' },
  { id: 'moon', name: 'Moon', preview: '🌙' },
  { id: 'city', name: 'Neon City', preview: '🌃' },
]

const VOICE_PRESETS = [
  { id: 'normal', name: 'Normal', pitch: 1, formant: 0 },
  { id: 'deep', name: 'Deep', pitch: 0.7, formant: -0.3 },
  { id: 'high', name: 'High', pitch: 1.4, formant: 0.3 },
  { id: 'robot', name: 'Robot', pitch: 1, formant: 0, robot: true },
  { id: 'anonymous', name: 'Anonymous', pitch: 0.85, formant: -0.15, distort: true },
]

export function AvatarStreamer({
  tokenImage,
  themeColor,
  onStreamReady,
}: AvatarStreamerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const outputCanvasRef = useRef<HTMLCanvasElement>(null)
  const faceMeshRef = useRef<FaceMesh | null>(null)
  const segmentationRef = useRef<SelfieSegmentation | null>(null)
  const cameraRef = useRef<Camera | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  // const pitchShifterRef = useRef<AudioWorkletNode | null>(null)

  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState('pepe')
  const [selectedBackground, setSelectedBackground] = useState('blur')
  const [selectedVoice, setSelectedVoice] = useState('normal')
  const [micEnabled, setMicEnabled] = useState(true)
  const [faceData, setFaceData] = useState<{
    mouthOpen: number
    eyeLeft: number
    eyeRight: number
    headRotation: { x: number; y: number; z: number }
  } | null>(null)
  const [segmentationMask, setSegmentationMask] = useState<ImageData | null>(null)

  // Initialize face mesh
  const initFaceMesh = useCallback(async () => {
    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    })

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })

    faceMesh.onResults((results: FaceMeshResults) => {
      if (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) {
        const landmarks = results.multiFaceLandmarks[0]

        // Calculate mouth openness (distance between upper and lower lip)
        const upperLip = landmarks[13]
        const lowerLip = landmarks[14]
        const mouthOpen = Math.min(1, Math.abs(upperLip.y - lowerLip.y) * 10)

        // Calculate eye openness
        const leftEyeTop = landmarks[159]
        const leftEyeBottom = landmarks[145]
        const rightEyeTop = landmarks[386]
        const rightEyeBottom = landmarks[374]
        const eyeLeft = Math.min(1, Math.abs(leftEyeTop.y - leftEyeBottom.y) * 20)
        const eyeRight = Math.min(1, Math.abs(rightEyeTop.y - rightEyeBottom.y) * 20)

        // Calculate head rotation
        const nose = landmarks[1]
        const leftCheek = landmarks[234]
        const rightCheek = landmarks[454]
        // const forehead = landmarks[10]
        // const chin = landmarks[152]

        const headRotation = {
          x: (nose.y - 0.5) * 2, // Pitch (up/down)
          y: (nose.x - 0.5) * -2, // Yaw (left/right)
          z: Math.atan2(rightCheek.y - leftCheek.y, rightCheek.x - leftCheek.x), // Roll
        }

        setFaceData({
          mouthOpen,
          eyeLeft,
          eyeRight,
          headRotation,
        })
      }
    })

    faceMeshRef.current = faceMesh
    return faceMesh
  }, [])

  // Initialize selfie segmentation for background removal
  const initSegmentation = useCallback(async () => {
    const segmentation = new SelfieSegmentation({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
    })

    segmentation.setOptions({
      modelSelection: 1, // 0 = general, 1 = landscape (better for streaming)
      selfieMode: true,
    })

    segmentation.onResults((results: SegmentationResults) => {
      if (results.segmentationMask) {
        const canvas = document.createElement('canvas')
        canvas.width = results.segmentationMask.width
        canvas.height = results.segmentationMask.height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(results.segmentationMask, 0, 0)
          setSegmentationMask(ctx.getImageData(0, 0, canvas.width, canvas.height))
        }
      }
    })

    segmentationRef.current = segmentation
    return segmentation
  }, [])

  // Initialize voice modulation
  const initVoiceModulation = useCallback(async (stream: MediaStream) => {
    const audioContext = new AudioContext()
    audioContextRef.current = audioContext

    const source = audioContext.createMediaStreamSource(stream)
    sourceNodeRef.current = source

    const gainNode = audioContext.createGain()
    gainNodeRef.current = gainNode
    gainNode.gain.value = 1

    // Create pitch shifter using oscillator-based approach
    const pitchPreset = VOICE_PRESETS.find((v) => v.id === selectedVoice) || VOICE_PRESETS[0]

    // Simple pitch shifting using playback rate manipulation
    // For production, you'd use a proper pitch shifting algorithm
    const biquadFilter = audioContext.createBiquadFilter()
    biquadFilter.type = 'lowshelf'
    biquadFilter.frequency.value = 500
    biquadFilter.gain.value = pitchPreset.formant * 10

    // Connect nodes
    source.connect(biquadFilter)
    biquadFilter.connect(gainNode)

    // Create destination stream
    const destination = audioContext.createMediaStreamDestination()
    gainNode.connect(destination)

    return destination.stream
  }, [selectedVoice])

  // Render avatar on canvas
  const renderAvatar = useCallback(() => {
    const canvas = outputCanvasRef.current
    const videoCanvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw background
    if (selectedBackground === 'none') {
      // Draw original video
      ctx.drawImage(video, 0, 0, width, height)
    } else if (selectedBackground === 'blur') {
      // Draw blurred video as background
      ctx.filter = 'blur(20px)'
      ctx.drawImage(video, -20, -20, width + 40, height + 40)
      ctx.filter = 'none'

      // Draw person (with segmentation mask)
      if (segmentationMask && videoCanvas) {
        const videoCtx = videoCanvas.getContext('2d')
        if (videoCtx) {
          videoCtx.drawImage(video, 0, 0, videoCanvas.width, videoCanvas.height)
          const videoData = videoCtx.getImageData(0, 0, videoCanvas.width, videoCanvas.height)

          // Apply segmentation mask
          for (let i = 0; i < segmentationMask.data.length; i += 4) {
            const mask = segmentationMask.data[i] / 255
            if (mask < 0.5) {
              videoData.data[i + 3] = 0 // Make background transparent
            }
          }

          videoCtx.putImageData(videoData, 0, 0)
          ctx.drawImage(videoCanvas, 0, 0, width, height)
        }
      }
    } else {
      // Draw animated backgrounds
      drawAnimatedBackground(ctx, width, height, selectedBackground)

      // Draw person silhouette if segmentation available
      if (segmentationMask && videoCanvas) {
        const videoCtx = videoCanvas.getContext('2d')
        if (videoCtx) {
          videoCtx.drawImage(video, 0, 0, videoCanvas.width, videoCanvas.height)
          const videoData = videoCtx.getImageData(0, 0, videoCanvas.width, videoCanvas.height)

          for (let i = 0; i < segmentationMask.data.length; i += 4) {
            const mask = segmentationMask.data[i] / 255
            if (mask < 0.5) {
              videoData.data[i + 3] = 0
            }
          }

          videoCtx.putImageData(videoData, 0, 0)
          ctx.drawImage(videoCanvas, 0, 0, width, height)
        }
      }
    }

    // Draw avatar overlay
    if (faceData && selectedAvatar !== 'none') {
      drawAvatar(ctx, width, height, faceData, selectedAvatar, tokenImage)
    }

    requestAnimationFrame(renderAvatar)
  }, [faceData, selectedAvatar, selectedBackground, segmentationMask, tokenImage])

  // Draw animated backgrounds
  const drawAnimatedBackground = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    bgType: string
  ) => {
    const time = Date.now() / 1000

    switch (bgType) {
      case 'matrix':
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, width, height)
        ctx.fillStyle = '#0f0'
        ctx.font = '14px monospace'
        for (let i = 0; i < 50; i++) {
          const x = (i * 20) % width
          const y = ((time * 100 + i * 50) % (height + 200)) - 100
          const char = String.fromCharCode(0x30a0 + Math.random() * 96)
          ctx.globalAlpha = Math.random() * 0.5 + 0.5
          ctx.fillText(char, x, y)
        }
        ctx.globalAlpha = 1
        break

      case 'space':
        const gradient = ctx.createLinearGradient(0, 0, 0, height)
        gradient.addColorStop(0, '#0a0a20')
        gradient.addColorStop(1, '#1a0a30')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, width, height)
        // Stars
        ctx.fillStyle = '#fff'
        for (let i = 0; i < 100; i++) {
          const x = (Math.sin(i * 0.1 + time * 0.1) * 0.5 + 0.5) * width
          const y = (Math.cos(i * 0.15 + time * 0.05) * 0.5 + 0.5) * height
          const size = Math.sin(time + i) * 1 + 2
          ctx.beginPath()
          ctx.arc(x, y, size, 0, Math.PI * 2)
          ctx.fill()
        }
        break

      case 'moon':
        ctx.fillStyle = '#1a1a2e'
        ctx.fillRect(0, 0, width, height)
        // Moon
        ctx.fillStyle = '#ffd700'
        ctx.beginPath()
        ctx.arc(width * 0.8, height * 0.2, 60, 0, Math.PI * 2)
        ctx.fill()
        // Glow
        const moonGlow = ctx.createRadialGradient(
          width * 0.8,
          height * 0.2,
          60,
          width * 0.8,
          height * 0.2,
          150
        )
        moonGlow.addColorStop(0, 'rgba(255,215,0,0.3)')
        moonGlow.addColorStop(1, 'transparent')
        ctx.fillStyle = moonGlow
        ctx.fillRect(0, 0, width, height)
        break

      case 'city':
        ctx.fillStyle = '#0a0a15'
        ctx.fillRect(0, 0, width, height)
        // Neon buildings
        for (let i = 0; i < 20; i++) {
          const bx = i * (width / 20)
          const bh = Math.random() * height * 0.6 + height * 0.2
          const hue = (i * 20 + time * 50) % 360
          ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.3)`
          ctx.fillRect(bx, height - bh, width / 20 - 5, bh)
          // Windows
          ctx.fillStyle = `hsla(${hue}, 100%, 70%, 0.8)`
          for (let w = 0; w < 5; w++) {
            for (let h = 0; h < bh / 30; h++) {
              if (Math.random() > 0.3) {
                ctx.fillRect(bx + 5 + w * 8, height - bh + 10 + h * 30, 5, 15)
              }
            }
          }
        }
        break
    }
  }

  // Draw avatar based on face data
  const drawAvatar = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    face: typeof faceData,
    avatarType: string,
    customImage?: string
  ) => {
    if (!face) return

    const centerX = width / 2 + face.headRotation.y * 100
    const centerY = height / 2 + face.headRotation.x * 50
    const scale = 200

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(face.headRotation.z * 0.5)

    // Draw avatar based on type
    switch (avatarType) {
      case 'pepe':
        drawPepeAvatar(ctx, scale, face)
        break
      case 'doge':
        drawDogeAvatar(ctx, scale, face)
        break
      case 'wojak':
        drawWojakAvatar(ctx, scale, face)
        break
      case 'chad':
        drawChadAvatar(ctx, scale, face)
        break
      case 'custom':
        if (customImage) {
          drawCustomAvatar(ctx, scale, face, customImage)
        } else {
          drawPepeAvatar(ctx, scale, face)
        }
        break
    }

    ctx.restore()
  }

  // Pepe avatar
  const drawPepeAvatar = (
    ctx: CanvasRenderingContext2D,
    scale: number,
    face: NonNullable<typeof faceData>
  ) => {
    // Head
    ctx.fillStyle = '#4ade80'
    ctx.beginPath()
    ctx.ellipse(0, 0, scale * 0.8, scale * 0.9, 0, 0, Math.PI * 2)
    ctx.fill()

    // Eyes
    const eyeOffset = scale * 0.25
    const eyeY = -scale * 0.1

    // Left eye
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.ellipse(-eyeOffset, eyeY, scale * 0.2, scale * 0.15 * face.eyeLeft, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.arc(-eyeOffset, eyeY, scale * 0.08, 0, Math.PI * 2)
    ctx.fill()

    // Right eye
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.ellipse(eyeOffset, eyeY, scale * 0.2, scale * 0.15 * face.eyeRight, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.arc(eyeOffset, eyeY, scale * 0.08, 0, Math.PI * 2)
    ctx.fill()

    // Mouth
    ctx.fillStyle = '#2d5a3d'
    ctx.beginPath()
    const mouthY = scale * 0.4
    const mouthWidth = scale * 0.4
    const mouthHeight = scale * 0.1 + face.mouthOpen * scale * 0.3
    ctx.ellipse(0, mouthY, mouthWidth, mouthHeight, 0, 0, Math.PI * 2)
    ctx.fill()

    // Lips outline
    ctx.strokeStyle = '#1a3d26'
    ctx.lineWidth = 3
    ctx.stroke()
  }

  // Doge avatar
  const drawDogeAvatar = (
    ctx: CanvasRenderingContext2D,
    scale: number,
    face: NonNullable<typeof faceData>
  ) => {
    // Head
    ctx.fillStyle = '#f59e0b'
    ctx.beginPath()
    ctx.ellipse(0, 0, scale * 0.75, scale * 0.85, 0, 0, Math.PI * 2)
    ctx.fill()

    // Ears
    ctx.fillStyle = '#d97706'
    ctx.beginPath()
    ctx.moveTo(-scale * 0.5, -scale * 0.6)
    ctx.lineTo(-scale * 0.7, -scale * 1.1)
    ctx.lineTo(-scale * 0.3, -scale * 0.7)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(scale * 0.5, -scale * 0.6)
    ctx.lineTo(scale * 0.7, -scale * 1.1)
    ctx.lineTo(scale * 0.3, -scale * 0.7)
    ctx.fill()

    // Snout
    ctx.fillStyle = '#fbbf24'
    ctx.beginPath()
    ctx.ellipse(0, scale * 0.2, scale * 0.35, scale * 0.3, 0, 0, Math.PI * 2)
    ctx.fill()

    // Eyes
    const eyeY = -scale * 0.15
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.ellipse(-scale * 0.25, eyeY, scale * 0.1, scale * 0.12 * face.eyeLeft, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(scale * 0.25, eyeY, scale * 0.1, scale * 0.12 * face.eyeRight, 0, 0, Math.PI * 2)
    ctx.fill()

    // Nose
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.arc(0, scale * 0.15, scale * 0.1, 0, Math.PI * 2)
    ctx.fill()

    // Mouth
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(-scale * 0.15, scale * 0.35)
    ctx.quadraticCurveTo(0, scale * 0.35 + face.mouthOpen * scale * 0.2, scale * 0.15, scale * 0.35)
    ctx.stroke()

    // Tongue (when mouth open)
    if (face.mouthOpen > 0.3) {
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.ellipse(0, scale * 0.45, scale * 0.1, scale * 0.15 * face.mouthOpen, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Wojak avatar
  const drawWojakAvatar = (
    ctx: CanvasRenderingContext2D,
    scale: number,
    face: NonNullable<typeof faceData>
  ) => {
    // Head
    ctx.fillStyle = '#fef3c7'
    ctx.beginPath()
    ctx.ellipse(0, 0, scale * 0.7, scale * 0.9, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.stroke()

    // Hair
    ctx.fillStyle = '#92400e'
    ctx.beginPath()
    ctx.arc(0, -scale * 0.5, scale * 0.6, Math.PI, 0)
    ctx.fill()

    // Eyes (sad)
    const eyeY = -scale * 0.1
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2

    // Left eye
    ctx.beginPath()
    ctx.moveTo(-scale * 0.35, eyeY - scale * 0.1)
    ctx.lineTo(-scale * 0.15, eyeY + scale * 0.05 * (1 - face.eyeLeft))
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(-scale * 0.25, eyeY + scale * 0.05, scale * 0.03, 0, Math.PI * 2)
    ctx.fill()

    // Right eye
    ctx.beginPath()
    ctx.moveTo(scale * 0.35, eyeY - scale * 0.1)
    ctx.lineTo(scale * 0.15, eyeY + scale * 0.05 * (1 - face.eyeRight))
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(scale * 0.25, eyeY + scale * 0.05, scale * 0.03, 0, Math.PI * 2)
    ctx.fill()

    // Mouth (sad)
    ctx.beginPath()
    ctx.moveTo(-scale * 0.2, scale * 0.35)
    ctx.quadraticCurveTo(0, scale * 0.25 - face.mouthOpen * scale * 0.1, scale * 0.2, scale * 0.35)
    ctx.stroke()

    // Tears (when mouth very open = crying)
    if (face.mouthOpen > 0.5) {
      ctx.fillStyle = '#60a5fa'
      ctx.beginPath()
      ctx.ellipse(-scale * 0.25, scale * 0.1, scale * 0.03, scale * 0.08, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(scale * 0.25, scale * 0.1, scale * 0.03, scale * 0.08, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Chad avatar
  const drawChadAvatar = (
    ctx: CanvasRenderingContext2D,
    scale: number,
    face: NonNullable<typeof faceData>
  ) => {
    // Head (more angular)
    ctx.fillStyle = '#fde68a'
    ctx.beginPath()
    ctx.moveTo(-scale * 0.6, -scale * 0.5)
    ctx.lineTo(-scale * 0.7, scale * 0.2)
    ctx.lineTo(-scale * 0.4, scale * 0.7)
    ctx.lineTo(scale * 0.4, scale * 0.7)
    ctx.lineTo(scale * 0.7, scale * 0.2)
    ctx.lineTo(scale * 0.6, -scale * 0.5)
    ctx.closePath()
    ctx.fill()

    // Hair
    ctx.fillStyle = '#78350f'
    ctx.beginPath()
    ctx.moveTo(-scale * 0.6, -scale * 0.5)
    ctx.lineTo(-scale * 0.5, -scale * 0.9)
    ctx.lineTo(0, -scale * 0.7)
    ctx.lineTo(scale * 0.5, -scale * 0.9)
    ctx.lineTo(scale * 0.6, -scale * 0.5)
    ctx.closePath()
    ctx.fill()

    // Beard
    ctx.fillStyle = '#78350f'
    ctx.beginPath()
    ctx.moveTo(-scale * 0.5, scale * 0.3)
    ctx.lineTo(-scale * 0.4, scale * 0.8)
    ctx.lineTo(0, scale * 0.9)
    ctx.lineTo(scale * 0.4, scale * 0.8)
    ctx.lineTo(scale * 0.5, scale * 0.3)
    ctx.closePath()
    ctx.fill()

    // Eyes (confident)
    const eyeY = -scale * 0.1
    ctx.fillStyle = '#1e40af'
    ctx.beginPath()
    ctx.ellipse(-scale * 0.25, eyeY, scale * 0.08, scale * 0.1 * face.eyeLeft, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(scale * 0.25, eyeY, scale * 0.08, scale * 0.1 * face.eyeRight, 0, 0, Math.PI * 2)
    ctx.fill()

    // Eyebrows (determined)
    ctx.strokeStyle = '#78350f'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(-scale * 0.4, eyeY - scale * 0.15)
    ctx.lineTo(-scale * 0.1, eyeY - scale * 0.2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(scale * 0.4, eyeY - scale * 0.15)
    ctx.lineTo(scale * 0.1, eyeY - scale * 0.2)
    ctx.stroke()

    // Mouth (smirk)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(-scale * 0.15, scale * 0.35)
    ctx.quadraticCurveTo(
      scale * 0.1,
      scale * 0.4 + face.mouthOpen * scale * 0.15,
      scale * 0.25,
      scale * 0.3
    )
    ctx.stroke()
  }

  // Custom avatar using token image
  const drawCustomAvatar = (
    ctx: CanvasRenderingContext2D,
    scale: number,
    face: NonNullable<typeof faceData>,
    imageUrl: string
  ) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imageUrl

    // Draw circular mask with image
    ctx.save()
    ctx.beginPath()
    ctx.arc(0, 0, scale * 0.8, 0, Math.PI * 2)
    ctx.clip()

    // Scale based on expression
    const expressionScale = 1 + face.mouthOpen * 0.1
    ctx.scale(expressionScale, expressionScale)

    if (img.complete) {
      ctx.drawImage(img, -scale * 0.8, -scale * 0.8, scale * 1.6, scale * 1.6)
    } else {
      // Fallback while loading
      ctx.fillStyle = themeColor
      ctx.fillRect(-scale * 0.8, -scale * 0.8, scale * 1.6, scale * 1.6)
    }

    ctx.restore()

    // Add expression overlays
    // Mouth animation
    if (face.mouthOpen > 0.2) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.beginPath()
      ctx.ellipse(0, scale * 0.3, scale * 0.2, scale * 0.1 + face.mouthOpen * scale * 0.2, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    // Eye blink effect
    if (face.eyeLeft < 0.3 || face.eyeRight < 0.3) {
      ctx.strokeStyle = themeColor
      ctx.lineWidth = 4
      if (face.eyeLeft < 0.3) {
        ctx.beginPath()
        ctx.moveTo(-scale * 0.35, -scale * 0.1)
        ctx.lineTo(-scale * 0.15, -scale * 0.1)
        ctx.stroke()
      }
      if (face.eyeRight < 0.3) {
        ctx.beginPath()
        ctx.moveTo(scale * 0.15, -scale * 0.1)
        ctx.lineTo(scale * 0.35, -scale * 0.1)
        ctx.stroke()
      }
    }
  }

  // Start streaming
  const startStream = async () => {
    setIsLoading(true)
    try {
      // Get webcam stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: micEnabled,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      // Initialize face mesh
      await initFaceMesh()

      // Initialize segmentation
      await initSegmentation()

      // Setup camera processing
      if (videoRef.current) {
        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (faceMeshRef.current && videoRef.current) {
              await faceMeshRef.current.send({ image: videoRef.current })
            }
            if (segmentationRef.current && videoRef.current) {
              await segmentationRef.current.send({ image: videoRef.current })
            }
          },
          width: 1280,
          height: 720,
        })
        cameraRef.current = camera
        await camera.start()
      }

      // Start rendering
      renderAvatar()

      // Setup audio if mic enabled
      if (micEnabled) {
        const processedAudio = await initVoiceModulation(stream)

        // Create combined stream
        const outputCanvas = outputCanvasRef.current
        if (outputCanvas) {
          const videoStream = outputCanvas.captureStream(30)
          const combinedStream = new MediaStream([
            ...videoStream.getVideoTracks(),
            ...processedAudio.getAudioTracks(),
          ])

          if (onStreamReady) {
            onStreamReady(combinedStream)
          }
        }
      }

      setIsStreaming(true)
    } catch (error) {
      console.error('Failed to start stream:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Stop streaming
  const stopStream = () => {
    if (cameraRef.current) {
      cameraRef.current.stop()
    }

    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
    }

    setIsStreaming(false)
    setFaceData(null)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream()
    }
  }, [])

  return (
    <div
      style={{
        background: 'linear-gradient(145deg, rgba(17,17,20,0.95) 0%, rgba(10,10,12,0.98) 100%)',
        border: `1px solid ${themeColor}20`,
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${themeColor}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>🎭</span>
          <h3
            style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '14px',
              color: themeColor,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Avatar Streamer
          </h3>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            backgroundColor: isStreaming ? 'rgba(220,20,60,0.2)' : 'rgba(0,0,0,0.3)',
            borderRadius: '4px',
            border: `1px solid ${isStreaming ? 'rgba(220,20,60,0.4)' : 'transparent'}`,
          }}
        >
          {isStreaming && (
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#dc143c',
                animation: 'pulse 2s infinite',
              }}
            />
          )}
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '11px',
              color: isStreaming ? '#dc143c' : '#888',
            }}
          >
            {isStreaming ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Preview Area */}
      <div style={{ position: 'relative', backgroundColor: '#000' }}>
        {/* Hidden video element for capture */}
        <video
          ref={videoRef}
          style={{ display: 'none' }}
          playsInline
          muted
        />

        {/* Hidden canvas for processing */}
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          style={{ display: 'none' }}
        />

        {/* Output canvas */}
        <canvas
          ref={outputCanvasRef}
          width={1280}
          height={720}
          style={{
            width: '100%',
            height: 'auto',
            aspectRatio: '16/9',
          }}
        />

        {/* Placeholder when not streaming */}
        {!isStreaming && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.8)',
            }}
          >
            <span style={{ fontSize: '64px', marginBottom: '16px' }}>🎭</span>
            <p
              style={{
                fontFamily: 'Cinzel, serif',
                fontSize: '16px',
                color: '#888',
                textAlign: 'center',
              }}
            >
              Stream as your avatar
              <br />
              <span style={{ fontSize: '12px', color: '#666' }}>
                Stay anonymous while engaging with your community
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ padding: '16px 20px' }}>
        {/* Avatar Selection */}
        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'block',
              fontFamily: 'Cinzel, serif',
              fontSize: '11px',
              color: '#888',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            Avatar Style
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {AVATAR_STYLES.map((avatar) => (
              <button
                key={avatar.id}
                onClick={() => setSelectedAvatar(avatar.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor:
                    selectedAvatar === avatar.id ? `${avatar.color}20` : 'rgba(0,0,0,0.3)',
                  border: `1px solid ${selectedAvatar === avatar.id ? avatar.color : 'rgba(255,255,255,0.1)'}`,
                  color: selectedAvatar === avatar.id ? avatar.color : '#888',
                  fontFamily: 'Cinzel, serif',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{avatar.emoji}</span>
                <span>{avatar.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Background Selection */}
        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'block',
              fontFamily: 'Cinzel, serif',
              fontSize: '11px',
              color: '#888',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            Background
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {BACKGROUNDS.map((bg) => (
              <button
                key={bg.id}
                onClick={() => setSelectedBackground(bg.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor:
                    selectedBackground === bg.id ? `${themeColor}20` : 'rgba(0,0,0,0.3)',
                  border: `1px solid ${selectedBackground === bg.id ? themeColor : 'rgba(255,255,255,0.1)'}`,
                  color: selectedBackground === bg.id ? themeColor : '#888',
                  fontFamily: 'Cinzel, serif',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{bg.preview}</span>
                <span>{bg.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Voice Selection */}
        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'block',
              fontFamily: 'Cinzel, serif',
              fontSize: '11px',
              color: '#888',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            Voice Modulation
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {VOICE_PRESETS.map((voice) => (
              <button
                key={voice.id}
                onClick={() => setSelectedVoice(voice.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor:
                    selectedVoice === voice.id ? `${themeColor}20` : 'rgba(0,0,0,0.3)',
                  border: `1px solid ${selectedVoice === voice.id ? themeColor : 'rgba(255,255,255,0.1)'}`,
                  color: selectedVoice === voice.id ? themeColor : '#888',
                  fontFamily: 'Cinzel, serif',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                {voice.name}
              </button>
            ))}
          </div>
        </div>

        {/* Mic Toggle */}
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={() => setMicEnabled(!micEnabled)}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              backgroundColor: micEnabled ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
              border: `1px solid ${micEnabled ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
              color: micEnabled ? '#22c55e' : '#ef4444',
              fontFamily: 'Cinzel, serif',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>{micEnabled ? '🎤' : '🔇'}</span>
            <span>{micEnabled ? 'Microphone On' : 'Microphone Off'}</span>
          </button>
        </div>

        {/* Start/Stop Button */}
        <button
          onClick={isStreaming ? stopStream : startStream}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '12px',
            background: isLoading
              ? 'linear-gradient(135deg, #333 0%, #222 100%)'
              : isStreaming
                ? 'linear-gradient(135deg, #991b1b 0%, #ef4444 100%)'
                : `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}cc 100%)`,
            border: 'none',
            color: '#fff',
            fontFamily: 'Cinzel, serif',
            fontWeight: 700,
            fontSize: '14px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: isLoading ? 'wait' : 'pointer',
            boxShadow: isStreaming
              ? '0 0 30px rgba(239,68,68,0.3)'
              : `0 0 30px ${themeColor}40`,
          }}
        >
          {isLoading ? '⏳ Initializing...' : isStreaming ? '⏹️ Stop Streaming' : '🎬 Start Avatar Stream'}
        </button>

        {/* Info */}
        <p
          style={{
            marginTop: '12px',
            fontSize: '11px',
            color: '#666',
            textAlign: 'center',
          }}
        >
          Your webcam tracks your face movements to animate the avatar.
          <br />
          Your real face is never shown or recorded.
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
