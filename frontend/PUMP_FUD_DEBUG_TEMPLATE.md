# PUMP.FUD COMPREHENSIVE DEBUG TEMPLATE
## Ralph Wiggum Validation Loop System

---

## 🎯 CRITICAL ISSUES IDENTIFIED

### 1. BRANDING VIOLATIONS (SEVERITY: CRITICAL)
| Issue | Current | Required | File |
|-------|---------|----------|------|
| Logo | "P" letter / 🔥 emoji | Neon pill logo (`/images/pump-pill-neon.png`) | Header.tsx, TokenDashboard.tsx |
| Primary Color | `#dc143c` (RED) | `#00ff00` (GREEN) | TokenDashboard.tsx, App.tsx |
| Secondary Color | Various reds | `#ffffff` (WHITE) | Multiple files |
| Text Style | Generic | Neon glow effect | Global |

### 2. NON-FUNCTIONAL COMPONENTS (SEVERITY: HIGH)
| Component | Issue | Fix Required |
|-----------|-------|--------------|
| Chart | Not connected to real data | Implement actual price feed |
| Swap | Buy/Sell quotes loading forever | Fix contract reads |
| Wallet Connect | Not persisting | Check RainbowKit config |
| Dashboard Buttons | Non-responsive | Add proper onClick handlers |

### 3. MISSING FEATURES (SEVERITY: MEDIUM)
| Feature | Status | Implementation Notes |
|---------|--------|---------------------|
| Live Chat Popup | Exists but incomplete | Token-gated: 1% supply required |
| Message Board Popup | Exists but incomplete | Token-gated: 0.5% supply required |
| Super Chat | Missing | Fee-based prominent messages |
| Holder Rankings | Missing | Sort by wallet balance |
| Buy/Sell Feed | Missing | Real-time transaction display |
| Token Description | Missing section | Below swap interface |
| Social Links | Non-functional | Twitter, Telegram, Discord, Instagram |

### 4. UI/UX PROBLEMS (SEVERITY: MEDIUM)
| Issue | Location | Fix |
|-------|----------|-----|
| Background too prominent | TokenDashboard | Reduce opacity, add overlay |
| Poor contrast | All components | Add dark overlays to components |
| Same background for all tokens | Token pages | Dynamic background per token |

---

## 🔧 FIX IMPLEMENTATION ORDER

### PHASE 1: BRANDING FIX (Priority 1)
```
VALIDATION CHECKPOINT 1:
□ All red (#dc143c, #8B0000, #DC143C) replaced with green (#00ff00)
□ Neon pill logo displayed in Header
□ Neon pill logo displayed in TokenDashboard header
□ No flame emojis used for branding
□ Neon glow effect on PUMP.FUD text
```

### PHASE 2: FUNCTIONALITY FIX (Priority 2)
```
VALIDATION CHECKPOINT 2:
□ Chart displays actual bonding curve data
□ Buy/Sell transactions execute successfully
□ Wallet connection persists across pages
□ All buttons trigger correct actions
□ Price quotes load within 2 seconds
```

### PHASE 3: FEATURE IMPLEMENTATION (Priority 3)
```
VALIDATION CHECKPOINT 3:
□ Live Chat popup opens with token gate check
□ Message Board popup opens with token gate check
□ Super Chat functionality works
□ Holder rankings display correctly
□ Buy/Sell feed updates in real-time
□ Token description section visible
□ Social links functional
```

### PHASE 4: UI/UX POLISH (Priority 4)
```
VALIDATION CHECKPOINT 4:
□ Background opacity reduced to 0.15-0.20
□ All components have proper contrast
□ Each token has unique background
□ Mobile responsive
□ No console errors
```

---

## 📁 FILES TO MODIFY

### Core Files:
1. `src/components/Header.tsx` - Logo + branding
2. `src/pages/TokenDashboard.tsx` - Main dashboard + colors
3. `src/pages/HomePage.tsx` - Landing page branding
4. `src/App.tsx` - Global styles + color themes
5. `src/components/PriceChart.tsx` - Chart functionality
6. `src/pages/LiveChatPopup.tsx` - Token gate implementation
7. `src/pages/MessageBoardPopup.tsx` - Token gate implementation
8. `tailwind.config.js` - Color palette

### New Files to Create:
1. `src/components/TransactionFeed.tsx` - Real-time buy/sell feed
2. `src/components/HolderRankings.tsx` - Holder leaderboard
3. `src/components/TokenDescription.tsx` - Token info section
4. `src/components/SuperChat.tsx` - Premium message system

---

## 🎨 CORRECT COLOR PALETTE

```typescript
// PUMP.FUD Official Colors
const colors = {
  // Primary - NEON GREEN
  primary: '#00ff00',
  primaryDark: '#00cc00',
  primaryGlow: 'rgba(0, 255, 0, 0.4)',
  
  // Secondary - WHITE
  secondary: '#ffffff',
  secondaryMuted: '#e0e0e0',
  
  // Background - DARK
  bgDark: '#0a0a0a',
  bgMedium: '#1a1a1a',
  bgLight: '#252525',
  
  // Accent - PURPLE (for graduated tokens)
  accent: '#a855f7',
  accentGlow: 'rgba(168, 85, 247, 0.4)',
  
  // Status Colors
  success: '#22c55e',
  warning: '#eab308',
  error: '#ef4444',
  
  // BANNED COLORS - DO NOT USE
  // ❌ #dc143c (Crimson Red)
  // ❌ #8B0000 (Dark Red)
  // ❌ #FF2400 (Scarlet)
  // ❌ Any red hue
}
```

---

## 🧪 RALPH WIGGUM VALIDATION LOOPS

### Loop 1: Build Validation
```bash
cd /home/sleepyj/pump-fud/frontend && npm run build
# Expected: zero errors, zero warnings
# If fail: Fix TypeScript/syntax errors first
```

### Loop 2: Lint Validation
```bash
cd /home/sleepyj/pump-fud/frontend && npm run lint
# Expected: zero errors
# If fail: Fix ESLint issues
```

### Loop 3: Type Check
```bash
cd /home/sleepyj/pump-fud/frontend && npx tsc --noEmit
# Expected: zero type errors
# If fail: Fix TypeScript types
```

### Loop 4: Color Audit
```bash
cd /home/sleepyj/pump-fud/frontend && grep -rn "dc143c\|8B0000\|crimson\|#DC143C" src/
# Expected: zero matches
# If fail: Replace all red colors with green
```

### Loop 5: Visual Validation
```bash
cd /home/sleepyj/pump-fud/frontend && npm run dev
# Manual check:
# □ Green neon logo visible in header
# □ No red elements anywhere
# □ All buttons clickable
# □ Chart displays data
# □ Wallet connects successfully
```

---

## 📋 TREASURY ADDRESS
**ALL FEES ROUTE TO:**
```
0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B
```

---

## 🚀 DEPLOYMENT CHECKLIST

Before deploying to Vercel:
```
□ npm run build passes with 0 errors
□ npm run lint passes with 0 errors  
□ All red colors removed (grep check)
□ Logo images present in /public/images/
□ Background images present in /public/backgrounds/
□ .env.local has correct contract addresses
□ wagmi.ts has correct PulseChain config
□ All 5 validation loops pass
```

---

## 📝 NOTES

- NEVER use placeholder code
- NEVER use mock implementations
- ALL code must be production-ready
- Test EVERY feature before deployment
- Use absolute paths for all imports
- Mobile responsive is REQUIRED
