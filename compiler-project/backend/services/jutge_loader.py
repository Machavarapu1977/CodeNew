import json
import os
from typing import Dict, List
from sqlalchemy.orm import Session
from ..models import Question, TestCase

# Path to language map config (relative to this file)
CONFIG_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "config", "language_map.json"))

def _load_language_map() -> Dict[int, str]:
    """Load language ID → Piston runtime mapping from JSON config.
    Returns a dict with integer keys.
    """
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
        # Convert keys to int for easier lookup
        return {int(k): v for k, v in raw.items()}
    except FileNotFoundError:
        raise RuntimeError(f"Language map config not found at {CONFIG_PATH}")
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Invalid JSON in language map: {e}")

# Cache the map on module import
LANGUAGE_MAP = _load_language_map()

def map_language_id(lang_id: int) -> str:
    """Return the Piston runtime string for a given language ID.
    Raises ValueError if the ID is unknown.
    """
    try:
        return LANGUAGE_MAP[lang_id]
    except KeyError:
        raise ValueError(f"Unsupported language ID: {lang_id}")

def load_question(question_id: int, db: Session) -> Dict:
    """Load a question and its test cases.
    Returns a dict with keys:
        "question": {id, title, description, sample_input, sample_output}
        "test_cases": list of dicts (first is visible sample, rest are hidden)
    """
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise ValueError(f"Question {question_id} not found")

    # Visible sample test case (id 1)
    test_cases: List[Dict] = [
        {
            "id": 1,
            "input": q.sample_input or "",
            "expected": q.sample_output or "",
            "is_hidden": False,
        }
    ]

    # Hidden test cases from DB
    hidden = db.query(TestCase).filter(TestCase.question_id == question_id).all()
    for idx, tc in enumerate(hidden, start=2):
        test_cases.append(
            {
                "id": idx,
                "input": tc.input_data,
                "expected": tc.expected_output,
                "is_hidden": tc.is_hidden,
            }
        )

    return {
        "question": {
            "id": q.id,
            "title": q.title,
            "description": q.description,
            "sample_input": q.sample_input,
            "sample_output": q.sample_output,
        },
        "test_cases": test_cases,
    }
