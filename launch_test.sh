#!/bin/bash
cd /home/sleepyj/pump-fud

# Load foundry
source ~/.bashrc 2>/dev/null || true
export PATH="$HOME/.foundry/bin:$PATH"

# Private key
PK="0xfca85204c9823d852523d084cb12c4177afb8c93c51d4e27c8b886a4c9d27d91"

# Contract address
CONTRACT="0xeb5ae44D7bC13A86e02051887d8C12e61ba90659"
RPC="https://pulsechain.publicnode.com"

# Launch test token
echo "Launching test token..."
cast send $CONTRACT "launchToken(string,string,string,string)" \
    "TEST GRADUATION" \
    "TESTGRAD" \
    "Testing dual-DEX graduation" \
    "https://pump.fud/test.png" \
    --rpc-url $RPC \
    --private-key $PK \
    --value 0
