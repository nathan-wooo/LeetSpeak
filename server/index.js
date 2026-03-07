import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { initializeApp as initFirebaseAdmin } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3001;

// --- Firebase Admin (for verifying user ID tokens) ---
if (!process.env.FIREBASE_PROJECT_ID) {
  console.error('FATAL: FIREBASE_PROJECT_ID is not set in server/.env');
  process.exit(1);
}
initFirebaseAdmin({ projectId: process.env.FIREBASE_PROJECT_ID });
const firebaseAuth = getAuth();

// --- Gemini config (server-side only — key never leaves the server) ---
if (!process.env.GEMINI_API_KEY) {
  console.error('FATAL: GEMINI_API_KEY is not set in server/.env');
  process.exit(1);
}
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// --- Per-user rate limiting (in-memory, keyed by Firebase UID) ---
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_WINDOW = 30;           // ~10 calls/question × 3 questions
const rateLimitStore = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [uid, data] of rateLimitStore) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(uid);
    }
  }
}, 10 * 60 * 1000);

function checkRateLimit(uid) {
  const now = Date.now();
  let data = rateLimitStore.get(uid);

  if (!data || now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
    data = { count: 0, windowStart: now };
  }

  if (data.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryMs = Math.max(0, data.windowStart + RATE_LIMIT_WINDOW_MS - now);
    return { allowed: false, retryMs, remaining: 0 };
  }

  data.count++;
  rateLimitStore.set(uid, data);
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - data.count };
}

// --- Middleware ---

app.use(cors());
app.use(express.json());

async function verifyAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }
  try {
    const decoded = await firebaseAuth.verifyIdToken(header.split('Bearer ')[1]);
    req.uid = decoded.uid;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid auth token' });
  }
}

function rateLimit(req, res, next) {
  const result = checkRateLimit(req.uid);
  if (!result.allowed) {
    const minutes = Math.max(1, Math.ceil(result.retryMs / 60000));
    return res.status(429).json({
      error: 'rate_limit',
      message: `You've hit the hourly AI usage limit. Try again in ~${minutes} minute(s).`,
      retryMs: result.retryMs,
    });
  }
  req.rateLimitRemaining = result.remaining;
  next();
}

async function callGemini(prompt, maxOutputTokens = 1000) {
  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens,
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const err = new Error(errBody.error?.message || `Gemini API ${response.status}`);
    err.status = response.status;
    err.code = errBody.error?.code;
    throw err;
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

// ===================== Gemini proxy routes =====================

app.post('/api/gemini/chat', verifyAuth, rateLimit, async (req, res) => {
  const { question, code, language, problemTitle } = req.body;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API key not configured on server.' });
  }

  const langTag = language === 'C++' ? 'cpp' : 'javascript';
  const prompt = `You are a coding assistant helping with ${problemTitle}. The user is asking: "${question}"

Current code context:
\`\`\`${langTag}
${code || '// No code yet'}
\`\`\`

IMPORTANT RULES:
- Provide a brief, helpful explanation (2-3 sentences max)
- If the question is about implementing something (like "how to use hashmap" or "how to implement a set"), provide ONLY helper code examples showing syntax/usage
- DO NOT provide complete solutions to the problem - only helper examples
- For "how to implement X" questions, show ONLY how to declare and use X (e.g., for "how to implement a set", show: \`unordered_set<int> mySet;\` and basic operations like \`mySet.insert(x)\`, \`mySet.count(x)\`)
- DO NOT show the entire problem solution - only the helper syntax/pattern they asked about
- For code suggestions, ALWAYS wrap code in markdown code fences: \`\`\`${langTag}\n<code>\n\`\`\`
- Keep code examples minimal - just enough to show the pattern/syntax (2-5 lines max)
- Format code suggestions clearly so they can be easily extracted
- When providing code examples in your explanation, use markdown code fences

If you're suggesting code, end your response with a line starting with "CODE_SUGGESTION:" followed by the code (without markdown fences). Only suggest the helper code, NOT the full solution.`;

  try {
    const text = await callGemini(prompt, 500);
    res.json({ text, remaining: req.rateLimitRemaining });
  } catch (err) {
    console.error('Gemini chat error:', err.message);
    if (err.code === 404) {
      return res.status(502).json({ error: `Model "${GEMINI_MODEL}" not found.` });
    }
    res.status(502).json({ error: 'Failed to get response from AI.' });
  }
});

app.post('/api/gemini/analyze', verifyAuth, rateLimit, async (req, res) => {
  const { transcript, conversationHistory = [], code, problemTitle, problemPrompt } = req.body;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API key not configured on server.' });
  }

  const conversationContext = conversationHistory.length > 0
    ? `Previous conversation:\n${conversationHistory.map(msg => `- ${msg}`).join('\n')}\n\nLatest: "${transcript}"`
    : transcript || 'No thoughts shared yet';

  const prompt = `You are a coding interview coach helping a student solve "${problemTitle}". 

Problem: ${problemPrompt}

This is an ongoing conversation. Here's what the student has shared:
${conversationContext}

Their current code:
\`\`\`${code || '// No code written yet'}
\`\`\`

IMPORTANT RULES:
- DO NOT give the answer or complete solution
- DO remember the conversation context and respond NATURALLY to their latest question/statement
- DO NOT reference the code unless the student's message is explicitly about code or solving the problem
- For casual greetings or when starting a conversation, encourage them to share their thinking by asking questions like:
  * "What are your initial thoughts on how to approach this?"
  * "How are you thinking about solving this problem?"
  * "What's going through your mind as you read the problem?"
- For casual greetings or non-problem-related messages, gently redirect them to think about the problem by asking them to share their approach or initial thoughts
- DO provide hints and questions to guide them based on what they've already shared ABOUT THE PROBLEM
- Only mention code structure/hints when they're actively discussing their approach or asking about implementation
- DO ask about time/space complexity when they're going in wrong direction
- DO encourage them when they're on the right track
- DO point out potential issues (e.g., "Consider edge cases", "Think about O(n²) vs O(n)") ONLY when relevant to their current discussion
- When the student has clearly identified the optimal approach (e.g., "I'll use a Set" for finding duplicates), encourage them with phrases like "Great approach!" or "Excellent, you've got it! Start coding that solution."
- Keep responses SHORT (1-2 sentences max)
- Use a supportive, Socratic teaching style
- Reference previous parts of the conversation when relevant (e.g., "Yes, that approach you mentioned..." or "Following up on what you said about...")

PROGRESS TRACKING:
- Assess how close the student is to a complete, working solution (0-100%)
- 0-20%: Just starting, no clear approach yet
- 20-40%: Has identified an approach but not implemented
- 40-60%: Started implementing, incomplete or has syntax errors
- 60-80%: Mostly implemented but has logical bugs or missing edge cases
- 80-95%: Close to solution, minor issues remaining
- 95-100%: Only when code is complete and correct (check if code has a return statement and proper logic)
- Base progress on actual code implementation, not just thoughts/approach

Respond with ONLY:
1. Your coaching message (1-2 sentences)
2. A new line with "PROGRESS:" followed by a number 0-100 representing how close they are to a complete solution

Example format:
Great approach! Consider using a hash set for O(n) time complexity.
PROGRESS: 35`;

  try {
    const text = await callGemini(prompt, 1000);
    res.json({ text, remaining: req.rateLimitRemaining });
  } catch (err) {
    console.error('Gemini analyze error:', err.message);
    if (err.code === 404) {
      return res.status(502).json({ error: `Model "${GEMINI_MODEL}" not found.` });
    }
    res.status(502).json({ error: 'Failed to get response from AI.' });
  }
});

// Temporary directory for compiled files
const TEMP_DIR = join(process.cwd(), 'temp');

// Create temp directory if it doesn't exist
try {
  await import('fs').then(({ mkdirSync, existsSync }) => {
    if (!existsSync(TEMP_DIR)) {
      mkdirSync(TEMP_DIR, { recursive: true });
    }
  });
} catch (err) {
  console.error('Failed to create temp directory:', err);
}

/**
 * Compiles and runs C++ code
 * Returns test results matching the frontend format
 */
app.post('/api/compile-cpp', verifyAuth, async (req, res) => {
  const { code, tests } = req.body;

  if (!code) {
    return res.status(400).json({
      ok: false,
      error: 'No code provided',
      logs: [],
      results: [],
    });
  }

  if (!tests || !Array.isArray(tests)) {
    return res.status(400).json({
      ok: false,
      error: 'Tests array is required',
      logs: [],
      results: [],
    });
  }

  const fileId = randomUUID();
  const cppFile = join(TEMP_DIR, `${fileId}.cpp`);
  const exeFile = join(TEMP_DIR, `${fileId}`);

  try {
    // Extract the Solution class from the code
    // We need to wrap it in a main function that runs the tests
    const wrappedCode = wrapCppCode(code, tests);

    // Write C++ code to file
    await writeFile(cppFile, wrappedCode, 'utf-8');

    // Compile C++ code (with timeout and resource limits)
    // Redirect stderr to stdout so we capture all error messages
    const compileCommand = `g++ -std=c++17 -O2 -o "${exeFile}" "${cppFile}" 2>&1`;
    let compileOutput = '';
    try {
      const { stdout, stderr } = await Promise.race([
        execAsync(compileCommand, {
          maxBuffer: 1024 * 1024, // 1MB
          timeout: 10000, // 10 seconds
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Compilation timeout')), 10000)
        ),
      ]);
      compileOutput = (stdout || '') + (stderr || '');
    } catch (compileError) {
      // execAsync with 2>&1 puts stderr into stdout
      // When command fails, error.stdout contains the error messages from g++
      let errorOutput = '';
      
      // Try to get the actual g++ error output
      if (compileError.stdout) {
        errorOutput = compileError.stdout.toString().trim();
      } else if (compileError.stderr) {
        errorOutput = compileError.stderr.toString().trim();
      }
      
      // If no output but there's a message, check if it contains useful info
      if (!errorOutput && compileError.message) {
        const msg = compileError.message.toString();
        // If message is just "Command failed: ...", try to read the actual error
        // Otherwise use the message
        if (!msg.includes('Command failed:') || errorOutput) {
          errorOutput = msg;
        }
      }
      
      compileOutput = errorOutput;
      
      // If we still don't have output, try reading from the file system logs
      // (This shouldn't happen, but just in case)
      if (!errorOutput) {
        errorOutput = `Compilation failed: ${compileError.message || 'Unknown error'}`;
      }
      
      // Clean up on compilation error
      try {
        await unlink(cppFile).catch(() => {});
      } catch {}
      
      return res.json({
        ok: false,
        error: `Compilation error:\n${errorOutput}`,
        logs: compileOutput ? [compileOutput] : [],
        results: [],
      });
    }

    // Run the compiled executable with timeout
    const results = [];
    let allPass = true;

    for (const test of tests) {
      try {
        const runCommand = `"${exeFile}" '${JSON.stringify(test.input)}'`;
        const { stdout } = await Promise.race([
          execAsync(runCommand, {
            maxBuffer: 1024 * 1024,
            timeout: 5000, // 5 seconds per test
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Execution timeout')), 5000)
          ),
        ]);

        const output = stdout.trim();
        let got;
        try {
          // Try to parse as JSON first (for bool/numbers)
          got = JSON.parse(output);
        } catch {
          // If not JSON, treat as string
          got = output;
        }

        // Normalize boolean strings
        if (got === 'true') got = true;
        if (got === 'false') got = false;

        const pass = JSON.stringify(got) === JSON.stringify(test.expected);
        results.push({
          name: test.name,
          pass,
          got,
          expected: test.expected,
        });

        if (!pass) allPass = false;
      } catch (runError) {
        results.push({
          name: test.name,
          pass: false,
          got: `Error: ${runError.message || String(runError)}`,
          expected: test.expected,
        });
        allPass = false;
      }
    }

    // Cleanup
    try {
      await unlink(cppFile);
      await unlink(exeFile);
    } catch (cleanupError) {
      console.warn('Cleanup warning:', cleanupError.message);
    }

    res.json({
      ok: allPass,
      logs: compileOutput ? [compileOutput] : [],
      results,
      error: null,
    });
  } catch (error) {
    // Cleanup on error
    try {
      await unlink(cppFile).catch(() => {});
      await unlink(exeFile).catch(() => {});
    } catch {}

    res.status(500).json({
      ok: false,
      error: `Server error: ${error.message || String(error)}`,
      logs: [],
      results: [],
    });
  }
});

/**
 * Wraps C++ Solution class code with a main function that runs tests
 */
function wrapCppCode(code, tests) {
  // Add missing includes if needed, then inject main function
  // User code should already have includes, but we need iostream, sstream, and string for parsing/IO
  
  const needsIostream = !code.includes('#include <iostream>') && !code.includes('#include<iostream>');
  const needsSstream = !code.includes('#include <sstream>') && !code.includes('#include<sstream>');
  const needsString = !code.includes('#include <string>') && !code.includes('#include<string>');

  let includes = '';
  if (needsIostream) includes += '#include <iostream>\n';
  if (needsSstream) includes += '#include <sstream>\n';
  if (needsString) includes += '#include <string>\n';

  return `${code}

${includes ? `// Auto-generated includes\n${includes}` : ''}
// Auto-generated main function to run tests
using namespace std;

// Helper to parse JSON array string like "[1,2,3]"
vector<int> parseArray(const string& jsonStr) {
  vector<int> result;
  string s = jsonStr;
  // Remove brackets
  if (!s.empty() && s.front() == '[') s = s.substr(1);
  if (!s.empty() && s.back() == ']') s.pop_back();
  
  if (s.empty()) return result;
  
  stringstream ss(s);
  string item;
  while (getline(ss, item, ',')) {
    // Remove whitespace
    item.erase(0, item.find_first_not_of(" \\t\\n\\r"));
    item.erase(item.find_last_not_of(" \\t\\n\\r") + 1);
    if (!item.empty()) {
      try {
        result.push_back(stoi(item));
      } catch (...) {
        // Skip invalid numbers
      }
    }
  }
  return result;
}

int main(int argc, char* argv[]) {
  if (argc < 2) {
    cerr << "Error: No input provided" << endl;
    return 1;
  }
  
  string inputJson = argv[1];
  vector<int> nums = parseArray(inputJson);
  
  Solution sol;
  bool result = sol.containsDuplicate(nums);
  
  // Output as JSON-compatible string
  cout << (result ? "true" : "false") << endl;
  return 0;
}`;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'C++ compilation server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 C++ compilation server running on http://localhost:${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`⚠️  Make sure g++ is installed: g++ --version`);
});
