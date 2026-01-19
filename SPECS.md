# PUMP.FUD BUILD SPECIFICATIONS
## PulseChain Bonding Curve Launchpad

**Treasury**: `0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B`
**Network**: PulseChain (369)
**WPLS**: `0xA1077a294dDE1B09bB078844df40758a5D0f9a27`
**PulseX V2 Router**: `0x165C3410fC91EF562C50559f7d2289fEbed552d9`
**PulseX V2 Factory**: `0x29eA7545DEf87022BAdc76323F373EA1e707C523`

---

## PUMP.FUD PARAMETERS (1/4 of pump.tires)

### Reference: pump.tires
- **Graduation**: 200,000,000 PLS
- **Total Supply**: 1,000,000,000 tokens
- **LP**: Burned permanently
- **Creator Reward**: 1% of PLS liquidity

### PUMP.FUD Parameters (1/4 scale)
```solidity
GRADUATION_THRESHOLD = 50,000,000 PLS    // 50M PLS
MAX_SUPPLY = 250,000,000 tokens          // 250M tokens
VIRTUAL_PLS_RESERVES = 15,000,000 PLS    // 15M virtual
VIRTUAL_TOKEN_RESERVES = 250,000,000     // 250M virtual
BURN_BPS = 2000                          // 20% (1/5) burned to dead address
PULSEX_LP_BPS = 1000                     // 10% burns to PulseX V2 LP
PAISLEY_LP_BPS = 0                       // 0% to Paisley Swap DEX
SUCCESS_REWARD_BPS = 500                 // 5% success reward to treasury
PLATFORM_FEE_BPS = 100                   // 1% trading fee
```

### Platform Token
- **wFUD**: `0xa59A460B9bd6Db7b167e7082Df3C9D87EeBc9825`
- Rewarding token with future use cases

---

## BONDING CURVE FORMULA

**Type**: Constant Product AMM (x * y = k)

```
k = (VIRTUAL_PLS + realPLS) * (VIRTUAL_TOKENS - tokensSold)

Buy:
  newPlsReserve = oldPlsReserve + plsIn
  newTokenReserve = k / newPlsReserve
  tokensOut = oldTokenReserve - newTokenReserve

Sell:
  newTokenReserve = oldTokenReserve + tokensIn
  newPlsReserve = k / newTokenReserve
  plsOut = oldPlsReserve - newPlsReserve

Price:
  price = plsReserve / tokenReserve
```

---

## TOKEN LIFECYCLE

### 1. Launch
- User calls `launchToken(name, symbol, description, imageUri)`
- New `PumpFudToken` ERC20 deployed
- Token status: `Live`
- No tokens minted yet

### 2. Trading (Bonding Curve)
- Buy: PLS → Tokens minted
- Sell: Tokens burned → PLS returned
- 1% platform fee on all trades → Treasury
- Price increases with purchases (constant product)

### 3. Graduation (at 50M PLS threshold)
- Automatic when `reserveBalance >= GRADUATION_THRESHOLD`
- **20% of tokens burned** to dead address
- **10% burns to PulseX V2 LP** (LP tokens burned permanently)
- **0% to Paisley Swap DEX**
- **5% of PLS** sent to TREASURY as success reward
- Remaining tokens stay with holders
- Trading continues on PulseX V2 forever

---

## GRADUATION FLOW

```
1. reserveBalance hits 50M PLS
2. Calculate splits:
   - tokensToBurnDead = totalTokensSold * 20% → DEAD_ADDRESS
   - tokensForPulseXLP = totalTokensSold * 10% → mint for LP
   - successReward = totalPLS * 5% → TREASURY
   - plsForLP = totalPLS - successReward → PulseX V2 LP

3. Mint 20% tokens and burn to dead address
4. Mint 10% tokens for LP
5. Approve PulseX V2 Router
6. addLiquidityETH:
   - Token + PLS → LP pair
   - LP tokens sent to DEAD_ADDRESS (burned permanently)

7. Send 5% PLS to TREASURY as success reward
8. Token status → Graduated
9. Bonding curve disabled
10. Trading on PulseX V2 only
```

---

## FEE STRUCTURE

| Fee Type | Amount | Destination |
|----------|--------|-------------|
| Launch Fee | 0 (configurable) | Treasury |
| Trading Fee | 1% (configurable) | Treasury |
| Success Reward | 5% of PLS | Treasury (on graduation) |

---

## TOKEN STATES

```solidity
enum TokenStatus {
    Live,       // Trading on bonding curve
    Graduated,  // Migrated to PulseX V2
    Rugged      // Reserved for future use
}
```

---

## STRUCT DEFINITIONS

```solidity
struct MemeToken {
    uint256 id;
    address tokenAddress;
    string name;
    string symbol;
    string description;
    string imageUri;
    address creator;
    uint256 reserveBalance;      // Real PLS in curve
    uint256 tokensSold;          // Tokens minted
    uint256 tradingVolume;
    uint256 createdAt;
    uint256 graduatedAt;
    TokenStatus status;
    uint256 holderCount;
    uint256 tradeCount;
}
```

---

## CONTRACT FILES

```
pump-fud/
├── foundry.toml
├── SPECS.md
├── src/
│   ├── PumpFud.sol              # Main launchpad contract
│   ├── PumpFudToken.sol         # ERC20 with mint/burn
│   ├── PumpFudArbitrage.sol     # ONLYBOTS arb integration
│   └── interfaces/
│       ├── IPumpFud.sol
│       ├── IPumpFudToken.sol
│       └── IPulseXRouter.sol
├── script/
│   └── Deploy.s.sol             # Deployment script
└── test/
    ├── PumpFud.t.sol            # Unit tests
    ├── PumpFud.fork.t.sol       # Fork tests (PulseChain)
    └── PumpFudArbitrage.t.sol   # Arbitrage tests
```

---

## DEPLOYMENT

```bash
# Install dependencies
cd /home/sleepyj/pump-fud && forge install OpenZeppelin/openzeppelin-contracts

# Build
forge build

# Test
forge test -vvv

# Fork test (requires PulseChain RPC)
forge test --match-contract PumpFudForkTest --fork-url https://rpc.pulsechain.com -vvv

# Deploy to PulseChain
forge script script/Deploy.s.sol:DeployPumpFud --rpc-url pulsechain --broadcast --verify

# Deploy to testnet
forge script script/Deploy.s.sol:DeployPumpFud --rpc-url pulsechain_testnet --broadcast
```

---

## SECURITY CONSIDERATIONS

1. **Reentrancy Protection**: ReentrancyGuard on all state-changing functions
2. **Slippage Protection**: minTokensOut/minPlsOut parameters
3. **Fee Limits**: Max 5% trading fee (hardcoded)
4. **LP Burned**: Cannot be retrieved - permanent liquidity
5. **No Admin Token Control**: Factory can only mint during bonding curve
6. **Ownership Renounced**: Token contract has no owner functions

---

## GRADUATION ALLOCATION SUMMARY

| Allocation | BPS | Percentage | Destination |
|------------|-----|------------|-------------|
| Burn to Dead | 2000 | 20% | 0x...dEaD |
| PulseX V2 LP | 1000 | 10% | PulseX V2 (LP burned) |
| Paisley Swap | 0 | 0% | N/A |
| Success Reward | 500 | 5% PLS | Treasury |
| Holder Tokens | - | 70% | Stay with holders |

---

## INTEGRATION WITH PAISLEY PROTOCOL

After graduation, tokens trade on PulseX V2 through:
- **Direct PulseX V2 Router**: Standard swaps
- **Paisley Aggregator**: Best price across all DEXes
- **Paisley Router**: Unified swap interface

```
                    ┌─────────────────────┐
                    │     PUMP.FUD UI     │
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
    ┌─────────▼─────────┐           ┌──────────▼──────────┐
    │  PumpFud Contract  │           │   PaisleyRouter     │
    │  (Bonding Curve)   │           │   (After Graduation)│
    └─────────┬──────────┘           └──────────┬──────────┘
              │                                 │
              │ graduation                      │
              │ (50M PLS)                       │
              ▼                                 ▼
    ┌─────────────────────┐         ┌──────────────────────┐
    │  PulseX V2 LP Pair  │────────▶│  PaisleyAggregator   │
    │  (LP Burned)        │         │  (Best Route)        │
    └─────────────────────┘         └──────────────────────┘
```

---

## ONLYBOTS ARBITRAGE INTEGRATION

### Overview
PumpFudArbitrage.sol integrates ONLYBOTS architecture for platform arbitrage:

1. **Bonding Curve vs PulseX Arbitrage** (pre-graduation)
   - Compare prices between pump.fud curve and PulseX LP
   - Execute arb when price differential exceeds threshold

2. **Cross-DEX Arbitrage** (post-graduation)
   - Monitor graduated tokens on watchlist
   - Scan PulseX V1, V2, and 9inch for price discrepancies
   - Execute profitable arb trades

3. **Graduation Positioning**
   - Scan tokens nearing graduation threshold (50M PLS)
   - Position early for graduation price discrepancy

### Arbitrage Contract
```solidity
// Key functions
function checkBondingCurveArb(tokenId, plsAmount) → (profit, buyOnCurve)
function executeBondingCurveArb(tokenId, plsAmount, buyOnCurve, minProfit)
function checkCrossDexArb(token, plsAmount, routerBuy, routerSell) → (profit, profitable)
function executeCrossDexArb(token, plsAmount, routerBuy, routerSell, minProfit)
function scanWatchedTokens(plsAmount) → (tokens, profits, buyRouters, sellRouters)
function scanNearGraduation(tokenIds, thresholdPct) → (nearGradIds, reserves, percents)
```

### Supported DEXes
- PulseX V1: `0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02`
- PulseX V2: `0x165C3410fC91EF562C50559f7d2289fEbed552d9`
- 9inch: `0x5bCa5697F3a82F0360544a6e8b3e1f8a98c567d1`

### Bot Settings
- `minProfitBps`: 25 (0.25% minimum profit)
- `maxGasPrice`: 100 gwei
- `maxPositionPls`: 10,000 PLS per trade

### Profit Flow
All arbitrage profits → TREASURY (`0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B`)

---

## NEXT STEPS

1. [x] PumpFud.sol - Main bonding curve contract
2. [x] PumpFudToken.sol - ERC20 with mint/burn
3. [x] Interfaces
4. [x] Deployment script
5. [x] Test suite
6. [x] Fork test suite
7. [x] PumpFudArbitrage.sol - ONLYBOTS integration
8. [ ] Frontend integration
9. [ ] Deploy to testnet
10. [ ] Audit
11. [ ] Deploy to mainnet
