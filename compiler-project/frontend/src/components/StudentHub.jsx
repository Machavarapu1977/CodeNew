import React, { useState, useEffect, useMemo } from 'react';
import './StudentHub.css';

const API_BASE = 'http://127.0.0.1:8000';

export default function StudentHub({
  user,
  testsList = [],
  attemptedTests = [],
  onStartTest,
  onCreateTestClick,
  onViewAttemptReport,
  onStartPracticeProblem,
  onLogout
}) {
  const [activeTab, setActiveTab] = useState('tests'); // 'tests' | 'practice'
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [topicFilter, setTopicFilter] = useState('All');
  const [difficultyFilter, setDifficultyFilter] = useState('All');

  useEffect(() => {
    let mounted = true;
    const fetchQuestions = async () => {
      setLoadingQuestions(true);
      try {
        const res = await fetch(`${API_BASE}/questions`);
        if (res.ok && mounted) {
          const data = await res.json();
          setQuestions(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to fetch practice problems:', err);
      } finally {
        if (mounted) setLoadingQuestions(false);
      }
    };
    fetchQuestions();
    return () => { mounted = false; };
  }, []);

  // Aggregate student performance stats across all attempted tests
  const stats = useMemo(() => {
    const totalAttempts = attemptedTests.length;
    if (totalAttempts === 0) {
      return {
        totalAttempts: 0,
        avgScorePct: 0,
        totalSolved: 0,
        avgIntegrity: 100
      };
    }
    let scorePctSum = 0;
    let totalSolved = 0;
    let integritySum = 0;
    let integrityCount = 0;

    attemptedTests.forEach((a) => {
      const totalQ = a.totalQuestions || 1;
      scorePctSum += Math.round(((a.solvedCount || 0) / totalQ) * 100);
      totalSolved += a.solvedCount || 0;
      if (a.integrityReport && typeof a.integrityReport.integrity_score === 'number') {
        integritySum += a.integrityReport.integrity_score;
        integrityCount += 1;
      }
    });

    return {
      totalAttempts,
      avgScorePct: Math.round(scorePctSum / totalAttempts),
      totalSolved,
      avgIntegrity: integrityCount > 0 ? Math.round(integritySum / integrityCount) : 100
    };
  }, [attemptedTests]);

  const topics = useMemo(() => {
    const set = new Set(questions.map(q => q.topic || 'General'));
    return ['All', ...Array.from(set)];
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchesSearch =
        !searchQuery.trim() ||
        q.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.topic?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTopic = topicFilter === 'All' || (q.topic || 'General') === topicFilter;
      const matchesDiff = difficultyFilter === 'All' || (q.difficulty || 'Medium') === difficultyFilter;
      return matchesSearch && matchesTopic && matchesDiff;
    });
  }, [questions, searchQuery, topicFilter, difficultyFilter]);

  const formatDuration = (secs) => {
    const m = Math.floor((secs || 0) / 60);
    const s = (secs || 0) % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };

  const formatDate = (iso) => {
    if (!iso) return 'Just now';
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="student-hub-container">
      {/* Top Bar */}
      <header className="student-hub-header">
        <div className="hub-brand">
          <span className="hub-logo">⚡ MockTest AI</span>
          <span className="hub-subtitle">Student Assessment & Practice Portal</span>
        </div>
        <div className="hub-user-actions">
          <div className="hub-user-pill">
            <span className="hub-user-avatar">{(user?.name || 'S')[0].toUpperCase()}</span>
            <div className="hub-user-meta">
              <span className="hub-user-name">{user?.name || 'Student'}</span>
              {user?.email && <span className="hub-user-email">{user.email}</span>}
            </div>
          </div>
          <button type="button" className="hub-create-btn" onClick={onCreateTestClick}>
            + Create AI Mock Test
          </button>
          <button type="button" className="hub-logout-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="student-hub-main">
        {/* Performance Overview Cards */}
        <section className="hub-stats-grid">
          <div className="hub-stat-card">
            <span className="hub-stat-label">Tests Attempted</span>
            <span className="hub-stat-value">{stats.totalAttempts}</span>
          </div>
          <div className="hub-stat-card">
            <span className="hub-stat-label">Average Score</span>
            <span className="hub-stat-value accent-blue">{stats.avgScorePct}%</span>
          </div>
          <div className="hub-stat-card">
            <span className="hub-stat-label">Problems Solved (Tests)</span>
            <span className="hub-stat-value accent-green">{stats.totalSolved}</span>
          </div>
          <div className="hub-stat-card">
            <span className="hub-stat-label">Avg Proctoring Integrity</span>
            <span className="hub-stat-value accent-purple">{stats.avgIntegrity}%</span>
          </div>
        </section>

        {/* Navigation Tabs */}
        <div className="hub-tabs">
          <button
            type="button"
            className={`hub-tab-btn ${activeTab === 'tests' ? 'active' : ''}`}
            onClick={() => setActiveTab('tests')}
          >
            📝 Tests & Attempt History ({testsList.length})
          </button>
          <button
            type="button"
            className={`hub-tab-btn ${activeTab === 'practice' ? 'active' : ''}`}
            onClick={() => setActiveTab('practice')}
          >
            💻 Practice Problems ({questions.length})
          </button>
        </div>

        {/* Tab 1: Tests & Attempt History */}
        {activeTab === 'tests' && (
          <div className="hub-tab-content">
            {/* Attempted Tests with Performance Analysis */}
            <section className="hub-section">
              <div className="hub-section-header">
                <h2>Attempted Tests & Performance Analysis</h2>
                <span className="hub-section-hint">Review detailed scores, test-case accuracy, and proctoring integrity</span>
              </div>

              {attemptedTests.length === 0 ? (
                <div className="hub-empty-state">
                  No completed test attempts yet. Start any assessment below to see your detailed performance analysis here.
                </div>
              ) : (
                <div className="hub-cards-list">
                  {attemptedTests.map((attempt) => {
                    const totalQ = attempt.totalQuestions || 1;
                    const pct = Math.round(((attempt.solvedCount || 0) / totalQ) * 100);
                    const integrityScore = attempt.integrityReport?.integrity_score;
                    return (
                      <div key={attempt.attemptId} className="hub-attempt-card">
                        <div className="hub-attempt-info">
                          <div className="hub-attempt-title-row">
                            <h3>{attempt.testInfo?.title || `Assessment #${attempt.testId}`}</h3>
                            <span className={`hub-score-badge ${pct >= 70 ? 'good' : pct >= 40 ? 'mid' : 'low'}`}>
                              {attempt.solvedCount} / {totalQ} Solved ({pct}%)
                            </span>
                            {typeof integrityScore === 'number' && (
                              <span className={`hub-integrity-badge ${integrityScore >= 80 ? 'good' : 'warn'}`}>
                                🛡️ Integrity: {integrityScore}%
                              </span>
                            )}
                          </div>
                          <div className="hub-attempt-meta">
                            <span>Completed: {formatDate(attempt.completedAt)}</span>
                            <span>•</span>
                            <span>Time Taken: {formatDuration(attempt.timeTakenSeconds)}</span>
                            <span>•</span>
                            <span>Score: {(attempt.solvedCount || 0) * 10} / {totalQ * 10}</span>
                          </div>
                        </div>
                        <div className="hub-attempt-actions">
                          <button
                            type="button"
                            className="hub-btn-primary"
                            onClick={() => onViewAttemptReport(attempt)}
                          >
                            📊 Detailed Analysis
                          </button>
                          {attempt.testInfo && (
                            <button
                              type="button"
                              className="hub-btn-secondary"
                              onClick={() => onStartTest(attempt.testInfo)}
                            >
                              ↻ Retake
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Created / Available Tests */}
            <section className="hub-section">
              <div className="hub-section-header">
                <h2>Available & Created Tests</h2>
                <button type="button" className="hub-link-btn" onClick={onCreateTestClick}>
                  + Generate Custom AI Test
                </button>
              </div>

              {testsList.length === 0 ? (
                <div className="hub-empty-state">
                  No tests available yet. Click "+ Create AI Mock Test" to generate one.
                </div>
              ) : (
                <div className="hub-tests-grid">
                  {testsList.map((test) => {
                    const attemptCount = attemptedTests.filter(a => a.testId === test.id).length;
                    return (
                      <div key={test.id} className="hub-test-card">
                        <div className="hub-test-card-top">
                          <h3>{test.title}</h3>
                          {attemptCount > 0 && (
                            <span className="hub-attempted-tag">Attempted ×{attemptCount}</span>
                          )}
                        </div>
                        <p className="hub-test-desc">
                          {test.description || 'Coding assessment with automated test-case evaluation.'}
                        </p>
                        <div className="hub-test-meta">
                          <span>⏱ {test.duration_minutes || 45} mins</span>
                          <span>📋 {test.questions?.length || 0} Questions</span>
                          <span>🏆 {test.total_marks || 100} Marks</span>
                        </div>
                        <button
                          type="button"
                          className="hub-start-test-btn"
                          onClick={() => onStartTest(test)}
                        >
                          {attemptCount > 0 ? 'Retake Assessment →' : 'Start Assessment →'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Tab 2: Practice Problems */}
        {activeTab === 'practice' && (
          <div className="hub-tab-content">
            <section className="hub-section">
              <div className="hub-section-header">
                <div>
                  <h2>Practice Coding Problems</h2>
                  <span className="hub-section-hint">
                    Solve individual problems freely in the code editor without exam timer or proctoring lock
                  </span>
                </div>
              </div>

              <div className="hub-practice-filters">
                <input
                  type="text"
                  className="hub-search-input"
                  placeholder="Search problems by title or topic..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select
                  className="hub-filter-select"
                  value={topicFilter}
                  onChange={(e) => setTopicFilter(e.target.value)}
                >
                  {topics.map(t => (
                    <option key={t} value={t}>{t === 'All' ? 'All Topics' : t}</option>
                  ))}
                </select>
                <select
                  className="hub-filter-select"
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value)}
                >
                  <option value="All">All Difficulties</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>

              {loadingQuestions ? (
                <div className="hub-empty-state">Loading practice problems...</div>
              ) : filteredQuestions.length === 0 ? (
                <div className="hub-empty-state">No problems match your filters.</div>
              ) : (
                <div className="hub-practice-list">
                  {filteredQuestions.map((q) => (
                    <div key={q.id} className="hub-practice-row">
                      <div className="hub-practice-info">
                        <div className="hub-practice-title-row">
                          <span className="hub-q-id">#{q.id}</span>
                          <h4>{q.title}</h4>
                          <span className={`hub-diff-badge ${(q.difficulty || 'Medium').toLowerCase()}`}>
                            {q.difficulty || 'Medium'}
                          </span>
                          <span className="hub-topic-badge">{q.topic || 'General'}</span>
                        </div>
                        <p className="hub-practice-desc">
                          {(q.description || '').slice(0, 140)}
                          {(q.description || '').length > 140 ? '…' : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="hub-practice-btn"
                        onClick={() => onStartPracticeProblem(q, filteredQuestions)}
                      >
                        Practice Solve →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
