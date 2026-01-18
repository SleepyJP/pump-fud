import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import './index.css'
import App from './App'
import { config } from './config/wagmi'

const queryClient = new QueryClient()

// Gothic Horror Theme for RainbowKit
const cryptTheme = darkTheme({
  accentColor: '#DC143C',
  accentColorForeground: '#ffffff',
  borderRadius: 'medium',
})

// Override specific properties for maximum darkness
const customTheme = {
  ...cryptTheme,
  colors: {
    ...cryptTheme.colors,
    modalBackground: '#0a0a0c',
    modalBackdrop: 'rgba(0, 0, 0, 0.85)',
    profileForeground: '#111114',
    closeButton: '#666666',
    closeButtonBackground: '#1a1a1f',
    connectButtonBackground: '#111114',
    connectButtonBackgroundError: '#8B0000',
    connectButtonInnerBackground: '#0a0a0c',
    connectButtonText: '#e8e8e8',
    connectButtonTextError: '#ffffff',
    connectionIndicator: '#DC143C',
    selectedOptionBorder: '#DC143C',
  },
  fonts: {
    body: 'Cinzel, Inter, system-ui, sans-serif',
  },
  shadows: {
    ...cryptTheme.shadows,
    connectButton: '0 0 20px rgba(220, 20, 60, 0.2)',
    dialog: '0 0 60px rgba(139, 0, 0, 0.3), 0 25px 80px rgba(0, 0, 0, 0.8)',
    profileDetailsAction: '0 0 10px rgba(139, 92, 246, 0.2)',
    selectedOption: '0 0 15px rgba(220, 20, 60, 0.3)',
    selectedWallet: '0 0 15px rgba(220, 20, 60, 0.3)',
    walletLogo: '0 0 10px rgba(139, 0, 0, 0.3)',
  },
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={customTheme}>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
