from pydantic import BaseModel

class RunRequest(BaseModel):
    language: str
    code: str
    input: str = ""
    question_id: int | None = None
    questionId: int | None = None

class SubmitRequest(BaseModel):
    language: str
    code: str

# New schema for submission with language ID mapping
class SubmissionRequest(BaseModel):
    question_id: int
    language_id: int
    source_code: str

# Auth and RBAC Schemas
class LoginRequest(BaseModel):
    name: str
    email: str
    role: str # "Instructor" or "Student"

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Question & Template Schemas
class TemplateResponse(BaseModel):
    id: int
    name: str
    icon: str
    description: str
    topic: str
    difficulty: str = "Medium"
    starter_code: str | None = None
    problem_scaffold: str | None = None
    sample_input: str | None = None
    sample_output: str | None = None
    constraints: str | None = None

    class Config:
        from_attributes = True

class TestCaseCreate(BaseModel):
    input_data: str
    expected_output: str
    is_hidden: bool = True

class QuestionCreateRequest(BaseModel):
    title: str
    description: str
    difficulty: str = "Medium"
    topic: str = "General"
    sample_input: str = ""
    sample_output: str = ""
    starter_code: str = ""
    constraints: str = ""
    test_cases: list[TestCaseCreate] = []

class QuestionResponse(BaseModel):
    id: int
    title: str
    description: str
    difficulty: str = "Medium"
    topic: str = "General"
    sample_input: str | None = None
    sample_output: str | None = None
    starter_code: str | None = None
    constraints: str | None = None

    class Config:
        from_attributes = True


# ── Test Schemas ────────────────────────────────────────────────────────────
class TestCreateRequest(BaseModel):
    title: str
    description: str = ""
    duration_minutes: int = 60
    total_marks: int = 100
    question_ids: list[int] = []


class QuestionSummary(BaseModel):
    id: int
    title: str
    difficulty: str = "Medium"
    topic: str = "General"
    description: str | None = None
    constraints: str | None = None
    sample_input: str | None = None
    sample_output: str | None = None
    starter_code: str | None = None

    class Config:
        from_attributes = True


class TestResponse(BaseModel):
    id: int
    title: str
    description: str | None = None
    duration_minutes: int
    total_marks: int
    created_at: str | None = None
    questions: list[QuestionSummary] = []

    class Config:
        from_attributes = True


# ── AI Question Generation Schemas ──────────────────────────────────────────
class AIGenerateRequest(BaseModel):
    topic: str = "Arrays"
    difficulty: str = "Medium"
    count: int = 3
    custom_prompt: str | None = None
    api_key: str | None = None
    use_rag: bool = True


# ── Pinecone Vector Search Schemas ──────────────────────────────────────────
class VectorSearchRequest(BaseModel):
    query: str
    top_k: int = 5
    topic: str | None = None
    difficulty: str | None = None
    use_rag: bool = False

class PineconeSyncResponse(BaseModel):
    total: int
    upserted: int
    status: str
    synced_to_pinecone: bool
    error: str | None = None


# ── Auto-Generate Test Schema ────────────────────────────────────────────────
class AutoGenerateTestRequest(BaseModel):
    title: str = "Auto-Generated Mock Test"
    description: str = ""
    duration_minutes: int = 45
    total_marks: int = 100
    num_questions: int = 3          # 1–20 questions to auto-pick
    topic: str | None = None        # None = all topics
    difficulty: str | None = None   # None = all difficulties (balanced)


# ── Proctoring & Violation Schemas ──────────────────────────────────────────
class ViolationCreate(BaseModel):
    test_id: int | None = None
    student_name: str
    event_type: str
    severity: str = "SOFT"
    details: str | dict | None = None


class ViolationResponse(BaseModel):
    id: int
    test_id: int | None = None
    student_name: str
    event_type: str
    severity: str
    details: str | None = None
    occurred_at: str | None = None

    class Config:
        from_attributes = True


class ProctoringTelemetryPacket(BaseModel):
    type: str  # TAB_SWITCH, WINDOW_BLUR, LARGE_PASTE, MULTI_DISPLAY, CAMERA_FRAME
    test_id: int | None = None
    student_name: str
    details: dict | None = None
    image: str | None = None  # Base64 image data for camera analysis
    timestamp: float | None = None


class ProctoringStatusResponse(BaseModel):
    status: str  # OK, SOFT_WARNING, HARD_FLAG, TERMINATE_TEST
    severity: str  # NONE, SOFT, HARD
    message: str
    soft_flags_count: int = 0
    hard_flags_count: int = 0
    total_violations: int = 0
    event_type: str | None = None
    proxy_status: str | None = None


