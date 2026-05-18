#!/bin/bash
BRANCH="claude/continue-app-development-HE6dd"
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  KEEPR Sync${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "\n${YELLOW}▶ Pulling latest changes...${NC}"
git pull origin $BRANCH
echo -e "${GREEN}✓ Up to date${NC}"
echo -e "\n${YELLOW}▶ Checking for syntax errors...${NC}"
ERRORS=0
for f in $(find src -name "*.js") App.js index.js; do
  if ! node --check "$f" 2>/dev/null; then
    echo -e "${RED}✗ Syntax error in: $f${NC}"; node --check "$f"; ERRORS=$((ERRORS+1))
  fi
done
[ $ERRORS -eq 0 ] && echo -e "${GREEN}✓ Keine Syntax-Fehler${NC}" || { echo -e "${RED}✗ $ERRORS Fehler!${NC}"; exit 1; }
echo -e "\n${YELLOW}▶ Checking dependencies...${NC}"
[ ! -d "node_modules" ] && npm install || echo -e "${GREEN}✓ Dependencies ok${NC}"
UNPUSHED=$(git rev-list "origin/$BRANCH..HEAD" --count 2>/dev/null || echo 0)
[ "$UNPUSHED" -gt 0 ] && git push origin $BRANCH && echo -e "${GREEN}✓ Gepusht${NC}" || echo -e "${GREEN}✓ Nichts zu pushen${NC}"
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Alles ok — starte mit: npx expo start${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
