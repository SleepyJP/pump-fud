#!/bin/bash
cd /home/sleepyj/pump-fud/frontend
echo "=== BUILD VALIDATION ==="
npm run build
echo ""
echo "=== BUILD EXIT CODE: $? ==="
