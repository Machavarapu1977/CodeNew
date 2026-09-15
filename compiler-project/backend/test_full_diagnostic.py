"""
Full diagnostic: Pinecone + Auto-Generate Mock Test endpoint
"""
import json
import urllib.request
import urllib.error
import os
from dotenv import load_dotenv

load_dotenv()
API_BASE = "http://127.0.0.1:8000"
PASS = "[OK]  "
FAIL = "[FAIL]"
WARN = "[WARN]"
SEP  = "-" * 60

def http_post(path, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read()), r.status

def http_get(path):
    req = urllib.request.Request(f"{API_BASE}{path}", method="GET")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read()), r.status

# ─────────────────────────────────────────────
print(SEP)
print("  SECTION 1: Pinecone Health")
print(SEP)

# 1a. Package import
try:
    import pinecone
    print(f"{PASS} pinecone package installed (v{pinecone.__version__})")
except ImportError as e:
    print(f"{FAIL} pinecone not installed: {e}")
    exit(1)

# 1b. API key
api_key = os.getenv("PINECONE_API_KEY", "").strip()
index_name = os.getenv("PINECONE_INDEX_NAME", "question-bank")
dimension  = int(os.getenv("PINECONE_DIMENSION", "1024"))
if api_key:
    print(f"{PASS} PINECONE_API_KEY present (starts: {api_key[:10]}...)")
else:
    print(f"{FAIL} PINECONE_API_KEY missing")
    exit(1)

# 1c. Client init
try:
    from pinecone import Pinecone
    pc = Pinecone(api_key=api_key)
    print(f"{PASS} Pinecone client initialised")
except Exception as e:
    print(f"{FAIL} Client init failed: {e}")
    exit(1)

# 1d. Index check
try:
    indexes = [idx.name for idx in pc.list_indexes()]
    print(f"{PASS} Indexes found: {indexes}")
    if index_name in indexes:
        print(f"{PASS} Target index '{index_name}' EXISTS")
        idx = pc.Index(index_name)
        stats = idx.describe_index_stats()
        total_vectors = stats.get("total_vector_count", stats.get("totalVectorCount", "?"))
        print(f"{PASS} Index stats — total vectors: {total_vectors} | dimension: {dimension}")
    else:
        print(f"{WARN} Index '{index_name}' not found — will be created on first question upsert")
except Exception as e:
    print(f"{FAIL} Index check failed: {e}")

# 1e. Embedding test
try:
    resp = pc.inference.embed(
        model="multilingual-e5-large",
        inputs=["binary search tree traversal"],
        parameters={"input_type": "passage", "truncate": "END"}
    )
    vec = resp[0].get("values") if hasattr(resp[0], "get") else resp[0].values
    print(f"{PASS} Inference embedding OK — dim={len(vec)}, first3={[round(v,4) for v in vec[:3]]}")
except Exception as e:
    print(f"{WARN} Inference embedding failed (local fallback active): {e}")

# 1f. Pinecone sync via backend
try:
    data, status = http_post("/questions/sync-pinecone", {})
    print(f"{PASS} /questions/sync-pinecone → status={data.get('status')} | synced={data.get('synced_to_pinecone')} | upserted={data.get('upserted')}/{data.get('total')}")
except Exception as e:
    print(f"{WARN} Pinecone sync endpoint failed: {e}")

# ─────────────────────────────────────────────
print()
print(SEP)
print("  SECTION 2: Auto-Generate Mock Test")
print(SEP)

# 2a. Question bank availability
try:
    questions, _ = http_get("/questions")
    total_q = len(questions)
    easy   = sum(1 for q in questions if q.get("difficulty") == "Easy")
    medium = sum(1 for q in questions if q.get("difficulty") == "Medium")
    hard   = sum(1 for q in questions if q.get("difficulty") == "Hard")
    print(f"{PASS} Question bank: {total_q} total | Easy={easy}, Medium={medium}, Hard={hard}")
except Exception as e:
    print(f"{FAIL} Could not fetch questions: {e}")
    exit(1)

if total_q == 0:
    print(f"{FAIL} Question bank is empty — cannot generate tests")
    exit(1)

# 2b. Balanced auto-gen (all topics, all difficulties)
try:
    payload = {"title": "Diag Balanced Test", "num_questions": 3, "duration_minutes": 30, "total_marks": 60}
    data, status = http_post("/tests/auto-generate", payload)
    qs = data.get("questions", [])
    print(f"{PASS} Balanced auto-gen (3 Qs) → test_id={data['id']} | got {len(qs)} questions")
    for q in qs:
        print(f"       [{q['difficulty']:6}] {q['title']}")
except Exception as e:
    print(f"{FAIL} Balanced auto-gen failed: {e}")

# 2c. Topic-filtered auto-gen
try:
    payload = {"title": "Diag Topic Test", "num_questions": 2, "topic": "Arrays", "duration_minutes": 20, "total_marks": 40}
    data, status = http_post("/tests/auto-generate", payload)
    qs = data.get("questions", [])
    all_correct_topic = all(q.get("topic") == "Arrays" for q in qs)
    print(f"{PASS} Topic-filtered auto-gen (Arrays, 2 Qs) → got {len(qs)} | all in Arrays: {all_correct_topic}")
    for q in qs:
        print(f"       [{q['difficulty']:6}] {q['title']} (topic: {q['topic']})")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"{WARN} Topic-filtered test (Arrays): {e.code} - {body} (OK if not enough Arrays questions)")
except Exception as e:
    print(f"{WARN} Topic-filtered auto-gen: {e}")

# 2d. Difficulty-specific auto-gen
try:
    payload = {"title": "Diag Easy Test", "num_questions": 2, "difficulty": "Easy", "duration_minutes": 15, "total_marks": 20}
    data, status = http_post("/tests/auto-generate", payload)
    qs = data.get("questions", [])
    all_easy = all(q.get("difficulty") == "Easy" for q in qs)
    print(f"{PASS} Difficulty-specific (Easy, 2 Qs) → got {len(qs)} | all Easy: {all_easy}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"{WARN} Easy-only auto-gen: {e.code} - {body}")
except Exception as e:
    print(f"{WARN} Difficulty-specific auto-gen: {e}")

# 2e. Max questions (20) stress test
try:
    payload = {"title": "Diag Max Test", "num_questions": 20, "duration_minutes": 120, "total_marks": 200}
    data, status = http_post("/tests/auto-generate", payload)
    qs = data.get("questions", [])
    print(f"{PASS} Max questions (20 requested) → got {len(qs)} questions (bank had {total_q})")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"{WARN} Max-test: {e.code} - {body}")
except Exception as e:
    print(f"{WARN} Max questions test: {e}")

# 2f. Verify tests are stored in DB
try:
    tests, _ = http_get("/tests")
    print(f"{PASS} /tests endpoint → {len(tests)} total tests stored in DB")
    diag_tests = [t for t in tests if t.get("title", "").startswith("Diag")]
    for t in diag_tests[:3]:
        print(f"       id={t['id']} | '{t['title']}' | {len(t.get('questions', []))} questions | {t['duration_minutes']}min")
except Exception as e:
    print(f"{FAIL} Could not fetch tests: {e}")

# ─────────────────────────────────────────────
print()
print(SEP)
print("  SECTION 3: Vector Search (Pinecone ↔ Question Bank)")
print(SEP)

try:
    payload = {"query": "dynamic programming optimal substructure", "top_k": 3}
    data, _ = http_post("/questions/vector-search", payload)
    print(f"{PASS} Vector search → {len(data)} results")
    for r in data:
        print(f"       score={r.get('score','?')} | [{r.get('difficulty','?')}] {r.get('title','?')}")
except Exception as e:
    print(f"{WARN} Vector search: {e}")

print()
print(SEP)
print("  All checks complete.")
print(SEP)
