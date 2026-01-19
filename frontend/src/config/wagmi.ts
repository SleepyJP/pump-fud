import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http } from 'wagmi'

// PulseChain definition
const pulsechain = {
  id: 369,
  name: 'PulseChain',
  nativeCurrency: { name: 'PLS', symbol: 'PLS', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.pulsechain.com'] },
  },
  blockExplorers: {
    default: { name: 'PulseScan', url: 'https://scan.pulsechain.com' },
  },
} as const

export const config = getDefaultConfig({
  appName: 'PUMP.FUD',
  projectId: 'pump-fud-pulsechain',
  chains: [pulsechain],
  transports: {
    [pulsechain.id]: http('https://rpc.pulsechain.com'),
  },
})

// Contract addresses
export const PUMP_FUD_ADDRESS = '0x7e65383639d8418E826a78a2f5C784cd4Bdb92D7' as const
export const LEADERBOARD_ADDRESS = '0xAe213e8aFBf7d76667332092f817589fdaB68EC2' as const
export const TREASURY = '0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B' as const
export const WPLS = '0xA1077a294dDE1B09bB078844df40758a5D0f9a27' as const
export const WFUD = '0xa59A460B9bd6Db7b167e7082Df3C9D87EeBc9825' as const

// ABI for PumpFud contract
export const PUMP_FUD_ABI = [
  // Launch token
  {
    name: 'launchToken',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'imageUri', type: 'string' },
    ],
    outputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'tokenAddress', type: 'address' },
    ],
  },
  // Buy tokens (by token ID)
  {
    name: 'buyTokens',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'minTokensOut', type: 'uint256' },
    ],
    outputs: [{ name: 'tokensOut', type: 'uint256' }],
  },
  // Sell tokens (by token ID)
  {
    name: 'sellTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'tokensIn', type: 'uint256' },
      { name: 'minPlsOut', type: 'uint256' },
    ],
    outputs: [{ name: 'plsOut', type: 'uint256' }],
  },
  // Get token by ID
  {
    name: 'getToken',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'imageUri', type: 'string' },
          { name: 'creator', type: 'address' },
          { name: 'reserveBalance', type: 'uint256' },
          { name: 'tokensSold', type: 'uint256' },
          { name: 'tradingVolume', type: 'uint256' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'graduatedAt', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'holderCount', type: 'uint256' },
          { name: 'tradeCount', type: 'uint256' },
        ],
      },
    ],
  },
  // Get token by address
  {
    name: 'getTokenByAddress',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenAddress', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'imageUri', type: 'string' },
          { name: 'creator', type: 'address' },
          { name: 'reserveBalance', type: 'uint256' },
          { name: 'tokensSold', type: 'uint256' },
          { name: 'tradingVolume', type: 'uint256' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'graduatedAt', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'holderCount', type: 'uint256' },
          { name: 'tradeCount', type: 'uint256' },
        ],
      },
    ],
  },
  // Token ID by address
  {
    name: 'tokenToId',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenAddress', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Get all tokens (paginated)
  {
    name: 'getAllTokens',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'imageUri', type: 'string' },
          { name: 'creator', type: 'address' },
          { name: 'reserveBalance', type: 'uint256' },
          { name: 'tokensSold', type: 'uint256' },
          { name: 'tradingVolume', type: 'uint256' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'graduatedAt', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'holderCount', type: 'uint256' },
          { name: 'tradeCount', type: 'uint256' },
        ],
      },
    ],
  },
  // Get live tokens (paginated)
  {
    name: 'getLiveTokens',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'imageUri', type: 'string' },
          { name: 'creator', type: 'address' },
          { name: 'reserveBalance', type: 'uint256' },
          { name: 'tokensSold', type: 'uint256' },
          { name: 'tradingVolume', type: 'uint256' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'graduatedAt', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'holderCount', type: 'uint256' },
          { name: 'tradeCount', type: 'uint256' },
        ],
      },
    ],
  },
  // Token count
  { name: 'tokenCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  // Get buy quote
  {
    name: 'calculateBuyAmount',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'plsIn', type: 'uint256' },
    ],
    outputs: [{ name: 'tokensOut', type: 'uint256' }],
  },
  // Get sell quote
  {
    name: 'calculateSellAmount',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'tokensIn', type: 'uint256' },
    ],
    outputs: [{ name: 'plsOut', type: 'uint256' }],
  },
  // Current price
  {
    name: 'getCurrentPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: 'price', type: 'uint256' }],
  },
  // Parameters
  { name: 'graduationThreshold', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'maxSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'launchFee', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'buyFeeBps', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'sellFeeBps', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'feeWhitelist', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
] as const

// ABI for PumpFudLeaderboard contract
export const LEADERBOARD_ABI = [
  // Get user stats
  {
    name: 'getUserStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'totalVolume', type: 'uint256' },
          { name: 'totalBuyValue', type: 'uint256' },
          { name: 'totalSellValue', type: 'uint256' },
          { name: 'tradeCount', type: 'uint256' },
          { name: 'buyCount', type: 'uint256' },
          { name: 'sellCount', type: 'uint256' },
          { name: 'referralCount', type: 'uint256' },
          { name: 'referralVolume', type: 'uint256' },
          { name: 'referralEarnings', type: 'uint256' },
          { name: 'pendingReferral', type: 'uint256' },
          { name: 'lastTradeTime', type: 'uint256' },
        ],
      },
    ],
  },
  // Get user referrals
  {
    name: 'getUserReferrals',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'address[]' }],
  },
  // Calculate ROI
  {
    name: 'calculateROI',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: 'roi', type: 'int256' }],
  },
  // Get total traders
  {
    name: 'getTotalTraders',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Get traders (paginated)
  {
    name: 'getTraders',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [{ name: 'result', type: 'address[]' }],
  },
  // Get top volume traders
  {
    name: 'getTopVolumeTraders',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'count', type: 'uint256' }],
    outputs: [
      { name: 'addresses', type: 'address[]' },
      { name: 'volumes', type: 'uint256[]' },
    ],
  },
  // Get top referrers
  {
    name: 'getTopReferrers',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'count', type: 'uint256' }],
    outputs: [
      { name: 'addresses', type: 'address[]' },
      { name: 'referralCounts', type: 'uint256[]' },
      { name: 'referralVolumes', type: 'uint256[]' },
    ],
  },
  // Get top ROI traders
  {
    name: 'getTopROITraders',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'count', type: 'uint256' }],
    outputs: [
      { name: 'addresses', type: 'address[]' },
      { name: 'rois', type: 'int256[]' },
      { name: 'volumes', type: 'uint256[]' },
    ],
  },
  // Register referrer
  {
    name: 'registerReferrer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'referrer', type: 'address' }],
    outputs: [],
  },
  // Claim referral rewards
  {
    name: 'claimReferralRewards',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  // Get referrer of user
  {
    name: 'referrerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
  },
  // Adjustable parameters (view)
  { name: 'referralFeeBps', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'minVolumeForROI', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'minTradesForROI', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
] as const
