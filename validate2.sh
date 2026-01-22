#!/bin/bash
cd /home/sleepyj/pump-fud/frontend
echo "=== LINT VALIDATION ==="
npm run lint 2>&1
echo ""
echo "=== LINT EXIT CODE: $? ==="
echo ""
echo "=== TYPESCRIPT CHECK ==="
npx tsc --noEmit 2>&1
echo ""
echo "=== TSC EXIT CODE: $? ==="
