import { useState, useRef, useEffect } from 'react'
import { useAccount } from 'wagmi'

interface ChatMessage {
  id: string
  sender: string
  username: string
  avatar: string
  message: string
  timestamp: number
  type: 'message' | 'superchat' | 'system'
  superchat?: {
    amount: string
    tier: number
  }
}

interface ChatPanelProps {
  tokenAddress: string // kept for future WebSocket integration
  tokenSymbol: string
  isOpen: boolean
  onClose: () => void
}

const TIER_STYLES = {
  1: 'border-tier-1 bg-tier-1/10',
  2: 'border-tier-2 bg-tier-2/10',
  3: 'border-tier-3 bg-tier-3/10',
  4: 'border-tier-4 bg-tier-4/10',
  5: 'border-tier-5 bg-tier-5/10 animate-pulse',
}

// Mock messages for demo
const generateMockMessages = (tokenSymbol: string): ChatMessage[] => [
  {
    id: '1',
    sender: '0x1234...5678',
    username: 'whale.pls',
    avatar: '',
    message: `Just aped into $${tokenSymbol}! LFG!`,
    timestamp: Date.now() - 300000,
    type: 'message',
  },
  {
    id: '2',
    sender: '0xabcd...efgh',
    username: 'degen_trader',
    avatar: '',
    message: 'This chart is looking bullish af',
    timestamp: Date.now() - 240000,
    type: 'message',
  },
  {
    id: '3',
    sender: '0x9876...5432',
    username: 'superchat_king',
    avatar: '',
    message: `$${tokenSymbol} TO THE MOON! SENDING IT!`,
    timestamp: Date.now() - 180000,
    type: 'superchat',
    superchat: { amount: '100,000', tier: 3 },
  },
  {
    id: '4',
    sender: '0x1111...2222',
    username: 'anon',
    avatar: '',
    message: 'When graduation?',
    timestamp: Date.now() - 120000,
    type: 'message',
  },
  {
    id: '5',
    sender: '0x3333...4444',
    username: 'pulse_maxi',
    avatar: '',
    message: 'Love this community!',
    timestamp: Date.now() - 60000,
    type: 'message',
  },
]

export function ChatPanel({ tokenAddress: _tokenAddress, tokenSymbol, isOpen, onClose }: ChatPanelProps) {
  // tokenAddress will be used for WebSocket room connection in production
  void _tokenAddress
  const { address, isConnected } = useAccount()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [showSuperchat, setShowSuperchat] = useState(false)
  const [superchatAmount, setSuperchatAmount] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize with mock messages
  useEffect(() => {
    if (isOpen) {
      setMessages(generateMockMessages(tokenSymbol))
    }
  }, [isOpen, tokenSymbol])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = () => {
    if (!inputValue.trim() || !isConnected || !address) return

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: address,
      username: `${address.slice(0, 6)}...${address.slice(-4)}`,
      avatar: '',
      message: inputValue.trim(),
      timestamp: Date.now(),
      type: 'message',
    }

    setMessages((prev) => [...prev, newMessage])
    setInputValue('')
  }

  const handleSendSuperchat = () => {
    if (!inputValue.trim() || !superchatAmount || !isConnected || !address) return

    // Calculate tier based on amount
    const amount = Number(superchatAmount)
    let tier = 1
    if (amount >= 10_000_000) tier = 5
    else if (amount >= 1_000_000) tier = 4
    else if (amount >= 100_000) tier = 3
    else if (amount >= 10_000) tier = 2

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: address,
      username: `${address.slice(0, 6)}...${address.slice(-4)}`,
      avatar: '',
      message: inputValue.trim(),
      timestamp: Date.now(),
      type: 'superchat',
      superchat: {
        amount: Number(superchatAmount).toLocaleString(),
        tier,
      },
    }

    setMessages((prev) => [...prev, newMessage])
    setInputValue('')
    setSuperchatAmount('')
    setShowSuperchat(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (showSuperchat) {
        handleSendSuperchat()
      } else {
        handleSendMessage()
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-pump-dark border-l border-pump-dark-border z-50 flex flex-col animate-slide-in">
      {/* Header */}
      <div className="p-4 border-b border-pump-dark-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-pump-green rounded-full animate-pulse" />
          <h3 className="font-display font-bold text-lg">${tokenSymbol} Chat</h3>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-pump-dark-lighter hover:bg-pump-dark-border flex items-center justify-center transition-colors"
        >
          <span className="text-lg">×</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-xl p-3 ${
              msg.type === 'superchat'
                ? `border-2 ${TIER_STYLES[msg.superchat?.tier as keyof typeof TIER_STYLES]}`
                : 'bg-pump-dark-lighter'
            }`}
          >
            {msg.type === 'superchat' && (
              <div className="flex items-center gap-2 mb-2 text-xs">
                <span className={`font-bold text-tier-${msg.superchat?.tier}`}>
                  ⭐ SUPERCHAT
                </span>
                <span className="text-pump-white-muted">
                  {msg.superchat?.amount} {tokenSymbol}
                </span>
              </div>
            )}
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pump-green to-pump-green-dark flex-shrink-0 flex items-center justify-center text-sm font-bold text-pump-dark">
                {msg.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-pump-green text-sm font-medium truncate">
                    {msg.username}
                  </span>
                  <span className="text-pump-dark-border text-xs">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-white text-sm break-words">{msg.message}</p>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Superchat Tiers */}
      {showSuperchat && (
        <div className="border-t border-pump-dark-border p-4 space-y-3">
          <div className="text-sm text-pump-white-muted">Superchat Amount</div>
          <div className="grid grid-cols-5 gap-2">
            {[1000, 10000, 100000, 1000000, 10000000].map((amount, i) => (
              <button
                key={amount}
                onClick={() => setSuperchatAmount(amount.toString())}
                className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all ${
                  superchatAmount === amount.toString()
                    ? `border-tier-${i + 1} bg-tier-${i + 1}/20 text-tier-${i + 1}`
                    : 'border-pump-dark-border text-pump-white-muted hover:border-pump-green'
                }`}
              >
                {amount >= 1000000 ? `${amount / 1000000}M` : `${amount / 1000}K`}
              </button>
            ))}
          </div>
          <input
            type="number"
            value={superchatAmount}
            onChange={(e) => setSuperchatAmount(e.target.value)}
            placeholder="Custom amount"
            className="w-full bg-pump-dark border border-pump-dark-border rounded-lg px-3 py-2 text-sm text-white focus:border-pump-green outline-none"
          />
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-pump-dark-border">
        {!isConnected ? (
          <div className="text-center text-pump-white-muted text-sm py-2">
            Connect wallet to chat
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1 bg-pump-dark-lighter border border-pump-dark-border rounded-lg px-4 py-3 text-white focus:border-pump-green outline-none transition-colors"
              />
              <button
                onClick={showSuperchat ? handleSendSuperchat : handleSendMessage}
                disabled={!inputValue.trim()}
                className={`px-4 rounded-lg font-bold transition-all disabled:opacity-50 ${
                  showSuperchat
                    ? 'bg-tier-3 text-pump-dark'
                    : 'bg-pump-green text-pump-dark'
                }`}
              >
                Send
              </button>
            </div>
            <button
              onClick={() => setShowSuperchat(!showSuperchat)}
              className={`w-full py-2 rounded-lg text-sm font-medium transition-all ${
                showSuperchat
                  ? 'bg-tier-3/20 text-tier-3 border border-tier-3'
                  : 'bg-pump-dark-lighter text-pump-white-muted hover:text-tier-3'
              }`}
            >
              ⭐ {showSuperchat ? 'Cancel Superchat' : 'Send Superchat'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
