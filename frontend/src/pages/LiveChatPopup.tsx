import { useSearchParams } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { config } from '../config/wagmi'
import { LiveChat } from '../components/LiveChat'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'

const queryClient = new QueryClient()

function LiveChatContent() {
  const [searchParams] = useSearchParams()

  const tokenAddress = searchParams.get('token') || ''
  const tokenName = searchParams.get('name') || 'Token'
  const tokenSymbol = searchParams.get('symbol') || 'TKN'
  const holderPct = parseFloat(searchParams.get('holderPct') || '0')

  // Generate theme color from token address
  const hash = tokenAddress ? parseInt(tokenAddress.slice(2, 8), 16) : 0
  const hue = hash % 360
  const primaryColor = `hsl(${hue}, 70%, 50%)`
  const secondaryColor = `hsl(${hue}, 60%, 40%)`

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#020203',
      color: '#e8e8e8',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${primaryColor}30`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(10,10,12,0.95)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>💬</span>
          <div>
            <h1 style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '14px',
              color: primaryColor,
              margin: 0,
              letterSpacing: '0.08em',
            }}>
              {tokenName} Live Chat
            </h1>
            <span style={{
              fontFamily: 'monospace',
              fontSize: '10px',
              color: '#888',
            }}>
              ${tokenSymbol} • You hold {holderPct.toFixed(2)}%
            </span>
          </div>
        </div>
        <ConnectButton />
      </div>

      {/* Requirements Banner */}
      {holderPct < 1 && (
        <div style={{
          padding: '10px 16px',
          backgroundColor: 'rgba(139,69,19,0.2)',
          borderBottom: '1px solid rgba(139,69,19,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          justifyContent: 'center',
        }}>
          <span>🔒</span>
          <span style={{
            fontFamily: 'Cinzel, serif',
            fontSize: '11px',
            color: '#b8860b',
          }}>
            Hold 1%+ of {tokenSymbol} to participate in chat
          </span>
        </div>
      )}

      {/* Chat Component */}
      <div style={{ flex: 1, padding: '16px' }}>
        <LiveChat
          tokenSymbol={tokenSymbol}
          holderPercentage={holderPct}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
        />
      </div>
    </div>
  )
}

export function LiveChatPopup() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({ accentColor: '#dc143c' })}>
          <LiveChatContent />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
