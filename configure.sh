#!/bin/bash
source ~/.bashrc 2>/dev/null

# Get private key
if [ -f "/home/sleepyj/.keys/deployer.key" ]; then
    PKEY=$(cat /home/sleepyj/.keys/deployer.key)
else
    PKEY="$DEPLOYER_PRIVATE_KEY"
fi

# Contract and addresses
PUMPFUD="0xeb5ae44D7bC13A86e02051887d8C12e61ba90659"
BURN="0x000000000000000000000000000000000000dEaD"
PAISLEY_FACTORY="0xb2A4279D68aa7A19818366eD832700f3e65a4D50"
RPC="https://rpc.pulsechain.com"

echo "Setting lpRecipient to burn address..."
/home/sleepyj/.foundry/bin/cast send $PUMPFUD "setLpRecipient(address)" $BURN --rpc-url $RPC --private-key $PKEY

echo ""
echo "Setting paisleyFactory..."
/home/sleepyj/.foundry/bin/cast send $PUMPFUD "setPaisleyFactory(address)" $PAISLEY_FACTORY --rpc-url $RPC --private-key $PKEY

echo ""
echo "Verifying configuration..."
echo "lpRecipient:"
/home/sleepyj/.foundry/bin/cast call $PUMPFUD "lpRecipient()(address)" --rpc-url $RPC
echo "paisleyFactory:"
/home/sleepyj/.foundry/bin/cast call $PUMPFUD "paisleyFactory()(address)" --rpc-url $RPC
