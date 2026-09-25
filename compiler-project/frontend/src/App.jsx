import React, { useState, useEffect, useRef } from 'react'
import './App.css'
import './components/LoginPage.css'
import './components/InstructorDashboard.css'
import InstructorDashboard from './components/InstructorDashboard'
import EvaluationReportModal, { GreenOutlinedTick } from './components/EvaluationReportModal'
import Editor from '@monaco-editor/react'

const starterTemplates = {
  // Added starter templates for new languages
  'C': `#include <stdio.h>\nint main() {\n    printf("Hello C\\n");\n    return 0;\n}`,
  'Shell(.sh)': `echo Hello Shell`,
  'SQL': `SELECT 'Hello SQL' AS greeting;`,

  // Existing language templates
  'Python 3': `import sys\n\ndef solve():\n    # Read input from stdin\n    # input_data = sys.stdin.read().split()\n    print("Hello World")\n\nif __name__ == "__main__":\n    solve()`,
  'JavaScript': `function solve() {\n    // Read input using readline or process.stdin\n    console.log("Hello World");\n}\n\nsolve();`,
  'Java': `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello World");\n    }\n}`,
  'C++': `#include <iostream>\n\nint main() {\n    std::cout << "Hello World" << std::endl;\n    return 0;\n}`
};

function App() {
  // Authentication State
  const [token, setToken] = useState(() => localStorage.getItem('token') || null)
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })

  const handleLoginSuccess = (authToken, userData) => {
    localStorage.setItem('token', authToken)
    // Simplify user object for UI
    const simplifiedUser = {
      role: userData.role || 'Instructor',
      name: userData.name || userData.username || 'Instructor',
      email: userData.email || ''
    };
    localStorage.setItem('user', JSON.stringify(simplifiedUser))
    setToken(authToken)
    setUser(simplifiedUser)
  }

  const [code, setCode] = useState(starterTemplates['Python 3'])
  const [language, setLanguage] = useState('Python 3')
  const [stdin, setStdin] = useState('')
  const [runOutput, setRunOutput] = useState('')
  const [runError, setRunError] = useState(null)
  const [runIsCorrect, setRunIsCorrect] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [activeTab, setActiveTab] = useState('input')
  const [copiedKey, setCopiedKey] = useState(null)
  const [testCases, setTestCases] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState({
    correct: false,
    score: '',
    status: '',
    message: 'Submit your code to see evaluation and feedback.',
    reviewPoints: [],
    show: false
  })
  const [showOutputWindow, setShowOutputWindow] = useState(false)
  const [isNavOpen, setIsNavOpen] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);
  const [instructorName, setInstructorName] = useState('');
  const [instructorNameInput, setInstructorNameInput] = useState('');
  const [instructorNamePending, setInstructorNamePending] = useState(false);
  const outputRef = useRef(null);
  const tabContentRef = useRef(null);


  const handleCopy = (text, key) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  // Question state loaded from backend
  const [questionsList, setQuestionsList] = useState([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState(1);
  const [testsList, setTestsList] = useState([]);
  const [selectedTestId, setSelectedTestId] = useState(null);
  const [selectedTest, setSelectedTest] = useState(null);
  const [hasExecuted, setHasExecuted] = useState(false);
  // Timer state for student assessment (in seconds)
  const [timeLeft, setTimeLeft] = useState(45 * 60);

  // Student Exam Evaluation & Performance Tracking State
  const [solvedQuestionIds, setSolvedQuestionIds] = useState([]);
  const [questionSubmissions, setQuestionSubmissions] = useState({});
  const [examStartTime, setExamStartTime] = useState(() => Date.now());
  const [isExamFinished, setIsExamFinished] = useState(false);
  const [showEvaluationReport, setShowEvaluationReport] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showSubmissionNote, setShowSubmissionNote] = useState(false);
  const [submissionNoteData, setSubmissionNoteData] = useState(null);

  // Student Mock Test Creation & Selection Modal State
  const [isStudentTestModalOpen, setIsStudentTestModalOpen] = useState(false);
  const [studentTestTab, setStudentTestTab] = useState('create'); // 'create' | 'select'
  const [allBankQuestions, setAllBankQuestions] = useState([]);
  const [filteredBankQuestions, setFilteredBankQuestions] = useState([]);
  const [vectorSearchQuery, setVectorSearchQuery] = useState('');
  const [filterTopic, setFilterTopic] = useState('All');
  const [filterDifficulty, setFilterDifficulty] = useState('All');
  const [isSearchingVector, setIsSearchingVector] = useState(false);
  const [newTestTitle, setNewTestTitle] = useState('');
  const [newTestDuration, setNewTestDuration] = useState(45);
  const [newTestMarks, setNewTestMarks] = useState(100);
  const [newTestDescription, setNewTestDescription] = useState('');
  const [autoGenTopic, setAutoGenTopic] = useState('All');
  const [autoGenDifficulty, setAutoGenDifficulty] = useState('All');
  const [autoGenNumQuestions, setAutoGenNumQuestions] = useState(3);
  const [isCreatingTest, setIsCreatingTest] = useState(false);
  const [autoGenError, setAutoGenError] = useState('');

  useEffect(() => {
    if (selectedTest?.duration_minutes) {
      setTimeLeft(selectedTest.duration_minutes * 60);
    }
  }, [selectedTest]);

  // Exam timer with auto-completion
  useEffect(() => {
    if (selectedRole !== 'Student' || isExamFinished) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsExamFinished(true);
          setShowEvaluationReport(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [selectedRole, isExamFinished]);

  const formatTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const calculateTimeTakenSeconds = () => {
    const totalAllottedSec = (selectedTest?.duration_minutes || 45) * 60;
    const elapsedFromTimer = totalAllottedSec - timeLeft;
    if (elapsedFromTimer > 0) return elapsedFromTimer;
    if (examStartTime) {
      return Math.max(1, Math.round((Date.now() - examStartTime) / 1000));
    }
    return 60;
  };

  const handleFinishExamClick = () => {
    setShowFinishConfirm(true);
  };

  const handleConfirmFinishExam = async () => {
    setShowFinishConfirm(false);
    const API_BASE = 'http://127.0.0.1:8000';
    const targetTestId = selectedTestId || selectedTest?.id || 1;
    const timeTaken = calculateTimeTakenSeconds();

    // Capture snapshot before clearing state
    const solvedSnap = [...solvedQuestionIds];
    const questionsSnap = [...questionsList];
    const submissionsSnap = { ...questionSubmissions };
    const testSnap = selectedTest;
    const studentSnap = user?.name || 'Student';
    const durationSnap = selectedTest?.duration_minutes || 45;

    try {
      const payload = {
        test_id: targetTestId,
        student_name: user?.name || 'Student',
        solved_questions: solvedQuestionIds,
        question_submissions: questionSubmissions,
        time_taken_seconds: timeTaken
      };

      const res = await fetch(`${API_BASE}/tests/${targetTestId}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let noteText = 'Your test has been successfully submitted and finalized!';
      if (res.ok) {
        const data = await res.json();
        if (data.note) noteText = data.note;
      }

      // Show styled in-app submission note instead of alert()
      setSubmissionNoteData({
        noteText,
        solvedCount: solvedSnap.length,
        totalQuestions: questionsSnap.length,
        timeTakenSeconds: timeTaken,
        // snapshot all data needed to show the eval report afterward
        questions: questionsSnap,
        solvedQuestionIds: solvedSnap,
        questionSubmissions: submissionsSnap,
        testInfo: testSnap,
        studentName: studentSnap,
        totalDurationMinutes: durationSnap
      });
      setShowSubmissionNote(true);
    } catch (err) {
      console.error('Error finishing test:', err);
      setSubmissionNoteData({
        noteText: 'Your test has been submitted successfully!',
        solvedCount: solvedQuestionIds.length,
        totalQuestions: questionsList.length,
        timeTakenSeconds: timeTaken,
        questions: questionsList,
        solvedQuestionIds: [...solvedQuestionIds],
        questionSubmissions: { ...questionSubmissions },
        testInfo: selectedTest,
        studentName: user?.name || 'Student',
        totalDurationMinutes: selectedTest?.duration_minutes || 45
      });
      setShowSubmissionNote(true);
    } finally {
      // Mark exam as finished and clear active test from storage
      setIsExamFinished(true);
      setSelectedTestId(null);
      setSelectedTest(null);
      localStorage.removeItem('activeTestId');
      localStorage.removeItem('activeTest');
    }
  };

  // Called when student dismisses the submission note and wants to go back to dashboard
  const handleDismissSubmissionNote = () => {
    setShowSubmissionNote(false);
    setSubmissionNoteData(null);
    setSelectedRole(null);
  };

  // Called when student wants to see the detailed report from the submission note
  const handleViewReportFromNote = () => {
    setShowSubmissionNote(false);
    setShowEvaluationReport(true);
  };

  const [question, setQuestion] = useState({
    number: 1,
    title: '',
    description: '',
    constraints: '',
    inputFormat: '',
    outputFormat: '',
    sampleInput: '',
    sampleOutput: ''
  });

  const handleTestSelect = (testObj) => {
    if (!testObj) return;
    setSelectedTestId(testObj.id);
    setSelectedTest(testObj);
    localStorage.setItem('activeTestId', testObj.id.toString());
    localStorage.setItem('activeTest', JSON.stringify(testObj));
    // Reset test progress for new test session
    setSolvedQuestionIds([]);
    setQuestionSubmissions({});
    setExamStartTime(Date.now());
    setIsExamFinished(false);
    setShowEvaluationReport(false);
    if (testObj.duration_minutes) {
      setTimeLeft(testObj.duration_minutes * 60);
    }
    if (testObj.questions && testObj.questions.length > 0) {
      setQuestionsList(testObj.questions);
      loadQuestion(testObj.questions[0].id, testObj.questions, 0);
    }
  };

  const loadQuestion = (qId, customList = null, indexOverride = null) => {
    const API_BASE = 'http://127.0.0.1:8000';
    const activeList = (customList && customList.length > 0) ? customList : questionsList;

    const foundIdx = (indexOverride !== null && indexOverride !== undefined && indexOverride !== -1)
      ? indexOverride
      : activeList.findIndex(q => q.id === qId);

    const targetQ = activeList[foundIdx !== -1 ? foundIdx : 0];
    const displayNum = foundIdx !== -1 ? foundIdx + 1 : 1;
    const targetId = targetQ ? targetQ.id : qId;

    setSelectedQuestionId(targetId);
    setFeedback(prev => ({ ...prev, show: false }));
    setRunOutput('');
    setRunError(null);
    setHasExecuted(false);

    // Restore previous submission state if already submitted
    const savedSub = questionSubmissions[targetId];
    if (savedSub) {
      if (savedSub.lastCode) setCode(savedSub.lastCode);
      if (savedSub.testCases) setTestCases(savedSub.testCases);
      setFeedback({
        correct: savedSub.isSolved,
        score: savedSub.score || '',
        status: savedSub.status || '',
        message: savedSub.isSolved ? '✓ Question solved successfully!' : `Status: ${savedSub.status}`,
        reviewPoints: [],
        show: true
      });
    }

    if (targetQ) {
      const sampleIn = targetQ.sampleInput ?? targetQ.sample_input ?? '';
      setQuestion({
        number: displayNum,
        title: targetQ.title ?? '',
        description: targetQ.description ?? '',
        constraints: targetQ.constraints ?? '',
        inputFormat: targetQ.inputFormat ?? targetQ.input_format ?? '',
        outputFormat: targetQ.outputFormat ?? targetQ.output_format ?? '',
        sampleInput: sampleIn,
        sampleOutput: targetQ.sampleOutput ?? targetQ.sample_output ?? ''
      });
      if (!savedSub) {
        setCode(starterTemplates[language] || '');
      }
      setStdin(sampleIn);
    }

    fetch(`${API_BASE}/questions/${targetId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data) return;
        const sampleIn = data.sample_input ?? data.sampleInput ?? targetQ?.sample_input ?? '';
        setQuestion({
          number: displayNum,
          title: data.title ?? targetQ?.title ?? '',
          description: data.description ?? targetQ?.description ?? '',
          constraints: data.constraints ?? targetQ?.constraints ?? '',
          inputFormat: data.input_format ?? data.inputFormat ?? targetQ?.inputFormat ?? '',
          outputFormat: data.output_format ?? data.outputFormat ?? targetQ?.outputFormat ?? '',
          sampleInput: sampleIn,
          sampleOutput: data.sample_output ?? data.sampleOutput ?? targetQ?.sampleOutput ?? ''
        });
        // Also sync the stdin textarea so it reflects the real sample input from the DB.
        // Only overwrite if the user hasn't manually changed it yet.
        setStdin(prev => (prev === '' || prev === (targetQ?.sampleInput ?? targetQ?.sample_input ?? '')) ? sampleIn : prev);
      })
      .catch((err) => console.error('Failed to load question:', err));
  };

  // Fetch tests and question bank from backend
  const fetchAllData = () => {
    const API_BASE = 'http://127.0.0.1:8000';

    // Fetch tests
    fetch(`${API_BASE}/tests`)
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setTestsList(data);
          const savedActiveId = localStorage.getItem('activeTestId');
          const targetTest = savedActiveId
            ? data.find(t => t.id === parseInt(savedActiveId, 10)) || data[0]
            : data[0];
          handleTestSelect(targetTest);
        }
      })
      .catch((err) => console.error('Failed to load tests:', err));

    // Fetch question bank
    fetch(`${API_BASE}/questions`)
      .then((res) => res.ok ? res.json() : [])
      .then((qData) => {
        if (Array.isArray(qData) && qData.length > 0) {
          setAllBankQuestions(qData);
          setFilteredBankQuestions(qData);
          if (!selectedTest) {
            setQuestionsList(qData);
            loadQuestion(qData[0].id, qData, 0);
          }
        }
      })
      .catch((err) => console.error('Failed to load questions:', err));
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Filter or Pinecone Vector Search questions for Student Test creation
  const handlePerformVectorSearch = async (query = vectorSearchQuery, topic = filterTopic, diff = filterDifficulty) => {
    const API_BASE = 'http://127.0.0.1:8000';
    setIsSearchingVector(true);
    try {
      const res = await fetch(`${API_BASE}/questions/vector-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query || '',
          top_k: 30,
          topic: topic !== 'All' ? topic : null,
          difficulty: diff !== 'All' ? diff : null
        })
      });

      if (res.ok) {
        const matches = await res.json();
        if (Array.isArray(matches) && matches.length > 0) {
          const matchIds = new Set(matches.map(m => m.id));
          const matchedQs = allBankQuestions.filter(q => matchIds.has(q.id));
          setFilteredBankQuestions(matchedQs.length > 0 ? matchedQs : allBankQuestions);
        } else {
          // Client filter fallback
          let filtered = [...allBankQuestions];
          if (topic !== 'All') filtered = filtered.filter(q => q.topic === topic);
          if (diff !== 'All') filtered = filtered.filter(q => q.difficulty === diff);
          if (query.trim()) {
            const lower = query.toLowerCase();
            filtered = filtered.filter(q => (q.title && q.title.toLowerCase().includes(lower)) || (q.description && q.description.toLowerCase().includes(lower)));
          }
          setFilteredBankQuestions(filtered);
        }
      } else {
        let filtered = [...allBankQuestions];
        if (topic !== 'All') filtered = filtered.filter(q => q.topic === topic);
        if (diff !== 'All') filtered = filtered.filter(q => q.difficulty === diff);
        setFilteredBankQuestions(filtered);
      }
    } catch (err) {
      console.warn('Vector search fallback:', err);
      let filtered = [...allBankQuestions];
      if (topic !== 'All') filtered = filtered.filter(q => q.topic === topic);
      if (diff !== 'All') filtered = filtered.filter(q => q.difficulty === diff);
      setFilteredBankQuestions(filtered);
    } finally {
      setIsSearchingVector(false);
    }
  };

  const toggleStudentTestQuestion = (qId) => {
    setNewTestSelectedQIds(prev =>
      prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId]
    );
  };

  const handleSelectAllStudentQuestions = (e) => {
    if (e.target.checked) {
      setNewTestSelectedQIds(filteredBankQuestions.map(q => q.id));
    } else {
      setNewTestSelectedQIds([]);
    }
  };

  const handleAutoGenerateTest = async (e) => {
    e.preventDefault();
    setAutoGenError('');
    setIsCreatingTest(true);
    const API_BASE = 'http://127.0.0.1:8000';
    const now = new Date();
    const dateLabel = now.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const titleToSend = newTestTitle.trim() || `Mock Test – ${dateLabel}`;
    try {
      const payload = {
        title: titleToSend,
        description: newTestDescription.trim(),
        duration_minutes: Number(newTestDuration) || 45,
        total_marks: Number(newTestMarks) || 100,
        num_questions: Number(autoGenNumQuestions) || 3,
        topic: autoGenTopic !== 'All' ? autoGenTopic : null,
        difficulty: autoGenDifficulty !== 'All' ? autoGenDifficulty : null,
      };
      const res = await fetch(`${API_BASE}/tests/auto-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAutoGenError(err.detail || 'Failed to generate test. Please add more questions to the bank.');
        return;
      }
      const createdTest = await res.json();
      setTestsList(prev => [createdTest, ...prev]);
      handleTestSelect(createdTest);
      setIsStudentTestModalOpen(false);
      // Reset form
      setNewTestTitle('');
      setNewTestDescription('');
      setAutoGenTopic('All');
      setAutoGenDifficulty('All');
      setAutoGenNumQuestions(3);
    } catch (err) {
      console.error('Error auto-generating mock test:', err);
      setAutoGenError('Failed to generate test. Check the question bank has enough questions.');
    } finally {
      setIsCreatingTest(false);
    }
  };


  const handleQuestionSelectChange = (e) => {
    const qId = parseInt(e.target.value, 10);
    if (qId) {
      const idx = questionsList.findIndex(q => q.id === qId);
      loadQuestion(qId, questionsList, idx);
    }
  };

  useEffect(() => {
    if (outputRef.current && !isRunning) {
      outputRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isRunning, runOutput, runError]);

  useEffect(() => {
    if (activeTab === 'input' && tabContentRef.current) {
      tabContentRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab]);

  // Map UI language label to backend language identifier
  const languageMap = (label) => {
    if (/python/i.test(label)) return 'python';
    if (/javascript/i.test(label)) return 'javascript';
    if (/java/i.test(label)) return 'java';
    if (/c\+\+/i.test(label)) return 'cpp'; // made case‑insensitive
    if (/shell\(\.sh\)/i.test(label)) return 'bash';
    if (/sql/i.test(label)) return 'sql';
    return label.toLowerCase();
  };
  // Map UI language label to backend language ID (as defined in backend/config/language_map.json)
  const languageIdMap = {
    'Python 3': 71,
    'C': 50,
    'C++': 54,
    'Java': 62,
    'JavaScript': 63,
    'Shell(.sh)': 58,
    'SQL': 70,
    // Add more mappings if needed
  };


  // Map UI language label to Monaco editor language string
  const monacoLanguageMap = (label) => {
    if (!label) return 'plaintext';
    const l = label.toLowerCase();
    if (l.includes('python')) return 'python';
    if (l.includes('javascript') || l === 'js') return 'javascript';
    if (l.includes('c++') || l.includes('cpp')) return 'cpp';
    if (l === 'c') return 'c';
    if (l.includes('java')) return 'java';
    if (l.includes('shell') || l.includes('sh') || l.includes('bash')) return 'shell';
    if (l.includes('sql')) return 'sql';
    return l;
  };

  // Handle language dropdown changes, load starter template if appropriate
  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    setFeedback(prev => ({ ...prev, show: false }));
    // Always load the starter template for the selected language
    setCode(starterTemplates[newLang] || '');
  };

  console.log('Current state - code:', code, 'stdin:', stdin, 'language:', language);

  const handleRun = async () => {
    console.log('Run button clicked');
    setShowOutputWindow(true);
    setRunOutput('');
    setRunError(null);
    setRunIsCorrect(false);
    setIsRunning(true);
    setHasExecuted(true);
    setActiveTab('input');
    setFeedback(prev => ({ ...prev, show: false }));
    const qTargetId = selectedQuestionId || question.number;
    const payload = {
      language: languageMap(language),
      code: code,
      input: stdin,
      question_id: qTargetId,
      questionId: qTargetId,
    };
    console.log('Payload being sent:', payload);
    try {
      const API_BASE = 'http://127.0.0.1:8000';
      const res = await fetch(`${API_BASE}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      console.log('Fetch response status:', res.status);
      if (!res.ok) {
        const errText = await res.text();
        console.error('Run API error:', res.status, errText);
        setRunError(`HTTP ${res.status}: ${errText}`);
        return;
      }
      const data = await res.json();
      console.log('Response data:', data);
      setRunOutput(data?.output ?? '');
      setRunError(data?.error ?? null);
      setRunIsCorrect(data?.is_correct ?? false);
    } catch (e) {
      console.error('Fetch error:', e);
      setRunError(String(e));
    } finally {
      setIsRunning(false);
    }
  }


  const handleSubmit = async () => {
    console.log('Submit button clicked');
    setShowOutputWindow(true);
    setIsSubmitting(true);
    setHasExecuted(true);
    const qTargetId = selectedQuestionId || question.number;
    try {
      const API_BASE = 'http://127.0.0.1:8000';
      const payload = {
        question_id: qTargetId,
        language_id: languageIdMap[language] ?? 71,
        source_code: code
      };

      const res = await fetch(`${API_BASE}/submit/questions/${qTargetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const data = await res.json();
      console.log('Submit response:', data);

      const isPassed = Boolean(data.passed);
      const passedTc = data.test_cases ? data.test_cases.filter(tc => tc.result === 'Accepted' || tc.result === 'Passed').length : (isPassed ? 5 : 0);
      const totalTc = data.test_cases ? data.test_cases.length : 5;
      const parsedScore = data.score ? parseInt(data.score, 10) : (isPassed ? 10 : 0);

      // Mark this question as solved with the green outlined tick mark!
      if (isPassed) {
        setSolvedQuestionIds(prev => prev.includes(qTargetId) ? prev : [...prev, qTargetId]);
      }

      // Record question submission details for the detailed evaluation report
      setQuestionSubmissions(prev => ({
        ...prev,
        [qTargetId]: {
          isSolved: isPassed,
          status: data.status,
          score: data.score,
          scoreValue: isNaN(parsedScore) ? (isPassed ? 10 : 0) : parsedScore,
          testCases: data.test_cases || [],
          passedTestCases: passedTc,
          totalTestCases: totalTc,
          lastCode: code,
          language: language,
          attempts: (prev[qTargetId]?.attempts || 0) + 1,
          submittedAt: Date.now()
        }
      }));

      // Update states
      setTestCases(data.test_cases || []);
      setFeedback({
        correct: isPassed,
        score: data.score,
        status: data.status,
        message: data.feedback,
        reviewPoints: data.review_points || [],
        show: true
      });

      // Automatically shift active tab to Test Cases (Submit)
      setActiveTab('tests');

    } catch (e) {
      console.error('Submit error:', e);
      alert('Submission failed: ' + String(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  const navigation = {
    current: 1,
    total: 1,
    section: 'Section C - Coding',
    answered: 1,
    score: 10,
    maxScore: 10
  }



  // Shared logout handler (defined before the role renders)
  const handleLogout = () => {
    setSelectedRole(null);
    setInstructorName('');
    setInstructorNameInput('');
    setInstructorNamePending(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };


  // ── Instructor name prompt (checked BEFORE role picker) ───────────────────
  if (instructorNamePending && !selectedRole) {
    const handleNameSubmit = (e) => {
      e.preventDefault();
      const trimmed = instructorNameInput.trim();
      if (!trimmed) return;
      setInstructorName(trimmed);
      setInstructorNamePending(false);
      setSelectedRole('Instructor');
    };

    return (
      <div className="login-page-container">
        <div className="bg-decor-circle-left" />
        <div className="bg-decor-circle-right" />
        <div className="bg-dots-pattern dots-top-left" />
        <div className="bg-dots-pattern dots-top-right" />
        <div className="login-card" style={{ maxWidth: 440 }}>
          <div className="login-header">
            <div className="icon-badge instructor-icon-badge" style={{ margin: '0 auto 1.25rem' }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="7" r="4" />
                <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                <path d="M16 3h5v8h-5z" />
                <path d="M16 11l4 4" />
              </svg>
            </div>
            <h1>Welcome, Instructor!</h1>
            <p>Enter your name to personalise your dashboard</p>
          </div>
          <form className="role-form" onSubmit={handleNameSubmit}>
            <div className="input-wrapper">
              <div className="input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <input
                type="text"
                className="role-input"
                placeholder="e.g. Dr. Sarah Connor"
                value={instructorNameInput}
                onChange={(e) => setInstructorNameInput(e.target.value)}
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="submit-btn"
              disabled={!instructorNameInput.trim()}
            >
              Enter Dashboard →
            </button>
            <button
              type="button"
              className="submit-btn"
              style={{ background: 'transparent', color: '#64748b', border: '1.5px solid #e2e8f0', marginTop: '0.5rem' }}
              onClick={() => setInstructorNamePending(false)}
            >
              ← Back
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Role picker ──────────────────────────────────────────────────────────
  if (!selectedRole) {
    return (
      <div className="login-page-container">
        {/* Background decorative elements (reused from LoginPage) */}
        <div className="bg-decor-circle-left" />
        <div className="bg-decor-circle-right" />
        <div className="bg-dots-pattern dots-top-left" />
        <div className="bg-dots-pattern dots-top-right" />

        <div className="login-card">
          {/* Header */}
          <div className="login-header">
            <h1>Welcome</h1>
            <p>Select your role to continue</p>
          </div>

          {/* Role cards */}
          <div className="login-roles-grid">
            {/* Instructor card */}
            <div className="role-card instructor-card">
              <div className="icon-badge instructor-icon-badge">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="7" r="4" />
                  <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                  <path d="M16 3h5v8h-5z" />
                  <path d="M16 11l4 4" />
                </svg>
              </div>
              <h2 className="role-title">Instructor</h2>
              <p className="role-description">
                Create and manage questions, tests, and track student performance.
              </p>
              <button
                className="submit-btn"
                onClick={() => setInstructorNamePending(true)}
              >
                Continue as Instructor
              </button>

            </div>

            {/* Divider */}
            <div className="divider-container">
              <div className="divider-line" />
              <div className="or-badge">OR</div>
            </div>

            {/* Student card */}
            <div className="role-card student-card">
              <div className="icon-badge student-icon-badge">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
              </div>
              <h2 className="role-title">Student</h2>
              <p className="role-description">
                Take mock tests, solve problems, and track your progress.
              </p>
              <button
                className="submit-btn"
                onClick={() => setSelectedRole('Student')}
              >
                Continue as Student
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Dashboards ───────────────────────────────────────────────────────────
  const demoUser = { name: instructorName || 'Instructor', role: selectedRole, email: '' };

  if (selectedRole === 'Instructor') {
    return <InstructorDashboard user={demoUser} onLogout={handleLogout} />;
  }

  if (selectedRole === 'Student') {
    return (
      <div className="app-container student-page">
        {/* Top Navbar */}
        <header className="header">
          <div className="header-left">
            <span className="question-counter">
              Question {question.number} of {questionsList.length || 1} {selectedTest ? `| ${selectedTest.title}` : ''}
            </span>
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${Math.min(100, Math.max(15, ((question.number || 1) / (questionsList.length || 1)) * 80))}%`
                }}
              />
            </div>
            <div className="timer-badge" title="Remaining Time">
              <span className="timer-icon">⏱</span>
              <span className="timer-text">{formatTime(timeLeft)}</span>
            </div>
            <div
              className="header-solved-counter"
              onClick={() => setShowEvaluationReport(true)}
              style={{ cursor: 'pointer' }}
              title="Click to view detailed Evaluation Report"
            >
              <GreenOutlinedTick size={15} />
              <span>{solvedQuestionIds.length}/{questionsList.length || 1} Solved</span>
            </div>
            <button
              className="student-test-btn"
              onClick={() => {
                setStudentTestTab('create');
                setFilteredBankQuestions(allBankQuestions);
                setIsStudentTestModalOpen(true);
              }}
              title="Create new mock test from Question Bank or switch tests"
            >
              📋 Create / Switch Mock Test
            </button>
          </div>

          <div className="header-right">
            <button
              className="finish-exam-btn"
              onClick={handleFinishExamClick}
            >
              Finish Exam
            </button>
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        {/* Main Layout - LeetCode Style Split Columns */}
        <main className="main-layout student-mode">
          {/* Left Column: Problem Description Window */}
          <section className="problem-description-panel">
            {/* Problem Scroll Content */}
            <div className="problem-content-scroll">
              {selectedTest && (
                <div className="assigned-test-badge">
                  <span>Assigned Test: <strong>{selectedTest.title}</strong></span>
                  <span>⏱ {selectedTest.duration_minutes || 45} mins | 📊 {selectedTest.total_marks || 100} marks</span>
                </div>
              )}

              {questionsList.length > 1 && (
                <div className="question-select-wrapper">
                  <label htmlFor="question-select">Select Question:</label>
                  <select
                    id="question-select"
                    value={selectedQuestionId}
                    onChange={handleQuestionSelectChange}
                    className="language-dropdown"
                  >
                    {questionsList.map((q, idx) => {
                      const isSolved = solvedQuestionIds.includes(q.id);
                      return (
                        <option key={q.id} value={q.id}>
                          {isSolved ? '✓ ' : ''}Q{idx + 1}: {q.title} ({q.difficulty || 'Medium'}){isSolved ? ' — [Solved]' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div className="problem-title-section">
                <div className="problem-title-row">
                  <h2>{question.number}. {question.title}</h2>
                  {solvedQuestionIds.includes(selectedQuestionId) && (
                    <span className="problem-header-solved-tag" title="Question solved successfully!">
                      <GreenOutlinedTick size={18} showText={true} />
                    </span>
                  )}
                </div>
              </div>

              <div className="problem-text">
                <p>{question.description}</p>
              </div>

              {question.inputFormat && (
                <div className="format-section">
                  <h4>Input Format</h4>
                  <p>{question.inputFormat}</p>
                </div>
              )}

              {question.outputFormat && (
                <div className="format-section">
                  <h4>Output Format</h4>
                  <p>{question.outputFormat}</p>
                </div>
              )}

              <div className="examples-section">
                <h4>Example 1:</h4>
                <div className="example-card">
                  <div className="example-row">
                    <strong>Input:</strong> <code>{question.sampleInput || 'N/A'}</code>
                  </div>
                  <div className="example-row">
                    <strong>Output:</strong> <code>{question.sampleOutput || 'N/A'}</code>
                  </div>
                </div>
              </div>

              {question.constraints && (
                <div className="constraints-section">
                  <h4>Constraints:</h4>
                  <ul className="constraints-list">
                    {question.constraints.split('\n').filter(line => line.trim().length > 0).map((line, idx) => {
                      const cleanLine = line.trim().replace(/^[•\-\*]\s*/, '');
                      return (
                        <li key={idx}>
                          <code>{cleanLine}</code>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {/* Right Column: Code Editor & Output Window */}
          <section className="editor-and-output-panel">
            {/* Upper Section: Code Editor */}
            <div className="leetcode-editor-container">
              <div className="editor-top-bar">
                <div className="editor-left-tools">
                  <span className="code-symbol">{"</> Code"}</span>
                  <select
                    id="language-select"
                    className="language-dropdown leetcode-lang-select"
                    value={language}
                    onChange={handleLanguageChange}
                  >
                    <option value="Python 3">Python3</option>
                    <option value="C++">C++</option>
                    <option value="Java">Java</option>
                    <option value="JavaScript">JavaScript</option>
                    <option value="C">C</option>
                    <option value="Shell(.sh)">Shell (.sh)</option>
                    <option value="SQL">SQL</option>
                  </select>
                </div>
              </div>

              <div className="monaco-wrapper">
                <Editor
                  height="100%"
                  theme="vs-dark"
                  language={monacoLanguageMap(language)}
                  value={code}
                  onChange={(val) => setCode(val || '')}
                  options={{
                    fontSize: 14,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 4,
                  }}
                />
              </div>

              <div className="editor-status-bar">
                <span className="status-saved">Saved</span>
                <span className="cursor-pos">Ln 1, Col 1</span>
              </div>
            </div>

            {/* Collapsible Output Window - Output windows appear ONLY when pressed on the buttons */}
            {showOutputWindow && (
              <div className="leetcode-output-window">
                <div className="output-header-tabs">
                  <div className="output-tab-buttons">
                    <button
                      className={`output-tab ${activeTab === 'input' ? 'active' : ''}`}
                      onClick={() => setActiveTab('input')}
                    >
                      ☑ Testcase / Custom Input
                    </button>
                    <button
                      className={`output-tab ${activeTab === 'tests' ? 'active' : ''}`}
                      onClick={() => setActiveTab('tests')}
                    >
                      ❯_ Test Result {feedback.show ? `(${feedback.status})` : ''}
                    </button>
                  </div>
                  <button className="close-output-btn" onClick={() => setShowOutputWindow(false)} title="Close Output">
                    ✕
                  </button>
                </div>

                <div ref={tabContentRef} className="output-tab-body">
                  {activeTab === 'input' && (
                    <div className="output-custom-io">
                      <div className="io-field">
                        <div className="io-header-row">
                          <label>Input (stdin):</label>
                          {question.sampleInput && stdin !== question.sampleInput && (
                            <button
                              type="button"
                              className="reset-sample-btn"
                              onClick={() => setStdin(question.sampleInput)}
                              title="Reset input to question's sample input"
                            >
                              Reset to Sample
                            </button>
                          )}
                        </div>
                        <textarea
                          className="io-textarea"
                          value={stdin}
                          onChange={(e) => setStdin(e.target.value)}
                          placeholder="Enter custom standard input for testing..."
                        />
                      </div>

                      <div ref={outputRef} className="io-field">
                        <label className="execution-output-header">Execution Output:</label>
                        {runError ? (
                          <div className="output-error-box">
                            <strong>Error:</strong> {runError}
                          </div>
                        ) : (
                          <pre className="execution-output-pre">
                            {runOutput || (isRunning ? 'Running code...' : 'Output will appear here.')}
                          </pre>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'tests' && (
                    <div className="output-test-results">
                      {feedback.show ? (
                        <div>
                          <div className={`feedback-summary ${feedback.correct ? 'success' : 'failure'}`}>
                            <div className="feedback-status-row">
                              {feedback.correct && <GreenOutlinedTick size={20} showText={true} />}
                              <h4>Status: {feedback.status} | Score: {feedback.score}</h4>
                            </div>
                            <p>{feedback.message}</p>
                          </div>

                          {testCases.length > 0 && (
                            <div className="test-cases-list">
                              <h4>Test Cases Detail:</h4>
                              {testCases.map((tc, i) => (
                                <div key={i} className={`test-case-item ${tc.result === 'Accepted' ? 'pass' : 'fail'}`}>
                                  <span>
                                    <strong>Test Case #{tc.id || i + 1}:</strong> {tc.is_hidden ? '(Hidden)' : `Input: ${tc.input}`}
                                  </span>
                                  <span className="result-badge">{tc.result}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="no-submission-text">
                          {isSubmitting ? 'Evaluating test cases...' : 'You must run or submit your code first.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bottom Controls Bar with Console, Run, and Submit buttons */}
            <div className="leetcode-action-bar">
              <button
                className="console-toggle-btn"
                onClick={() => setShowOutputWindow(prev => !prev)}
              >
                {showOutputWindow ? 'Console ˅' : 'Console ˄'}
              </button>

              <div className="action-buttons-group">
                <button
                  className={`run-btn ${isRunning ? 'running' : ''}`}
                  onClick={handleRun}
                  disabled={isRunning || isSubmitting}
                >
                  {isRunning ? 'Running...' : 'Run'}
                </button>
                <button
                  className="submit-btn"
                  onClick={handleSubmit}
                  disabled={isSubmitting || isRunning}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          </section>
        </main>

        {/* ── Auto-Generate / Switch Mock Test Modal ── */}
        {isStudentTestModalOpen && (
          <div className="id-modal-overlay" onClick={() => setIsStudentTestModalOpen(false)}>
            <div className="id-modal-card id-modal-card--wide" onClick={(e) => e.stopPropagation()}>
              <div className="id-modal-header">
                <div className="id-modal-title-group">
                  <div className="id-tmpl-icon">📋</div>
                  <div>
                    <h3 className="id-modal-heading">Mock Assessments &amp; Question Bank</h3>
                    <p className="id-modal-subheading">Generate a new test or switch to an existing assessment.</p>
                  </div>
                </div>
                <button className="id-modal-close" onClick={() => setIsStudentTestModalOpen(false)}>✕</button>
              </div>

              {/* Tab Selector */}
              <div style={{ display: 'flex', gap: '0.6rem', padding: '0.75rem 1.5rem', background: '#09152b', borderBottom: '1px solid #1e293b' }}>
                <button
                  type="button"
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: studentTestTab === 'create' ? '#3b82f6' : '#334155',
                    background: studentTestTab === 'create' ? '#2563eb' : 'transparent',
                    color: studentTestTab === 'create' ? '#ffffff' : '#94a3b8',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                  onClick={() => setStudentTestTab('create')}
                >
                  ⚡ Auto-Generate New Test
                </button>
                <button
                  type="button"
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: studentTestTab === 'select' ? '#3b82f6' : '#334155',
                    background: studentTestTab === 'select' ? '#2563eb' : 'transparent',
                    color: studentTestTab === 'select' ? '#ffffff' : '#94a3b8',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                  onClick={() => setStudentTestTab('select')}
                >
                  📚 Switch Existing Test ({testsList.length})
                </button>
              </div>

              {studentTestTab === 'select' ? (
                <div style={{ padding: '1.25rem 1.5rem', maxHeight: '55vh', overflowY: 'auto' }}>
                  {testsList.length === 0 ? (
                    <p style={{ color: '#94a3b8', textAlign: 'center', margin: '2rem 0' }}>No tests available.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {testsList.map(t => {
                        const isCurrent = selectedTest?.id === t.id;
                        return (
                          <div
                            key={t.id}
                            style={{
                              background: isCurrent ? '#1e293b' : '#0f172a',
                              border: isCurrent ? '1.5px solid #3b82f6' : '1px solid #1e293b',
                              borderRadius: '8px',
                              padding: '1rem 1.25rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '1rem'
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                <strong style={{ color: '#f8fafc', fontSize: '1rem' }}>{t.title}</strong>
                                {isCurrent && (
                                  <span style={{ background: '#1d4ed8', color: '#fff', fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 600 }}>Active</span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <span>⏱ {t.duration_minutes || 45} mins</span>
                                <span>📊 {t.total_marks || 100} marks</span>
                                <span>📝 {t.questions?.length || 0} questions</span>
                              </div>
                              {t.questions && t.questions.length > 0 && (
                                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                  {t.questions.map((q, idx) => (
                                    <span
                                      key={q.id || idx}
                                      style={{
                                        background: '#334155',
                                        color: '#cbd5e1',
                                        fontSize: '0.72rem',
                                        padding: '0.15rem 0.45rem',
                                        borderRadius: '4px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.3rem'
                                      }}
                                    >
                                      {q.title}
                                      {q.constraints && <span title="Constraints defined" style={{ color: '#fbbf24' }}>⚡</span>}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              className="id-view-q-btn"
                              style={{
                                background: isCurrent ? '#334155' : '#2563eb',
                                color: '#ffffff',
                                borderColor: isCurrent ? '#475569' : '#1d4ed8',
                                whiteSpace: 'nowrap'
                              }}
                              disabled={isCurrent}
                              onClick={() => {
                                handleTestSelect(t);
                                setIsStudentTestModalOpen(false);
                              }}
                            >
                              {isCurrent ? 'Current Test' : 'Switch & Start →'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleAutoGenerateTest} className="id-modal-form">
                  {/* Row 1: Title + Duration + Marks */}
                  <div className="id-form-row">
                    <div className="id-form-group flex-2">
                      <label className="id-form-label">Test Title</label>
                      <input
                        className="id-form-input"
                        type="text"
                        value={newTestTitle}
                        onChange={(e) => setNewTestTitle(e.target.value)}
                        placeholder={`e.g. Mock Test – ${new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`}
                      />
                    </div>
                    <div className="id-form-group">
                      <label className="id-form-label">Duration (min)</label>
                      <input
                        className="id-form-input"
                        type="number"
                        min="5"
                        max="180"
                        value={newTestDuration}
                        onChange={(e) => setNewTestDuration(e.target.value)}
                      />
                    </div>
                    <div className="id-form-group">
                      <label className="id-form-label">Total Marks</label>
                      <input
                        className="id-form-input"
                        type="number"
                        min="10"
                        value={newTestMarks}
                        onChange={(e) => setNewTestMarks(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Row 2: Questions + Topic + Difficulty */}
                  <div className="id-form-row">
                    <div className="id-form-group">
                      <label className="id-form-label">No. of Questions (1–20)</label>
                      <input
                        className="id-form-input"
                        type="number"
                        min="1"
                        max="20"
                        value={autoGenNumQuestions}
                        onChange={(e) => setAutoGenNumQuestions(Math.min(20, Math.max(1, Number(e.target.value))))}
                      />
                    </div>
                    <div className="id-form-group flex-2">
                      <label className="id-form-label">Topic</label>
                      <select
                        className="id-form-select"
                        value={autoGenTopic}
                        onChange={(e) => setAutoGenTopic(e.target.value)}
                      >
                        <option value="All">All Topics</option>
                        <option value="Arrays">Arrays</option>
                        <option value="Dynamic Programming">Dynamic Programming</option>
                        <option value="Graphs">Graphs</option>
                        <option value="Trees">Trees</option>
                        <option value="Strings">Strings</option>
                        <option value="Linked Lists">Linked Lists</option>
                        <option value="Searching">Searching</option>
                        <option value="Recursion">Recursion</option>
                        <option value="General">General</option>
                      </select>
                    </div>
                    <div className="id-form-group flex-2">
                      <label className="id-form-label">Difficulty</label>
                      <select
                        className="id-form-select"
                        value={autoGenDifficulty}
                        onChange={(e) => setAutoGenDifficulty(e.target.value)}
                      >
                        <option value="All">Balanced (All)</option>
                        <option value="Easy">Easy Only</option>
                        <option value="Medium">Medium Only</option>
                        <option value="Hard">Hard Only</option>
                      </select>
                    </div>
                  </div>

                  {/* Strategy info callout */}
                  <div style={{
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2445 100%)',
                    border: '1px solid #2563eb40',
                    borderRadius: '10px',
                    padding: '0.85rem 1.1rem',
                    marginBottom: '0.5rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.7rem'
                  }}>
                    <span style={{ fontSize: '1.2rem', marginTop: '1px' }}>⚖️</span>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#93c5fd', marginBottom: '2px' }}>Balanced Selection Strategy</div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5 }}>
                        {autoGenDifficulty === 'All'
                          ? `Questions will be auto-picked as ~25% Easy, ~50% Medium, ~25% Hard from ${autoGenTopic === 'All' ? 'all topics' : autoGenTopic}. Order is randomised each time.`
                          : `All ${autoGenNumQuestions} question${autoGenNumQuestions !== 1 ? 's' : ''} will be picked randomly from ${autoGenDifficulty} difficulty${autoGenTopic !== 'All' ? ` in ${autoGenTopic}` : ''}.`
                        }
                      </div>
                    </div>
                  </div>

                  {/* Error message */}
                  {autoGenError && (
                    <div style={{
                      background: '#3b0a0a',
                      border: '1px solid #dc2626',
                      borderRadius: '8px',
                      padding: '0.7rem 1rem',
                      color: '#fca5a5',
                      fontSize: '0.83rem',
                      marginBottom: '0.25rem'
                    }}>
                      ⚠️ {autoGenError}
                    </div>
                  )}

                  <div className="id-modal-footer">
                    <button type="button" className="id-modal-cancel-btn" onClick={() => setIsStudentTestModalOpen(false)}>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="id-modal-submit-btn"
                      disabled={isCreatingTest}
                      style={isCreatingTest ? { opacity: 0.7, cursor: 'not-allowed' } : {}}
                    >
                      {isCreatingTest
                        ? '⚡ Generating...'
                        : `⚡ Generate & Start (${autoGenNumQuestions} Q${autoGenNumQuestions !== 1 ? 's' : ''})`
                      }
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ── Finish Exam Confirmation Modal ── */}
        {showFinishConfirm && (
          <div className="finish-confirm-overlay" onClick={() => setShowFinishConfirm(false)}>
            <div className="finish-confirm-card" onClick={(e) => e.stopPropagation()}>
              <h3 className="finish-confirm-title">Finish Assessment</h3>
              <p className="finish-confirm-text">
                Are you sure you want to finish the exam? You have completed <strong>{solvedQuestionIds.length}</strong> of <strong>{questionsList.length || 1}</strong> questions.
              </p>
              <div className="finish-confirm-summary-box">
                <div className="finish-summary-item">
                  <span className="summary-label">Questions Solved</span>
                  <span className="summary-val solved-val">
                    <GreenOutlinedTick size={16} /> {solvedQuestionIds.length} / {questionsList.length || 1}
                  </span>
                </div>
                <div className="finish-summary-item">
                  <span className="summary-label">Time Remaining</span>
                  <span className="summary-val">{formatTime(timeLeft)}</span>
                </div>
              </div>
              <p className="finish-confirm-note">
                Submitting will finalize your assessment and generate your detailed performance evaluation report with questions solved, accuracy, time taken, and improvement suggestions.
              </p>
              <div className="finish-confirm-actions">
                <button
                  type="button"
                  className="finish-btn-secondary"
                  onClick={() => setShowFinishConfirm(false)}
                >
                  Keep Solving
                </button>
                <button
                  type="button"
                  className="finish-btn-primary"
                  onClick={handleConfirmFinishExam}
                >
                  Submit &amp; Finish Assessment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Submission Success Notification Modal ── */}
        {showSubmissionNote && submissionNoteData && (
          <div className="finish-confirm-overlay">
            <div className="finish-confirm-card" style={{ maxWidth: 520, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
              {/* Success Check Icon */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" fill="rgba(34,197,94,0.10)" stroke="#16a34a" strokeWidth="1.8" />
                  <polyline points="8 12.5 11 15.5 16.5 9" stroke="#16a34a" strokeWidth="2.4" />
                </svg>
              </div>

              <h3 className="finish-confirm-title" style={{ color: '#16a34a', marginBottom: '0.5rem' }}>
                Test Submitted Successfully!
              </h3>
              <p className="finish-confirm-text" style={{ marginBottom: '1.25rem' }}>
                {submissionNoteData.noteText}
              </p>

              {/* Quick Stats — same summary box style */}
              <div className="finish-confirm-summary-box" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="finish-summary-item">
                  <span className="summary-label">Questions Solved</span>
                  <span className="summary-val solved-val">
                    <GreenOutlinedTick size={15} />
                    {submissionNoteData.solvedCount} / {submissionNoteData.totalQuestions}
                  </span>
                </div>
                <div className="finish-summary-item">
                  <span className="summary-label">Time Taken</span>
                  <span className="summary-val">
                    {String(Math.floor(submissionNoteData.timeTakenSeconds / 60)).padStart(2,'0')}:{String(submissionNoteData.timeTakenSeconds % 60).padStart(2,'0')}
                  </span>
                </div>
                <div className="finish-summary-item">
                  <span className="summary-label">Score</span>
                  <span className="summary-val">
                    {submissionNoteData.solvedCount * 10} / {submissionNoteData.totalQuestions * 10}
                  </span>
                </div>
              </div>

              <p className="finish-confirm-note">
                Your results have been securely recorded. View your full performance report or return to the main dashboard.
              </p>

              <div className="finish-confirm-actions">
                <button
                  type="button"
                  className="finish-btn-secondary"
                  onClick={handleDismissSubmissionNote}
                >
                  Back to Dashboard
                </button>
                <button
                  type="button"
                  className="finish-btn-primary"
                  onClick={handleViewReportFromNote}
                >
                  📊 View Detailed Report
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Detailed Evaluation Report Modal ── */}
        <EvaluationReportModal
          isOpen={showEvaluationReport}
          onClose={() => {
            setShowEvaluationReport(false);
            // After viewing report, return to dashboard if exam was finished
            if (isExamFinished) {
              setSolvedQuestionIds([]);
              setQuestionSubmissions({});
              setSubmissionNoteData(null);
              setSelectedRole(null);
            }
          }}
          testInfo={submissionNoteData?.testInfo || selectedTest}
          questions={submissionNoteData?.questions || questionsList}
          solvedQuestionIds={submissionNoteData?.solvedQuestionIds || solvedQuestionIds}
          questionSubmissions={submissionNoteData?.questionSubmissions || questionSubmissions}
          timeTakenSeconds={submissionNoteData?.timeTakenSeconds || calculateTimeTakenSeconds()}
          totalDurationMinutes={submissionNoteData?.totalDurationMinutes || selectedTest?.duration_minutes || 45}
          studentName={submissionNoteData?.studentName || user?.name || 'Student'}
          onRetakeOrNewTest={() => {
            setStudentTestTab('create');
            setIsStudentTestModalOpen(true);
          }}
        />
      </div>
    );
  }

}

export default App
