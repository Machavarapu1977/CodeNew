"""
RAG (Retrieval-Augmented Generation) Service for Question Bank & Assessments.
Integrates Pinecone Vector Database retrieval with Groq LLM generation.
"""

import os
import re
import json
import logging
from typing import List, Dict, Any, Optional
import httpx
from dotenv import load_dotenv

from services.pinecone_service import search_questions_in_pinecone

load_dotenv()
logger = logging.getLogger(__name__)

CANDIDATE_GROQ_MODELS = [
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
]

def format_retrieved_context(matches: List[Dict[str, Any]]) -> str:
    """Format retrieved Pinecone question matches as context for the prompt."""
    if not matches:
        return "No prior reference questions retrieved from Pinecone."

    context_lines = []
    for idx, m in enumerate(matches, start=1):
        context_lines.append(
            f"--- Reference Problem {idx} (from Pinecone Vector DB) ---\n"
            f"Title: {m.get('title', 'N/A')}\n"
            f"Topic: {m.get('topic', 'General')}\n"
            f"Difficulty: {m.get('difficulty', 'Medium')}\n"
            f"Description: {m.get('description', '')}\n"
            f"Constraints: {m.get('constraints', '')}\n"
            f"Sample Input: {m.get('sample_input', '')}\n"
            f"Sample Output: {m.get('sample_output', '')}\n"
        )
    return "\n".join(context_lines)


async def generate_questions_with_rag(
    topic: str = "Arrays",
    difficulty: str = "Medium",
    count: int = 3,
    custom_prompt: Optional[str] = None,
    api_key: Optional[str] = None,
    db_session = None
) -> Dict[str, Any]:
    """
    RAG Pipeline:
    1. RETRIEVE: Query Pinecone index for top relevant questions matching topic/difficulty/custom_prompt.
    2. AUGMENT: Inject retrieved questions into the prompt as verified domain context and few-shot examples.
    3. GENERATE: Call Groq LLM to synthesize distinct, rigorous questions grounded in the retrieved knowledge.
    """
    groq_key = (api_key or os.getenv("GROQ_API_KEY") or "").strip()
    clean_topic = topic.strip() or "Arrays"
    clean_difficulty = difficulty.strip() or "Medium"
    count = max(1, min(count, 10))

    # 1. RETRIEVAL STEP from Pinecone
    retrieval_query = f"{clean_topic} {clean_difficulty} {custom_prompt or ''}".strip()
    retrieved_matches = search_questions_in_pinecone(
        query_text=retrieval_query,
        top_k=min(5, max(2, count)),
        topic=clean_topic if clean_topic != "All" else None,
        difficulty=clean_difficulty if clean_difficulty != "All" else None
    )

    # If Pinecone didn't return any matches (e.g. empty or offline), fallback to DB
    if not retrieved_matches and db_session is not None:
        try:
            from models import Question
            q_query = db_session.query(Question)
            if clean_topic != "All":
                q_query = q_query.filter(Question.topic == clean_topic)
            if clean_difficulty != "All":
                q_query = q_query.filter(Question.difficulty == clean_difficulty)
            db_qs = q_query.limit(3).all()
            retrieved_matches = [
                {
                    "id": q.id,
                    "title": q.title,
                    "topic": q.topic or "General",
                    "difficulty": q.difficulty or "Medium",
                    "description": q.description or "",
                    "constraints": q.constraints or "",
                    "sample_input": q.sample_input or "",
                    "sample_output": q.sample_output or "",
                    "score": 1.0
                }
                for q in db_qs
            ]
        except Exception as e:
            logger.warning(f"DB fallback retrieval error: {e}")

    # 2. AUGMENTATION STEP
    context_text = format_retrieved_context(retrieved_matches)
    
    rag_system_prompt = (
        "You are an expert competitive programming problem setter and algorithms professor. "
        "You use Retrieval-Augmented Generation (RAG) grounded in verified reference problems "
        "from the question bank to design new, mathematically sound, distinct algorithmic questions.\n\n"
        "Output ONLY a valid JSON array of question objects without markdown blocks or preamble.\n"
        "Each question object MUST contain these exact keys:\n"
        "- 'title': concise problem title\n"
        "- 'topic': algorithmic topic (e.g. Arrays, Dynamic Programming, Graphs, etc.)\n"
        "- 'difficulty': 'Easy', 'Medium', or 'Hard'\n"
        "- 'description': clear problem statement with exact input/output explanation\n"
        "- 'constraints': realistic time/memory limits and bounds (e.g. 1 <= N <= 10^5, Time Limit: 1.0s, Memory Limit: 256MB)\n"
        "- 'sample_input': valid testcase standard input\n"
        "- 'sample_output': exact expected output matching the sample input\n"
        "- 'starter_code': Python 3 starter function or scaffold\n"
    )

    user_content = (
        f"=== RETRIEVED CONTEXT FROM PINECONE VECTOR DATABASE ===\n"
        f"{context_text}\n"
        f"=======================================================\n\n"
        f"TASK:\n"
        f"Using the style, standards, and difficulty conventions from the retrieved reference problems above as grounding context, "
        f"generate exactly {count} NEW and DISTINCT competitive programming questions for Topic: \"{clean_topic}\" "
        f"at Difficulty: \"{clean_difficulty}\".\n"
        f"{'Additional criteria: ' + custom_prompt if custom_prompt else ''}\n"
        f"Do NOT copy the reference questions directly; produce creative, solvable variations with complete sample input and output.\n"
        f"Return ONLY the JSON array."
    )

    # 3. GENERATION STEP via Groq
    if groq_key:
        async with httpx.AsyncClient(timeout=15.0) as client:
            for model_name in CANDIDATE_GROQ_MODELS:
                try:
                    res = await client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {groq_key}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": model_name,
                            "messages": [
                                {"role": "system", "content": rag_system_prompt},
                                {"role": "user", "content": user_content}
                            ],
                            "temperature": 0.5
                        }
                    )
                    if res.status_code == 200:
                        data = res.json()
                        content = data["choices"][0]["message"]["content"]
                        cleaned = re.sub(r"^```(?:json)?", "", content.strip(), flags=re.MULTILINE)
                        cleaned = re.sub(r"```$", "", cleaned.strip(), flags=re.MULTILINE).strip()

                        try:
                            parsed = json.loads(cleaned)
                        except json.JSONDecodeError:
                            match = re.search(r'\[\s*\{.*\}\s*\]', content, re.DOTALL)
                            if match:
                                parsed = json.loads(match.group(0))
                            else:
                                continue

                        items = parsed if isinstance(parsed, list) else (parsed.get("questions") or parsed.get("data") or [])
                        if items:
                            formatted = []
                            for idx, q in enumerate(items[:count]):
                                formatted.append({
                                    "id": f"rag-q-{idx+1}",
                                    "sequence_number": idx + 1,
                                    "title": q.get("title") or f"{clean_topic} Problem {idx+1}",
                                    "topic": q.get("topic") or clean_topic,
                                    "difficulty": q.get("difficulty") or (clean_difficulty if clean_difficulty != "All" else "Medium"),
                                    "description": q.get("description") or f"Solve {clean_topic} problem.",
                                    "constraints": q.get("constraints") or "1 <= N <= 10^5\nTime Limit: 1.0s\nMemory Limit: 256MB",
                                    "sample_input": str(q.get("sample_input") or "1 2 3"),
                                    "sample_output": str(q.get("sample_output") or "6"),
                                    "starter_code": q.get("starter_code") or "def solve():\n    pass\n"
                                })

                            return {
                                "success": True,
                                "rag_enabled": True,
                                "source": f"Groq RAG (Pinecone + {model_name})",
                                "retrieved_references_count": len(retrieved_matches),
                                "retrieved_references": [
                                    {"id": m.get("id"), "title": m.get("title"), "topic": m.get("topic"), "score": m.get("score")}
                                    for m in retrieved_matches
                                ],
                                "topic": clean_topic,
                                "difficulty": clean_difficulty,
                                "count": len(formatted),
                                "questions": formatted
                            }
                    else:
                        logger.warning(f"Groq API returned {res.status_code} for {model_name}: {res.text}")
                except Exception as loop_e:
                    logger.warning(f"Groq RAG generation error with model {model_name}: {loop_e}")
                    continue

    # Fallback synthesizer if Groq API fails or key is missing
    from app import generate_fallback_questions
    fallback_qs = generate_fallback_questions(clean_topic, clean_difficulty, count)
    return {
        "success": True,
        "rag_enabled": bool(retrieved_matches),
        "source": "Local RAG Synthesizer (Pinecone + Fallback)",
        "retrieved_references_count": len(retrieved_matches),
        "retrieved_references": [
            {"id": m.get("id"), "title": m.get("title"), "topic": m.get("topic"), "score": m.get("score")}
            for m in retrieved_matches
        ],
        "topic": clean_topic,
        "difficulty": clean_difficulty,
        "count": len(fallback_qs),
        "questions": fallback_qs
    }
