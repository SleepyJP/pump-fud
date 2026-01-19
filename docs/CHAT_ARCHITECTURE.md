# PUMP.pHuD Token Dashboard Chat System
## Architecture Specification v1.0

**Network:** PulseChain Mainnet (Chain ID: 369)
**Treasury:** 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B

---

## SCRAPED INTEL SUMMARY

### Source 1: pump-chat-client (npm)
WebSocket client using Socket.io protocol for pump.fun chat rooms.

**Message Interface:**
```typescript
interface IMessage {
  id: string;
  roomId: string;           // Token address
  username: string;
  userAddress: string;
  message: string;
  profile_image: string;
  timestamp: string;
  messageType: string;
  expiresAt: number;
}
```

**Protocol:** Socket.io over WebSocket
- Automatic reconnection with exponential backoff
- Message history with configurable limits
- Event-driven architecture (connected, message, messageHistory, error, disconnected)

### Source 2: harmony-one/pump.fun.backend
NestJS backend with PostgreSQL for pump.fun clone.

**Comment Entity:**
```typescript
@Entity({ name: 'comments' })
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  text: string;

  @ManyToOne(() => UserAccount)
  user: UserAccount;

  @ManyToOne(() => Token)
  token: Token;

  @CreateDateColumn()
  createdAt: Date;
}
```

**Auth Flow:**
1. POST `/user/nonce` - Get one-time nonce
2. Sign message with wallet: "I'm signing my one-time nonce: <nonce>"
3. POST `/user/verify` - Verify signature, get JWT tokens
4. Use JWT for authenticated endpoints

**Comment Endpoints:**
- GET `/comments?tokenAddress=0x...&limit=100&offset=0&sortingOrder=DESC`
- POST `/comment` (requires JWT) - { tokenAddress, text }

---

## PUMP.pHuD CHAT ARCHITECTURE

### 1. DUAL CHAT MODES

#### Mode A: Telegram-Style Sliding Chat Panel
- Slides in from right side of token dashboard
- Real-time WebSocket messages
- User avatars, timestamps, reply threads
- Floating window that can be resized/repositioned

#### Mode B: YouTube Live-Style Message Board
- Vertical scrolling message feed
- Messages flow upward in real-time
- Superchat highlighted messages with token amounts
- Pinned messages for creator announcements

### 2. TOKEN-GATED ACCESS SYSTEM

**Configurable Access Threshold:**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IChatAccess {
    struct AccessConfig {
        uint256 minimumBalance;     // Minimum tokens to hold (in wei)
        uint256 minimumPercentage;  // Minimum % of supply (basis points, 100 = 1%)
        bool requiresHolding;       // Toggle for token gating
        bool superchatEnabled;      // Toggle for superchat feature
    }

    function canAccessChat(address token, address user) external view returns (bool);
    function getAccessConfig(address token) external view returns (AccessConfig memory);
    function setAccessConfig(address token, AccessConfig calldata config) external;
}
```

**Backend Verification:**
```typescript
// Token-gated chat access check
async function verifyTokenAccess(
  tokenAddress: string,
  userAddress: string,
  accessConfig: AccessConfig
): Promise<boolean> {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  const [balance, totalSupply] = await Promise.all([
    tokenContract.balanceOf(userAddress),
    tokenContract.totalSupply()
  ]);

  // Check minimum balance
  if (accessConfig.minimumBalance > 0n) {
    if (balance < accessConfig.minimumBalance) return false;
  }

  // Check minimum percentage (basis points)
  if (accessConfig.minimumPercentage > 0) {
    const userPercentage = (balance * 10000n) / totalSupply;
    if (userPercentage < BigInt(accessConfig.minimumPercentage)) return false;
  }

  return true;
}
```

**Default Config (Adjustable):**
- `minimumPercentage`: 100 (1% of supply)
- Can be adjusted per-token by creator
- Platform default can be changed globally

### 3. SUPERCHAT SYSTEM (Unbonded Token Tipping)

**Core Concept:** Users can tip the chat with the token itself (before bonding), creating engagement and redistribution.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SuperchatManager is ReentrancyGuard {
    address public immutable TREASURY = 0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B;

    uint256 public platformFeeBps = 500; // 5% platform fee

    struct Superchat {
        address sender;
        address recipient;      // address(0) = broadcast to chat
        address token;
        uint256 amount;
        string message;
        uint256 timestamp;
        uint256 tier;           // 1-5 based on amount
    }

    struct TierConfig {
        uint256 tier1Min;       // Basic highlight
        uint256 tier2Min;       // Blue highlight
        uint256 tier3Min;       // Purple highlight
        uint256 tier4Min;       // Gold highlight
        uint256 tier5Min;       // Diamond + animation
    }

    mapping(address => TierConfig) public tokenTiers;
    mapping(address => Superchat[]) public tokenSuperchats;

    event SuperchatSent(
        address indexed token,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        string message,
        uint256 tier
    );

    function sendSuperchat(
        address token,
        address recipient,
        uint256 amount,
        string calldata message
    ) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(bytes(message).length <= 200, "Message too long");

        // Transfer tokens from sender
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        // Calculate platform fee
        uint256 fee = (amount * platformFeeBps) / 10000;
        uint256 recipientAmount = amount - fee;

        // Send fee to treasury
        IERC20(token).transfer(TREASURY, fee);

        // If broadcast (recipient = address(0)), tokens get burned or redistributed
        if (recipient == address(0)) {
            // Option A: Burn (reduces supply, pumps price)
            // IERC20Burnable(token).burn(recipientAmount);

            // Option B: Send to token contract (locked)
            IERC20(token).transfer(token, recipientAmount);
        } else {
            // Direct tip to user
            IERC20(token).transfer(recipient, recipientAmount);
        }

        uint256 tier = calculateTier(token, amount);

        tokenSuperchats[token].push(Superchat({
            sender: msg.sender,
            recipient: recipient,
            token: token,
            amount: amount,
            message: message,
            timestamp: block.timestamp,
            tier: tier
        }));

        emit SuperchatSent(token, msg.sender, recipient, amount, message, tier);
    }

    function calculateTier(address token, uint256 amount) public view returns (uint256) {
        TierConfig memory config = tokenTiers[token];

        if (amount >= config.tier5Min) return 5;
        if (amount >= config.tier4Min) return 4;
        if (amount >= config.tier3Min) return 3;
        if (amount >= config.tier2Min) return 2;
        if (amount >= config.tier1Min) return 1;
        return 0;
    }

    function setTierConfig(address token, TierConfig calldata config) external {
        // Only token creator or platform admin
        tokenTiers[token] = config;
    }
}
```

### 4. REAL-TIME WEBSOCKET SERVER

```typescript
// Socket.io server for PUMP.pHuD chat
import { Server } from 'socket.io';
import { ethers } from 'ethers';

interface ChatMessage {
  id: string;
  roomId: string;          // Token address
  sender: string;          // Wallet address
  username: string;
  avatar: string;
  message: string;
  timestamp: number;
  type: 'message' | 'superchat' | 'system';
  superchat?: {
    amount: string;
    tier: number;
    txHash: string;
  };
}

interface JoinRoomPayload {
  tokenAddress: string;
  signature: string;
  message: string;
}

const io = new Server(server, {
  cors: { origin: '*' }
});

// Token room namespace
const chatNamespace = io.of('/chat');

chatNamespace.on('connection', async (socket) => {

  socket.on('join_room', async (payload: JoinRoomPayload) => {
    const { tokenAddress, signature, message } = payload;

    // Verify signature
    const recoveredAddress = ethers.verifyMessage(message, signature);

    // Check token-gated access
    const hasAccess = await verifyTokenAccess(tokenAddress, recoveredAddress);

    if (!hasAccess) {
      socket.emit('access_denied', {
        reason: 'Insufficient token balance',
        required: await getAccessConfig(tokenAddress)
      });
      return;
    }

    // Join the token's chat room
    socket.join(tokenAddress);
    socket.data.userAddress = recoveredAddress;
    socket.data.tokenAddress = tokenAddress;

    // Send recent message history
    const history = await getMessageHistory(tokenAddress, 50);
    socket.emit('message_history', history);

    // Announce join
    chatNamespace.to(tokenAddress).emit('user_joined', {
      address: recoveredAddress,
      timestamp: Date.now()
    });
  });

  socket.on('send_message', async (content: string) => {
    const { userAddress, tokenAddress } = socket.data;

    if (!userAddress || !tokenAddress) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    // Re-verify access (in case they sold tokens)
    const hasAccess = await verifyTokenAccess(tokenAddress, userAddress);
    if (!hasAccess) {
      socket.emit('access_revoked', { reason: 'Token balance below threshold' });
      socket.leave(tokenAddress);
      return;
    }

    const message: ChatMessage = {
      id: generateId(),
      roomId: tokenAddress,
      sender: userAddress,
      username: await getUsername(userAddress),
      avatar: await getAvatar(userAddress),
      message: content,
      timestamp: Date.now(),
      type: 'message'
    };

    // Save to database
    await saveMessage(message);

    // Broadcast to room
    chatNamespace.to(tokenAddress).emit('new_message', message);
  });

  socket.on('disconnect', () => {
    const { userAddress, tokenAddress } = socket.data;
    if (tokenAddress) {
      chatNamespace.to(tokenAddress).emit('user_left', {
        address: userAddress,
        timestamp: Date.now()
      });
    }
  });
});

// Listen for on-chain superchat events
const superchatContract = new ethers.Contract(SUPERCHAT_ADDRESS, SUPERCHAT_ABI, provider);

superchatContract.on('SuperchatSent', async (token, sender, recipient, amount, message, tier) => {
  const superchatMessage: ChatMessage = {
    id: generateId(),
    roomId: token,
    sender: sender,
    username: await getUsername(sender),
    avatar: await getAvatar(sender),
    message: message,
    timestamp: Date.now(),
    type: 'superchat',
    superchat: {
      amount: ethers.formatUnits(amount, 18),
      tier: tier.toNumber(),
      txHash: '' // Get from event
    }
  };

  await saveMessage(superchatMessage);
  chatNamespace.to(token).emit('superchat', superchatMessage);
});
```

### 5. FRONTEND COMPONENTS

#### Telegram-Style Chat Panel
```typescript
// React component structure
interface ChatPanelProps {
  tokenAddress: string;
  position: 'right' | 'bottom' | 'floating';
  isOpen: boolean;
  onClose: () => void;
}

// Features:
// - Slide-in animation from right
// - Resizable/draggable in floating mode
// - Reply threads
// - User mentions (@username)
// - Emoji reactions
// - Image/GIF support
// - Message search
```

#### YouTube Live-Style Feed
```typescript
interface LiveChatFeedProps {
  tokenAddress: string;
  showSuperchatsOnly: boolean;
  autoScroll: boolean;
}

// Features:
// - Vertical scrolling feed
// - Superchat highlights with tier colors
// - Tier 5 superchats get animation
// - Pinned messages at top
// - Member badges (based on holding %)
```

### 6. DATABASE SCHEMA

```sql
-- Messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address VARCHAR(42) NOT NULL,
  sender_address VARCHAR(42) NOT NULL,
  message TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'message',
  superchat_amount NUMERIC(78, 0),
  superchat_tier INTEGER,
  superchat_tx_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_token_created (token_address, created_at DESC),
  INDEX idx_sender (sender_address)
);

-- Access configs (per-token settings)
CREATE TABLE chat_access_configs (
  token_address VARCHAR(42) PRIMARY KEY,
  minimum_balance NUMERIC(78, 0) DEFAULT 0,
  minimum_percentage INTEGER DEFAULT 100, -- basis points (100 = 1%)
  requires_holding BOOLEAN DEFAULT true,
  superchat_enabled BOOLEAN DEFAULT true,
  created_by VARCHAR(42),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Superchat tier configs
CREATE TABLE superchat_tiers (
  token_address VARCHAR(42) PRIMARY KEY,
  tier1_min NUMERIC(78, 0),
  tier2_min NUMERIC(78, 0),
  tier3_min NUMERIC(78, 0),
  tier4_min NUMERIC(78, 0),
  tier5_min NUMERIC(78, 0),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User profiles
CREATE TABLE chat_users (
  address VARCHAR(42) PRIMARY KEY,
  username VARCHAR(50),
  avatar_url TEXT,
  is_banned BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 7. ACCESS CONFIGURATION OPTIONS

```typescript
interface AccessConfigOptions {
  // Minimum token balance required (absolute amount)
  minimumBalance: bigint;

  // Minimum percentage of total supply (basis points)
  // 100 = 1%, 50 = 0.5%, 10 = 0.1%
  minimumPercentage: number;

  // Whether token holding is required at all
  requiresHolding: boolean;

  // Whether superchats are enabled for this token
  superchatEnabled: boolean;

  // Superchat destination options
  superchatDestination: 'burn' | 'lock' | 'creator' | 'holders';
}

// Platform defaults (adjustable by admin)
const PLATFORM_DEFAULTS: AccessConfigOptions = {
  minimumBalance: 0n,
  minimumPercentage: 100, // 1% of supply
  requiresHolding: true,
  superchatEnabled: true,
  superchatDestination: 'lock'
};
```

---

## IMPLEMENTATION PRIORITY

1. **Phase 1:** Basic WebSocket chat (no gating)
2. **Phase 2:** Token-gated access with configurable threshold
3. **Phase 3:** Superchat system with on-chain tipping
4. **Phase 4:** UI polish (Telegram + YouTube modes)
5. **Phase 5:** Advanced features (threads, reactions, search)

---

## NOTES FOR SLEEPYJ

- The 1% default is a starting point - make it configurable per-token
- Superchat tokens going to `lock` (contract itself) is deflationary without burning
- Consider adding "whale badges" for top 10 holders
- Rate limiting needed to prevent spam
- Moderation tools for token creators

**Treasury receives 5% of all superchats.**

---

*Generated by AQUEMINI - THE pHuD FARM*
