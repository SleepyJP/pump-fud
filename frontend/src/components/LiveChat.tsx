import { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'

interface ChatMessage {
  id: string
  address: string
  message: string
  timestamp: number
  isSuperChat?: boolean
  superChatAmount?: number
  superChatColor?: string
}

interface LiveChatProps {
  tokenSymbol: string
  holderPercentage: number
  primaryColor: string
  secondaryColor: string
}

const DEMO_MESSAGES: ChatMessage[] = [
  { id: '1', address: '0x49bb...086B', message: 'LFG! This token is going to the moon', timestamp: Date.now() - 60000 },
  { id: '2', address: '0xdBDA...0B7', message: 'Diamond hands only', timestamp: Date.now() - 45000 },
  { id: '3', address: '0x4bD4...8fB', message: 'Just bought another bag', timestamp: Date.now() - 30000, isSuperChat: true, superChatAmount: 1000, superChatColor: '#22c55e' },
  { id: '4', address: '0x1234...5678', message: 'When DEX?', timestamp: Date.now() - 20000 },
  { id: '5', address: '0xabcd...efgh', message: 'WAGMI', timestamp: Date.now() - 10000 },
  { id: '6', address: '0x9876...4321', message: 'Best community ever', timestamp: Date.now() - 5000, isSuperChat: true, superChatAmount: 5000, superChatColor: '#a855f7' },
]

export function LiveChat({
  tokenSymbol,
  holderPercentage,
  primaryColor,
  secondaryColor,
}: LiveChatProps) {
  const { address, isConnected } = useAccount()
  const [messages, setMessages] = useState<ChatMessage[]>(DEMO_MESSAGES)
  const [newMessage, setNewMessage] = useState('')
  const [showSuperChat, setShowSuperChat] = useState(false)
  const [superChatAmount, setSuperChatAmount] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const canChat = holderPercentage >= 1
  const canSuperChat = holderPercentage >= 1

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Simulate incoming messages
  useEffect(() => {
    const interval = setInterval(() => {
      const randomMessages = [
        'Bullish!',
        'Great project',
        'To the moon!',
        'Holding strong',
        'Love this community',
        'WAGMI',
        'NFA but this is the one',
        'Who else is accumulating?',
      ]
      const randomAddresses = ['0x1111...2222', '0x3333...4444', '0x5555...6666', '0x7777...8888']

      const newMsg: ChatMessage = {
        id: Date.now().toString(),
        address: randomAddresses[Math.floor(Math.random() * randomAddresses.length)],
        message: randomMessages[Math.floor(Math.random() * randomMessages.length)],
        timestamp: Date.now(),
      }

      setMessages(prev => [...prev.slice(-50), newMsg])
    }, 8000)

    return () => clearInterval(interval)
  }, [])

  const handleSendMessage = () => {
    if (!newMessage.trim() || !canChat || !isConnected) return

    const msg: ChatMessage = {
      id: Date.now().toString(),
      address: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '0x????...????',
      message: newMessage,
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, msg])
    setNewMessage('')
  }

  const handleSendSuperChat = () => {
    if (!newMessage.trim() || !superChatAmount || !canSuperChat || !isConnected) return

    const amount = parseFloat(superChatAmount)
    let color = '#22c55e'
    if (amount >= 5000) color = '#a855f7'
    if (amount >= 10000) color = '#ffd700'

    const msg: ChatMessage = {
      id: Date.now().toString(),
      address: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '0x????...????',
      message: newMessage,
      timestamp: Date.now(),
      isSuperChat: true,
      superChatAmount: amount,
      superChatColor: color,
    }

    setMessages(prev => [...prev, msg])
    setNewMessage('')
    setSuperChatAmount('')
    setShowSuperChat(false)
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div
      style={{
        background: 'linear-gradient(145deg, rgba(17,17,20,0.95) 0%, rgba(10,10,12,0.98) 100%)',
        border: `1px solid rgba(139,92,246,0.2)`,
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        height: '500px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(139,92,246,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>💬</span>
          <h3
            style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '14px',
              color: primaryColor,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Live Chat
          </h3>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              animation: 'liveDot 2s ease-in-out infinite',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: '4px',
          }}
        >
          <span style={{ fontSize: '12px' }}>👥</span>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '11px',
              color: '#888',
            }}
          >
            {messages.length} msgs
          </span>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              padding: msg.isSuperChat ? '12px 14px' : '8px 12px',
              borderRadius: '8px',
              backgroundColor: msg.isSuperChat
                ? `${msg.superChatColor}15`
                : 'rgba(0,0,0,0.3)',
              border: msg.isSuperChat
                ? `1px solid ${msg.superChatColor}40`
                : '1px solid transparent',
              animation: msg.isSuperChat ? 'superChatGlow 2s ease-in-out' : 'none',
            }}
          >
            {msg.isSuperChat && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '6px',
                }}
              >
                <span style={{ fontSize: '14px' }}>✨</span>
                <span
                  style={{
                    fontFamily: 'Cinzel, serif',
                    fontSize: '11px',
                    color: msg.superChatColor,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  Super Chat - {msg.superChatAmount?.toLocaleString()} PLS
                </span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: msg.isSuperChat ? msg.superChatColor : secondaryColor,
                  flexShrink: 0,
                }}
              >
                {msg.address}
              </span>
              <span
                style={{
                  fontSize: '13px',
                  color: msg.isSuperChat ? '#fff' : '#e8e8e8',
                  flex: 1,
                  wordBreak: 'break-word',
                }}
              >
                {msg.message}
              </span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  color: '#555',
                  flexShrink: 0,
                }}
              >
                {formatTime(msg.timestamp)}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Super Chat Panel */}
      {showSuperChat && canSuperChat && (
        <div
          style={{
            padding: '16px',
            borderTop: '1px solid rgba(139,92,246,0.1)',
            background: 'linear-gradient(180deg, rgba(168,85,247,0.1) 0%, transparent 100%)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
            }}
          >
            <span style={{ fontSize: '16px' }}>✨</span>
            <span
              style={{
                fontFamily: 'Cinzel, serif',
                fontSize: '12px',
                color: '#a855f7',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              Send Super Chat
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {[500, 1000, 5000, 10000].map((amount) => (
              <button
                key={amount}
                onClick={() => setSuperChatAmount(amount.toString())}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  backgroundColor:
                    superChatAmount === amount.toString()
                      ? 'rgba(168,85,247,0.3)'
                      : 'rgba(0,0,0,0.3)',
                  border: `1px solid ${
                    superChatAmount === amount.toString() ? '#a855f7' : 'rgba(139,92,246,0.2)'
                  }`,
                  color: superChatAmount === amount.toString() ? '#a855f7' : '#888',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {amount >= 1000 ? `${amount / 1000}K` : amount}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={superChatAmount}
              onChange={(e) => setSuperChatAmount(e.target.value)}
              placeholder="Custom PLS"
              style={{
                width: '100px',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(139,92,246,0.2)',
                color: '#e8e8e8',
                fontFamily: 'monospace',
                fontSize: '12px',
                outline: 'none',
              }}
            />
            <button
              onClick={handleSendSuperChat}
              disabled={!superChatAmount || !newMessage.trim()}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '8px',
                background:
                  !superChatAmount || !newMessage.trim()
                    ? 'linear-gradient(135deg, #333 0%, #222 100%)'
                    : 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                border: 'none',
                color: '#fff',
                fontFamily: 'Cinzel, serif',
                fontWeight: 600,
                fontSize: '12px',
                letterSpacing: '0.05em',
                cursor: !superChatAmount || !newMessage.trim() ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
              }}
            >
              Send {superChatAmount ? `${superChatAmount} PLS` : ''}
            </button>
            <button
              onClick={() => setShowSuperChat(false)}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                backgroundColor: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444',
                fontFamily: 'Cinzel, serif',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(139,92,246,0.1)',
          display: 'flex',
          gap: '8px',
        }}
      >
        {canChat && isConnected ? (
          <>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !showSuperChat && handleSendMessage()}
              placeholder="Type a message..."
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(139,92,246,0.2)',
                color: '#e8e8e8',
                fontSize: '13px',
                outline: 'none',
                transition: 'all 0.2s ease',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = primaryColor
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(139,92,246,0.2)'
              }}
            />
            {canSuperChat && !showSuperChat && (
              <button
                onClick={() => setShowSuperChat(true)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(168,85,247,0.2)',
                  border: '1px solid rgba(168,85,247,0.4)',
                  color: '#a855f7',
                  fontSize: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title="Super Chat"
              >
                ✨
              </button>
            )}
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || showSuperChat}
              style={{
                padding: '12px 20px',
                borderRadius: '8px',
                background:
                  !newMessage.trim() || showSuperChat
                    ? 'linear-gradient(135deg, #333 0%, #222 100%)'
                    : `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                border: 'none',
                color: '#fff',
                fontFamily: 'Cinzel, serif',
                fontWeight: 600,
                fontSize: '12px',
                letterSpacing: '0.05em',
                cursor: !newMessage.trim() || showSuperChat ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
              }}
            >
              Send
            </button>
          </>
        ) : !isConnected ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px',
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
              border: '1px dashed rgba(139,92,246,0.2)',
            }}
          >
            <span
              style={{
                fontFamily: 'Cinzel, serif',
                fontSize: '12px',
                color: '#666',
              }}
            >
              Connect wallet to chat
            </span>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px',
              backgroundColor: 'rgba(139,69,19,0.15)',
              borderRadius: '8px',
              border: '1px solid rgba(139,69,19,0.3)',
            }}
          >
            <span style={{ fontSize: '14px' }}>🔒</span>
            <span
              style={{
                fontFamily: 'Cinzel, serif',
                fontSize: '12px',
                color: '#b8860b',
              }}
            >
              Hold 1%+ of {tokenSymbol} to chat
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes liveDot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes superChatGlow {
          0% { transform: scale(1); }
          10% { transform: scale(1.02); }
          20% { transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
