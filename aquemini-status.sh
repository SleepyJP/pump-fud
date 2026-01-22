#!/bin/bash
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║           AQUEMINI STATUS REPORT: PUMP.FUD                       ║"
echo "║           $(date '+%Y-%m-%d %H:%M:%S')                              ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

cd /home/sleepyj/pump-fud

echo "═══ 1. GIT STATUS ═══"
git status --short 2>/dev/null || echo "Not a git repo"
echo ""

echo "═══ 2. BUILD STATUS ═══"
cd frontend
npm run build 2>&1 | tail -5
BUILD_EXIT=$?
if [ $BUILD_EXIT -eq 0 ]; then
    echo "✅ BUILD: PASSED"
else
    echo "❌ BUILD: FAILED (exit $BUILD_EXIT)"
fi
cd ..
echo ""

echo "═══ 3. DEPLOYMENT CONFIG ═══"
if [ -f "vercel.json" ]; then
    echo "vercel.json found:"
    cat vercel.json | head -10
elif [ -f "frontend/vercel.json" ]; then
    echo "frontend/vercel.json found:"
    cat frontend/vercel.json | head -10
else
    echo "No vercel.json found"
fi
ls -la .vercel 2>/dev/null || echo "No .vercel directory"
echo ""

echo "═══ 4. CONTRACT CONFIG ═══"
if [ -f "frontend/src/config/wagmi.ts" ]; then
    echo "Contract addresses from wagmi.ts:"
    grep -E "ADDRESS|address" frontend/src/config/wagmi.ts | head -10
fi
echo ""

echo "═══ 5. RECENT MODIFICATIONS (24h) ═══"
find . -type f -mtime -1 -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./frontend/node_modules/*" -not -path "./frontend/dist/*" 2>/dev/null | head -20
echo ""

echo "═══ 6. COLOR AUDIT (Red Check) ═══"
RED_COUNT=$(grep -rn "dc143c\|crimson\|8B0000" frontend/src/ 2>/dev/null | wc -l)
if [ "$RED_COUNT" -eq 0 ]; then
    echo "✅ COLOR AUDIT: PASSED (0 red colors)"
else
    echo "❌ COLOR AUDIT: FAILED ($RED_COUNT red instances)"
    grep -rn "dc143c\|crimson\|8B0000" frontend/src/ 2>/dev/null
fi
echo ""

echo "═══════════════════════════════════════════════════════════════════"
echo "                    END AQUEMINI STATUS REPORT"
echo "═══════════════════════════════════════════════════════════════════"
