import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { useNavigate } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { PUMP_FUD_ADDRESS, PUMP_FUD_ABI } from '../config/wagmi'

interface SocialLinks {
  twitter: string
  telegram: string
  facebook: string
  youtube: string
  youtubeStream: string
  twitch: string
  kick: string
  instagram: string
  website: string
  livestreamUrl: string
}

export function LaunchPage() {
  const navigate = useNavigate()
  const { isConnected, address } = useAccount()
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [description, setDescription] = useState('')
  const [imageUri, setImageUri] = useState('')
  const [showSocials, setShowSocials] = useState(false)
  const [initialBuyAmount, setInitialBuyAmount] = useState('')
  const [showInitialBuy, setShowInitialBuy] = useState(true)
  const [, setLaunchedTokenAddress] = useState<string | null>(null)
  const [socials, setSocials] = useState<SocialLinks>({
    twitter: '',
    telegram: '',
    facebook: '',
    youtube: '',
    youtubeStream: '',
    twitch: '',
    kick: '',
    instagram: '',
    website: '',
    livestreamUrl: '',
  })

  // Get user PLS balance
  const { data: plsBalance } = useBalance({ address })

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash })

  const handleLaunch = () => {
    if (!name || !symbol) return

    // Encode socials into description JSON for on-chain storage
    const metadata = {
      description,
      socials: Object.fromEntries(
        Object.entries(socials).filter(([, v]) => v.trim() !== '')
      ),
    }

    // Base launch fee + optional initial buy amount
    const launchFee = parseEther('100000')
    const buyAmount = initialBuyAmount ? parseEther(initialBuyAmount) : 0n
    const totalValue = launchFee + buyAmount

    writeContract({
      address: PUMP_FUD_ADDRESS,
      abi: PUMP_FUD_ABI,
      functionName: 'launchToken',
      args: [name, symbol, JSON.stringify(metadata), imageUri],
      value: totalValue,
    })
  }

  // Extract token address from receipt logs and redirect
  useEffect(() => {
    if (isSuccess && receipt) {
      // Find TokenLaunched event in logs - token address is typically in the first topic or data
      const logs = receipt.logs
      if (logs && logs.length > 0) {
        // The token address should be in one of the event logs
        // TokenLaunched event emits (tokenId, tokenAddress, name, symbol, creator)
        for (const log of logs) {
          // Check for token address in topics (indexed params) or data
          if (log.topics && log.topics.length >= 3) {
            // Second topic is often the token address (after event sig)
            const potentialAddress = '0x' + log.topics[2]?.slice(-40)
            if (potentialAddress && potentialAddress.length === 42) {
              setLaunchedTokenAddress(potentialAddress)
              navigate(`/dashboard/${potentialAddress}`)
              return
            }
          }
        }
        // Fallback: try to extract from log data
        if (logs[0]?.data && logs[0].data.length >= 66) {
          const dataAddress = '0x' + logs[0].data.slice(26, 66)
          if (dataAddress.length === 42) {
            setLaunchedTokenAddress(dataAddress)
            navigate(`/dashboard/${dataAddress}`)
            return
          }
        }
      }
      // If we can't extract address, go home
      navigate('/')
    }
  }, [isSuccess, receipt, navigate])

  const updateSocial = (key: keyof SocialLinks, value: string) => {
    setSocials(prev => ({ ...prev, [key]: value }))
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: 'rgba(10,8,5,0.8)',
    border: '1px solid rgba(139,69,19,0.4)',
    borderRadius: '8px',
    padding: '14px 16px',
    fontSize: '14px',
    color: '#e8e8e8',
    fontFamily: 'Inter, system-ui, sans-serif',
    outline: 'none',
    transition: 'all 0.3s ease',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: 'Cinzel, serif',
    fontSize: '11px',
    color: '#b8860b',
    marginBottom: '8px',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    textShadow: '0 0 10px rgba(184,134,11,0.3)',
  }

  const socialInputStyle: React.CSSProperties = {
    ...inputStyle,
    padding: '10px 14px',
    fontSize: '13px',
  }

  const socialFields = [
    { key: 'twitter' as keyof SocialLinks, label: 'Twitter / X', icon: '𝕏', placeholder: 'https://twitter.com/...' },
    { key: 'telegram' as keyof SocialLinks, label: 'Telegram', icon: '✈️', placeholder: 'https://t.me/...' },
    { key: 'facebook' as keyof SocialLinks, label: 'Facebook', icon: '📘', placeholder: 'https://facebook.com/...' },
    { key: 'youtube' as keyof SocialLinks, label: 'YouTube Channel', icon: '▶️', placeholder: 'https://youtube.com/@...' },
    { key: 'youtubeStream' as keyof SocialLinks, label: 'YouTube Livestream', icon: '🔴', placeholder: 'https://youtube.com/live/...' },
    { key: 'twitch' as keyof SocialLinks, label: 'Twitch', icon: '💜', placeholder: 'https://twitch.tv/...' },
    { key: 'kick' as keyof SocialLinks, label: 'Kick', icon: '🟢', placeholder: 'https://kick.com/...' },
    { key: 'instagram' as keyof SocialLinks, label: 'Instagram', icon: '📷', placeholder: 'https://instagram.com/...' },
    { key: 'website' as keyof SocialLinks, label: 'Website', icon: '🌐', placeholder: 'https://...' },
    { key: 'livestreamUrl' as keyof SocialLinks, label: 'Live Launch URL', icon: '📺', placeholder: 'Livestream URL for launch event' },
  ]

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      overflow: 'auto',
    }}>
      {/* Full-bleed background */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: 'url(/backgrounds/launch-altar.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        zIndex: 0,
      }} />

      {/* Dark gradient overlay */}
      <div style={{
        position: 'fixed',
        inset: 0,
        background: `
          radial-gradient(ellipse at 50% 60%, transparent 0%, rgba(0,0,0,0.4) 60%),
          linear-gradient(180deg, rgba(0,0,0,0.2) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.4) 100%)
        `,
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* Header */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '24px',
        zIndex: 50,
      }}>
        <ConnectButton />
      </div>

      {/* Form Content */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        minHeight: '100vh',
        padding: '60px 20px',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '520px',
        }}>
          {/* Title - THE FORGE */}
          <div style={{
            textAlign: 'center',
            marginBottom: '28px',
          }}>
            <p style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '14px',
              color: '#b8860b',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}>
              ⚒️ THE FORGE ⚒️
            </p>
            <h1 style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '36px',
              fontWeight: 700,
              color: '#ffd700',
              letterSpacing: '0.1em',
              textShadow: '0 0 30px rgba(255,215,0,0.5), 0 4px 8px rgba(0,0,0,0.5)',
              marginBottom: '8px',
            }}>
              FORGE YOUR TOKEN
            </h1>
            <p style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: '13px',
            }}>
              Shape your creation in the flames of PUMP.FUD
            </p>
          </div>

          {/* Main Form Card */}
          <div style={{
            background: 'rgba(15,10,5,0.9)',
            borderRadius: '16px',
            border: '2px solid rgba(139,69,19,0.5)',
            padding: '28px',
            boxShadow: '0 0 60px rgba(255,100,0,0.15), inset 0 0 40px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(10px)',
          }}>
            {/* Token Identity Section */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: '1px solid rgba(139,69,19,0.3)',
              }}>
                <span style={{ fontSize: '20px' }}>🔥</span>
                <span style={{
                  fontFamily: 'Cinzel, serif',
                  fontSize: '14px',
                  color: '#ffd700',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}>
                  Token Identity
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                marginBottom: '16px',
              }}>
                <div>
                  <label style={labelStyle}>Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Token name"
                    style={inputStyle}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'rgba(255,215,0,0.5)'
                      e.target.style.boxShadow = '0 0 20px rgba(255,215,0,0.15)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(139,69,19,0.4)'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Symbol *</label>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="TICKER"
                    maxLength={10}
                    style={inputStyle}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'rgba(255,215,0,0.5)'
                      e.target.style.boxShadow = '0 0 20px rgba(255,215,0,0.15)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(139,69,19,0.4)'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your token..."
                  rows={3}
                  style={{
                    ...inputStyle,
                    resize: 'none',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(255,215,0,0.5)'
                    e.target.style.boxShadow = '0 0 20px rgba(255,215,0,0.15)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(139,69,19,0.4)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              </div>
            </div>

            {/* Token Image Section */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: '1px solid rgba(139,69,19,0.3)',
              }}>
                <span style={{ fontSize: '20px' }}>🖼️</span>
                <span style={{
                  fontFamily: 'Cinzel, serif',
                  fontSize: '14px',
                  color: '#ffd700',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}>
                  Token Image
                </span>
              </div>

              <div style={{
                border: '2px dashed rgba(139,69,19,0.4)',
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center',
                backgroundColor: 'rgba(0,0,0,0.2)',
              }}>
                <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.7 }}>
                  📷
                </div>
                <p style={{ color: '#888', fontSize: '13px', marginBottom: '12px' }}>
                  Drag & drop or click to upload
                </p>
                <input
                  type="text"
                  value={imageUri}
                  onChange={(e) => setImageUri(e.target.value)}
                  placeholder="Or paste image URL..."
                  style={{
                    ...inputStyle,
                    padding: '10px 14px',
                    fontSize: '12px',
                    textAlign: 'center',
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Social Links Section */}
            <div style={{ marginBottom: '24px' }}>
              <button
                onClick={() => setShowSocials(!showSocials)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  padding: '12px 0',
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(139,69,19,0.3)',
                }}
              >
                <span style={{ fontSize: '20px' }}>🔗</span>
                <span style={{
                  fontFamily: 'Cinzel, serif',
                  fontSize: '14px',
                  color: '#ffd700',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  flex: 1,
                  textAlign: 'left',
                }}>
                  Social Links & Livestream
                </span>
                <span style={{
                  color: '#888',
                  fontSize: '11px',
                  fontStyle: 'italic',
                  marginRight: '8px',
                }}>
                  (Optional)
                </span>
                <span style={{ color: '#b8860b', fontSize: '12px' }}>
                  {showSocials ? '▼' : '▶'}
                </span>
              </button>

              {showSocials && (
                <div style={{
                  marginTop: '16px',
                  padding: '16px',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  borderRadius: '12px',
                  border: '1px solid rgba(139,69,19,0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}>
                  {socialFields.map((field) => (
                    <div key={field.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '18px', width: '28px', textAlign: 'center' }}>
                        {field.icon}
                      </span>
                      <div style={{ flex: 1 }}>
                        <input
                          type="text"
                          value={socials[field.key]}
                          onChange={(e) => updateSocial(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          style={socialInputStyle}
                          onFocus={(e) => {
                            e.target.style.borderColor = 'rgba(255,215,0,0.4)'
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = 'rgba(139,69,19,0.4)'
                          }}
                        />
                      </div>
                    </div>
                  ))}

                  <p style={{
                    color: '#666',
                    fontSize: '11px',
                    textAlign: 'center',
                    marginTop: '8px',
                    fontStyle: 'italic',
                  }}>
                    Add a Live Launch URL to stream your token launch event
                  </p>
                </div>
              )}
            </div>

            {/* Initial Buy Section */}
            <div style={{ marginBottom: '24px' }}>
              <button
                onClick={() => setShowInitialBuy(!showInitialBuy)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  padding: '12px 0',
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(139,69,19,0.3)',
                }}
              >
                <span style={{ fontSize: '20px' }}>💰</span>
                <span style={{
                  fontFamily: 'Cinzel, serif',
                  fontSize: '14px',
                  color: '#22c55e',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  flex: 1,
                  textAlign: 'left',
                }}>
                  Buy Tokens at Launch
                </span>
                <span style={{
                  color: '#888',
                  fontSize: '11px',
                  fontStyle: 'italic',
                  marginRight: '8px',
                }}>
                  (Recommended)
                </span>
                <span style={{ color: '#22c55e', fontSize: '12px' }}>
                  {showInitialBuy ? '▼' : '▶'}
                </span>
              </button>

              {showInitialBuy && (
                <div style={{
                  marginTop: '16px',
                  padding: '20px',
                  backgroundColor: 'rgba(34,197,94,0.05)',
                  borderRadius: '12px',
                  border: '1px solid rgba(34,197,94,0.2)',
                }}>
                  <p style={{
                    color: '#888',
                    fontSize: '12px',
                    marginBottom: '16px',
                    lineHeight: 1.5,
                  }}>
                    Be the first to buy your own token! This amount is added to the 100,000 PLS launch fee.
                    You'll receive tokens at the initial bonding curve price.
                  </p>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{
                      display: 'block',
                      fontFamily: 'Cinzel, serif',
                      fontSize: '11px',
                      color: '#22c55e',
                      marginBottom: '8px',
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                    }}>
                      Initial Buy Amount (PLS)
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        value={initialBuyAmount}
                        onChange={(e) => setInitialBuyAmount(e.target.value)}
                        placeholder="0"
                        style={{
                          ...inputStyle,
                          paddingRight: '60px',
                          borderColor: 'rgba(34,197,94,0.3)',
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = 'rgba(34,197,94,0.6)'
                          e.target.style.boxShadow = '0 0 20px rgba(34,197,94,0.15)'
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'rgba(34,197,94,0.3)'
                          e.target.style.boxShadow = 'none'
                        }}
                      />
                      <span style={{
                        position: 'absolute',
                        right: '16px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#666',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                      }}>
                        PLS
                      </span>
                    </div>
                  </div>

                  {/* Quick amount buttons */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '8px',
                    marginBottom: '12px',
                  }}>
                    {['1000', '5000', '10000', '50000'].map((val) => (
                      <button
                        key={val}
                        onClick={() => setInitialBuyAmount(val)}
                        style={{
                          padding: '8px',
                          backgroundColor: initialBuyAmount === val ? 'rgba(34,197,94,0.2)' : 'rgba(0,0,0,0.3)',
                          border: `1px solid ${initialBuyAmount === val ? 'rgba(34,197,94,0.5)' : 'rgba(34,197,94,0.2)'}`,
                          borderRadius: '6px',
                          color: initialBuyAmount === val ? '#22c55e' : '#888',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          cursor: 'pointer',
                        }}
                      >
                        {Number(val).toLocaleString()}
                      </button>
                    ))}
                  </div>

                  {/* Balance display */}
                  {plsBalance && (
                    <p style={{
                      color: '#666',
                      fontSize: '11px',
                      textAlign: 'right',
                    }}>
                      Balance: <span style={{ color: '#22c55e', fontFamily: 'monospace' }}>
                        {Number(formatEther(plsBalance.value)).toLocaleString(undefined, { maximumFractionDigits: 0 })} PLS
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Fee Notice */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(139,69,19,0.2) 0%, rgba(184,134,11,0.1) 100%)',
              border: '1px solid rgba(184,134,11,0.3)',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '24px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '28px' }}>⚗️</span>
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontFamily: 'Cinzel, serif',
                    color: '#ffd700',
                    fontSize: '12px',
                    letterSpacing: '0.1em',
                    marginBottom: '4px',
                  }}>
                    {initialBuyAmount ? 'TOTAL COST' : 'LAUNCH FEE'}
                  </p>
                  <p style={{ color: '#888', fontSize: '12px' }}>
                    {initialBuyAmount
                      ? `100K launch fee + ${Number(initialBuyAmount).toLocaleString()} PLS buy`
                      : 'Required to create your token'
                    }
                  </p>
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#ffd700',
                  textShadow: '0 0 15px rgba(255,215,0,0.5)',
                }}>
                  {initialBuyAmount
                    ? `${(100000 + Number(initialBuyAmount)).toLocaleString()} PLS`
                    : '100,000 PLS'
                  }
                </div>
              </div>

              {initialBuyAmount && Number(initialBuyAmount) > 0 && (
                <div style={{
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid rgba(184,134,11,0.2)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: '#888',
                }}>
                  <span>Launch Fee: 100,000 PLS</span>
                  <span style={{ color: '#22c55e' }}>
                    + Initial Buy: {Number(initialBuyAmount).toLocaleString()} PLS
                  </span>
                </div>
              )}
            </div>

            {/* Submit Button */}
            {isConnected ? (
              <button
                onClick={handleLaunch}
                disabled={!name || !symbol || isPending || isConfirming}
                style={{
                  width: '100%',
                  padding: '18px',
                  borderRadius: '12px',
                  background: (!name || !symbol || isPending || isConfirming)
                    ? 'linear-gradient(135deg, #333 0%, #222 100%)'
                    : 'linear-gradient(135deg, #b8860b 0%, #daa520 50%, #b8860b 100%)',
                  border: '2px solid rgba(255,215,0,0.5)',
                  color: (!name || !symbol || isPending || isConfirming) ? '#666' : '#000',
                  fontFamily: 'Cinzel, serif',
                  fontWeight: 700,
                  fontSize: '16px',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  cursor: (!name || !symbol || isPending || isConfirming) ? 'not-allowed' : 'pointer',
                  boxShadow: (!name || !symbol || isPending || isConfirming)
                    ? 'none'
                    : '0 0 40px rgba(255,215,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
                  transition: 'all 0.3s ease',
                }}
              >
                {isPending || isConfirming ? (
                  '⏳ Creating Token...'
                ) : (
                  '🚀 Launch Token'
                )}
              </button>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                padding: '24px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '12px',
                border: '1px dashed rgba(139,69,19,0.4)',
              }}>
                <span style={{
                  fontFamily: 'Cinzel, serif',
                  fontSize: '12px',
                  color: '#b8860b',
                  letterSpacing: '0.1em',
                }}>
                  Connect Wallet to Launch
                </span>
                <ConnectButton />
              </div>
            )}
          </div>

          {/* Back button */}
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'block',
              margin: '24px auto 0',
              padding: '10px 24px',
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(139,69,19,0.3)',
              borderRadius: '8px',
              color: '#888',
              fontFamily: 'Cinzel, serif',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,215,0,0.3)'
              e.currentTarget.style.color = '#ffd700'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'rgba(139,69,19,0.3)'
              e.currentTarget.style.color = '#888'
            }}
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}
