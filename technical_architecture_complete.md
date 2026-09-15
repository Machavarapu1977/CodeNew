# Technical Architecture Document: AI-Powered Mock Test Generation & Evaluation Platform

## 1. Executive Summary & System Overview

The **AI-Powered Mock Test Generation & Evaluation Platform** is an enterprise-grade assessment system designed to streamline coding evaluations for educational institutions and technical organizations. The platform provides a hybrid workflow: **Teachers** author, refine, and manage questions with LLM support, while **Students** take adaptive mock tests synthesized dynamically through Retrieval-Augmented Generation (RAG).

Code submissions are executed securely in isolated environments using **Piston**, while real-time proctoring, automated performance analytics, and topic-wise recommendations are driven by asynchronous AI agent workflows.

---

## 2. High-Level Architecture Diagram (C4 Level 2 - Container)

```
                                      +-------------------------------------------------------+
                                      |                    CLIENT LAYER                       |
                                      |                                                       |
                                      |   +---------------------+   +---------------------+   |
                                      |   |   Teacher Portal    |   |   Student Portal    |   |
                                      |   | (React + Tailwind)  |   | (React + Monaco Ed) |   |
                                      |   +----------+----------+   +----------+----------+   |
                                      +--------------|-------------------------|--------------+
                                                     | HTTPS / REST / WS       | HTTPS / REST / WS
                                                     v                         v
+----------------------------------------------------------------------------------------------------------------------------------+
|                                                      API GATEWAY & BACKEND LAYER                                                 |
|                                                                                                                                  |
|  +----------------------------------------------------------------------------------------------------------------------------+  |
|  |                                                 FastAPI Application Server                                                 |  |
|  |                                                                                                                            |  |
|  |   +---------------------+    +---------------------+    +---------------------+    +---------------------+    +---------------+  |
|  |   | Auth & Access Ctrl  |    |  Question Management|    |  Mock Test Engine   |    | Submission Handler  |    | Proctoring WS |  |
|  |   |    (JWT / RBAC)     |    |       Service       |    |       Service       |    |       Service       |    |    Handler    |  |
|  |   +---------------------+    +---------------------+    +---------------------+    +---------------------+    +---------------+  |
|  +----------------------------------------------------------------------------------------------------------------------------+  |
+------------------------------------|----------------------------|----------------------------|-----------------------------------+
                                     |                            |                            |
      +------------------------------+                            |                            +-------------------------------+
      |                                                           |                                                            |
      v                                                           v                                                            v
+------------------------+                        +------------------------+                                      +------------------------+
|    DATA STORAGE        |                        |    AI & AGENT WORKFLOW |                                      | EXECUTION ENGINE       |
|                        |                        |                        |                                      |                        |
|  +------------------+  |                        |  +------------------+  |                                      |  +------------------+  |
|  |    PostgreSQL    |  |                        |  | Sentence-        |  |                                      |  |  Piston API /    |  |
|  | (Relational DB)  |  |                        |  | Transformers     |  |                                      |  |  Container Engine|  |
|  +------------------+  |                        |  +------------------+  |                                      |  +------------------+  |
|  |     Pinecone     |  |                        |  | Retrieval Agent  |  |                                      |                        |
|  |   (Vector DB)    |  |                        |  +------------------+  |                                      +------------------------+
|  +------------------+  |                        |  | Generation Agent |  |
|                        |                        |  +------------------+  |
+------------------------+                        |  | Report Agent     |  |
                                                  |  +------------------+  |
                                                  |  | LLM Providers    |  |
                                                  |  | (Groq/OpenRouter)|  |
                                                  |  +------------------+  |
                                                  +------------------------+
```

---

## 3. Subsystem & Core Module Specifications

### 3.1 Teacher Portal & Authoring Subsystem
*   **Question Authoring Interface:** Rich markdown editor with math formula support and embedded code block formatters.
*   **AI Question Assistant:** Prompt-driven interface allowing teachers to auto-generate question stems, sample solutions, hints, and edge-case test cases.
*   **Test Case Management:** UI to configure both **Public** (visible to student during trial run) and **Hidden** (used strictly for final evaluation) test cases.
*   **Vectorization Pipeline:** Triggered automatically upon question finalization. Text content, metadata, and difficulty tags are converted into vector embeddings via `Sentence-Transformers` and upserted into **Pinecone**.

### 3.2 Student Portal & Test Execution Subsystem
*   **Monaco Code Editor integration:** Embedded visual code editor supporting auto-completion, syntax highlighting, theme switching, and keybindings for supported languages (Python, JavaScript, C++, Java, Go).
*   **Mock Test Generator UI:** Interface allowing students to request customized assessments by selecting target topics, desired difficulty, and time limits.
*   **Run vs. Submit Dual Pipeline:**
    *   *Run Code:* Executes current workspace code against public test cases using Piston; returns standard output, execution time, and stdout/stderr logs.
    *   *Submit Test:* Submits full code bundle against hidden test cases, locks test state, triggers Evaluation and Report Agents, and closes test session.

### 3.3 AI & Agent Ecosystem
1. **Retrieval Agent (RAG Engine):**
   * Computes embedding vectors for requested topic parameters.
   * Filters out recently attempted questions (retrieved from `Submissions` and `MockTestQuestions`).
   * Queries Pinecone with metadata filtering (e.g., `difficulty = 'Medium'`, `topic = 'Dynamic Programming'`).
   * Assembles dynamically balanced assessment sets.
2. **Question Generation Assistant:**
   * Leverages high-throughput LLM APIs (Groq / Llama-3 / DeepSeek / Together AI).
   * Generates formatted JSON payloads containing problem statements, constraints, sample inputs/outputs, and algorithmic test cases.
3. **Evaluation Agent:**
   * Receives submitted solution scripts and coordinates asynchronous calls to Piston.
   * Validates outputs against hidden test cases, accounts for time/memory limits, calculates weighted scores, and determines execution status (`ACCEPTED`, `WRONG_ANSWER`, `TIME_LIMIT_EXCEEDED`, `RUNTIME_ERROR`, `COMPILATION_ERROR`).
4. **Report & Recommendation Agent:**
   * Analyzes submission results across test runs.
   * Synthesizes performance insights (e.g., logic errors vs. time limit failures).
   * Maps performance back to domain taxonomy to generate radar charts, topic mastery percentages, and suggested follow-up practice modules.
5. **Proctoring Agent (Phase 2):**
   * Real-time WebSocket listener on the client.
   * Tracks DOM events: `visibilitychange` (tab switches), `blur` (window defocus), `paste` (large clipboard transfers), and multi-display detection.
   * Logs events into the `Violations` table and raises soft/hard flags based on customizable severity thresholds.

---

## 4. End-to-End Workflow & Data Flow Diagrams

### Workflow 1: Teacher Question Creation & Vectorization

```
Teacher          Teacher Portal           FastAPI           SentenceTransformers       Pinecone          PostgreSQL
   |                   |                     |                        |                   |                   |
   |-- Create/Gen Q --->|                     |                        |                   |                   |
   |                   |-- POST /questions ->|                        |                   |                   |
   |                   |                     |-- Save Question & TC ->|-------------------|------------------>|
   |                   |                     |                        |                   |  (Insert Row)     |
   |                   |                     |-- Generate Vector ---->|                   |                   |
   |                   |                     |<-- Vector Embedding ---|                   |                   |
   |                   |                     |                                            |                   |
   |                   |                     |-- Upsert Embedding + Metadata ------------>|                   |
   |                   |                     |<-- Ack ------------------------------------|                   |
   |                   |<-- 201 Created -----|                                            |                   |
```

### Workflow 2: Student Test Generation & Evaluation Pipeline

```
Student          Student Portal           FastAPI          Retrieval Agent        Pinecone            Piston DB / Engine
   |                   |                     |                    |                   |                       |
   |-- Request Test -->|                     |                    |                   |                       |
   |                   |-- POST /test/gen ->|                    |                   |                       |
   |                   |                     |-- Get Questions -->|                   |                       |
   |                   |                     |                    |-- Vector Query -->|                       |
   |                   |                     |                    |<-- Q_IDs ---------|                       |
   |                   |                     |<-- Selected Qs ----|                   |                       |
   |                   |<-- Render Test -----|                                        |                       |
   |                   |                                                              |                       |
   |-- Submit Code --->|                                                              |                       |
   |                   |-- POST /submit ---->|                                             |                       |
   |                   |                     |-- Trigger Piston Execution --------------------------------------->|
   |                   |                     |<-- Raw Execution Results ----------------------------------------|
   |                   |                     |                                                                |
   |                   |                     |-- Parse & Compute Score                                        |
   |                   |                     |-- Write Submissions & Reports to Postgres                      |
   |                   |<-- Return Report ---|                                                                |
```

---

## 5. Database Schema & Data Models (PostgreSQL & Vector)

### 5.1 Relational Database Schema (PostgreSQL / SQLAlchemy)

```sql
-- Enums
CREATE TYPE user_role AS ENUM ('TEACHER', 'STUDENT', 'ADMIN');
CREATE TYPE difficulty_level AS ENUM ('EASY', 'MEDIUM', 'HARD');
CREATE TYPE submission_status AS ENUM ('ACCEPTED', 'WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'RUNTIME_ERROR', 'COMPILATION_ERROR');
CREATE TYPE violation_type AS ENUM ('TAB_SWITCH', 'WINDOW_BLUR', 'COPY_PASTE', 'UNAUTHORIZED_KEY');

-- 1. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'STUDENT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Questions Table
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    difficulty difficulty_level NOT NULL,
    topic VARCHAR(100) NOT NULL,
    subtopic VARCHAR(100),
    constraints TEXT,
    time_limit_ms INT DEFAULT 2000,
    memory_limit_kb INT DEFAULT 128000,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Test Cases Table
CREATE TABLE test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    input_data TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    is_hidden BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Mock Tests Table
CREATE TABLE mock_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    total_questions INT NOT NULL,
    duration_minutes INT NOT NULL,
    score_achieved NUMERIC(5,2) DEFAULT 0.00,
    is_completed BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 5. Mock Test Questions (Junction Table)
CREATE TABLE mock_test_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mock_test_id UUID NOT NULL REFERENCES mock_tests(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    order_index INT NOT NULL,
    UNIQUE(mock_test_id, question_id)
);

-- 6. Submissions Table
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mock_test_id UUID REFERENCES mock_tests(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_snippet TEXT NOT NULL,
    language VARCHAR(50) NOT NULL,
    status submission_status NOT NULL,
    execution_time_ms INT,
    memory_used_kb INT,
    test_cases_passed INT NOT NULL,
    total_test_cases INT NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Violations Table (Proctoring)
CREATE TABLE violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mock_test_id UUID NOT NULL REFERENCES mock_tests(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type violation_type NOT NULL,
    metadata JSONB,
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 5.2 Vector Index Schema (Pinecone)
*   **Index Name:** `coding-questions-index`
*   **Dimension:** 384 (matching `all-MiniLM-L6-v2` or equivalent Sentence-Transformer model)
*   **Metric:** Cosine Similarity
*   **Vector Content:** Embedded string combining `Title + Description + Topic + Subtopic + Constraints`.
*   **Payload Metadata:**
    ```json
    {
      "question_id": "uuid-string",
      "difficulty": "EASY | MEDIUM | HARD",
      "topic": "String",
      "subtopic": "String",
      "created_by": "uuid-string"
    }
    ```

---

## 6. Technology Stack Architecture

| Layer / Component | Technology | Rationale / Usage |
| :--- | :--- | :--- |
| **Frontend Framework** | React (v18+) + Vite | High-performance SPA with fast build times and modular UI rendering. |
| **UI Componentry** | Tailwind CSS + Lucide Icons | Utility-first, responsive design tailored for dashboards and code environments. |
| **Code Editor** | Monaco Editor (`@monaco-editor/react`) | Industry-standard VS Code web editor component with syntax support and state control. |
| **Backend API Framework**| FastAPI (Python 3.11+) | Asynchronous execution support (ASGI), OpenAPI docs, and Native Pydantic validation. |
| **Database ORM** | SQLAlchemy v2.0 + Alembic | Async relational ORM paired with schema migration tracking. |
| **Relational Database** | PostgreSQL 16 | ACID-compliant storage for users, questions, submissions, and proctoring logs. |
| **Vector Database** | Pinecone | Managed, low-latency similarity search for semantic question retrieval. |
| **Code Sandbox** | Piston (Self-hosted or Managed) | Isolated high-throughput engine for safe execution of untrusted user code. |
| **Embeddings Model** | `sentence-transformers/all-MiniLM-L6-v2` | Lightweight, CPU/GPU efficient text embedding generation. |
| **LLM Interface Layer** | Groq / OpenRouter / Together AI / Ollama | Inference access to models (Llama 3, DeepSeek) for question generation and insights. |
| **Auth & Security** | OAuth2 + JWT (python-jose) + Passlib (bcrypt) | Stateless authentication with Role-Based Access Control (RBAC). |

---

## 7. Implementation Roadmap & Development Phases

```
+----------------------------------------------------------------------------------------------------+
|                                    DEVELOPMENT TIMELINE & PHASES                                   |
+----------------------------------------------------------------------------------------------------+
  Phase 1: Foundation Setup
  [==========] Schema Setup (PostgreSQL) & Core Question Management APIs
  
  Phase 2: Direct role assignment based on click.
  
  Phase 3: Vector Integration
  [==========] Embedding Pipeline Setup & Pinecone Vector Database Integration
  
  Phase 4: Test Engine & Retrieval
  [==========] Retrieval Agent & Dynamic RAG Mock Test Engine Construction
  
  Phase 5: Code Execution & AI Generation
  [==========] Piston Engine Integration & LLM-Powered Question Creation Assistant
  
  Phase 6: Analytics & Security
  [==========] Performance Report Generation Agent & Real-time Proctoring Agent
  
  Phase 7: Production Optimization
  [==========] CI/CD Pipeline, Docker Containerization, Load Testing, & Deployment
+----------------------------------------------------------------------------------------------------+
```

### Milestone Breakdowns
1. **Phase 1: DB Schema & Question Management**
   * PostgreSQL database provisioning.
   * FastAPI CRUD endpoints for questions and test cases.
2. **Phase 2: Authentication & Dashboards**
   * Implementation of JWT authorization middleware with `TEACHER` and `STUDENT` roles.
   * Frontend integration for Login/Register and Dashboard shell.
3. **Phase 3: Pinecone Integration**
   * Sentence-Transformers integration in backend.
   * Question creation hooks to embed and upsert vector data to Pinecone.
4. **Phase 4: Retrieval-Based Mock Test Generation**
   * RAG algorithm implementation to fetch balanced questions filtering out past attempts.
   * Dynamic assembly of test sessions.
5. **Phase 5: AI-Assisted Question Creation & Execution**
   * Integration of Groq/OpenRouter LLM prompts for question generation.
   * Integration of Piston API for running and evaluating submissions against hidden test cases.
6. **Phase 6: Reports & Proctoring**
   * Implementation of client-side tracking hooks (tab visibility, copy-paste block).
   * Analytics engine to calculate topic strengths/weaknesses and visual report cards.
7. **Phase 7: Deployment & Optimization**
   * Dockerization of FastAPI backend and Piston sandbox setup.
   * Frontend deployment to Vercel/Netlify; Backend to Cloud Infra (AWS / GCP / DigitalOcean).