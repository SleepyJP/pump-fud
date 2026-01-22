#!/bin/bash
set -e

PKEY="fca85204c9823d852523d084cb12c4177aeb49848880600bd24ce913f568c576"
RPC="https://rpc.pulsechain.com"
PUMPFUD="0xeb5ae44D7bC13A86e02051887d8C12e61ba90659"
CAST="/home/sleepyj/.foundry/bin/cast"

echo "=========================================="
echo "PUMP.FUD Graduation Test"
echo "=========================================="
echo ""

# Step 1: Launch test token
echo "Step 1: Launching test token..."
TX1=$($CAST send $PUMPFUD "launchToken(string,string,string,string)" "GradTest" "GTEST" "Testing graduation flow" "https://pump.fud/test.png" --rpc-url $RPC --private-key $PKEY --json)
echo "Launch TX: $(echo $TX1 | jq -r '.transactionHash')"
sleep 3

# Step 2: Get token count and new token address
echo ""
echo "Step 2: Getting new token info..."
TOKEN_COUNT=$($CAST call $PUMPFUD "tokenCount()(uint256)" --rpc-url $RPC)
echo "Token count: $TOKEN_COUNT"

# Get token address using tokenToId mapping reverse lookup
TOKEN_ID=$TOKEN_COUNT
echo "New token ID: $TOKEN_ID"

# Fetch token address from tokens mapping
TOKEN_DATA=$($CAST call $PUMPFUD "tokens(uint256)" $TOKEN_ID --rpc-url $RPC)
# Extract address (bytes 32-64 contain the token address padded)
TOKEN_ADDR="0x$(echo $TOKEN_DATA | cut -c 91-130)"
echo "Token address: $TOKEN_ADDR"

# Step 3: Mark as test token
echo ""
echo "Step 3: Setting as test token..."
TX2=$($CAST send $PUMPFUD "setTestToken(address,bool)" $TOKEN_ADDR true --rpc-url $RPC --private-key $PKEY --json)
echo "SetTestToken TX: $(echo $TX2 | jq -r '.transactionHash')"
sleep 3

# Verify it's a test token
IS_TEST=$($CAST call $PUMPFUD "isTestToken(address)(bool)" $TOKEN_ADDR --rpc-url $RPC)
echo "Is test token: $IS_TEST"

# Step 4: Buy tokens to trigger graduation (need >10,000 PLS)
echo ""
echo "Step 4: Buying tokens to trigger graduation..."
echo "Sending 11,000 PLS..."
TX3=$($CAST send $PUMPFUD "buyTokens(uint256,uint256)" $TOKEN_ID 0 --rpc-url $RPC --private-key $PKEY --value 11000ether --json 2>&1)
echo "Buy TX result:"
echo $TX3 | jq -r '.transactionHash // .error // .' 2>/dev/null || echo "$TX3"

sleep 5

# Step 5: Check graduation status
echo ""
echo "Step 5: Checking graduation status..."
STATUS=$($CAST call $PUMPFUD "tokens(uint256)" $TOKEN_ID --rpc-url $RPC)
echo "Raw token data: $STATUS"

echo ""
echo "=========================================="
echo "Test Complete!"
echo "=========================================="
