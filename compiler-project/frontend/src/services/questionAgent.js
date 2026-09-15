// Groq AI Chatbot & Question Generator Agent Service

const API_BASE = 'http://127.0.0.1:8000';

/**
 * Call AI Question Generator via Backend Groq endpoint.
 * The Groq API key is securely loaded and managed by the backend.
 */
export async function callGroqAPI({ topic = 'Arrays', difficulty = 'Medium', count = 3, customPrompt = '' }) {
  const requestedCount = Math.max(1, Math.min(Number(count) || 3, 10));

  // 1. Request question generation from backend endpoint
  try {
    const backendRes = await fetch(`${API_BASE}/ai/generate-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        difficulty,
        count: requestedCount,
        custom_prompt: customPrompt
      })
    });

    if (backendRes.ok) {
      const data = await backendRes.json();
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        return data.questions.map((q, idx) => ({
          id: q.id || `groq-gen-${Date.now()}-${idx + 1}`,
          sequence_number: q.sequence_number || (idx + 1),
          title: q.title || `${topic} Problem ${idx + 1}`,
          topic: q.topic || topic,
          difficulty: q.difficulty || (difficulty === 'All' ? 'Medium' : difficulty),
          description: q.description || `Solve the ${topic} challenge.`,
          constraints: q.constraints || '1 <= N <= 10^5\nTime Limit: 1.0s\nMemory Limit: 256MB',
          sample_input: q.sample_input || '1 2 3',
          sample_output: q.sample_output || '6',
          starter_code: q.starter_code || `def solve(data):\n    # Write solution here\n    pass\n`
        }));
      }
    }
  } catch (err) {
    console.warn('Backend AI generate endpoint unreachable, using client synthesizer fallback:', err);
  }

  // 2. Fallback intelligent synthesizer if backend is unreachable
  return fallbackGroqSynthesizer(topic, difficulty, requestedCount);
}

/**
 * Fallback synthesizer matching Groq payload format
 */
function fallbackGroqSynthesizer(topic, difficulty, count) {
  const diffToUse = difficulty === 'All' ? 'Medium' : difficulty;
  const questions = [];

  const templatesByTopic = {
    'Arrays': [
      { title: 'Maximum Subarray Sum (Kadane)', desc: 'Find the contiguous subarray with the maximum sum in an array of integers.' },
      { title: 'Rotate Array by K Positions', desc: 'Rotate an array of size N to the right by K steps in place.' },
      { title: 'Product of Array Except Self', desc: 'Return an array output such that output[i] is equal to the product of all elements except nums[i].' },
      { title: 'Container With Most Water', desc: 'Find two lines that together with the x-axis form a container holding the maximum water.' },
      { title: '3Sum Zero Triplet Search', desc: 'Find all unique triplets in the array that sum up to zero.' }
    ],
    'Dynamic Programming': [
      { title: '0/1 Knapsack Optimization', desc: 'Given weights and values of N items, determine the maximum value put in a knapsack of capacity W.' },
      { title: 'Longest Increasing Subsequence', desc: 'Find the length of the longest strictly increasing subsequence in an integer array.' },
      { title: 'Partition Equal Subset Sum', desc: 'Determine if an array can be partitioned into two subsets with equal sum.' },
      { title: 'Coin Change Problem', desc: 'Find the fewest number of coins needed to make up a given amount.' },
      { title: 'House Robber Max Loot', desc: 'Determine the maximum amount of money you can rob tonight without alerting adjacent alarms.' }
    ],
    'Graphs': [
      { title: 'Shortest Path in Weighted Graph (Dijkstra)', desc: 'Find the shortest path from source node to all other nodes in a weighted non-negative graph.' },
      { title: 'Number of Connected Components', desc: 'Find the number of connected components in an undirected graph.' },
      { title: 'Topological Sort of DAG', desc: 'Return a valid topological ordering of vertices in a Directed Acyclic Graph.' },
      { title: 'Detect Cycle in Directed Graph', desc: 'Determine whether a given directed graph contains a cycle.' }
    ],
    'Strings': [
      { title: 'Valid Anagram Check', desc: 'Determine if string t is an anagram of string s.' },
      { title: 'Group Anagrams Together', desc: 'Given an array of strings, group the anagrams together in any order.' },
      { title: 'Longest Palindromic Substring', desc: 'Find the longest palindromic substring in a given string s.' },
      { title: 'String Compression Algorithm', desc: 'Compress a character array using run-length encoding in place.' }
    ],
    'Trees': [
      { title: 'Binary Tree Level Order Traversal', desc: 'Return the level order traversal of binary tree node values.' },
      { title: 'Validate Binary Search Tree', desc: 'Determine if a given binary tree is a valid Binary Search Tree (BST).' },
      { title: 'Lowest Common Ancestor in BST', desc: 'Find the lowest common ancestor node of two given nodes p and q in a BST.' },
      { title: 'Diameter of Binary Tree', desc: 'Compute the length of the longest path between any two nodes in a tree.' }
    ],
    'Linked Lists': [
      { title: 'Reverse a Linked List', desc: 'Reverse a singly linked list in-place and return the new head.' },
      { title: 'Detect Linked List Cycle', desc: 'Given head, determine if the linked list has a cycle in it using Floyd Cycle algorithm.' },
      { title: 'Merge Two Sorted Lists', desc: 'Merge two sorted linked lists and return it as a new sorted list.' }
    ]
  };

  const pool = templatesByTopic[topic] || [
    { title: `${topic} Optimal Solution Challenge`, desc: `Solve the algorithmic challenge involving ${topic}.` },
    { title: `Advanced ${topic} Traversal`, desc: `Implement an efficient algorithm for ${topic} with optimal time complexity.` },
    { title: `${topic} Edge Case Evaluator`, desc: `Handle performance edge cases for ${topic} data structures.` },
    { title: `${topic} Subproblem Solver`, desc: `Break down the ${topic} challenge into efficient subproblems.` }
  ];

  for (let i = 0; i < count; i++) {
    const tmpl = pool[i % pool.length];
    questions.push({
      id: `groq-synth-${Date.now()}-${i + 1}`,
      sequence_number: i + 1,
      title: `${tmpl.title} (${diffToUse})`,
      topic: topic,
      difficulty: diffToUse,
      description: tmpl.desc,
      constraints: `1 <= N <= 10^5\nTime Limit: ${diffToUse === 'Hard' ? '2.0s' : '1.0s'}\nMemory Limit: 256MB`,
      sample_input: `Input data for ${topic} sequence ${i + 1}`,
      sample_output: `Output result for ${topic} sequence ${i + 1}`,
      starter_code: `# Solution scaffold for ${tmpl.title}\ndef solve(data):\n    # Write your solution here\n    pass\n`
    });
  }

  return questions;
}
