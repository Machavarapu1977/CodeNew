# pyrefly: ignore [missing-import]
from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.exc import OperationalError
from services.piston_service import execute_code
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
from schemas import RunRequest, SubmissionRequest, LoginRequest, TokenResponse, UserResponse, TemplateResponse, QuestionCreateRequest, QuestionResponse, TestCreateRequest, TestResponse, AIGenerateRequest, VectorSearchRequest, PineconeSyncResponse, AutoGenerateTestRequest
from models import Question, TestCase, Role, User, QuestionTemplate, Test
from services.evaluator import evaluate_output
from services.pinecone_service import upsert_question_to_pinecone, search_questions_in_pinecone, sync_all_questions_to_pinecone
from auth import create_access_token, get_current_user, require_role
from dotenv import load_dotenv
import os

load_dotenv()


# Create DB tables (if not existing). If the database is unreachable,
# catch the error so the app doesn't crash at import time. Routes that
# require the DB will still fail at request time until the DB is available.
DB_AVAILABLE = True

DEFAULT_TEMPLATES = [
    {
        "name": "Two Pointers",
        "icon": "↔",
        "description": "Use two pointers in array problems",
        "topic": "Arrays",
        "difficulty": "Medium",
        "starter_code": "def solve(arr, target):\n    # Write your solution here\n    pass\n",
        "problem_scaffold": "Given an array of integers and a target sum, use two pointers to find two numbers that sum up to target.\n\nInput Format:\nLine 1: Space-separated integers representing the array\nLine 2: Target integer\n\nOutput Format:\nIndices of the two numbers separated by space.",
        "sample_input": "2 7 11 15\n9",
        "sample_output": "0 1",
        "constraints": "1 <= arr.length <= 10^5\n-10^9 <= arr[i], target <= 10^9\nTime Limit: 1.0s\nMemory Limit: 256MB"
    },
    {
        "name": "Sliding Window",
        "icon": "▭",
        "description": "Find optimal subarray problems",
        "topic": "Arrays",
        "difficulty": "Medium",
        "starter_code": "def max_sub_array_of_size_k(k, arr):\n    # Write your solution here\n    pass\n",
        "problem_scaffold": "Given an array of positive numbers and a positive number 'k', find the maximum sum of any contiguous subarray of size 'k'.\n\nInput Format:\nLine 1: k (window size)\nLine 2: Space-separated array elements\n\nOutput Format:\nSingle integer representing maximum sum.",
        "sample_input": "3\n2 1 5 1 3 2",
        "sample_output": "9",
        "constraints": "1 <= arr.length <= 10^5\n1 <= k <= arr.length\nTime Limit: 1.0s\nMemory Limit: 256MB"
    },
    {
        "name": "Binary Search",
        "icon": "🔍",
        "description": "Search in sorted space efficiently",
        "topic": "Searching",
        "difficulty": "Easy",
        "starter_code": "def binary_search(arr, target):\n    # Write your solution here\n    pass\n",
        "problem_scaffold": "Given a sorted array of distinct integers and a target value, return the index if the target is found. If not, return -1.\n\nInput Format:\nLine 1: Sorted array elements separated by spaces\nLine 2: Target element\n\nOutput Format:\nIndex of target or -1.",
        "sample_input": "-1 0 3 5 9 12\n9",
        "sample_output": "4",
        "constraints": "1 <= arr.length <= 10^5\n-10^9 <= arr[i] <= 10^9\nArray is sorted in ascending order\nTime Limit: 0.5s"
    },
    {
        "name": "Graphs",
        "icon": "⬡",
        "description": "Graph traversal and shortest path",
        "topic": "Graphs",
        "difficulty": "Hard",
        "starter_code": "from collections import deque\n\ndef bfs(graph, start, goal):\n    # Write your solution here\n    pass\n",
        "problem_scaffold": "Given an unweighted undirected graph and two nodes (start and target), find the shortest distance between start and target node using BFS.\n\nInput Format:\nLine 1: Number of vertices V and edges E\nFollowing E lines: u v (edge between u and v)\nLast line: start and target vertices\n\nOutput Format:\nShortest path distance or -1.",
        "sample_input": "4 4\n0 1\n0 2\n1 3\n2 3\n0 3",
        "sample_output": "2",
        "constraints": "1 <= V <= 10^4\n0 <= E <= 10^4\nTime Limit: 2.0s"
    },
    {
        "name": "Dynamic Programming",
        "icon": "⚡",
        "description": "Solve optimization problems",
        "topic": "Dynamic Programming",
        "difficulty": "Medium",
        "starter_code": "def climb_stairs(n):\n    # Write your solution here\n    pass\n",
        "problem_scaffold": "You are climbing a staircase. It takes n steps to reach the top. Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?\n\nInput Format:\nSingle integer n\n\nOutput Format:\nTotal distinct ways.",
        "sample_input": "3",
        "sample_output": "3",
        "constraints": "1 <= n <= 45\nTime Limit: 1.0s\nMemory Limit: 128MB"
    },
    {
        "name": "Backtracking",
        "icon": "↩",
        "description": "Generate and explore all possibilities",
        "topic": "Recursion",
        "difficulty": "Medium",
        "starter_code": "def subsets(nums):\n    # Write your solution here\n    pass\n",
        "problem_scaffold": "Given an integer array nums of unique elements, return all possible subsets (the power set).\n\nInput Format:\nSpace-separated integers\n\nOutput Format:\nAll subsets listed.",
        "sample_input": "1 2 3",
        "sample_output": "[[], [1], [1, 2], [1, 2, 3], [1, 3], [2], [2, 3], [3]]",
        "constraints": "1 <= nums.length <= 10\nAll elements of nums are unique\nTime Limit: 1.0s"
    },
    {
        "name": "Prefix Sum",
        "icon": "∑",
        "description": "Cumulative sum query problems",
        "topic": "Arrays",
        "difficulty": "Medium",
        "starter_code": "def range_sum_query(arr, queries):\n    # Write your solution here\n    pass\n",
        "problem_scaffold": "Given an array of integers and multiple range sum queries (L, R), calculate the sum of elements between indices L and R inclusive efficiently.\n\nInput Format:\nLine 1: Space-separated array elements\nLine 2: Number of queries Q\nFollowing Q lines: L R indices\n\nOutput Format:\nQuery results separated by space.",
        "sample_input": "1 2 3 4 5 6\n2\n0 2\n2 5",
        "sample_output": "6 18",
        "constraints": "1 <= arr.length <= 10^5\n1 <= Q <= 10^5\n0 <= L <= R < arr.length\nTime Limit: 1.0s"
    },
    {
        "name": "Trees",
        "icon": "🌲",
        "description": "Binary tree traversal and operations",
        "topic": "Trees",
        "difficulty": "Medium",
        "starter_code": "class TreeNode:\n    def __init__(self, val=0, left=None, right=None):\n        self.val = val\n        self.left = left\n        self.right = right\n\ndef max_depth(root):\n    # Write your solution here\n    pass\n",
        "problem_scaffold": "Given the root of a binary tree, return its maximum depth (the number of nodes along the longest path from root node to leaf node).\n\nInput Format:\nTree nodes in level order representation\n\nOutput Format:\nMaximum depth integer.",
        "sample_input": "3 9 20 null null 15 7",
        "sample_output": "3",
        "constraints": "0 <= Number of nodes <= 10^4\n-100 <= Node.val <= 100\nTime Limit: 1.0s"
    }
]

from sqlalchemy import text

try:
    Base.metadata.create_all(bind=engine)
    if engine.dialect.name != 'sqlite':
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20) DEFAULT 'Medium';"))
            conn.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS topic VARCHAR(50) DEFAULT 'General';"))
            conn.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS starter_code TEXT;"))
            conn.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS constraints TEXT;"))
            conn.execute(text("ALTER TABLE question_templates ADD COLUMN IF NOT EXISTS constraints TEXT;"))
            conn.commit()



    db = SessionLocal()

    # Seed default roles if not present
    for role_name in ["Instructor", "Student"]:
        existing_role = db.query(Role).filter(Role.name == role_name).first()
        if not existing_role:
            db.add(Role(name=role_name))
    db.commit()

    # Seed default question and hidden test cases if not present
    q1 = db.query(Question).filter(Question.id == 1).first()
    if not q1:
        q1 = Question(
            id=1,
            title="Add Two Numbers",
            description="Given two integers, return their sum.",
            sample_input="2 3",
            sample_output="5",
            difficulty="Easy",
            topic="Basic Math"
        )
        db.add(q1)
        db.commit()
        db.refresh(q1)

    # Ensure standard questions have constraints populated if missing
    default_constraints_map = {
        1: "-10^9 <= a, b <= 10^9\nTime Limit: 1.0s\nMemory Limit: 256MB",
        2: "1 <= arr.length <= 10^5\n-10^9 <= arr[i], target <= 10^9\nArray is sorted in ascending order\nTime Limit: 0.5s",
        3: "1 <= nums.length <= 10^4\n0 <= nums[i] <= 10^5\nTime Limit: 1.0s\nMemory Limit: 256MB",
        12: "1 <= nums.length <= 10^5\n-10^9 <= nums[i] <= 10^9\nTime Limit: 1.0s\nMemory Limit: 256MB"
    }
    for q_id, q_constraints in default_constraints_map.items():
        q_obj = db.query(Question).filter(Question.id == q_id).first()
        if q_obj and not q_obj.constraints:
            q_obj.constraints = q_constraints
    db.commit()

    tc_count = db.query(TestCase).filter(TestCase.question_id == 1).count()
    if tc_count == 0:
        test_cases = [
            TestCase(question_id=1, input_data="10 20", expected_output="30", is_hidden=True),
            TestCase(question_id=1, input_data="100 -50", expected_output="50", is_hidden=True),
            TestCase(question_id=1, input_data="-10 -15", expected_output="-25", is_hidden=True),
            TestCase(question_id=1, input_data="0 999", expected_output="999", is_hidden=True)
        ]
        db.add_all(test_cases)
        db.commit()

    # Seed default mock test if empty
    test_count = db.query(Test).count()
    if test_count == 0:
        default_test = Test(
            title="Mock Coding Assessment 1",
            description="Default practice test containing foundational coding questions.",
            duration_minutes=45,
            total_marks=100,
        )
        if q1:
            default_test.questions = [q1]
        db.add(default_test)
        db.commit()

    # Seed question templates if empty
    tmpl_count = db.query(QuestionTemplate).count()
    if tmpl_count == 0:
        for t_data in DEFAULT_TEMPLATES:
            tmpl = QuestionTemplate(**t_data)
            db.add(tmpl)
        db.commit()

    # Sync all existing questions to Pinecone on startup
    try:
        all_qs = db.query(Question).all()
        sync_all_questions_to_pinecone(all_qs)
    except Exception as pine_err:
        print("Note: Pinecone startup sync:", pine_err)

    db.close()
except OperationalError as e:
    DB_AVAILABLE = False
    print("Warning: could not connect to the database during startup:", e)
    print("The app will continue to run but DB-backed routes will fail until the DB is available.")



app = FastAPI()
# Enable CORS for the frontend development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/health")
async def health_check():
    """Simple health check to verify backend reachability."""
    return {"status": "OK"}



@app.get("/instructor/dashboard")
def instructor_dashboard(current_user: User = Depends(require_role(["Instructor"]))):
    return {
        "message": f"Welcome Instructor {current_user.name}!",
        "role": "Instructor",
        "actions": ["Create Questions", "Manage Test Cases", "View Student Reports"]
    }

@app.get("/student/dashboard")
def student_dashboard(current_user: User = Depends(require_role(["Student"]))):
    return {
        "message": f"Welcome Student {current_user.name}!",
        "role": "Student",
        "actions": ["Take Mock Tests", "Solve Problems", "Track Progress"]
    }

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/questions/{question_id}")
def read_question(question_id: int, db: Session = Depends(get_db)):
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return {
        "id": q.id,
        "title": q.title,
        "description": q.description,
        "sample_input": q.sample_input,
        "sample_output": q.sample_output,
        "difficulty": q.difficulty or "Medium",
        "topic": q.topic or "General",
        "starter_code": q.starter_code or "",
        "constraints": q.constraints or ""
    }



#This block of code below is the run code API which sends the code to piston
@app.post("/run")
async def run_code(req: RunRequest, db: Session = Depends(get_db)):
    """Execute code via the piston_service and return stdout/stderr and check correctness."""
    q_id = req.question_id if req.question_id is not None else req.questionId
    
    sample_output = ""
    is_custom_input = False
    stdin = ""

    if q_id is not None:
        q = db.query(Question).filter(Question.id == q_id).first()
        if q:
            sample_in = (q.sample_input or "").strip()
            if q.sample_output:
                sample_output = q.sample_output
            
            # If user provided explicit non-empty input
            if req.input is not None and req.input.strip():
                stdin = req.input
                if sample_in and stdin.strip() != sample_in:
                    is_custom_input = True
            else:
                stdin = q.sample_input or ""
                is_custom_input = False
    else:
        stdin = req.input if req.input is not None else ""
        if stdin.strip():
            is_custom_input = True

    # Execute code with dynamic input via Piston or local fallback
    result = await execute_code(req.language, req.code, stdin)

    if result.get("error"):
        is_correct = False
        if not result.get("output"):
            result["output"] = result["error"] or ""
    else:
        actual_output = result.get("output", "")
        if is_custom_input:
            is_correct = True
        else:
            eval_res = evaluate_output(actual_output, sample_output)
            is_correct = eval_res["passed"]

    result["is_correct"] = is_correct
    result["is_custom_input"] = is_custom_input
    return result

import os
import json

@app.post("/submit/questions/{question_id}")
async def submit_code(question_id: int, req: SubmissionRequest, db: Session = Depends(get_db)):
    """Execute code against all test cases for a question and return evaluation results."""
    # Load language mapping configuration
    config_path = os.path.join(os.path.dirname(__file__), "config", "language_map.json")
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            language_map = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to load language map")

    runtime_language = language_map.get(str(req.language_id))
    if not runtime_language:
        raise HTTPException(status_code=400, detail="Unsupported language ID")

    # Retrieve question metadata
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    # Retrieve hidden test cases from DB
    db_test_cases = db.query(TestCase).filter(TestCase.question_id == question_id).all()

    # Assemble test cases (sample + hidden)
    test_cases_to_run = []
    if q.sample_input and q.sample_output:
        test_cases_to_run.append({
            "id": 1,
            "input": q.sample_input or "",
            "expected": q.sample_output or "",
            "is_hidden": False
        })
    idx = len(test_cases_to_run) + 1
    for tc in db_test_cases:
        test_cases_to_run.append({
            "id": idx,
            "input": tc.input_data or "",
            "expected": tc.expected_output or "",
            "is_hidden": tc.is_hidden
        })
        idx += 1

    test_results = []
    passed_count = 0
    total_count = len(test_cases_to_run)
    overall_status = "Accepted"

    # Execute each test case using Piston
    for tc in test_cases_to_run:
        tc_in = tc["input"] if tc["input"] is not None else ""
        tc_exp = tc["expected"] if tc["expected"] is not None else ""
        run_res = await execute_code(runtime_language, req.source_code, tc_in)
        actual_output = run_res.get("output", "")
        error_msg = run_res.get("error", None)
        if error_msg:
            tc_status = "Runtime Error"
            passed = False
            actual_display = error_msg
        else:
            eval_res = evaluate_output(actual_output, tc_exp)
            tc_status = eval_res["status"]
            passed = eval_res["passed"]
            actual_display = actual_output
        if passed:
            passed_count += 1
        else:
            if overall_status == "Accepted":
                overall_status = tc_status
        test_results.append({
            "id": tc["id"],
            "input": tc["input"],
            "expected": tc["expected"],
            "output": actual_display.strip(),
            "result": tc_status,
            "is_hidden": tc["is_hidden"]
        })

    # Calculate score (out of 10)
    score_val = int((passed_count / total_count) * 10) if total_count > 0 else 0
    score_str = f"{score_val}/10"

    # Dynamic feedback and code reviews
    from services.feedback_service import generate_feedback_and_reviews
    feedback_data = generate_feedback_and_reviews(
        code=req.source_code,
        language=runtime_language,
        question_id=question_id,
        test_results=test_results,
        passed_count=passed_count,
        total_count=total_count,
    )

    return {
        "status": overall_status,
        "score": score_str,
        "passed": passed_count == total_count,
        "test_cases": test_results,
        "feedback": feedback_data["feedback"],
        "review_points": feedback_data["review_points"],
    }

# TEMPLATES & QUESTIONS ENDPOINTS
@app.get("/templates", response_model=list[TemplateResponse])
def get_templates(db: Session = Depends(get_db)):
    """Fetch all algorithmic problem templates from PostgreSQL DB."""
    templates = db.query(QuestionTemplate).all()
    return templates

@app.get("/templates/{template_id}", response_model=TemplateResponse)
def get_template(template_id: int, db: Session = Depends(get_db)):
    """Fetch a single template by ID."""
    template = db.query(QuestionTemplate).filter(QuestionTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@app.get("/questions", response_model=list[QuestionResponse])
def get_all_questions(db: Session = Depends(get_db)):
    """Fetch all questions stored in PostgreSQL DB."""
    questions = db.query(Question).all()
    return questions

@app.post("/questions", response_model=QuestionResponse)
def create_question(req: QuestionCreateRequest, db: Session = Depends(get_db)):
    """Create a new question and associated test cases in PostgreSQL DB and upsert to Pinecone."""
    new_q = Question(
        title=req.title,
        description=req.description,
        difficulty=req.difficulty,
        topic=req.topic,
        sample_input=req.sample_input,
        sample_output=req.sample_output,
        starter_code=req.starter_code,
        constraints=req.constraints
    )
    db.add(new_q)
    db.commit()
    db.refresh(new_q)

    # Create associated test cases
    for tc in req.test_cases:
        db_tc = TestCase(
            question_id=new_q.id,
            input_data=tc.input_data,
            expected_output=tc.expected_output,
            is_hidden=tc.is_hidden
        )
        db.add(db_tc)
    if req.test_cases:
        db.commit()

    # Automatically upsert into Pinecone vector database
    try:
        upsert_question_to_pinecone(new_q)
    except Exception as e:
        logger.warning(f"Failed to upsert question {new_q.id} to Pinecone: {e}")

    return new_q


# ── PINECONE VECTOR SEARCH & SYNC ENDPOINTS ────────────────────────────────
@app.post("/questions/vector-search")
def vector_search_questions(req: VectorSearchRequest, db: Session = Depends(get_db)):
    """Search questions using Pinecone semantic vector query with DB fallback."""
    results = search_questions_in_pinecone(req.query, req.top_k, req.topic, req.difficulty)
    if not results:
        # Fallback to database text matching
        query = db.query(Question)
        if req.topic and req.topic != "All":
            query = query.filter(Question.topic == req.topic)
        if req.difficulty and req.difficulty != "All":
            query = query.filter(Question.difficulty == req.difficulty)
        if req.query and req.query.strip():
            query = query.filter(
                Question.title.ilike(f"%{req.query.strip()}%") | 
                Question.description.ilike(f"%{req.query.strip()}%")
            )
        db_matches = query.limit(req.top_k).all()
        results = [
            {
                "id": q.id,
                "title": q.title,
                "topic": q.topic or "General",
                "difficulty": q.difficulty or "Medium",
                "description": q.description or "",
                "constraints": q.constraints or "",
                "sample_input": q.sample_input or "",
                "sample_output": q.sample_output or "",
                "starter_code": q.starter_code or "",
                "score": 1.0
            }
            for q in db_matches
        ]
    return results


@app.post("/questions/sync-pinecone", response_model=PineconeSyncResponse)
def sync_pinecone(db: Session = Depends(get_db)):
    """Sync all questions from SQL database to Pinecone vector database."""
    questions = db.query(Question).all()
    res = sync_all_questions_to_pinecone(questions)
    return res


# ── TESTS (Mock Assessments) ENDPOINTS ──────────────────────────────────────

@app.post("/tests", response_model=TestResponse)
def create_test(req: TestCreateRequest, db: Session = Depends(get_db)):
    """Create a new mock test and link selected questions in PostgreSQL."""
    new_test = Test(
        title=req.title,
        description=req.description,
        duration_minutes=req.duration_minutes,
        total_marks=req.total_marks,
    )
    # Attach questions
    if req.question_ids:
        questions = db.query(Question).filter(Question.id.in_(req.question_ids)).all()
        new_test.questions = questions
    db.add(new_test)
    db.commit()
    db.refresh(new_test)
    return _test_to_response(new_test)


@app.get("/tests", response_model=list[TestResponse])
def get_all_tests(db: Session = Depends(get_db)):
    """Fetch all mock tests from PostgreSQL, ordered by newest first."""
    tests = db.query(Test).order_by(Test.created_at.desc()).all()
    return [_test_to_response(t) for t in tests]


@app.get("/tests/{test_id}", response_model=TestResponse)
def get_test(test_id: int, db: Session = Depends(get_db)):
    """Fetch a single mock test by ID with all linked questions."""
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    return _test_to_response(test)


@app.delete("/tests/{test_id}")
def delete_test(test_id: int, db: Session = Depends(get_db)):
    """Delete a mock test by ID."""
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    db.delete(test)
    db.commit()
    return {"message": f"Test '{test.title}' deleted successfully."}


@app.post("/tests/auto-generate", response_model=TestResponse)
def auto_generate_test(req: AutoGenerateTestRequest, db: Session = Depends(get_db)):
    """
    Auto-generate a balanced mock test from the question bank.

    Selects `num_questions` questions using a balanced strategy:
    - If difficulty is not specified, picks across Easy/Medium/Hard proportionally.
    - If topic is specified, restricts pool to that topic.
    - Falls back to random sampling when the pool is smaller than requested.
    """
    import random

    num = max(1, min(req.num_questions, 20))

    # Build the base query, optionally filtered by topic
    base_query = db.query(Question)
    if req.topic and req.topic not in ("All", ""):
        base_query = base_query.filter(Question.topic == req.topic)

    if req.difficulty and req.difficulty not in ("All", ""):
        # Single-difficulty mode: just pick randomly from that difficulty
        pool = base_query.filter(Question.difficulty == req.difficulty).all()
        random.shuffle(pool)
        selected = pool[:num]
    else:
        # Balanced strategy: divide slots across Easy / Medium / Hard
        easy_pool   = base_query.filter(Question.difficulty == "Easy").all()
        medium_pool = base_query.filter(Question.difficulty == "Medium").all()
        hard_pool   = base_query.filter(Question.difficulty == "Hard").all()
        other_pool  = base_query.filter(
            ~Question.difficulty.in_(["Easy", "Medium", "Hard"])
        ).all()

        # Slot allocation: ~25% Easy, ~50% Medium, ~25% Hard
        easy_slots   = max(1, round(num * 0.25))
        hard_slots   = max(1, round(num * 0.25))
        medium_slots = num - easy_slots - hard_slots

        def pick(pool, n):
            shuffled = list(pool)
            random.shuffle(shuffled)
            return shuffled[:n]

        selected = (
            pick(easy_pool,   easy_slots)
            + pick(medium_pool, medium_slots)
            + pick(hard_pool,   hard_slots)
        )

        # If some buckets were empty, top-up from other pools
        shortfall = num - len(selected)
        if shortfall > 0:
            used_ids = {q.id for q in selected}
            extras = [
                q for q in easy_pool + medium_pool + hard_pool + other_pool
                if q.id not in used_ids
            ]
            random.shuffle(extras)
            selected += extras[:shortfall]

        random.shuffle(selected)  # shuffle the final order

    if not selected:
        raise HTTPException(
            status_code=400,
            detail="No questions found in the question bank matching the given filters. Add questions first."
        )

    # Build a meaningful default title if caller didn't customise it
    title = req.title.strip() or "Auto-Generated Mock Test"
    difficulty_label = req.difficulty if req.difficulty and req.difficulty not in ("All", "") else "Balanced"
    topic_label = req.topic if req.topic and req.topic not in ("All", "") else "All Topics"
    description = req.description.strip() or (
        f"Auto-generated {difficulty_label} test covering {topic_label} "
        f"({len(selected)} question{'s' if len(selected) != 1 else ''})."
    )

    new_test = Test(
        title=title,
        description=description,
        duration_minutes=req.duration_minutes,
        total_marks=req.total_marks,
        questions=selected,
    )
    db.add(new_test)
    db.commit()
    db.refresh(new_test)
    return _test_to_response(new_test)


def _test_to_response(test: Test) -> dict:
    """Helper: serialize a Test ORM instance to a TestResponse-compatible dict."""
    return {
        "id": test.id,
        "title": test.title,
        "description": test.description or "",
        "duration_minutes": test.duration_minutes,
        "total_marks": test.total_marks,
        "created_at": test.created_at.isoformat() if test.created_at else None,
        "questions": [
            {
                "id": q.id,
                "title": q.title,
                "difficulty": q.difficulty or "Medium",
                "topic": q.topic or "General",
                "description": q.description or "",
                "constraints": q.constraints or "",
                "sample_input": q.sample_input or "",
                "sample_output": q.sample_output or "",
                "starter_code": q.starter_code or "",
            }
            for q in test.questions
        ],
    }


from pydantic import BaseModel

class TestFinishRequest(BaseModel):
    test_id: int | None = None
    student_name: str | None = "Student"
    solved_questions: list[int] = []
    question_submissions: dict = {}
    time_taken_seconds: int = 0

@app.post("/tests/{test_id}/finish")
@app.post("/tests/finish")
async def finish_test(test_id: int | None = None, req: TestFinishRequest | None = None, db: Session = Depends(get_db)):
    """Automatically submit test, generate student confirmation note via feedback_service,
    and return instruction to navigate back to the main dashboard."""
    from services.feedback_service import generate_test_submission_note

    target_test_id = test_id or (req.test_id if req else None)
    test_title = "Assessment"
    total_marks = 100
    total_questions = 0

    if target_test_id:
        test = db.query(Test).filter(Test.id == target_test_id).first()
        if test:
            test_title = test.title or "Assessment"
            total_marks = test.total_marks or 100
            total_questions = len(test.questions)

    student_name = (req.student_name if req and req.student_name else "Student")
    solved_count = len(req.solved_questions) if req and req.solved_questions else 0
    if total_questions == 0 and req and req.question_submissions:
        total_questions = max(len(req.question_submissions), solved_count)
    if total_questions == 0:
        total_questions = max(1, solved_count)

    score = int((solved_count / total_questions) * total_marks) if total_questions > 0 else 0

    note = generate_test_submission_note(
        test_title=test_title,
        student_name=student_name,
        total_questions=total_questions,
        solved_count=solved_count,
        score=score,
        total_marks=total_marks
    )

    return {
        "status": "Submitted",
        "message": "Test has been automatically submitted successfully.",
        "note": note,
        "test_title": test_title,
        "solved_count": solved_count,
        "total_questions": total_questions,
        "score": score,
        "total_marks": total_marks,
        "redirect_to": "dashboard"
    }



# ── AI / GROQ QUESTION GENERATION ENDPOINT ─────────────────────────────────
import httpx
import re

FALLBACK_TEMPLATES_BY_TOPIC = {
    "Arrays": [
        {"title": "Maximum Subarray Sum (Kadane's Algorithm)", "desc": "Find the contiguous subarray with the maximum sum in an array of integers."},
        {"title": "Rotate Array by K Positions", "desc": "Rotate an array of size N to the right by K steps in place."},
        {"title": "Product of Array Except Self", "desc": "Return an array output such that output[i] is equal to the product of all elements except nums[i]."},
        {"title": "Container With Most Water", "desc": "Find two lines that together with the x-axis form a container that contains the most water."},
        {"title": "3Sum Target Triplet", "desc": "Find all unique triplets in the array which gives the sum of zero."}
    ],
    "Dynamic Programming": [
        {"title": "0/1 Knapsack Optimization", "desc": "Given weights and values of N items, determine the maximum value put in a knapsack of capacity W."},
        {"title": "Longest Increasing Subsequence", "desc": "Find the length of the longest strictly increasing subsequence in an integer array."},
        {"title": "Partition Equal Subset Sum", "desc": "Determine if an array can be partitioned into two subsets with equal sum."},
        {"title": "Coin Change Minimum Coins", "desc": "Find the fewest number of coins needed to make up a given amount."},
        {"title": "House Robber DP", "desc": "Determine the maximum amount of money you can rob tonight without alerting the police."}
    ],
    "Graphs": [
        {"title": "Shortest Path in Weighted Graph (Dijkstra)", "desc": "Find the shortest path from source node to all other nodes in a non-negative weighted graph."},
        {"title": "Number of Connected Components", "desc": "Find the number of connected components in an undirected graph."},
        {"title": "Topological Sort of DAG", "desc": "Return a valid topological ordering of vertices in a Directed Acyclic Graph."},
        {"title": "Detect Cycle in Directed Graph", "desc": "Determine whether a given directed graph contains a cycle using DFS coloring."},
        {"title": "Course Schedule Prerequisites", "desc": "Determine if it is possible to finish all courses given prerequisite dependencies."}
    ],
    "Trees": [
        {"title": "Binary Tree Level Order Traversal", "desc": "Return the level order traversal of binary tree node values using BFS queue."},
        {"title": "Validate Binary Search Tree", "desc": "Determine if a given binary tree is a valid Binary Search Tree (BST)."},
        {"title": "Lowest Common Ancestor in BST", "desc": "Find the lowest common ancestor node of two given nodes p and q in a BST."},
        {"title": "Serialize and Deserialize Binary Tree", "desc": "Design an algorithm to serialize and deserialize a binary tree to and from string."},
        {"title": "Diameter of Binary Tree", "desc": "Compute the length of the longest path between any two nodes in a tree."}
    ],
    "Strings": [
        {"title": "Valid Anagram Check", "desc": "Determine if string t is an anagram of string s using frequency maps."},
        {"title": "Group Anagrams Together", "desc": "Given an array of strings, group the anagrams together in any order."},
        {"title": "Longest Palindromic Substring", "desc": "Find the longest palindromic substring in a given string s."},
        {"title": "String Compression Run-Length", "desc": "Compress a character array using run-length encoding in place."},
        {"title": "Longest Substring Without Repeating Characters", "desc": "Find the length of the longest substring without repeating characters."}
    ],
    "Linked Lists": [
        {"title": "Reverse Linked List", "desc": "Reverse a singly linked list iteratively and recursively."},
        {"title": "Detect and Find Cycle in Linked List", "desc": "Detect if a cycle exists in a linked list and return the node where cycle begins."},
        {"title": "Merge Two Sorted Lists", "desc": "Merge two sorted linked lists and return it as a new sorted list."}
    ]
}

def generate_fallback_questions(topic: str, difficulty: str, count: int) -> list:
    diff_val = "Medium" if difficulty == "All" else difficulty
    pool = FALLBACK_TEMPLATES_BY_TOPIC.get(topic) or [
        {"title": f"{topic} Optimal Solution Challenge", "desc": f"Solve the algorithmic problem focusing on {topic}."},
        {"title": f"Advanced {topic} Traversal & Processing", "desc": f"Implement an efficient algorithm for {topic} with optimal time complexity."},
        {"title": f"{topic} Edge Case Evaluator", "desc": f"Handle constraints and performance edge cases for {topic} data structures."},
        {"title": f"{topic} Subproblem Decomposition", "desc": f"Break down {topic} challenge into efficient subproblems."},
        {"title": f"{topic} Complexity Optimizer", "desc": f"Design an O(N) or O(N log N) solution for {topic}."}
    ]
    
    results = []
    for i in range(count):
        tmpl = pool[i % len(pool)]
        time_lim = "2.0s" if diff_val == "Hard" else ("0.5s" if diff_val == "Easy" else "1.0s")
        results.append({
            "id": f"ai-q-{i+1}",
            "sequence_number": i + 1,
            "title": f"{tmpl['title']} ({diff_val})",
            "topic": topic,
            "difficulty": diff_val,
            "description": tmpl["desc"],
            "constraints": f"1 <= N <= 10^5\nTime Limit: {time_lim}\nMemory Limit: 256MB",
            "sample_input": f"5\n10 20 30 40 50",
            "sample_output": "150",
            "starter_code": f"# Python 3 Scaffold for {tmpl['title']}\ndef solve(data):\n    # Write your solution here\n    pass\n\nif __name__ == '__main__':\n    import sys\n    # input_data = sys.stdin.read()\n    # print(solve(input_data))\n"
        })
    return results

import logging

logger = logging.getLogger(__name__)

@app.get("/rag/status")
def get_rag_status():
    """Diagnostic endpoint checking Pinecone and RAG system status."""
    from services.pinecone_service import get_pinecone_index, PINECONE_INDEX_NAME
    idx = get_pinecone_index()
    vector_count = 0
    connected = False
    if idx is not None:
        try:
            stats = idx.describe_index_stats()
            vector_count = getattr(stats, "total_vector_count", 0)
            connected = True
        except Exception:
            connected = False

    return {
        "rag_system_enabled": True,
        "retrieval_backend": "Pinecone Vector Database",
        "generation_backend": "Groq LLM (qwen/qwen3.8-27b)",
        "index_name": PINECONE_INDEX_NAME,
        "pinecone_connected": connected,
        "total_vector_count": vector_count,
        "rag_pipeline": "1. Pinecone Vector Retrieval -> 2. Context Grounding & Augmentation -> 3. Groq LLM Synthesis"
    }

@app.post("/ai/generate-questions")
async def ai_generate_questions(req: AIGenerateRequest, db: Session = Depends(get_db)):
    """
    Generate coding questions using Pinecone RAG system (Retrieval-Augmented Generation)
    grounded in question bank context, powered by Groq LLM.
    """
    from services.rag_service import generate_questions_with_rag
    return await generate_questions_with_rag(
        topic=req.topic,
        difficulty=req.difficulty,
        count=req.count,
        custom_prompt=req.custom_prompt,
        api_key=req.api_key,
        db_session=db
    )

