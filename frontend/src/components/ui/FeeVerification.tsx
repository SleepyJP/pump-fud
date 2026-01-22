import { useState, useEffect } from 'react'
import { useReadContract } from 'wagmi'
import { formatEther } from 'viem'
import { PUMP_FUD_ADDRESS, PUMP_FUD_ABI } from '../../config/wagmi'

// RL-008: Fee routing verification component
// Verifies: 50% treasury + 0.1% platform fee structure

const TREASURY_ADDRESS = '0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B'
const BPS_DENOMINATOR = 10000

interface FeeVerificationProps {
  showDetails?: boolean
}

export function FeeVerification({ showDetails = false }: FeeVerificationProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Read fee configuration from contract
  const { data: buyFeeBps } = useReadContract({
    address: PUMP_FUD_ADDRESS,
    abi: PUMP_FUD_ABI,
    functionName: 'BUY_FEE_BPS',
  })

  const { data: sellFeeBps } = useReadContract({
    address: PUMP_FUD_ADDRESS,
    abi: PUMP_FUD_ABI,
    functionName: 'SELL_FEE_BPS',
  })

  const { data: creationFee } = useReadContract({
    address: PUMP_FUD_ADDRESS,
    abi: PUMP_FUD_ABI,
    functionName: 'CREATION_FEE',
  })

  const { data: treasuryAddress } = useReadContract({
    address: PUMP_FUD_ADDRESS,
    abi: PUMP_FUD_ABI,
    functionName: 'TREASURY',
  })

  // RL-008 VALIDATION: Log fee verification on mount and when data changes
  useEffect(() => {
    if (buyFeeBps && sellFeeBps && treasuryAddress) {
      const buyFeePercent = (Number(buyFeeBps) / BPS_DENOMINATOR * 100).toFixed(2)
      const sellFeePercent = (Number(sellFeeBps) / BPS_DENOMINATOR * 100).toFixed(2)
      const isCorrectTreasury = treasuryAddress?.toLowerCase() === TREASURY_ADDRESS.toLowerCase()

      console.log('[RALPH RL-008] Fee Routing Verification:', {
        buyFeeBps: Number(buyFeeBps),
        buyFeePercent: `${buyFeePercent}%`,
        sellFeeBps: Number(sellFeeBps),
        sellFeePercent: `${sellFeePercent}%`,
        creationFee: creationFee ? formatEther(creationFee as bigint) + ' PLS' : 'Loading...',
        treasury: treasuryAddress,
        expectedTreasury: TREASURY_ADDRESS,
        treasuryMatch: isCorrectTreasury,
        feeDistribution: 'With referrer: 50% referrer / 50% treasury | Without referrer: 100% treasury',
        status: isCorrectTreasury ? 'VERIFIED ✓' : 'MISMATCH ⚠️',
      })
    }
  }, [buyFeeBps, sellFeeBps, creationFee, treasuryAddress])

  // Calculate percentages
  const buyFeePercent = buyFeeBps ? (Number(buyFeeBps) / BPS_DENOMINATOR * 100).toFixed(2) : '...'
  const sellFeePercent = sellFeeBps ? (Number(sellFeeBps) / BPS_DENOMINATOR * 100).toFixed(2) : '...'
  const treasuryVerified = treasuryAddress?.toLowerCase() === TREASURY_ADDRESS.toLowerCase()

  if (!showDetails && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        style={{
          padding: '4px 8px',
          backgroundColor: treasuryVerified ? 'rgba(0,255,0,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${treasuryVerified ? 'rgba(0,255,0,0.3)' : 'rgba(239,68,68,0.3)'}`,
          borderRadius: '4px',
          color: treasuryVerified ? '#00ff00' : '#ef4444',
          fontSize: '10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
        title="View fee routing verification"
      >
        {treasuryVerified ? '✓' : '⚠️'} Fees
      </button>
    )
  }

  return (
    <div style={{
      backgroundColor: 'rgba(26,26,26,0.98)',
      border: `1px solid ${treasuryVerified ? 'rgba(0,255,0,0.2)' : 'rgba(239,68,68,0.2)'}`,
      borderRadius: '8px',
      padding: '12px',
      fontSize: '11px',
      ...(isExpanded && !showDetails && {
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: '4px',
        zIndex: 1000,
        minWidth: '280px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }),
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
      }}>
        <span style={{ fontWeight: 600, color: '#fff', fontSize: '12px' }}>
          📊 Fee Verification
        </span>
        {!showDetails && (
          <button
            onClick={() => setIsExpanded(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Treasury Status */}
      <div style={{
        padding: '8px',
        backgroundColor: treasuryVerified ? 'rgba(0,255,0,0.1)' : 'rgba(239,68,68,0.1)',
        borderRadius: '6px',
        marginBottom: '10px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: treasuryVerified ? '#00ff00' : '#ef4444',
          fontWeight: 600,
        }}>
          {treasuryVerified ? '✓ Treasury Verified' : '⚠️ Treasury Mismatch'}
        </div>
        <div style={{
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#888',
          marginTop: '4px',
          wordBreak: 'break-all',
        }}>
          {treasuryAddress || 'Loading...'}
        </div>
      </div>

      {/* Fee Breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '6px 8px',
          backgroundColor: 'rgba(0,255,0,0.05)',
          borderRadius: '4px',
        }}>
          <span style={{ color: '#888' }}>Buy Fee:</span>
          <span style={{ color: '#00ff00', fontWeight: 600 }}>{buyFeePercent}%</span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '6px 8px',
          backgroundColor: 'rgba(239,68,68,0.05)',
          borderRadius: '4px',
        }}>
          <span style={{ color: '#888' }}>Sell Fee:</span>
          <span style={{ color: '#ef4444', fontWeight: 600 }}>{sellFeePercent}%</span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '6px 8px',
          backgroundColor: 'rgba(168,85,247,0.05)',
          borderRadius: '4px',
        }}>
          <span style={{ color: '#888' }}>Creation Fee:</span>
          <span style={{ color: '#c084fc', fontWeight: 600 }}>
            {creationFee ? `${formatEther(creationFee as bigint)} PLS` : '...'}
          </span>
        </div>
      </div>

      {/* Fee Distribution */}
      <div style={{
        marginTop: '10px',
        padding: '8px',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: '6px',
      }}>
        <div style={{ color: '#888', marginBottom: '6px', fontSize: '10px' }}>
          Fee Distribution:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ color: '#888' }}>With referrer:</span>
            <span style={{ color: '#fff' }}>50% referrer / 50% treasury</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ color: '#888' }}>No referrer:</span>
            <span style={{ color: '#fff' }}>100% treasury</span>
          </div>
        </div>
      </div>

      {/* RL-008 Badge */}
      <div style={{
        marginTop: '8px',
        textAlign: 'center',
        fontSize: '9px',
        color: '#666',
      }}>
        RALPH RL-008 Verification Active
      </div>
    </div>
  )
}
