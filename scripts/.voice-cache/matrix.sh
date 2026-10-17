#!/bin/sh
# Runs the 6-turn session against each tool behaviour/scheduling combination.
cd "c:/Users/AYUSH JANGID/medicare--"
OUT=scripts/.voice-cache/matrix.log
: > "$OUT"
for COMBO in "BLOCKING:" "NON_BLOCKING:INTERRUPT" "UNSET:INTERRUPT" "UNSET:"; do
  B=${COMBO%%:*}; S=${COMBO#*:}
  P=$(netstat -ano 2>/dev/null | grep LISTENING | grep ":3000" | awk '{print $NF}' | head -1)
  [ -n "$P" ] && taskkill //F //PID "$P" >/dev/null 2>&1
  sleep 3
  rm -f /tmp/medicare-dev.log
  VOICE_TOOL_BEHAVIOR=$B VOICE_TOOL_SCHEDULING=$S VOICE_TRACE=1 npm run dev > /tmp/medicare-dev.log 2>&1 &
  for i in $(seq 1 50); do curl -s -o /dev/null -m 5 http://127.0.0.1:3000/ 2>/dev/null && break; sleep 2; done
  echo "===== behavior=$B scheduling=${S:-none} =====" >> "$OUT"
  TURNS=6 npx tsx scripts/verify-voice-session.ts 2>&1 | grep -E "turn +[0-9]|replies with|timeouts|median" >> "$OUT"
  echo "--- trace: after tool response ---" >> "$OUT"
  grep "voice:trace" /tmp/medicare-dev.log | grep -E "tool response sent|first audio" >> "$OUT"
  echo >> "$OUT"
  sleep 45
done
echo "MATRIX DONE" >> "$OUT"
