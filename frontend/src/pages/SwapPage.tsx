import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { PUMP_FUD_ADDRESS, PUMP_FUD_ABI } from '../config/wagmi'

export function SwapPage() {
  const { address, isConnected } = useAccount()
  const [sellAmount, setSellAmount] = useState('')
  const [selectedTokenId, setSelectedTokenId] = useState<bigint | null>(null)

  // Get all tokens for selector
  const { data: allTokens } = useReadContract({
    address: PUMP_FUD_ADDRESS,
    abi: PUMP_FUD_ABI,
    functionName: 'getAllTokens',
    args: [0n, 50n],
  })

  // PLS balance
  const { data: plsBalance } = useBalance({
    address: address,
  })

  // Buy quote
  const { data: buyQuote } = useReadContract({
    address: PUMP_FUD_ADDRESS,
    abi: PUMP_FUD_ABI,
    functionName: 'calculateBuyAmount',
    args: sellAmount && selectedTokenId !== null ? [selectedTokenId, parseEther(sellAmount)] : undefined,
    query: { enabled: !!sellAmount && selectedTokenId !== null && Number(sellAmount) > 0 },
  })

  // Buy transaction
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const handleSwap = () => {
    if (!sellAmount || selectedTokenId === null || !buyQuote) return
    const minOut = (buyQuote * 95n) / 100n // 5% slippage
    writeContract({
      address: PUMP_FUD_ADDRESS,
      abi: PUMP_FUD_ABI,
      functionName: 'buyTokens',
      args: [selectedTokenId, minOut],
      value: parseEther(sellAmount),
    })
  }

  // Get selected token info
  const selectedToken = allTokens?.find(t => t.id === selectedTokenId)

  return (
    <div className="min-h-screen flex items-start justify-center pt-20">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-display font-bold">
            <span className="text-white/80">FUD</span>
            <span className="text-pump-green ml-2">SWAP</span>
          </h1>
        </div>

        {/* Swap Card */}
        <div className="bg-pump-dark-lighter rounded-2xl p-6 border border-pump-dark-border">
          {/* Settings Icon */}
          <div className="flex justify-end mb-4">
            <button className="text-pump-white-muted hover:text-white transition-colors">
              ⚙️
            </button>
          </div>

          {/* Sell Input */}
          <div className="bg-pump-dark rounded-xl p-4 mb-2">
            <div className="flex justify-between text-sm text-pump-white-muted mb-2">
              <span>Sell</span>
              <span>
                Balance: {plsBalance ? Number(formatEther(plsBalance.value)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'} PLS
              </span>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
                placeholder="0"
                className="flex-1 bg-transparent text-3xl font-mono text-white placeholder-pump-dark-border focus:outline-none"
              />
              <div className="flex items-center gap-2 bg-pump-dark-lighter px-3 py-2 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500" />
                <span className="font-medium">PLS</span>
              </div>
            </div>
          </div>

          {/* Swap Arrow */}
          <div className="flex justify-center -my-2 relative z-10">
            <button className="w-10 h-10 rounded-xl bg-pump-dark-lighter border border-pump-dark-border flex items-center justify-center text-pump-white-muted hover:text-pump-green transition-colors">
              ↓
            </button>
          </div>

          {/* Buy Input */}
          <div className="bg-pump-dark rounded-xl p-4 mt-2">
            <div className="flex justify-between text-sm text-pump-white-muted mb-2">
              <span>Buy</span>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="text"
                value={buyQuote ? Number(formatEther(buyQuote)).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0'}
                readOnly
                placeholder="0"
                className="flex-1 bg-transparent text-3xl font-mono text-white placeholder-pump-dark-border focus:outline-none"
              />
              <select
                value={selectedTokenId?.toString() || ''}
                onChange={(e) => setSelectedTokenId(e.target.value ? BigInt(e.target.value) : null)}
                className="bg-pump-dark-lighter px-3 py-2 rounded-lg border border-pump-dark-border text-white focus:border-pump-green outline-none cursor-pointer"
              >
                <option value="">Select token</option>
                {allTokens?.map((token) => (
                  <option key={token.id.toString()} value={token.id.toString()}>
                    {token.symbol} ({token.tokenAddress.slice(0, 6)}...{token.tokenAddress.slice(-4)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected Token Info */}
          {selectedToken && (
            <div className="mt-4 p-3 bg-pump-dark rounded-lg text-sm">
              <div className="flex justify-between text-pump-white-muted">
                <span>Token</span>
                <span className="text-pump-green">{selectedToken.name}</span>
              </div>
            </div>
          )}

          {/* Swap Button */}
          <div className="mt-6">
            {!isConnected ? (
              <div className="flex justify-center">
                <ConnectButton />
              </div>
            ) : (
              <button
                onClick={handleSwap}
                disabled={!sellAmount || selectedTokenId === null || isPending || isConfirming}
                className="w-full py-4 rounded-xl gradient-button text-pump-dark font-display font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending || isConfirming ? 'Swapping...' : 'Swap'}
              </button>
            )}
          </div>

          {isSuccess && (
            <div className="mt-4 text-center text-pump-green text-sm">
              Swap successful!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-pump-dark-border">
          support
        </div>
      </div>
    </div>
  )
}
