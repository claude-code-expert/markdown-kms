#!/usr/bin/env python3
"""세션 transcript(jsonl)의 토큰 사용량 집계.

usage:
  python3 .claude/scripts/token-usage.py <session.jsonl>
  python3 .claude/scripts/token-usage.py   # 최신 세션 자동 탐색
"""
import json, sys, glob, os

def find_latest():
    cwd = os.getcwd().replace("/", "-")
    base = os.path.expanduser(f"~/.claude/projects/{cwd}")
    files = glob.glob(f"{base}/*.jsonl")
    return max(files, key=os.path.getmtime) if files else None

path = sys.argv[1] if len(sys.argv) > 1 else find_latest()
if not path:
    sys.exit("no transcript found")

tin = tout = cc = cr = n = 0
for line in open(path):
    try: o = json.loads(line)
    except: continue
    m = o.get("message")
    u = (m.get("usage") if isinstance(m, dict) else None) or o.get("usage")
    if not u: continue
    n += 1
    tin  += u.get("input_tokens", 0)
    tout += u.get("output_tokens", 0)
    cc   += u.get("cache_creation_input_tokens", 0)
    cr   += u.get("cache_read_input_tokens", 0)

print(f"file: {path}")
print(f"assistant turns (with usage): {n}")
print(f"input_tokens (uncached):      {tin:,}")
print(f"output_tokens:                {tout:,}")
print(f"cache_creation_input_tokens:  {cc:,}")
print(f"cache_read_input_tokens:      {cr:,}")
print("---")
print(f"TOTAL tokens (all):           {tin+tout+cc+cr:,}")
