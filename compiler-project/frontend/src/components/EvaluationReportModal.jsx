import React, { useMemo } from 'react';
import './EvaluationReportModal.css';

/**
 * Simple Green Outlined Tick Mark
 * A clean, outlined checkmark badge indicating successful question submission.
 */
export const GreenOutlinedTick = ({ size = 18, className = '', showText = false }) => (
  <span className={`green-outline-tick-badge ${className}`} title="Solved successfully">
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#16a34a"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="green-outline-tick-svg"
    >
      <circle cx="12" cy="12" r="9.5" stroke="#16a34a" strokeWidth="1.8" fill="rgba(34, 197, 94, 0.10)" />
      <polyline points="8 12.5 11 15.5 16.5 9" stroke="#16a34a" strokeWidth="2.4" />
    </svg>
    {showText && <span className="tick-label">Solved</span>}
  </span>
);

export default function EvaluationReportModal({
  isOpen,
  onClose,
  testInfo,
  questions = [],
  solvedQuestionIds = [],
  questionSubmissions = {},
  timeTakenSeconds = 0,
  totalDurationMinutes = 45,
  studentName = 'Student',
  onRetakeOrNewTest
}) {
  if (!isOpen) return null;

  // Format seconds to "Xm Ys" or "X mins Y secs"
  const formatDuration = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  // Metrics computation
  const totalQuestions = questions.length || 1;
  const solvedCount = solvedQuestionIds.length;
  const solvedPercentage = Math.round((solvedCount / totalQuestions) * 100);

  // Compute test case accuracy
  const { totalTestCases, passedTestCases, overallAccuracy, totalScoreEarned, maxPossibleScore } = useMemo(() => {
    let totalTc = 0;
    let passedTc = 0;
    let scoreEarned = 0;
    const maxScore = totalQuestions * 10;

    questions.forEach((q) => {
      const sub = questionSubmissions[q.id];
      if (sub) {
        if (sub.totalTestCases) {
          totalTc += sub.totalTestCases;
          passedTc += (sub.passedTestCases || 0);
        } else if (sub.testCases && sub.testCases.length > 0) {
          totalTc += sub.testCases.length;
          passedTc += sub.testCases.filter(tc => tc.result === 'Accepted' || tc.result === 'Passed').length;
        }
        if (sub.scoreValue !== undefined) {
          scoreEarned += sub.scoreValue;
        } else if (sub.isSolved) {
          scoreEarned += 10;
        }
      }
    });

    let accuracy = 0;
    if (totalTc > 0) {
      accuracy = Math.round((passedTc / totalTc) * 100);
    } else if (solvedCount > 0) {
      accuracy = Math.round((solvedCount / totalQuestions) * 100);
    }

    return {
      totalTestCases: totalTc,
      passedTestCases: passedTc,
      overallAccuracy: accuracy,
      totalScoreEarned: scoreEarned,
      maxPossibleScore: maxScore
    };
  }, [questions, questionSubmissions, solvedCount, totalQuestions]);

  // Average time per question
  const avgTimePerQuestion = solvedCount > 0
    ? Math.round(timeTakenSeconds / totalQuestions)
    : Math.round(timeTakenSeconds / Math.max(1, Object.keys(questionSubmissions).length));

  // Determine Performance Tier
  let performanceTier = 'Needs Practice';
  let tierColor = '#ef4444';
  let tierBadge = '📚 Keep Practicing';
  let scoreColorClass = 'score-red';

  if (solvedPercentage === 100 && overallAccuracy >= 85) {
    performanceTier = 'Outstanding';
    tierColor = '#16a34a';
    tierBadge = '🏆 Master Level';
    scoreColorClass = 'score-green';
  } else if (solvedPercentage >= 65 || overallAccuracy >= 70) {
    performanceTier = 'Good Performance';
    tierColor = '#2563eb';
    tierBadge = '🌟 Proficient';
    scoreColorClass = 'score-blue';
  } else if (solvedPercentage >= 35) {
    performanceTier = 'Fair Effort';
    tierColor = '#d97706';
    tierBadge = '⚡ Intermediate';
    scoreColorClass = 'score-amber';
  }

  // Dynamic suggestions generation
  const suggestions = useMemo(() => {
    const list = [];
    const unsolved = questions.filter(q => !solvedQuestionIds.includes(q.id));
    const unsolvedTopics = [...new Set(unsolved.map(q => q.topic || 'General Problem Solving'))];

    // 1. Topic Mastery Suggestion
    if (unsolvedTopics.length > 0) {
      list.push({
        type: 'concept',
        icon: '🎯',
        title: `Strengthen Concept Mastery in: ${unsolvedTopics.slice(0, 3).join(', ')}`,
        desc: `You encountered difficulty on questions involving ${unsolvedTopics.join(', ')}. Review core patterns (e.g. two-pointer techniques, sliding windows, recursion trees, or hash-table lookups) and solve 2–3 targeted practice problems in these domains.`
      });
    } else {
      list.push({
        type: 'concept',
        icon: '🎉',
        title: 'Outstanding Topic Versatility',
        desc: 'You solved every problem across all topics in this assessment. To challenge yourself further, attempt Hard difficulty problems in Dynamic Programming and Graph Algorithms.'
      });
    }

    // 2. Accuracy & Edge Cases Suggestion
    if (overallAccuracy < 80) {
      list.push({
        type: 'accuracy',
        icon: '🛡️',
        title: 'Defensive Coding & Boundary Case Validation',
        desc: `Your test case accuracy was ${overallAccuracy}%. Common failures stem from edge cases like empty inputs, boundary values (0, negative numbers, maximum array bounds), and off-by-one indices. Always trace through minimal edge cases manually before submitting.`
      });
    } else {
      list.push({
        type: 'accuracy',
        icon: '✨',
        title: 'High Precision & Solution Robustness',
        desc: `Strong accuracy of ${overallAccuracy}%! Your solutions handled both public and hidden test cases effectively with minimal execution anomalies.`
      });
    }

    // 3. Time Management & Pacing Suggestion
    const allottedSec = totalDurationMinutes * 60;
    const timeRatio = timeTakenSeconds / Math.max(1, allottedSec);

    if (timeRatio > 0.85) {
      list.push({
        type: 'time',
        icon: '⏱️',
        title: 'Optimize Time Allocation & Rapid Prototyping',
        desc: `You used ${formatDuration(timeTakenSeconds)} (${Math.round(timeRatio * 100)}% of allotted time). If stuck on an optimal solution for >10 minutes, implement a working brute-force approach first to secure partial credit, then optimize.`
      });
    } else if (solvedPercentage < 100 && timeRatio < 0.40) {
      list.push({
        type: 'time',
        icon: '⏳',
        title: 'Take Full Advantage of Allotted Time',
        desc: `You completed the test in ${formatDuration(timeTakenSeconds)} with substantial time remaining. Unsolved problems could benefit from calm debugging and incremental print statements.`
      });
    } else {
      list.push({
        type: 'time',
        icon: '⚡',
        title: 'Well-Paced Problem Solving',
        desc: `Average time per question was ${formatDuration(avgTimePerQuestion)}. Your pacing was balanced, allowing consistent focus across the assessment.`
      });
    }

    // 4. Code Optimization / Complexity Suggestion
    list.push({
      type: 'complexity',
      icon: '💡',
      title: 'Algorithmic Complexity & Best Practices',
      desc: 'Focus on choosing optimal data structures (e.g. Set/Map for O(1) lookup vs O(N) array scans). Keep helper functions modular and comment your reasoning for edge condition branches.'
    });

    return list;
  }, [questions, solvedQuestionIds, overallAccuracy, timeTakenSeconds, totalDurationMinutes, avgTimePerQuestion, solvedPercentage]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="eval-modal-overlay" onClick={onClose}>
      <div className="eval-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header Bar */}
        <div className="eval-header">
          <div className="eval-header-title">
            <div className="eval-badge-ribbon" style={{ borderColor: tierColor, color: tierColor }}>
              {tierBadge}
            </div>
            <h2>Exam Performance Evaluation Report</h2>
            <p className="eval-subtitle">
              Comprehensive assessment for <strong>{studentName}</strong> • {testInfo?.title || 'Mock Assessment'} • {new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="eval-header-actions">
            <button className="eval-btn-print" onClick={handlePrint} title="Save as PDF or Print">
              🖨️ Print / Save PDF
            </button>
            <button className="eval-btn-close" onClick={onClose} title="Close Report">
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Report Content */}
        <div className="eval-body">
          {/* Key Metrics Dashboard (4 Primary Parameters) */}
          <div className="eval-metrics-grid">
            {/* 1. Questions Solved */}
            <div className="eval-metric-card">
              <div className="metric-header">
                <span className="metric-icon">🧩</span>
                <span className="metric-title">Questions Solved</span>
              </div>
              <div className="metric-value-row">
                <span className="metric-value">{solvedCount}</span>
                <span className="metric-total">/ {totalQuestions}</span>
              </div>
              <div className="metric-progress-bar">
                <div
                  className="metric-progress-fill fill-green"
                  style={{ width: `${solvedPercentage}%` }}
                />
              </div>
              <div className="metric-footnote">
                <span>{solvedPercentage}% completion rate</span>
                <span className="metric-tag">{solvedCount === totalQuestions ? 'All Solved' : `${totalQuestions - solvedCount} remaining`}</span>
              </div>
            </div>

            {/* 2. Accuracy */}
            <div className="eval-metric-card">
              <div className="metric-header">
                <span className="metric-icon">🎯</span>
                <span className="metric-title">Overall Accuracy</span>
              </div>
              <div className="metric-value-row">
                <span className={`metric-value ${scoreColorClass}`}>{overallAccuracy}%</span>
              </div>
              <div className="metric-progress-bar">
                <div
                  className="metric-progress-fill fill-blue"
                  style={{ width: `${overallAccuracy}%` }}
                />
              </div>
              <div className="metric-footnote">
                <span>{passedTestCases} of {totalTestCases || totalQuestions} test cases passed</span>
                <span className="metric-tag">{overallAccuracy >= 80 ? 'High' : overallAccuracy >= 50 ? 'Moderate' : 'Low'}</span>
              </div>
            </div>

            {/* 3. Time Taken */}
            <div className="eval-metric-card">
              <div className="metric-header">
                <span className="metric-icon">⏱️</span>
                <span className="metric-title">Time Taken</span>
              </div>
              <div className="metric-value-row">
                <span className="metric-value">{formatDuration(timeTakenSeconds)}</span>
              </div>
              <div className="metric-progress-bar">
                <div
                  className="metric-progress-fill fill-amber"
                  style={{ width: `${Math.min(100, Math.round((timeTakenSeconds / (totalDurationMinutes * 60)) * 100))}%` }}
                />
              </div>
              <div className="metric-footnote">
                <span>Allotted: {totalDurationMinutes}m | Avg: {formatDuration(avgTimePerQuestion)}/Q</span>
                <span className="metric-tag">
                  {timeTakenSeconds < (totalDurationMinutes * 60 * 0.5) ? 'Paced Well' : 'Steady'}
                </span>
              </div>
            </div>

            {/* 4. Total Score Earned */}
            <div className="eval-metric-card">
              <div className="metric-header">
                <span className="metric-icon">📊</span>
                <span className="metric-title">Exam Score</span>
              </div>
              <div className="metric-value-row">
                <span className="metric-value">{totalScoreEarned}</span>
                <span className="metric-total">/ {maxPossibleScore}</span>
              </div>
              <div className="metric-progress-bar">
                <div
                  className="metric-progress-fill fill-indigo"
                  style={{ width: `${Math.round((totalScoreEarned / maxPossibleScore) * 100)}%` }}
                />
              </div>
              <div className="metric-footnote">
                <span>Rank tier: <strong>{performanceTier}</strong></span>
                <span className="metric-tag" style={{ color: tierColor, borderColor: tierColor }}>{solvedPercentage}%</span>
              </div>
            </div>
          </div>

          {/* Section: Question-by-Question Breakdown */}
          <div className="eval-section">
            <div className="eval-section-header">
              <h3>📋 Question-by-Question Detailed Breakdown</h3>
              <p>Review the submission status, test case verification, and marks for each question</p>
            </div>

            <div className="eval-table-wrapper">
              <table className="eval-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Q#</th>
                    <th>Question Title</th>
                    <th>Topic</th>
                    <th>Difficulty</th>
                    <th>Status</th>
                    <th>Test Cases</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, idx) => {
                    const isSolved = solvedQuestionIds.includes(q.id);
                    const sub = questionSubmissions[q.id];
                    const passedTc = sub?.passedTestCases ?? (isSolved ? 5 : 0);
                    const totalTc = sub?.totalTestCases ?? 5;
                    const statusText = isSolved ? 'Accepted' : (sub?.status || 'Not Attempted');

                    return (
                      <tr key={q.id} className={isSolved ? 'row-solved' : 'row-unsolved'}>
                        <td className="col-num">Q{idx + 1}</td>
                        <td className="col-title">
                          <div className="table-title-cell">
                            <strong>{q.title}</strong>
                            {isSolved && (
                              <GreenOutlinedTick size={18} className="table-tick" />
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="eval-topic-pill">{q.topic || 'General'}</span>
                        </td>
                        <td>
                          <span className={`eval-diff-pill diff-${(q.difficulty || 'medium').toLowerCase()}`}>
                            {q.difficulty || 'Medium'}
                          </span>
                        </td>
                        <td>
                          {isSolved ? (
                            <span className="status-badge-solved">
                              <GreenOutlinedTick size={15} />
                              <span>Accepted</span>
                            </span>
                          ) : (
                            <span className={`status-badge-other ${sub ? 'attempted' : 'unattempted'}`}>
                              {statusText}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="testcases-pill">
                            {sub ? `${passedTc} / ${totalTc}` : '—'}
                          </span>
                        </td>
                        <td>
                          <strong className={isSolved ? 'score-green' : 'score-muted'}>
                            {isSolved ? '10 / 10' : (sub?.score || '0 / 10')}
                          </strong>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: Actionable Suggestions to Improve (Parameter 4) */}
          <div className="eval-section">
            <div className="eval-section-header">
              <h3>💡 Actionable Suggestions to Improve</h3>
              <p>Personalized analysis and study roadmap based on your submission results</p>
            </div>

            <div className="eval-suggestions-grid">
              {suggestions.map((item, i) => (
                <div key={i} className={`eval-suggestion-card suggestion-${item.type}`}>
                  <div className="suggestion-top">
                    <span className="suggestion-icon">{item.icon}</span>
                    <h4>{item.title}</h4>
                  </div>
                  <p className="suggestion-desc">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="eval-footer">
          <div className="eval-footer-left">
            <span className="eval-summary-legend">
              <GreenOutlinedTick size={16} /> = Questions marked with green outline are successfully solved
            </span>
          </div>
          <div className="eval-footer-right">
            <button className="eval-btn-secondary" onClick={onClose}>
              🔍 Review Code & Questions
            </button>
            {onRetakeOrNewTest && (
              <button
                className="eval-btn-primary"
                onClick={() => {
                  onClose();
                  onRetakeOrNewTest();
                }}
              >
                ⚡ Start Another Mock Test
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
