import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

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
app.post('/api/compile-cpp', async (req, res) => {
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
