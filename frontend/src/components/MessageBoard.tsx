import { useState, useMemo } from 'react'
import { useAccount } from 'wagmi'

interface BoardMessage {
  id: string
  address: string
  message: string
  timestamp: number
  likes: number
  replies: BoardMessage[]
  isSuperChat?: boolean
  superChatAmount?: number
  superChatColor?: string
}

interface MessageBoardProps {
  tokenSymbol: string
  holderPercentage: number
  primaryColor: string
  secondaryColor: string
}

export function MessageBoard({
  tokenSymbol,
  holderPercentage,
  primaryColor,
  secondaryColor,
}: MessageBoardProps) {
  const { address, isConnected } = useAccount()
  const [messages, setMessages] = useState<BoardMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [showSuperChat, setShowSuperChat] = useState(false)
  const [superChatAmount, setSuperChatAmount] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent')

  const canPost = holderPercentage >= 0.5
  const canSuperChat = holderPercentage >= 0.5

  const sortedMessages = useMemo(() => {
    const sorted = [...messages]
    if (sortBy === 'popular') {
      sorted.sort((a, b) => b.likes - a.likes)
    } else {
      sorted.sort((a, b) => b.timestamp - a.timestamp)
    }
    return sorted
  }, [messages, sortBy])

  const handlePost = () => {
    if (!newMessage.trim() || !canPost || !isConnected) return

    const msg: BoardMessage = {
      id: Date.now().toString(),
      address: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '0x????...????',
      message: newMessage,
      timestamp: Date.now(),
      likes: 0,
      replies: [],
    }

    setMessages((prev) => [msg, ...prev])
    setNewMessage('')
  }

  const handleSuperChatPost = () => {
    if (!newMessage.trim() || !superChatAmount || !canSuperChat || !isConnected) return

    const amount = parseFloat(superChatAmount)
    let color = '#22c55e'
    if (amount >= 5000) color = '#a855f7'
    if (amount >= 10000) color = '#ffd700'

    const msg: BoardMessage = {
      id: Date.now().toString(),
      address: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '0x????...????',
      message: newMessage,
      timestamp: Date.now(),
      likes: 0,
      replies: [],
      isSuperChat: true,
      superChatAmount: amount,
      superChatColor: color,
    }

    setMessages((prev) => [msg, ...prev])
    setNewMessage('')
    setSuperChatAmount('')
    setShowSuperChat(false)
  }

  const handleReply = (parentId: string) => {
    if (!replyText.trim() || !canPost || !isConnected) return

    const reply: BoardMessage = {
      id: `${parentId}-${Date.now()}`,
      address: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '0x????...????',
      message: replyText,
      timestamp: Date.now(),
      likes: 0,
      replies: [],
    }

    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === parentId) {
          return { ...msg, replies: [...msg.replies, reply] }
        }
        return msg
      })
    )
    setReplyText('')
    setReplyingTo(null)
  }

  const handleLike = (messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId) {
          return { ...msg, likes: msg.likes + 1 }
        }
        if (msg.replies.some((r) => r.id === messageId)) {
          return {
            ...msg,
            replies: msg.replies.map((r) =>
              r.id === messageId ? { ...r, likes: r.likes + 1 } : r
            ),
          }
        }
        return msg
      })
    )
  }

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  const renderMessage = (msg: BoardMessage, isReply = false) => (
    <div
      key={msg.id}
      style={{
        padding: isReply ? '12px 16px' : '16px 20px',
        backgroundColor: msg.isSuperChat
          ? `${msg.superChatColor}10`
          : isReply
            ? 'rgba(0,0,0,0.2)'
            : 'rgba(0,0,0,0.3)',
        borderRadius: isReply ? '8px' : '12px',
        border: msg.isSuperChat
          ? `1px solid ${msg.superChatColor}40`
          : `1px solid ${primaryColor}15`,
        marginLeft: isReply ? '24px' : 0,
        marginTop: isReply ? '8px' : 0,
      }}
    >
      {msg.isSuperChat && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '10px',
            paddingBottom: '10px',
            borderBottom: `1px solid ${msg.superChatColor}30`,
          }}
        >
          <span style={{ fontSize: '16px' }}>✨</span>
          <span
            style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '12px',
              color: msg.superChatColor,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Super Chat - {msg.superChatAmount?.toLocaleString()} {tokenSymbol}
          </span>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '10px',
        }}
      >
        <div
          style={{
            width: isReply ? '28px' : '36px',
            height: isReply ? '28px' : '36px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isReply ? '12px' : '14px',
          }}
        >
          👤
        </div>
        <div>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: isReply ? '11px' : '12px',
              color: msg.isSuperChat ? msg.superChatColor : primaryColor,
              fontWeight: 600,
            }}
          >
            {msg.address}
          </span>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '10px',
              color: '#555',
              marginLeft: '10px',
            }}
          >
            {formatTimeAgo(msg.timestamp)}
          </span>
        </div>
      </div>

      <p
        style={{
          fontSize: isReply ? '13px' : '14px',
          color: '#e8e8e8',
          lineHeight: 1.6,
          marginBottom: '12px',
        }}
      >
        {msg.message}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={() => handleLike(msg.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            backgroundColor: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            color: '#888',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <span>👍</span>
          <span style={{ fontFamily: 'monospace' }}>{msg.likes}</span>
        </button>

        {!isReply && canPost && (
          <button
            onClick={() => setReplyingTo(replyingTo === msg.id ? null : msg.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: replyingTo === msg.id ? `${primaryColor}20` : 'rgba(0,0,0,0.3)',
              border: `1px solid ${replyingTo === msg.id ? primaryColor : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '6px',
              color: replyingTo === msg.id ? primaryColor : '#888',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <span>💬</span>
            <span>Reply</span>
          </button>
        )}

        {!isReply && msg.replies.length > 0 && (
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '11px',
              color: '#666',
            }}
          >
            {msg.replies.length} {msg.replies.length === 1 ? 'reply' : 'replies'}
          </span>
        )}
      </div>

      {/* Reply Input */}
      {replyingTo === msg.id && (
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(0,0,0,0.5)',
              border: `1px solid ${primaryColor}30`,
              color: '#e8e8e8',
              fontSize: '13px',
              outline: 'none',
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleReply(msg.id)}
          />
          <button
            onClick={() => handleReply(msg.id)}
            disabled={!replyText.trim()}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              background: !replyText.trim()
                ? 'linear-gradient(135deg, #333 0%, #222 100%)'
                : `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
              border: 'none',
              color: '#fff',
              fontFamily: 'Cinzel, serif',
              fontWeight: 600,
              fontSize: '11px',
              letterSpacing: '0.05em',
              cursor: !replyText.trim() ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase',
            }}
          >
            Reply
          </button>
        </div>
      )}

      {/* Replies */}
      {!isReply && msg.replies.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          {msg.replies.map((reply) => renderMessage(reply, true))}
        </div>
      )}
    </div>
  )

  return (
    <div
      style={{
        background: 'linear-gradient(145deg, rgba(17,17,20,0.95) 0%, rgba(10,10,12,0.98) 100%)',
        border: `1px solid ${primaryColor}20`,
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${primaryColor}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>📋</span>
          <h3
            style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '14px',
              color: primaryColor,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Message Board
          </h3>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setSortBy('recent')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: sortBy === 'recent' ? `${primaryColor}20` : 'rgba(0,0,0,0.3)',
              border: `1px solid ${sortBy === 'recent' ? primaryColor : 'rgba(255,255,255,0.1)'}`,
              color: sortBy === 'recent' ? primaryColor : '#888',
              fontFamily: 'Cinzel, serif',
              fontSize: '10px',
              letterSpacing: '0.05em',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            Recent
          </button>
          <button
            onClick={() => setSortBy('popular')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: sortBy === 'popular' ? `${primaryColor}20` : 'rgba(0,0,0,0.3)',
              border: `1px solid ${sortBy === 'popular' ? primaryColor : 'rgba(255,255,255,0.1)'}`,
              color: sortBy === 'popular' ? primaryColor : '#888',
              fontFamily: 'Cinzel, serif',
              fontSize: '10px',
              letterSpacing: '0.05em',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            Popular
          </button>
        </div>
      </div>

      {/* Post Input */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${primaryColor}10` }}>
        {canPost && isConnected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Share your thoughts..."
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(0,0,0,0.5)',
                border: `1px solid ${primaryColor}30`,
                color: '#e8e8e8',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none',
              }}
            />

            {/* Super Chat Panel */}
            {showSuperChat && (
              <div
                style={{
                  padding: '14px',
                  backgroundColor: 'rgba(168,85,247,0.1)',
                  borderRadius: '10px',
                  border: '1px solid rgba(168,85,247,0.3)',
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
                  <span style={{ fontSize: '14px' }}>✨</span>
                  <span
                    style={{
                      fontFamily: 'Cinzel, serif',
                      fontSize: '11px',
                      color: '#a855f7',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Super Chat Post - Pay {tokenSymbol} to highlight
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[500, 1000, 5000, 10000].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setSuperChatAmount(amount.toString())}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        backgroundColor:
                          superChatAmount === amount.toString()
                            ? 'rgba(168,85,247,0.3)'
                            : 'rgba(0,0,0,0.3)',
                        border: `1px solid ${
                          superChatAmount === amount.toString()
                            ? '#a855f7'
                            : 'rgba(139,92,246,0.2)'
                        }`,
                        color: superChatAmount === amount.toString() ? '#a855f7' : '#888',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      {amount >= 1000 ? `${amount / 1000}K` : amount} {tokenSymbol}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={superChatAmount}
                    onChange={(e) => setSuperChatAmount(e.target.value)}
                    placeholder="Custom"
                    style={{
                      width: '80px',
                      padding: '8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      border: '1px solid rgba(139,92,246,0.2)',
                      color: '#e8e8e8',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              {canSuperChat && (
                <button
                  onClick={() => setShowSuperChat(!showSuperChat)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    backgroundColor: showSuperChat
                      ? 'rgba(168,85,247,0.2)'
                      : 'rgba(0,0,0,0.3)',
                    border: `1px solid ${showSuperChat ? '#a855f7' : 'rgba(139,92,246,0.3)'}`,
                    color: showSuperChat ? '#a855f7' : '#888',
                    fontFamily: 'Cinzel, serif',
                    fontWeight: 600,
                    fontSize: '11px',
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>✨</span>
                  Super Chat
                </button>
              )}

              {showSuperChat ? (
                <>
                  <button
                    onClick={() => setShowSuperChat(false)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      color: '#ef4444',
                      fontFamily: 'Cinzel, serif',
                      fontSize: '11px',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSuperChatPost}
                    disabled={!newMessage.trim() || !superChatAmount}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      background:
                        !newMessage.trim() || !superChatAmount
                          ? 'linear-gradient(135deg, #333 0%, #222 100%)'
                          : 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                      border: 'none',
                      color: '#fff',
                      fontFamily: 'Cinzel, serif',
                      fontWeight: 600,
                      fontSize: '11px',
                      letterSpacing: '0.05em',
                      cursor: !newMessage.trim() || !superChatAmount ? 'not-allowed' : 'pointer',
                      textTransform: 'uppercase',
                    }}
                  >
                    Post Super Chat
                  </button>
                </>
              ) : (
                <button
                  onClick={handlePost}
                  disabled={!newMessage.trim()}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: !newMessage.trim()
                      ? 'linear-gradient(135deg, #333 0%, #222 100%)'
                      : `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                    border: 'none',
                    color: '#fff',
                    fontFamily: 'Cinzel, serif',
                    fontWeight: 600,
                    fontSize: '11px',
                    letterSpacing: '0.05em',
                    cursor: !newMessage.trim() ? 'not-allowed' : 'pointer',
                    textTransform: 'uppercase',
                  }}
                >
                  Post
                </button>
              )}
            </div>
          </div>
        ) : !isConnected ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderRadius: '10px',
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
              Connect wallet to post
            </span>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '20px',
              backgroundColor: 'rgba(139,69,19,0.15)',
              borderRadius: '10px',
              border: '1px solid rgba(139,69,19,0.3)',
            }}
          >
            <span style={{ fontSize: '16px' }}>🔒</span>
            <span
              style={{
                fontFamily: 'Cinzel, serif',
                fontSize: '12px',
                color: '#b8860b',
              }}
            >
              Hold 0.5%+ of {tokenSymbol} to post
            </span>
          </div>
        )}
      </div>

      {/* Messages List */}
      <div
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxHeight: '600px',
          overflowY: 'auto',
        }}
      >
        {sortedMessages.length > 0 ? (
          sortedMessages.map((msg) => renderMessage(msg))
        ) : (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: '#666',
            }}
          >
            <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px', opacity: 0.4 }}>
              📋
            </span>
            <p style={{ fontFamily: 'Cinzel, serif', fontSize: '13px' }}>
              No messages yet. Be the first to post!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
