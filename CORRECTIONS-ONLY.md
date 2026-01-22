# PUMP.FUD - CORRECTIONS ONLY
## DO NOT REBUILD - FIX THESE SPECIFIC ITEMS

---

## 🚨 CRITICAL FIXES

### 1. GRADUATION THRESHOLD DISPLAY
**Current:** Shows 100K PLS  
**Correct:** 50,000,000 PLS (50M)  
**Where:** Wherever graduation progress/threshold is displayed

### 2. GAS LIMIT ON BUY TRANSACTIONS
**Current:** Default gas estimation  
**Correct:** Set `gasLimit: 10000000` on ALL buyTokens() calls  
**Why:** Graduation requires ~5M gas, will fail without this

### 3. REMOVE ALL FAKE/PLACEHOLDER DATA
- No hardcoded token lists
- No mock prices
- No fake holder counts
- No placeholder images for tokens that don't have them
- ALL data must come from contract reads or indexed events

---

## 📍 SPECIFIC ITEMS TO VERIFY

| Item | Should Show | Source |
|------|-------------|--------|
| Token Price | Calculated from bonding curve | Contract: `getCurrentPrice(tokenId)` |
| Market Cap | Price × Supply | Calculate from contract data |
| Holder Count | Real holders | Index Transfer events |
| Graduation Progress | plsCollected / 50,000,000 | Contract: `tokens(tokenId).plsCollected` |
| Your Balance | User's token balance | Contract: `balanceOf(user, tokenAddress)` |

---

## 🖼️ IMAGES TO ADD

_List specific images needed here:_

1. 
2. 
3. 

---

## 📝 TEXT/COPY CORRECTIONS

_List specific text changes here:_

| Location | Current Text | Change To |
|----------|--------------|-----------|
| | | |
| | | |

---

## ⚠️ DO NOT

- Do NOT rebuild the platform
- Do NOT change the contract integration
- Do NOT restructure the codebase
- Do NOT add new features
- ONLY fix the items listed above

---

**Contract Address:** `0xeb5ae44D7bC13A86e02051887d8C12e61ba90659`  
**Chain:** PulseChain (369)  
**Graduation Threshold:** 50,000,000 PLS  
**Test Threshold:** 10,000 PLS (for tokens marked as test)
