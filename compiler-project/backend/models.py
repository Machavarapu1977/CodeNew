from sqlalchemy import Column, Integer, String, Text, ForeignKey, Boolean, DateTime, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)

    users = relationship("User", back_populates="role")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    role = relationship("Role", back_populates="users")

class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    sample_input = Column(Text, nullable=True)
    sample_output = Column(Text, nullable=True)
    difficulty = Column(String(20), default="Medium")
    topic = Column(String(50), default="General")
    starter_code = Column(Text, nullable=True)
    constraints = Column(Text, nullable=True)

    test_cases = relationship("TestCase", back_populates="question", cascade="all, delete-orphan")

class TestCase(Base):
    __tablename__ = "test_cases"
    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    input_data = Column(Text, nullable=False)
    expected_output = Column(Text, nullable=False)
    is_hidden = Column(Boolean, default=True)

    question = relationship("Question", back_populates="test_cases")

class QuestionTemplate(Base):
    __tablename__ = "question_templates"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    icon = Column(String(20), nullable=False)
    description = Column(Text, nullable=False)
    topic = Column(String(50), nullable=False)
    difficulty = Column(String(20), default="Medium")
    starter_code = Column(Text, nullable=True)
    problem_scaffold = Column(Text, nullable=True)
    sample_input = Column(Text, nullable=True)
    sample_output = Column(Text, nullable=True)
    constraints = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# Association table: many-to-many between tests and questions
test_questions = Table(
    "test_questions",
    Base.metadata,
    Column("test_id", Integer, ForeignKey("tests.id", ondelete="CASCADE"), primary_key=True),
    Column("question_id", Integer, ForeignKey("questions.id", ondelete="CASCADE"), primary_key=True),
)


class Test(Base):
    __tablename__ = "tests"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    duration_minutes = Column(Integer, default=60)
    total_marks = Column(Integer, default=100)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Many-to-many relationship with Question
    questions = relationship("Question", secondary=test_questions, backref="tests")
