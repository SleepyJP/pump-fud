import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatEther } from 'viem'
import { PUMP_FUD_ADDRESS, PUMP_FUD_ABI } from '../config/wagmi'

interface LaunchModalProps {
  isOpen: boolean
  onClose: () => void
}

export function LaunchModal({ isOpen, onClose }: LaunchModalProps) {
  const { isConnected } = useAccount()
  const [tokenName, setTokenName] = useState('')
  const [tokenSymbol, setTokenSymbol] = useState('')
  const [tokenDescription, setTokenDescription] = useState('')
  const [tokenImage, setTokenImage] = useState('')

  // Get launch fee
  const { data: launchFee } = useReadContract({
    address: PUMP_FUD_ADDRESS,
    abi: PUMP_FUD_ABI,
    functionName: 'launchFee',
  })

  // Launch token
  const { writeContract: launchToken, data: launchHash, isPending: isLaunching } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: launchHash })

  // Reset form after successful launch
  useEffect(() => {
    if (isConfirmed) {
      setTimeout(() => {
        setTokenName('')
        setTokenSymbol('')
        setTokenDescription('')
        setTokenImage('')
        onClose()
      }, 2000)
    }
  }, [isConfirmed, onClose])

  const handleLaunch = () => {
    if (!tokenName || !tokenSymbol) return
    launchToken({
      address: PUMP_FUD_ADDRESS,
      abi: PUMP_FUD_ABI,
      functionName: 'launchToken',
      args: [tokenName, tokenSymbol, tokenDescription, tokenImage],
      value: launchFee || 0n,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg glass-card neon-glow animate-scale-in">
        {/* Header */}
        <div className="p-6 border-b border-pump-dark-border flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold">Launch Token</h2>
            <p className="text-pump-white-muted text-sm mt-1">Create your memecoin on PUMP.FUD</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-pump-dark-lighter hover:bg-pump-dark-border flex items-center justify-center transition-colors"
          >
            <span className="text-2xl">×</span>
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          {/* Token Name */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-pump-white-muted">
              Token Name <span className="text-tier-5">*</span>
            </label>
            <input
              type="text"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="e.g., Doge Killer"
              className="w-full bg-pump-dark border border-pump-dark-border rounded-xl px-4 py-3 text-white placeholder-pump-dark-border focus:border-pump-green outline-none transition-colors"
            />
          </div>

          {/* Token Symbol */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-pump-white-muted">
              Symbol <span className="text-tier-5">*</span>
            </label>
            <input
              type="text"
              value={tokenSymbol}
              onChange={(e) => setTokenSymbol(e.target.value.toUpperCase().slice(0, 10))}
              placeholder="e.g., DOGEK"
              maxLength={10}
              className="w-full bg-pump-dark border border-pump-dark-border rounded-xl px-4 py-3 text-white placeholder-pump-dark-border focus:border-pump-green outline-none transition-colors font-mono uppercase"
            />
            <p className="text-xs text-pump-dark-border">Max 10 characters</p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-pump-white-muted">
              Description
            </label>
            <textarea
              value={tokenDescription}
              onChange={(e) => setTokenDescription(e.target.value.slice(0, 280))}
              placeholder="Tell the world about your token..."
              rows={3}
              maxLength={280}
              className="w-full bg-pump-dark border border-pump-dark-border rounded-xl px-4 py-3 text-white placeholder-pump-dark-border focus:border-pump-green outline-none transition-colors resize-none"
            />
            <p className="text-xs text-pump-dark-border text-right">{tokenDescription.length}/280</p>
          </div>

          {/* Image URL */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-pump-white-muted">
              Image URL
            </label>
            <input
              type="url"
              value={tokenImage}
              onChange={(e) => setTokenImage(e.target.value)}
              placeholder="https://..."
              className="w-full bg-pump-dark border border-pump-dark-border rounded-xl px-4 py-3 text-white placeholder-pump-dark-border focus:border-pump-green outline-none transition-colors"
            />
            <p className="text-xs text-pump-dark-border">Direct link to your token's logo (PNG, JPG, GIF)</p>
          </div>

          {/* Image Preview */}
          {tokenImage && (
            <div className="flex justify-center">
              <img
                src={tokenImage}
                alt="Token preview"
                className="w-24 h-24 rounded-xl object-cover ring-2 ring-pump-green/30"
                onError={(e) => {
                  e.currentTarget.src = ''
                  e.currentTarget.className = 'hidden'
                }}
              />
            </div>
          )}

          {/* Launch Fee */}
          {launchFee && launchFee > 0n && (
            <div className="flex items-center justify-between p-4 bg-pump-dark rounded-xl border border-pump-dark-border">
              <span className="text-pump-white-muted">Launch Fee</span>
              <span className="font-mono font-bold text-pump-green">
                {formatEther(launchFee)} PLS
              </span>
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-pump-green/10 rounded-xl border border-pump-green/30">
            <div className="flex gap-3">
              <span className="text-xl">💊</span>
              <div className="text-sm">
                <p className="text-pump-green font-medium mb-1">How it works</p>
                <p className="text-pump-white-muted leading-relaxed">
                  Your token will trade on a bonding curve. When 50M PLS is raised,
                  it graduates to PulseX with permanent liquidity!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-pump-dark-border">
          {!isConnected ? (
            <button
              disabled
              className="w-full py-4 rounded-xl font-display font-bold text-lg bg-pump-dark-lighter text-pump-white-muted"
            >
              Connect Wallet to Launch
            </button>
          ) : (
            <button
              onClick={handleLaunch}
              disabled={!tokenName || !tokenSymbol || isLaunching || isConfirming}
              className="w-full gradient-button py-4 rounded-xl font-display font-bold text-lg text-pump-dark disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {isLaunching || isConfirming ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-pump-dark border-t-transparent rounded-full animate-spin" />
                  Launching...
                </span>
              ) : (
                '🚀 LAUNCH TOKEN'
              )}
            </button>
          )}

          {isConfirmed && (
            <div className="mt-4 text-center text-pump-green">
              ✅ Token launched successfully!
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
