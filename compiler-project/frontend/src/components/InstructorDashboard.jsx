import React, { useState, useEffect, useRef } from 'react';
import './InstructorDashboard.css';
import { callGroqAPI } from '../services/questionAgent';

const defaultRecentQuestions = [
  {
    id: 1,
    title: 'Find the Longest Subarray with Sum K',
    difficulty: 'Medium',
    topic: 'Arrays',
    description: 'Given an array of integers and an integer K, find the length of the longest subarray that sums to K.',
    constraints: '1 <= arr.length <= 10^5\n-10^9 <= arr[i], K <= 10^9\nTime Limit: 1.0s\nMemory Limit: 256MB',
    sample_input: '10 5 2 7 1 9\n15',
    sample_output: '4',
    starter_code: 'def len_of_long_subarr(arr, n, k):\n    # Write your solution here\n    pass'
  },
  {
    id: 2,
    title: 'Two Sum',
    difficulty: 'Easy',
    topic: 'Arrays',
    description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
    constraints: '2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\nTime Limit: 0.5s',
    sample_input: '2 7 11 15\n9',
    sample_output: '0 1',
    starter_code: 'def twoSum(nums, target):\n    # Write your solution here\n    pass'
  },
  {
    id: 3,
    title: 'Merge Intervals',
    difficulty: 'Medium',
    topic: 'Arrays',
    description: 'Given an array of intervals where intervals[i] = [starti, endi], merge all overlapping intervals.',
    constraints: '1 <= intervals.length <= 10^4\nTime Limit: 1.0s',
    sample_input: '1 3\n2 6\n8 10\n15 18',
    sample_output: '1 6\n8 10\n15 18',
    starter_code: 'def merge(intervals):\n    # Write your solution here\n    pass'
  },
  {
    id: 4,
    title: 'Number of Islands',
    difficulty: 'Hard',
    topic: 'Graphs',
    description: 'Given an m x n 2D binary grid grid which represents a map of 1s (land) and 0s (water), return the number of islands.',
    constraints: '1 <= m, n <= 300\ngrid[i][j] is 0 or 1\nTime Limit: 2.0s',
    sample_input: '11110\n11010\n11000\n00000',
    sample_output: '1',
    starter_code: 'def numIslands(grid):\n    # Write your solution here\n    pass'
  },
  {
    id: 5,
    title: 'Maximum Product Subarray',
    difficulty: 'Medium',
    topic: 'Dynamic Programming',
    description: 'Given an integer array nums, find a subarray that has the largest product, and return the product.',
    constraints: '1 <= nums.length <= 2 * 10^4\n-10 <= nums[i] <= 10\nTime Limit: 1.0s',
    sample_input: '2 3 -2 4',
    sample_output: '6',
    starter_code: 'def maxProduct(nums):\n    # Write your solution here\n    pass'
  },
];

const fallbackTemplates = [
  { icon: '📊', name: 'Arrays', desc: 'Array manipulation and array traversal problems', topic: 'Arrays', difficulty: 'Easy', constraints: '1 <= arr.length <= 10^5\nTime Limit: 1.0s\nMemory Limit: 256MB', problem_scaffold: 'Given an array of integers, solve the specified target condition efficiently.', sample_input: '1 2 3 4 5', sample_output: '15', starter_code: 'def solve(arr):\n    # Write your solution here\n    pass' },
  { icon: '🔑', name: 'Hashing', desc: 'Fast lookup and frequency counting using hash tables', topic: 'Hashing', difficulty: 'Easy', constraints: '1 <= n <= 10^5\nTime Limit: 1.0s\nMemory Limit: 256MB', problem_scaffold: 'Given elements, use a hash map or hash set to perform fast lookups.', sample_input: 'cat dog cat mouse', sample_output: 'cat: 2, dog: 1, mouse: 1', starter_code: 'def solve(items):\n    # Write your solution here\n    pass' },
  { icon: '🔤', name: 'Strings', desc: 'String processing, parsing, and pattern matching', topic: 'Strings', difficulty: 'Easy', constraints: '1 <= s.length <= 10^5\nTime Limit: 1.0s\nMemory Limit: 256MB', problem_scaffold: 'Given a string, process characters or find substrings matching constraints.', sample_input: 'racecar', sample_output: 'true', starter_code: 'def solve(s):\n    # Write your solution here\n    pass' },
  { icon: '🔗', name: 'Linked Lists', desc: 'Singly and doubly linked list manipulation and pointers', topic: 'Linked Lists', difficulty: 'Medium', constraints: '0 <= number of nodes <= 10^4\nTime Limit: 1.0s\nMemory Limit: 256MB', problem_scaffold: 'Perform list operations such as node insertion, deletion, or reversing pointers.', sample_input: '1 -> 2 -> 3 -> 4 -> 5', sample_output: '5 -> 4 -> 3 -> 2 -> 1', starter_code: 'class ListNode:\n    def __init__(self, val=0, next=None):\n        self.val = val\n        self.next = next\n\ndef solve(head):\n    # Write your solution here\n    pass' },
  { icon: '📚', name: 'Stack', desc: 'LIFO data structure for expression parsing and monotonicity', topic: 'Stack', difficulty: 'Medium', constraints: '1 <= n <= 10^5\nTime Limit: 1.0s\nMemory Limit: 256MB', problem_scaffold: 'Use stack operations (push, pop, peek) to process elements in LIFO order.', sample_input: '({[]})', sample_output: 'true', starter_code: 'def solve(s):\n    # Write your solution here\n    pass' },
  { icon: '🚶', name: 'Queue', desc: 'FIFO data structure for queueing and level-order traversal', topic: 'Queue', difficulty: 'Easy', constraints: '1 <= n <= 10^5\nTime Limit: 1.0s\nMemory Limit: 256MB', problem_scaffold: 'Process elements in first-in first-out (FIFO) sequence.', sample_input: '1 2 3 4', sample_output: '1 2 3 4', starter_code: 'from collections import deque\n\ndef solve(arr):\n    # Write your solution here\n    pass' },
  { icon: '⛰️', name: 'Heap (Priority Queue)', desc: 'Min/Max heap for priority tracking and k-largest problems', topic: 'Heap (Priority Queue)', difficulty: 'Medium', constraints: '1 <= arr.length <= 10^5\nTime Limit: 1.0s\nMemory Limit: 256MB', problem_scaffold: 'Maintain dynamically ordered elements using a priority queue or binary heap.', sample_input: '3 2 1 5 6 4\nk = 2', sample_output: '5', starter_code: 'import heapq\n\ndef solve(nums, k):\n    # Write your solution here\n    pass' },
  { icon: '🌲', name: 'Binary Search Trees', desc: 'BST insertion, search, deletion, and ordered traversals', topic: 'Binary Search Trees', difficulty: 'Medium', constraints: '0 <= number of nodes <= 10^4\nTime Limit: 1.0s\nMemory Limit: 256MB', problem_scaffold: 'Perform searching or structural modifications on a Binary Search Tree.', sample_input: 'root = [4,2,7,1,3], val = 2', sample_output: '[2,1,3]', starter_code: 'class TreeNode:\n    def __init__(self, val=0, left=None, right=None):\n        self.val = val\n        self.left = left\n        self.right = right\n\ndef solve(root, val):\n    # Write your solution here\n    pass' },
  { icon: '🌐', name: 'Union Find (DSU)', desc: 'Disjoint Set Union for connectivity and component tracking', topic: 'Union Find (DSU)', difficulty: 'Medium', constraints: '1 <= N <= 10^5\n1 <= edges <= 2 * 10^5\nTime Limit: 1.5s\nMemory Limit: 256MB', problem_scaffold: 'Implement Union-Find with path compression and rank to detect connected components.', sample_input: '5 nodes, edges: [(0,1), (1,2), (3,4)]', sample_output: '2 components', starter_code: 'class UnionFind:\n    def __init__(self, n):\n        self.parent = list(range(n))\n    def find(self, i):\n        if self.parent[i] == i:\n            return i\n        self.parent[i] = self.find(self.parent[i])\n        return self.parent[i]\n    def union(self, i, j):\n        root_i = self.find(i)\n        root_j = self.find(j)\n        if root_i != root_j:\n            self.parent[root_i] = root_j\n\ndef solve(n, edges):\n    # Write your solution here\n    pass' },
  { icon: '💡', name: 'Greedy Algorithms', desc: 'Local optimal choice for global optimization solutions', topic: 'Greedy Algorithms', difficulty: 'Medium', constraints: '1 <= n <= 10^5\nTime Limit: 1.0s\nMemory Limit: 256MB', problem_scaffold: 'Make local optimal decisions at each step to find a global optimum.', sample_input: 'intervals = [[1,3],[2,6],[8,10],[15,18]]', sample_output: '[[1,6],[8,10],[15,18]]', starter_code: 'def solve(intervals):\n    # Write your solution here\n    pass' },
  { icon: '🔢', name: 'Bit Manipulation', desc: 'Direct binary bitwise operations and bitmasking techniques', topic: 'Bit Manipulation', difficulty: 'Easy', constraints: '0 <= n <= 2^31 - 1\nTime Limit: 0.5s\nMemory Limit: 256MB', problem_scaffold: 'Use bitwise operators (AND, OR, XOR, shifts) to solve problems efficiently.', sample_input: 'n = 11 (00000000000000000000000000001011)', sample_output: '3', starter_code: 'def solve(n):\n    # Write your solution here\n    pass' },
  { icon: '🌳', name: 'Trie', desc: 'Prefix tree for dictionary lookups and autocomplete searches', topic: 'Trie', difficulty: 'Hard', constraints: '1 <= words.length <= 10^4\n1 <= word[i].length <= 50\nTime Limit: 1.5s\nMemory Limit: 256MB', problem_scaffold: 'Implement a Trie data structure supporting insert, search, and startsWith operations.', sample_input: 'insert("apple"), search("apple"), startsWith("app")', sample_output: 'true, true', starter_code: 'class TrieNode:\n    def __init__(self):\n        self.children = {}\n        self.is_end = False\n\nclass Trie:\n    def __init__(self):\n        self.root = TrieNode()\n    def insert(self, word: str) -> None:\n        curr = self.root\n        for ch in word:\n            if ch not in curr.children:\n                curr.children[ch] = TrieNode()\n            curr = curr.children[ch]\n        curr.is_end = True\n\ndef solve():\n    # Write your solution here\n    pass' },
  { icon: '↔', name: 'Two Pointers', desc: 'Use two pointers in array problems', topic: 'Arrays', difficulty: 'Medium', constraints: '1 <= arr.length <= 10^5\nTime Limit: 1.0s' },
  { icon: '▭', name: 'Sliding Window', desc: 'Find optimal subarray problems', topic: 'Arrays', difficulty: 'Medium', constraints: '1 <= arr.length <= 10^5\nTime Limit: 1.0s' },
  { icon: '🔍', name: 'Binary Search', desc: 'Search in sorted space efficiently', topic: 'Searching', difficulty: 'Easy', constraints: '1 <= arr.length <= 10^5\nTime Limit: 0.5s' },
  { icon: '⬡', name: 'Graphs', desc: 'Graph traversal and shortest path', topic: 'Graphs', difficulty: 'Hard', constraints: '1 <= V <= 10^4\nTime Limit: 2.0s' },
  { icon: '⚡', name: 'Dynamic Programming', desc: 'Solve optimization problems', topic: 'Dynamic Programming', difficulty: 'Medium', constraints: '1 <= n <= 45\nTime Limit: 1.0s' },
];

const navItems = [
  {
    label: 'Question Bank',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="4" width="14" height="17" rx="3" ry="3" />
        <path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z" />
        <circle cx="9" cy="10" r="0.8" fill="currentColor" />
        <line x1="12" y1="10" x2="16" y2="10" />
        <circle cx="9" cy="14" r="0.8" fill="currentColor" />
        <line x1="12" y1="14" x2="16" y2="14" />
        <circle cx="9" cy="18" r="0.8" fill="currentColor" />
        <line x1="12" y1="18" x2="16" y2="18" />
      </svg>
    ),
    active: true
  },
  {
    label: 'AI Question Agent',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4" />
        <line x1="8" y1="16" x2="8" y2="16" />
        <line x1="16" y1="16" x2="16" y2="16" />
      </svg>
    )
  },
  {
    label: 'Templates',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </svg>
    )
  },
];

const difficultyColor = { Easy: 'diff-easy', Medium: 'diff-medium', Hard: 'diff-hard' };

const tabHeaders = {
  'Question Bank': {
    title: 'Question Bank',
    sub: 'Create, manage and view coding questions in the question bank.',
  },
  'AI Question Agent': {
    title: 'AI Question Setter Chatbot',
    sub: 'Generate tailored competitive programming questions sequentially using Groq AI.',
  },
  'Templates': {
    title: 'Question Templates',
    sub: 'Explore and use pre-built coding problem templates from the database.',
  },
};

const API_BASE = 'http://127.0.0.1:8000';

export default function InstructorDashboard({ user, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeNav, setActiveNav] = useState('Question Bank');

  // Active Selected Question in Question Bank Tab (for inline view)
  const [selectedQuestion, setSelectedQuestion] = useState(null);

  // Templates state loaded from PostgreSQL DB
  const [templatesList, setTemplatesList] = useState(fallbackTemplates);
  // Questions list loaded from PostgreSQL DB
  const [questionsList, setQuestionsList] = useState(defaultRecentQuestions);

  // Modal State for Question Creation
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formDifficulty, setFormDifficulty] = useState('Medium');
  const [formTopic, setFormTopic] = useState('Arrays');
  const [formDescription, setFormDescription] = useState('');
  const [formConstraints, setFormConstraints] = useState('');
  const [formSampleInput, setFormSampleInput] = useState('');
  const [formSampleOutput, setFormSampleOutput] = useState('');
  const [formStarterCode, setFormStarterCode] = useState('');

  // AI Chatbot Assistant State
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: "Hello! I am your Groq-powered AI Question Setter Chatbot 🤖. Mention the topic, difficulty level, and number of questions you need (or use the quick controls below), and I will generate structured problem statements for your question bank!",
      questions: []
    }
  ]);
  const [chatInputTopic, setChatInputTopic] = useState('Dynamic Programming');
  const [chatInputDifficulty, setChatInputDifficulty] = useState('Medium');
  const [chatInputCount, setChatInputCount] = useState(3);
  const [chatCustomPrompt, setChatCustomPrompt] = useState('');
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [isBottomBarCollapsed, setIsBottomBarCollapsed] = useState(false);
  const chatThreadRef = useRef(null);

  const handleSendChatMessage = async (customPromptOverride = null, topicOverride = null, diffOverride = null, countOverride = null) => {
    const topic = topicOverride || chatInputTopic || 'Arrays';
    const difficulty = diffOverride || chatInputDifficulty || 'Medium';
    const count = countOverride || chatInputCount || 3;
    const promptMsg = customPromptOverride || chatCustomPrompt.trim() || `Generate ${count} ${difficulty} questions on ${topic}`;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: promptMsg,
      questions: []
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatCustomPrompt('');
    setIsBotThinking(true);

    try {
      const generatedQs = await callGroqAPI({
        topic,
        difficulty,
        count,
        customPrompt: promptMsg
      });

      const botMsg = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: `Here are ${generatedQs.length} question(s) matching Topic: "${topic}" | Difficulty: "${difficulty}" generated via Groq AI:`,
        questions: generatedQs
      };

      setChatMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error('Chatbot agent error:', err);
      setChatMessages(prev => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: 'I encountered an issue generating questions with Groq API. Please try again.',
          questions: []
        }
      ]);
    } finally {
      setIsBotThinking(false);
    }
  };

  useEffect(() => {
    if (chatThreadRef.current) {
      chatThreadRef.current.scrollTop = chatThreadRef.current.scrollHeight;
    }
  }, [chatMessages, isBotThinking]);

  const handleAddAgentQuestionToBank = async (q) => {
    if (questionsList.some(existing => existing.title === q.title)) {
      setNotification(`Question "${q.title}" is already in your Question Bank.`);
      setTimeout(() => setNotification(null), 3500);
      return;
    }

    try {
      const payload = {
        title: q.title,
        description: q.description || '',
        difficulty: q.difficulty || 'Medium',
        topic: q.topic || 'General',
        sample_input: q.sample_input || '',
        sample_output: q.sample_output || '',
        starter_code: q.starter_code || '',
        constraints: q.constraints || '',
        test_cases: [
          {
            input_data: q.sample_input || '1 2 3',
            expected_output: q.sample_output || '6',
            is_hidden: false
          }
        ]
      };

      const res = await fetch(`${API_BASE}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const savedQ = await res.json();
        setQuestionsList(prev => [savedQ, ...prev]);
        setNotification(`✓ Saved "${q.title}" to Question Bank!`);
      } else {
        setQuestionsList(prev => [q, ...prev]);
        setNotification(`Added "${q.title}" to Question Bank!`);
      }
    } catch (err) {
      setQuestionsList(prev => [q, ...prev]);
      setNotification(`Added "${q.title}" to Question Bank!`);
    }
    setTimeout(() => setNotification(null), 4000);
  };

  const handleAddAllAgentQuestionsToBank = async (questionsArr) => {
    if (!Array.isArray(questionsArr) || questionsArr.length === 0) return;
    let addedCount = 0;
    for (const q of questionsArr) {
      if (!questionsList.some(existing => existing.title === q.title)) {
        try {
          const payload = {
            title: q.title,
            description: q.description || '',
            difficulty: q.difficulty || 'Medium',
            topic: q.topic || 'General',
            sample_input: q.sample_input || '',
            sample_output: q.sample_output || '',
            starter_code: q.starter_code || '',
            constraints: q.constraints || '',
            test_cases: [
              {
                input_data: q.sample_input || '1 2 3',
                expected_output: q.sample_output || '6',
                is_hidden: false
              }
            ]
          };

          const res = await fetch(`${API_BASE}/questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            const savedQ = await res.json();
            setQuestionsList(prev => [savedQ, ...prev]);
          } else {
            setQuestionsList(prev => [q, ...prev]);
          }
          addedCount++;
        } catch (e) {
          setQuestionsList(prev => [q, ...prev]);
          addedCount++;
        }
      }
    }
    if (addedCount > 0) {
      setNotification(`✓ Added all ${addedCount} question(s) in sequence to Question Bank!`);
    } else {
      setNotification('All questions in this sequence are already in your Question Bank.');
    }
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch templates from DB
  const fetchTemplates = () => {
    fetch(`${API_BASE}/templates`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch templates');
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map(t => ({
            ...t,
            desc: t.description || t.desc,
          }));
          // Combine DB templates with fallback templates, removing duplicates by name
          const dbNames = new Set(mapped.map(t => t.name));
          const missingFallbacks = fallbackTemplates.filter(t => !dbNames.has(t.name));
          setTemplatesList([...mapped, ...missingFallbacks]);
        } else {
          setTemplatesList(fallbackTemplates);
        }
      })
      .catch((err) => {
        console.log('Using default templates fallback:', err);
        setTemplatesList(fallbackTemplates);
      });
  };

  // Fetch questions from DB
  const fetchQuestions = () => {
    fetch(`${API_BASE}/questions`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch questions');
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setQuestionsList(data);
        }
      })
      .catch((err) => console.log('Using default questions fallback:', err));
  };

  useEffect(() => {
    fetchTemplates();
    fetchQuestions();
  }, []);


  const handleNavChange = (label) => {
    setActiveNav(label);
    setSelectedQuestion(null);
  };

  const handleSelectQuestion = (q) => {
    setSelectedQuestion(q);
    if (q && q.id) {
      fetch(`${API_BASE}/questions/${q.id}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.constraints) {
            setSelectedQuestion(prev => (prev && prev.id === data.id ? { ...prev, ...data } : prev));
          }
        })
        .catch(err => console.warn('Could not refresh question details:', err));
    }
  };

  const handleOpenTemplateModal = (tmpl) => {
    setSelectedTemplate(tmpl);
    setFormTitle(`${tmpl.name} Problem`);
    setFormDifficulty(tmpl.difficulty || 'Medium');
    setFormTopic(tmpl.topic || tmpl.name);
    setFormDescription(tmpl.problem_scaffold || tmpl.desc || tmpl.description || '');
    setFormConstraints(tmpl.constraints || '1 <= N <= 10^5\nTime Limit: 1.0s\nMemory Limit: 256MB');
    setFormSampleInput(tmpl.sample_input || '');
    setFormSampleOutput(tmpl.sample_output || '');
    setFormStarterCode(tmpl.starter_code || '');
    setIsModalOpen(true);
  };

  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const payload = {
      title: formTitle,
      description: formDescription,
      difficulty: formDifficulty,
      topic: formTopic,
      constraints: formConstraints,
      sample_input: formSampleInput,
      sample_output: formSampleOutput,
      starter_code: formStarterCode,
      test_cases: formSampleInput && formSampleOutput ? [
        {
          input_data: formSampleInput,
          expected_output: formSampleOutput,
          is_hidden: false
        }
      ] : []
    };

    try {
      const res = await fetch(`${API_BASE}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to save question');
      }

      const createdQ = await res.json();
      setQuestionsList(prev => [createdQ, ...prev]);
      setIsModalOpen(false);
      setNotification(`Question "${createdQ.title}" created successfully!`);
      setTimeout(() => setNotification(null), 4000);
      setActiveNav('Question Bank');
      setSelectedQuestion(createdQ);
    } catch (err) {
      console.error('Error creating question:', err);
      // Local state fallback update
      const fallbackQ = {
        id: Date.now(),
        title: formTitle,
        difficulty: formDifficulty,
        topic: formTopic,
        description: formDescription,
        constraints: formConstraints,
        sample_input: formSampleInput,
        sample_output: formSampleOutput,
        starter_code: formStarterCode
      };
      setQuestionsList(prev => [fallbackQ, ...prev]);
      setIsModalOpen(false);
      setNotification(`Question "${formTitle}" created successfully!`);
      setTimeout(() => setNotification(null), 4000);
      setActiveNav('Question Bank');
      setSelectedQuestion(fallbackQ);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Avatar: first letter of first + last name (e.g. "John Doe" → "JD")
  const getAvatarInitials = (name) => {
    if (!name) return 'I';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const avatarInitials = getAvatarInitials(user?.name);


  const currentHeader = tabHeaders[activeNav] || { title: activeNav, sub: '' };

  return (
    <div className="id-shell">
      {/* Toast Notification */}
      {notification && (
        <div className="id-toast-notification">
          <span>✓ {notification}</span>
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside className={`id-sidebar ${sidebarOpen ? '' : 'id-sidebar--collapsed'}`}>
        <div className="id-sidebar-brand">
          {sidebarOpen && <span className="id-brand-text">Instructor</span>}
          <button
            className="id-sidebar-toggle"
            onClick={() => setSidebarOpen(v => !v)}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? '‹' : '›'}
          </button>
        </div>

        <nav className="id-nav">
          {navItems.map(({ label, icon }) => (
            <button
              key={label}
              className={`id-nav-item ${activeNav === label ? 'id-nav-item--active' : ''}`}
              onClick={() => handleNavChange(label)}
            >
              <span className="id-nav-icon">{icon}</span>
              {sidebarOpen && <span className="id-nav-label">{label}</span>}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Main ── */}
      <div className="id-main">
        {/* Top bar */}
        <header className="id-topbar">
          <div className="id-topbar-left">
            <h1 className="id-page-title">
              {selectedQuestion ? selectedQuestion.title : currentHeader.title}
            </h1>
            <p className="id-page-sub">
              {selectedQuestion
                ? `Viewing question details under ${selectedQuestion.topic || 'General'}`
                : currentHeader.sub}
            </p>
          </div>
          <div className="id-topbar-right">
            <div className="id-user-chip">
              <div className="id-avatar" title={user?.name ?? 'Instructor'}>{avatarInitials}</div>
              <div className="id-user-info">
                <span className="id-user-name">{user?.name ?? 'Instructor'}</span>
                <span className="id-user-role">Instructor</span>
              </div>
            </div>

            <button className="id-logout-btn" onClick={onLogout}>Logout</button>
          </div>
        </header>

        {/* Content grid */}
        <div className="id-content-grid">
          {/* Question Bank View */}
          {activeNav === 'Question Bank' && (
            <>
              {/* Question List View */}
              {!selectedQuestion && (
                <section className="id-card id-card--full">
                  <div className="id-card-header">
                    <h2 className="id-card-title">Recent Questions ({questionsList.length})</h2>
                    <button className="id-view-all" onClick={() => handleNavChange('Templates')}>
                      + Create Question from Template
                    </button>
                  </div>
                  <ul className="id-q-list">
                    {questionsList.map((q, i) => (
                      <li
                        className="id-q-row"
                        key={q.id || i}
                        onClick={() => handleSelectQuestion(q)}
                      >
                        <span className="id-q-doc-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        </span>
                        <div className="id-q-meta">
                          <span className="id-q-title">{q.title}</span>
                          <div className="id-q-tags">
                            <span className={`id-diff-badge ${difficultyColor[q.difficulty] || 'diff-medium'}`}>
                              {q.difficulty || 'Medium'}
                            </span>
                            <span className="id-topic-tag">• {q.topic || 'General'}</span>
                            {q.constraints ? (
                              <span
                                style={{
                                  fontSize: '0.73rem',
                                  background: '#f0fdf4',
                                  color: '#15803d',
                                  padding: '0.12rem 0.45rem',
                                  borderRadius: '4px',
                                  border: '1px solid #bbf7d0',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px'
                                }}
                                title={q.constraints}
                              >
                                ⚡ Constraints
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <button className="id-view-q-btn">View Question →</button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Single Question Detail View inside Question Bank */}
              {selectedQuestion && (
                <div className="id-q-detail-container">
                  <div className="id-q-detail-actions">
                    <button
                      className="id-back-btn"
                      onClick={() => setSelectedQuestion(null)}
                    >
                      ← Back to Question Bank List
                    </button>
                    <span className={`id-diff-badge ${difficultyColor[selectedQuestion.difficulty] || 'diff-medium'}`}>
                      {selectedQuestion.difficulty || 'Medium'}
                    </span>
                    <span className="id-topic-tag">• {selectedQuestion.topic || 'General'}</span>
                  </div>

                  {/* Problem Description Card */}
                  <section className="id-card">
                    <h3 className="id-detail-section-title">Problem Description</h3>
                    <p className="id-detail-text">{selectedQuestion.description}</p>
                  </section>

                  {/* Constraints Card */}
                  <section className="id-card">
                    <h3 className="id-detail-section-title">Constraints</h3>
                    {selectedQuestion.constraints ? (
                      <pre className="id-constraints-box">{selectedQuestion.constraints}</pre>
                    ) : (
                      <p className="id-detail-text-muted">No explicit constraints defined for this question.</p>
                    )}
                  </section>

                  {/* Sample Input / Output Row */}
                  <div className="id-form-row">
                    <section className="id-card flex-1">
                      <h3 className="id-detail-section-title">Sample Input</h3>
                      <pre className="id-code-box">{selectedQuestion.sample_input || selectedQuestion.sampleInput || 'N/A'}</pre>
                    </section>
                    <section className="id-card flex-1">
                      <h3 className="id-detail-section-title">Sample Output</h3>
                      <pre className="id-code-box">{selectedQuestion.sample_output || selectedQuestion.sampleOutput || 'N/A'}</pre>
                    </section>
                  </div>

                  {/* Starter Code Card */}
                  <section className="id-card">
                    <h3 className="id-detail-section-title">Starter Code / Solution Scaffold</h3>
                    <pre className="id-code-box code-font">{selectedQuestion.starter_code || selectedQuestion.starterCode || '# No starter code provided'}</pre>
                  </section>
                </div>
              )}
            </>
          )}

          {/* AI Question Chatbot Agent View */}
          {activeNav === 'AI Question Agent' && (
            <div className="id-chatbot-shell">
              {/* Chat Header */}
              <div className="id-chat-header">
                <div className="id-chat-header-user">
                  <div className="id-chat-bot-avatar">🤖</div>
                  <div>
                    <h2 className="id-chat-bot-name">Groq AI Question Setter Chatbot</h2>
                    <div className="id-chat-bot-status">
                      <span className="id-chat-status-dot" /> Online • Powered by Groq LLM API
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="id-chat-header-toggle-btn"
                  onClick={() => setIsBottomBarCollapsed((prev) => !prev)}
                  title={isBottomBarCollapsed ? 'Show bottom controls' : 'Collapse bottom controls'}
                >
                  {isBottomBarCollapsed ? '▲ Show Controls' : '▼ Collapse Controls'}
                </button>
              </div>

              {/* Chat Message Thread */}
              <div ref={chatThreadRef} className="id-chat-thread">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={`id-chat-msg-group ${msg.sender}`}>
                    <div className="id-chat-bubble">
                      <p style={{ margin: 0 }}>{msg.text}</p>
                    </div>

                    {msg.questions && msg.questions.length > 0 && (
                      <div className="id-chat-q-cards-list">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.25rem 0' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                            Generated Sequence ({msg.questions.length} Question{msg.questions.length > 1 ? 's' : ''})
                          </span>
                          <button
                            className="id-view-q-btn"
                            style={{ background: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8', fontWeight: '600', fontSize: '0.78rem' }}
                            onClick={() => handleAddAllAgentQuestionsToBank(msg.questions)}
                          >
                            + Add All to Question Bank
                          </button>
                        </div>

                        {msg.questions.map((q, idx) => {
                          const isInBank = questionsList.some(item => item.title === q.title);
                          return (
                            <div key={q.id || idx} className="id-chat-q-card">
                              <div className="id-chat-q-header">
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                    <span style={{ background: '#e0e7ff', color: '#4338ca', fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                                      #{q.sequence_number || idx + 1}
                                    </span>
                                    <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1rem', fontWeight: 700 }}>{q.title}</h4>
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <span className={`id-diff-badge ${difficultyColor[q.difficulty] || 'diff-medium'}`}>
                                      {q.difficulty || 'Medium'}
                                    </span>
                                    <span className="id-topic-tag">• {q.topic || 'General'}</span>
                                  </div>
                                </div>

                                <button
                                  className="id-view-q-btn"
                                  style={{
                                    background: isInBank ? '#f1f5f9' : '#dcfce7',
                                    color: isInBank ? '#64748b' : '#15803d',
                                    borderColor: isInBank ? '#cbd5e1' : '#bbf7d0',
                                    fontWeight: '600'
                                  }}
                                  onClick={() => handleAddAgentQuestionToBank(q)}
                                  disabled={isInBank}
                                >
                                  {isInBank ? '✓ In Bank' : '+ Add to Bank'}
                                </button>
                              </div>

                              <p style={{ margin: '0.75rem 0 0.5rem 0', fontSize: '0.875rem', color: '#334155', lineHeight: '1.45' }}>
                                {q.description}
                              </p>

                              {q.constraints && (
                                <div style={{ marginTop: '0.4rem' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Constraints:</span>
                                  <pre style={{ background: '#f1f5f9', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', margin: '0.2rem 0', color: '#475569', whiteSpace: 'pre-wrap' }}>
                                    {q.constraints}
                                  </pre>
                                </div>
                              )}

                              {(q.sample_input || q.sample_output) && (
                                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', background: '#f8fafc', padding: '0.4rem 0.6rem', borderRadius: '6px', marginTop: '0.4rem', border: '1px solid #e2e8f0' }}>
                                  {q.sample_input && <div><strong>Sample In:</strong> <code>{q.sample_input}</code></div>}
                                  {q.sample_output && <div><strong>Sample Out:</strong> <code>{q.sample_output}</code></div>}
                                </div>
                              )}

                              {q.starter_code && (
                                <div style={{ marginTop: '0.4rem' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Starter Code:</span>
                                  <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: '0.45rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', margin: '0.2rem 0', overflowX: 'auto', fontFamily: 'monospace' }}>
                                    {q.starter_code}
                                  </pre>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                {isBotThinking && (
                  <div className="id-chat-msg-group bot">
                    <div className="id-chat-thinking">
                      <span>⚡ Groq AI Chatbot is thinking & synthesizing questions...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Controls Bar (Collapsible) */}
              {!isBottomBarCollapsed ? (
                <>
                  {/* Quick Prompt Chips */}
                  <div className="id-chat-quick-chips">
                    <button
                      type="button"
                      className="id-chat-chip-btn"
                      onClick={() => {
                        setChatInputTopic('Dynamic Programming');
                        setChatInputDifficulty('Medium');
                        setChatInputCount(3);
                        handleSendChatMessage('Generate 3 Medium questions on Dynamic Programming', 'Dynamic Programming', 'Medium', 3);
                      }}
                    >
                      ⚡ 3 Medium questions on Dynamic Programming
                    </button>

                    <button
                      type="button"
                      className="id-chat-chip-btn"
                      onClick={() => {
                        setChatInputTopic('Arrays');
                        setChatInputDifficulty('Easy');
                        setChatInputCount(2);
                        handleSendChatMessage('Generate 2 Easy questions on Arrays', 'Arrays', 'Easy', 2);
                      }}
                    >
                      📊 2 Easy questions on Arrays
                    </button>

                    <button
                      type="button"
                      className="id-chat-chip-btn"
                      onClick={() => {
                        setChatInputTopic('Graphs');
                        setChatInputDifficulty('Hard');
                        setChatInputCount(2);
                        handleSendChatMessage('Generate 2 Hard questions on Graphs', 'Graphs', 'Hard', 2);
                      }}
                    >
                      🌐 2 Hard questions on Graphs
                    </button>

                    <button
                      type="button"
                      className="id-chat-chip-btn"
                      onClick={() => {
                        setChatInputTopic('Strings');
                        setChatInputDifficulty('Easy');
                        setChatInputCount(3);
                        handleSendChatMessage('Generate 3 Easy questions on Strings', 'Strings', 'Easy', 3);
                      }}
                    >
                      🔤 3 Easy questions on Strings
                    </button>
                  </div>

                  {/* Chat Input Controls */}
                  <div className="id-chat-input-area">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendChatMessage();
                      }}
                      className="id-chat-text-row"
                      style={{ justifyContent: 'space-between' }}
                    >
                      <div className="id-chat-controls-bar">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Topic:</label>
                          <input
                            type="text"
                            list="topics-list"
                            className="id-form-input"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.85rem', width: '170px' }}
                            value={chatInputTopic}
                            onChange={(e) => setChatInputTopic(e.target.value)}
                            placeholder="e.g. Arrays, DP..."
                          />
                          <datalist id="topics-list">
                            <option value="Arrays" />
                            <option value="Dynamic Programming" />
                            <option value="Graphs" />
                            <option value="Trees" />
                            <option value="Strings" />
                            <option value="Linked Lists" />
                            <option value="Binary Search" />
                            <option value="Greedy Algorithms" />
                            <option value="Hashing" />
                            <option value="Backtracking" />
                            <option value="Stack" />
                            <option value="Queue" />
                            <option value="Trie" />
                          </datalist>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Difficulty:</label>
                          <select
                            className="id-form-select"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.85rem' }}
                            value={chatInputDifficulty}
                            onChange={(e) => setChatInputDifficulty(e.target.value)}
                          >
                            <option value="All">All</option>
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                          </select>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>No. of Questions:</label>
                          <input
                            type="number"
                            className="id-form-input"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.85rem', width: '65px' }}
                            min="1"
                            max="10"
                            value={chatInputCount}
                            onChange={(e) => setChatInputCount(e.target.value)}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
                        <button type="submit" className="id-chat-send-btn" disabled={isBotThinking}>
                          {isBotThinking ? 'Generating...' : '⚡ Generate Sequence'}
                        </button>
                        <button
                          type="button"
                          className="id-chat-collapse-btn"
                          onClick={() => setIsBottomBarCollapsed(true)}
                          title="Collapse bottom bar to view questions"
                        >
                          ▼ Collapse
                        </button>
                      </div>
                    </form>
                  </div>
                </>
              ) : (
                <div
                  className="id-chat-collapsed-bar"
                  onClick={() => setIsBottomBarCollapsed(false)}
                  title="Click to expand controls"
                >
                  <div className="id-chat-collapsed-summary">
                    <span className="id-chat-collapsed-tag">⚡ Controls Collapsed</span>
                    <span className="id-chat-collapsed-info">
                      Topic: <strong>{chatInputTopic || 'Dynamic Programming'}</strong> • Difficulty: <strong>{chatInputDifficulty}</strong> • Count: <strong>{chatInputCount}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="id-chat-expand-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsBottomBarCollapsed(false);
                    }}
                  >
                    ▲ Show Controls
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Question Templates View */}
          {activeNav === 'Templates' && (
            <section className="id-card id-card--full">
              <div className="id-card-header">
                <h2 className="id-card-title">Available Templates ({templatesList.length})</h2>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Click a template to create a new question
                </span>
              </div>
              <ul className="id-tmpl-list">
                {templatesList.map((t, i) => (
                  <li
                    className="id-tmpl-row"
                    key={t.id || i}
                    onClick={() => handleOpenTemplateModal(t)}
                  >
                    <div className="id-tmpl-icon">{t.icon}</div>
                    <div className="id-tmpl-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="id-tmpl-name">{t.name}</span>
                        <span className={`id-diff-badge ${difficultyColor[t.difficulty] || 'diff-medium'}`}>
                          {t.difficulty || 'Medium'}
                        </span>
                      </div>
                      <span className="id-tmpl-desc">{t.desc || t.description}</span>
                    </div>
                    <button className="id-use-tmpl-btn">Use Pattern →</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

        </div>
      </div>

      {/* ── Create Question Modal ── */}
      {isModalOpen && selectedTemplate && (

        <div className="id-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="id-modal-card" onClick={e => e.stopPropagation()}>
            <div className="id-modal-header">
              <div className="id-modal-title-group">
                <div className="id-tmpl-icon">{selectedTemplate.icon}</div>
                <div>
                  <h3 className="id-modal-heading">Create Question: {selectedTemplate.name}</h3>
                  <p className="id-modal-subheading">Customize template scaffold and constraints before saving.</p>
                </div>
              </div>
              <button className="id-modal-close" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateQuestion} className="id-modal-form">
              <div className="id-form-row">
                <div className="id-form-group flex-2">
                  <label className="id-form-label">Question Title</label>
                  <input
                    className="id-form-input"
                    type="text"
                    required
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="e.g. Two Sum Array Problem"
                  />
                </div>
                <div className="id-form-group">
                  <label className="id-form-label">Difficulty</label>
                  <select
                    className="id-form-select"
                    value={formDifficulty}
                    onChange={e => setFormDifficulty(e.target.value)}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <div className="id-form-group">
                  <label className="id-form-label">Topic / Tag</label>
                  <input
                    className="id-form-input"
                    type="text"
                    value={formTopic}
                    onChange={e => setFormTopic(e.target.value)}
                  />
                </div>
              </div>

              <div className="id-form-group">
                <label className="id-form-label">Problem Description & Scaffold</label>
                <textarea
                  className="id-form-textarea"
                  rows={4}
                  required
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                />
              </div>

              {/* NEW: Constraints Input Field */}
              <div className="id-form-group">
                <label className="id-form-label">Question Constraints (Input Boundaries & Limits)</label>
                <textarea
                  className="id-form-textarea"
                  rows={3}
                  value={formConstraints}
                  onChange={e => setFormConstraints(e.target.value)}
                  placeholder="e.g. 1 <= N <= 10^5\nTime Limit: 1.0s\nMemory Limit: 256MB"
                />
              </div>

              <div className="id-form-row">
                <div className="id-form-group">
                  <label className="id-form-label">Sample Input</label>
                  <textarea
                    className="id-form-textarea"
                    rows={3}
                    value={formSampleInput}
                    onChange={e => setFormSampleInput(e.target.value)}
                    placeholder="e.g. 2 7 11 15\n9"
                  />
                </div>
                <div className="id-form-group">
                  <label className="id-form-label">Sample Output</label>
                  <textarea
                    className="id-form-textarea"
                    rows={3}
                    value={formSampleOutput}
                    onChange={e => setFormSampleOutput(e.target.value)}
                    placeholder="e.g. 0 1"
                  />
                </div>
              </div>

              <div className="id-form-group">
                <label className="id-form-label">Starter Code / Solution Scaffold</label>
                <textarea
                  className="id-form-textarea code-font"
                  rows={5}
                  value={formStarterCode}
                  onChange={e => setFormStarterCode(e.target.value)}
                />
              </div>

              <div className="id-modal-footer">
                <button
                  type="button"
                  className="id-modal-cancel-btn"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="id-modal-submit-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating Question...' : '✓ Save & Publish Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


