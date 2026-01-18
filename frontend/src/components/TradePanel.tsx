import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { PUMP_FUD_ADDRESS, PUMP_FUD_ABI } from '../config/wagmi'

// ERC20 ABI for token balance
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

interface TradePanelProps {
  tokenAddress: `0x${string}`
  tokenSymbol: string
  isGraduated: boolean
}

export function TradePanel({ tokenAddress, tokenSymbol, isGraduated }: TradePanelProps) {
  const { address, isConnected } = useAccount()
  const [mode, setMode] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState(5) // 5% default

  // PLS balance
  const { data: plsBalance } = useBalance({
    address: address,
  })

  // Token balance
  const { data: tokenBalance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // Get token ID from address
  const { data: tokenId } = useReadContract({
    address: PUMP_FUD_ADDRESS,
    abi: PUMP_FUD_ABI,
    functionName: 'tokenToId',
    args: [tokenAddress],
  })

  // Token allowance
  const { data: allowance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, PUMP_FUD_ADDRESS] : undefined,
    query: { enabled: !!address && mode === 'sell' },
  })

  // Buy quote
  const { data: buyQuote } = useReadContract({
    address: PUMP_FUD_ADDRESS,
    abi: PUMP_FUD_ABI,
    functionName: 'calculateBuyAmount',
    args: amount && mode === 'buy' && tokenId !== undefined ? [tokenId, parseEther(amount)] : undefined,
    query: { enabled: !!amount && mode === 'buy' && Number(amount) > 0 && tokenId !== undefined },
  })

  // Sell quote
  const { data: sellQuote } = useReadContract({
    address: PUMP_FUD_ADDRESS,
    abi: PUMP_FUD_ABI,
    functionName: 'calculateSellAmount',
    args: amount && mode === 'sell' && tokenId !== undefined ? [tokenId, parseEther(amount)] : undefined,
    query: { enabled: !!amount && mode === 'sell' && Number(amount) > 0 && tokenId !== undefined },
  })

  // Buy transaction
  const { writeContract: buyTokens, data: buyHash, isPending: isBuying } = useWriteContract()
  const { isLoading: isBuyConfirming, isSuccess: buyConfirmed } = useWaitForTransactionReceipt({ hash: buyHash })

  // Approve transaction
  const { writeContract: approveTokens, data: approveHash, isPending: isApproving } = useWriteContract()
  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({ hash: approveHash })

  // Sell transaction
  const { writeContract: sellTokens, data: sellHash, isPending: isSelling } = useWriteContract()
  const { isLoading: isSellConfirming, isSuccess: sellConfirmed } = useWaitForTransactionReceipt({ hash: sellHash })

  // Reset amount after successful transaction
  useEffect(() => {
    if (buyConfirmed || sellConfirmed) {
      setAmount('')
    }
  }, [buyConfirmed, sellConfirmed])

  const handleBuy = () => {
    if (!amount || !buyQuote || tokenId === undefined) return
    const minOut = (buyQuote * BigInt(100 - slippage)) / 100n
    buyTokens({
      address: PUMP_FUD_ADDRESS,
      abi: PUMP_FUD_ABI,
      functionName: 'buyTokens',
      args: [tokenId, minOut],
      value: parseEther(amount),
    })
  }

  const handleApprove = () => {
    if (!amount) return
    approveTokens({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [PUMP_FUD_ADDRESS, parseEther(amount)],
    })
  }

  const handleSell = () => {
    if (!amount || !sellQuote || tokenId === undefined) return
    const minOut = (sellQuote * BigInt(100 - slippage)) / 100n
    sellTokens({
      address: PUMP_FUD_ADDRESS,
      abi: PUMP_FUD_ABI,
      functionName: 'sellTokens',
      args: [tokenId, parseEther(amount), minOut],
    })
  }

  const needsApproval = mode === 'sell' && amount && allowance !== undefined && parseEther(amount) > allowance

  const setMaxAmount = () => {
    if (mode === 'buy' && plsBalance) {
      // Leave some PLS for gas
      const maxBuy = plsBalance.value > parseEther('100') ? plsBalance.value - parseEther('100') : 0n
      setAmount(formatEther(maxBuy))
    } else if (mode === 'sell' && tokenBalance) {
      setAmount(formatEther(tokenBalance))
    }
  }

  const quote = mode === 'buy' ? buyQuote : sellQuote
  const isLoading = isBuying || isBuyConfirming || isApproving || isApproveConfirming || isSelling || isSellConfirming

  if (isGraduated) {
    return (
      <div className="glass-card p-6 text-center">
        <div className="text-4xl mb-4">🎓</div>
        <h3 className="font-display font-bold text-xl text-pump-green mb-2">Token Graduated!</h3>
        <p className="text-pump-white-muted mb-4">
          This token has graduated to PulseX. Trade on the DEX for better liquidity.
        </p>
        <a
          href={`https://app.pulsex.com/swap?outputCurrency=${tokenAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block gradient-button px-6 py-3 rounded-xl font-display font-bold text-pump-dark"
        >
          Trade on PulseX
        </a>
      </div>
    )
  }

  return (
    <div className="glass-card overflow-hidden">
      {/* Mode Tabs */}
      <div className="flex border-b border-pump-dark-border">
        <button
          onClick={() => setMode('buy')}
          className={`flex-1 py-4 font-display font-bold text-lg transition-all ${
            mode === 'buy'
              ? 'bg-pump-green/20 text-pump-green border-b-2 border-pump-green'
              : 'text-pump-white-muted hover:bg-pump-dark-lighter'
          }`}
        >
          BUY
        </button>
        <button
          onClick={() => setMode('sell')}
          className={`flex-1 py-4 font-display font-bold text-lg transition-all ${
            mode === 'sell'
              ? 'bg-tier-5/20 text-tier-5 border-b-2 border-tier-5'
              : 'text-pump-white-muted hover:bg-pump-dark-lighter'
          }`}
        >
          SELL
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Input */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-pump-white-muted">
              {mode === 'buy' ? 'You Pay' : 'You Sell'}
            </span>
            <button onClick={setMaxAmount} className="text-pump-green hover:underline">
              Balance: {mode === 'buy'
                ? Number(formatEther(plsBalance?.value || 0n)).toLocaleString(undefined, { maximumFractionDigits: 2 })
                : Number(formatEther(tokenBalance || 0n)).toLocaleString(undefined, { maximumFractionDigits: 2 })
              } {mode === 'buy' ? 'PLS' : tokenSymbol}
            </button>
          </div>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="w-full bg-pump-dark border border-pump-dark-border rounded-xl px-4 py-4 text-2xl font-mono text-white focus:border-pump-green outline-none transition-colors"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                onClick={setMaxAmount}
                className="px-2 py-1 text-xs font-bold bg-pump-green/20 text-pump-green rounded hover:bg-pump-green/30 transition-colors"
              >
                MAX
              </button>
              <span className="font-bold text-pump-white-muted">
                {mode === 'buy' ? 'PLS' : tokenSymbol}
              </span>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="w-10 h-10 rounded-full bg-pump-dark-lighter border border-pump-dark-border flex items-center justify-center">
            <span className="text-xl">↓</span>
          </div>
        </div>

        {/* Output */}
        <div className="space-y-2">
          <span className="text-pump-white-muted text-sm">
            {mode === 'buy' ? 'You Receive' : 'You Get'}
          </span>
          <div className="bg-pump-dark border border-pump-dark-border rounded-xl px-4 py-4 flex justify-between items-center">
            <span className="text-2xl font-mono text-white">
              {quote ? Number(formatEther(quote)).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0.0'}
            </span>
            <span className="font-bold text-pump-white-muted">
              {mode === 'buy' ? tokenSymbol : 'PLS'}
            </span>
          </div>
        </div>

        {/* Slippage */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-pump-white-muted">Slippage Tolerance</span>
          <div className="flex gap-2">
            {[1, 3, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => setSlippage(s)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  slippage === s
                    ? 'bg-pump-green/20 text-pump-green'
                    : 'bg-pump-dark-lighter text-pump-white-muted hover:text-white'
                }`}
              >
                {s}%
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        {!isConnected ? (
          <button
            disabled
            className="w-full py-4 rounded-xl font-display font-bold text-lg bg-pump-dark-lighter text-pump-white-muted"
          >
            Connect Wallet
          </button>
        ) : needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={isLoading}
            className="w-full py-4 rounded-xl font-display font-bold text-lg bg-tier-3 text-pump-dark hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isApproving || isApproveConfirming ? 'Approving...' : `Approve ${tokenSymbol}`}
          </button>
        ) : (
          <button
            onClick={mode === 'buy' ? handleBuy : handleSell}
            disabled={!amount || isLoading}
            className={`w-full py-4 rounded-xl font-display font-bold text-lg disabled:opacity-50 transition-all ${
              mode === 'buy'
                ? 'gradient-button text-pump-dark'
                : 'bg-tier-5 text-white hover:opacity-90'
            }`}
          >
            {isLoading
              ? 'Processing...'
              : mode === 'buy'
              ? `Buy ${tokenSymbol}`
              : `Sell ${tokenSymbol}`
            }
          </button>
        )}

        {/* Success Messages */}
        {buyConfirmed && (
          <div className="text-center text-pump-green text-sm">
            Purchase successful!
          </div>
        )}
        {sellConfirmed && (
          <div className="text-center text-tier-5 text-sm">
            Sale successful!
          </div>
        )}
      </div>
    </div>
  )
}
