import os
import math
import re
import logging
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "question-bank")
PINECONE_DIMENSION = int(os.getenv("PINECONE_DIMENSION", "384"))

_pinecone_client = None
_pinecone_index = None

def get_pinecone_client():
    global _pinecone_client
    if _pinecone_client is not None:
        return _pinecone_client
    
    load_dotenv(override=True)
    api_key = os.getenv("PINECONE_API_KEY", "").strip()
    if not api_key:
        logger.warning("PINECONE_API_KEY is not set in environment variables.")
        return None
    
    try:
        from pinecone import Pinecone
        _pinecone_client = Pinecone(api_key=api_key)
        return _pinecone_client
    except Exception as e:
        logger.error(f"Failed to initialize Pinecone client: {e}")
        return None

def get_pinecone_index():
    global _pinecone_index
    if _pinecone_index is not None:
        return _pinecone_index
    
    pc = get_pinecone_client()
    if pc is None:
        return None
    
    try:
        index_name = os.getenv("PINECONE_INDEX_NAME", PINECONE_INDEX_NAME)
        existing_indexes = [idx.name for idx in pc.list_indexes()]
        if index_name not in existing_indexes:
            from pinecone import ServerlessSpec
            logger.info(f"Creating Pinecone index '{index_name}'...")
            pc.create_index(
                name=index_name,
                dimension=PINECONE_DIMENSION,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1")
            )
        _pinecone_index = pc.Index(index_name)
        return _pinecone_index
    except Exception as e:
        logger.error(f"Error accessing or creating Pinecone index: {e}")
        return None

def generate_embedding(text: str, dimension: int = PINECONE_DIMENSION) -> List[float]:
    """
    Generate a normalized dense vector embedding for text.
    Uses Pinecone Inference if available, or a deterministic semantic feature hash
    that maps text tokens to high-dimensional cosine space.
    """
    pc = get_pinecone_client()
    if pc is not None:
        try:
            response = pc.inference.embed(
                model="multilingual-e5-large",
                inputs=[text[:1000]],
                parameters={"input_type": "passage", "truncate": "END"}
            )
            if response and len(response) > 0:
                raw_vec = response[0].get("values") or response[0].values
                if len(raw_vec) == dimension:
                    return raw_vec
                elif len(raw_vec) > dimension:
                    return raw_vec[:dimension]
        except Exception as e:
            logger.debug(f"Pinecone inference embed fallback: {e}")

    # Deterministic high-entropy feature embedding with token hashing
    vec = [0.0] * dimension
    words = re.findall(r"\w+", text.lower())
    if not words:
        vec[0] = 1.0
        return vec

    for i, word in enumerate(words):
        h = 2166136261
        for ch in word:
            h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
        idx1 = h % dimension
        idx2 = ((h >> 8) * 31) % dimension
        weight = 1.0 / (1.0 + math.log(1 + i))
        vec[idx1] += weight
        vec[idx2] += weight * 0.5

    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [round(x / norm, 6) for x in vec]
    else:
        vec[0] = 1.0
    return vec

def upsert_question_to_pinecone(question) -> Dict[str, Any]:
    """
    Upsert a question object into Pinecone index.
    """
    index = get_pinecone_index()
    text_content = f"{question.title} {question.topic or ''} {question.difficulty or ''}\n{question.description or ''}\n{question.constraints or ''}"
    vector = generate_embedding(text_content, PINECONE_DIMENSION)

    metadata = {
        "id": question.id,
        "title": question.title or "",
        "topic": question.topic or "General",
        "difficulty": question.difficulty or "Medium",
        "description": (question.description or "")[:800],
        "sample_input": (question.sample_input or "")[:200],
        "sample_output": (question.sample_output or "")[:200],
        "constraints": (question.constraints or "")[:300]
    }

    if index is not None:
        try:
            index.upsert(vectors=[{
                "id": str(question.id),
                "values": vector,
                "metadata": metadata
            }])
            logger.info(f"Successfully upserted question {question.id} ('{question.title}') to Pinecone.")
            return {"status": "success", "synced_to_pinecone": True, "question_id": question.id}
        except Exception as e:
            logger.error(f"Failed to upsert question {question.id} to Pinecone index: {e}")
            return {"status": "error", "synced_to_pinecone": False, "error": str(e), "question_id": question.id}
    else:
        logger.info(f"Pinecone index not reachable or API key not set. Question {question.id} vector created locally.")
        return {"status": "local_vector_generated", "synced_to_pinecone": False, "question_id": question.id}

def search_questions_in_pinecone(query_text: str, top_k: int = 5, topic: Optional[str] = None, difficulty: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Query questions from Pinecone by semantic query vector with optional filtering.
    """
    index = get_pinecone_index()
    query_vector = generate_embedding(query_text, PINECONE_DIMENSION)
    
    filter_dict = {}
    if topic and topic != "All":
        filter_dict["topic"] = {"$eq": topic}
    if difficulty and difficulty != "All":
        filter_dict["difficulty"] = {"$eq": difficulty}

    if index is not None:
        try:
            query_kwargs = {
                "vector": query_vector,
                "top_k": top_k,
                "include_metadata": True
            }
            if filter_dict:
                query_kwargs["filter"] = filter_dict
                
            results = index.query(**query_kwargs)
            matches = []
            for m in results.get("matches", []):
                meta = m.get("metadata", {})
                matches.append({
                    "id": int(m["id"]) if m["id"].isdigit() else m["id"],
                    "title": meta.get("title", ""),
                    "topic": meta.get("topic", "General"),
                    "difficulty": meta.get("difficulty", "Medium"),
                    "description": meta.get("description", ""),
                    "score": round(m.get("score", 0.0), 4)
                })
            return matches
        except Exception as e:
            logger.error(f"Pinecone vector query error: {e}")
            return []
    return []

def sync_all_questions_to_pinecone(questions: List[Any]) -> Dict[str, Any]:
    """
    Batch upsert all questions from DB to Pinecone.
    """
    index = get_pinecone_index()
    if not questions:
        return {"total": 0, "upserted": 0, "status": "no_questions"}
    
    vectors_to_upsert = []
    for q in questions:
        text_content = f"{q.title} {q.topic or ''} {q.difficulty or ''}\n{q.description or ''}\n{q.constraints or ''}"
        vector = generate_embedding(text_content, PINECONE_DIMENSION)
        vectors_to_upsert.append({
            "id": str(q.id),
            "values": vector,
            "metadata": {
                "id": q.id,
                "title": q.title or "",
                "topic": q.topic or "General",
                "difficulty": q.difficulty or "Medium",
                "description": (q.description or "")[:800],
                "sample_input": (q.sample_input or "")[:200],
                "sample_output": (q.sample_output or "")[:200],
                "constraints": (q.constraints or "")[:300]
            }
        })
    
    if index is not None and vectors_to_upsert:
        try:
            chunk_size = 50
            for i in range(0, len(vectors_to_upsert), chunk_size):
                chunk = vectors_to_upsert[i:i + chunk_size]
                index.upsert(vectors=chunk)
            logger.info(f"Successfully batch synced {len(vectors_to_upsert)} questions to Pinecone.")
            return {"total": len(questions), "upserted": len(vectors_to_upsert), "status": "success", "synced_to_pinecone": True}
        except Exception as e:
            logger.error(f"Batch sync to Pinecone failed: {e}")
            return {"total": len(questions), "upserted": 0, "status": "error", "error": str(e), "synced_to_pinecone": False}
    
    return {"total": len(questions), "upserted": len(vectors_to_upsert), "status": "local_vectorized", "synced_to_pinecone": False}
