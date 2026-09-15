import os
from dotenv import load_dotenv
load_dotenv()

print("=== Pinecone Diagnostic ===")

# 1. Check install
try:
    import pinecone
    print(f"[OK] pinecone installed: version {pinecone.__version__}")
except ImportError as e:
    print(f"[FAIL] pinecone not installed: {e}")
    exit(1)

# 2. Check API key
api_key = os.getenv("PINECONE_API_KEY", "").strip()
index_name = os.getenv("PINECONE_INDEX_NAME", "question-bank")
if api_key:
    print(f"[OK] PINECONE_API_KEY found (starts with: {api_key[:12]}...)")
else:
    print("[FAIL] PINECONE_API_KEY is missing or empty")
    exit(1)

# 3. Connect to Pinecone
try:
    from pinecone import Pinecone
    pc = Pinecone(api_key=api_key)
    print("[OK] Pinecone client initialized")
except Exception as e:
    print(f"[FAIL] Could not create Pinecone client: {e}")
    exit(1)

# 4. List indexes
try:
    indexes = pc.list_indexes()
    names = [idx.name for idx in indexes]
    print(f"[OK] Connected to Pinecone. Indexes found: {names}")
    if index_name in names:
        print(f"[OK] Target index '{index_name}' EXISTS")
    else:
        print(f"[WARN] Target index '{index_name}' does NOT exist yet (will be auto-created on first use)")
except Exception as e:
    print(f"[FAIL] Could not list indexes: {e}")
    exit(1)

# 5. Test Pinecone Inference embedding
try:
    response = pc.inference.embed(
        model="multilingual-e5-large",
        inputs=["hello world test"],
        parameters={"input_type": "passage", "truncate": "END"}
    )
    vec = response[0].get("values") if hasattr(response[0], "get") else response[0].values
    print(f"[OK] Pinecone Inference embedding works. Vector dim: {len(vec)}")
except Exception as e:
    print(f"[WARN] Pinecone Inference embed failed (local fallback will be used): {e}")

print()
print("=== Diagnostic complete ===")
