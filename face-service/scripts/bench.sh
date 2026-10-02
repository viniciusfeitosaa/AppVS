#!/usr/bin/env bash
# Uso: FACE_URL=http://127.0.0.1:18000 FACE_TOKEN=... ./bench.sh <dir-com-fotos>
# Gera embeddings (enroll), compara pares e mede latência.
set -euo pipefail
DIR="${1:?diretório de fotos}"
URL="${FACE_URL:-http://127.0.0.1:18000}"
TOKEN="${FACE_TOKEN:?FACE_TOKEN}"
OUT="$(mktemp -d)"

enroll() {
  curl -s -H "X-Face-Token: $TOKEN" -F "image=@$1;type=image/jpeg" "$URL/v1/enroll"
}

echo "== enroll (latência, rostos, liveness, motivo) =="
for f in "$DIR"/*.jpg; do
  n="$(basename "$f" .jpg)"
  enroll "$f" > "$OUT/$n.json"
  python3 - "$OUT/$n.json" "$n" <<'PY'
import json, sys
d = json.load(open(sys.argv[1])); n = sys.argv[2]
lv = d.get("liveness") or {}
print(f"{n:24s} total={d['timingsMs'].get('total'):>6}ms faces={d['faces']} live={lv.get('score')} real={lv.get('real')} ok={d['ok']} motivo={d['motivo']} q={d.get('quality')}")
PY
done

echo
echo "== similaridade entre pares =="
python3 - "$OUT" <<'PY'
import json, os, sys, itertools
import math
out = sys.argv[1]
embs = {}
for fn in sorted(os.listdir(out)):
    d = json.load(open(os.path.join(out, fn)))
    if d.get("embedding"):
        embs[fn[:-5]] = d["embedding"]
def cos(a, b):
    s = sum(x * y for x, y in zip(a, b))
    return s / (math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b)))
pairs = os.environ.get("PAIRS", "")
for p in [p for p in pairs.split(",") if p]:
    a, b = p.split(":")
    if a in embs and b in embs:
        print(f"MESMA  {a:22s} x {b:22s} {cos(embs[a], embs[b]):.4f}")
names = list(embs)
diff = sorted((cos(embs[a], embs[b]), a, b) for a, b in itertools.combinations(names, 2))
print("maiores similaridades entre todos os pares (inclui mesmas pessoas):")
for s, a, b in diff[-12:]:
    print(f"  {a:22s} x {b:22s} {s:.4f}")
PY
rm -rf "$OUT"
