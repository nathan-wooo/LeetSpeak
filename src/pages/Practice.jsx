import React, { useMemo, useRef, useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { analyzeWithGemini, chatWithGemini } from '../utils/gemini';
import { speakText, stopSpeech } from '../utils/inworld';

const PROBLEM = {
  id: 'contains-duplicate',
  title: 'Contains Duplicate',
  difficulty: 'Easy',
  prompt:
    'Given an integer array nums, return true if any value appears more than once in the array, otherwise return false.',
  examples: [
    { input: 'nums = [1, 2, 3, 3]', output: 'true' },
    { input: 'nums = [1, 2, 3, 4]', output: 'false' },
  ],
  constraints: ['1 <= nums.length <= 10^5', '-10^9 <= nums[i] <= 10^9'],
  jsStarter: `/**
 * Contains Duplicate
 * @param {number[]} nums
 * @return {boolean}
 */
function containsDuplicate(nums) {
  // Talk through your approach out loud like an interview.
  // Tip: A Set is a great fit here.
}
`,
  cppStarter: `#include <vector>
#include <unordered_set>
using namespace std;

class Solution {
public:
    bool containsDuplicate(vector<int>& nums) {
        // Talk through your approach out loud like an interview.
        // Tip: A set/hash table is a great fit here.
    }
};`,
  tests: [
    { name: 'Example 1', input: [1, 2, 3, 3], expected: true },
    { name: 'Example 2', input: [1, 2, 3, 4], expected: false },
    { name: 'Edge', input: [], expected: false },
    { name: 'Negatives', input: [-1, -1], expected: true },
  ],
};

function analyze({ transcript, code }) {
  const t = (transcript || '').toLowerCase();
  const c = code || '';

  const usesSet =
    /new\s+Set\s*\(/.test(c) || /\bSet\s*\(/.test(c) || /has\(/.test(c);
  const looksBruteforce =
    (c.match(/\bfor\b/g) || []).length >= 2 || /\bnested\b/.test(t);
  const mentionsSet = /\bset\b/.test(t) || /\bhash\b/.test(t) || /\bmap\b/.test(t);

  if (usesSet || mentionsSet) {
    return {
      level: 'good',
      title: 'On track',
      message: 'Using a hash/set approach should get you O(n) time.',
    };
  }

  if (looksBruteforce || /\bbrute\b/.test(t) || /\bo\(n\^2\)\b/.test(t)) {
    return {
      level: 'warn',
      title: 'Careful',
      message: 'Brute force may be too slow. Can you track seen values with a Set?',
    };
  }

  return {
    level: 'neutral',
    title: 'Listening…',
    message: 'Explain your plan (time/space) and I’ll nudge you if needed.',
  };
}

function levelStyles(level) {
  switch (level) {
    case 'good':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    case 'warn':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
    default:
      return 'border-zinc-700 bg-zinc-900/60 text-zinc-200';
  }
}

function safeStringify(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function runJavaScriptSolution(code, tests) {
  const logs = [];
  const fakeConsole = {
    log: (...args) => logs.push(args.map(safeStringify).join(' ')),
    error: (...args) => logs.push(['[error] ', ...args.map(safeStringify)].join('')),
  };

  // Evaluate user code and extract a function named `containsDuplicate`.
  // Note: This is intentionally simple for an MVP. We'll sandbox further later.
  let fn;
  try {
    // eslint-disable-next-line no-new-func
    const getFn = new Function(
      'console',
      `${code}\n\nreturn (typeof containsDuplicate === "function") ? containsDuplicate : null;`,
    );
    fn = getFn(fakeConsole);
  } catch (e) {
    return {
      ok: false,
      logs,
      results: [],
      error: `Parse/runtime error while loading your code: ${e?.message || String(e)}`,
    };
  }

  if (!fn) {
    return {
      ok: false,
      logs,
      results: [],
      error: 'Expected a function named `containsDuplicate(nums)`.',
    };
  }

  const results = [];
  let allPass = true;

  for (const t of tests) {
    try {
      const got = fn(t.input);
      const pass = Object.is(got, t.expected);
      results.push({ name: t.name, pass, got, expected: t.expected });
      if (!pass) allPass = false;
    } catch (e) {
      results.push({
        name: t.name,
        pass: false,
        got: `Error: ${e?.message || String(e)}`,
        expected: t.expected,
      });
      allPass = false;
    }
  }

  return { ok: allPass, logs, results, error: null };
}

async function runCppSolution(code, tests) {
  // Call the backend C++ compilation server
  // Make sure the server is running on http://localhost:3001
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  
  try {
    const response = await fetch(`${API_URL}/api/compile-cpp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, tests }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Server error' }));
      return {
        ok: false,
        logs: [],
        results: [],
        error: `Server error (${response.status}): ${errorData.error || response.statusText}`,
      };
    }

    const result = await response.json();
    return result;
  } catch (e) {
    // Network error - server might not be running
    if (e.message?.includes('fetch') || e.message?.includes('Network')) {
      return {
        ok: false,
        logs: [],
        results: [],
        error: 'Cannot connect to C++ compilation server. Make sure the backend server is running on http://localhost:3001. Run: cd server && npm install && npm start',
      };
    }
    
    return {
      ok: false,
      logs: [],
      results: [],
      error: `C++ execution error: ${e?.message || String(e)}`,
    };
  }
}

export default function Practice() {
  const [activeTab, setActiveTab] = useState('Question');
  const [language, setLanguage] = useState('JavaScript');
  const [code, setCode] = useState(PROBLEM.jsStarter);
  const [transcript, setTranscript] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]); // Keep full conversation context
  const conversationHistoryRef = useRef([]); // Ref to always have latest history
  const [isListening, setIsListening] = useState(false);
  const [inCodingPhase, setInCodingPhase] = useState(false); // Track if mic stopped due to optimal approach
  const [runState, setRunState] = useState({ status: 'idle', output: null });
  const [coach, setCoach] = useState({ level: 'neutral', title: 'Thinking…', message: 'Share your thoughts and I\'ll guide you!' });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatMessages, setChatMessages] = useState([]); // Chat history
  const [chatInput, setChatInput] = useState(''); // Current chat input
  const [isChatting, setIsChatting] = useState(false); // Track if chat AI is responding
  const [pendingCodeSuggestion, setPendingCodeSuggestion] = useState(null); // Code suggestion from chat
  const [isCoachTextBlurred, setIsCoachTextBlurred] = useState(false); // Track if coach text is blurred
  const recognitionRef = useRef(null);
  const lastAnalyzedRef = useRef({ transcript: '', code: '' });
  const lastSpokenRef = useRef('');
  const debounceTimerRef = useRef(null);
  const isInitialMountRef = useRef(true);
  const currentAnalysisRef = useRef(null); // Track ongoing analysis to prevent race conditions
  const isPausedForTTSRef = useRef(false); // Track if recognition is paused for TTS
  const currentAudioRef = useRef(null); // Track current audio element to stop it if needed
  const isTTSPlayingRef = useRef(false); // Track if TTS is currently playing

  // Update code when language changes
  useEffect(() => {
    if (language === 'JavaScript') {
      setCode(PROBLEM.jsStarter);
    } else if (language === 'C++') {
      setCode(PROBLEM.cppStarter);
    }
  }, [language]);

  // Debounced analysis with Gemini API - ONLY when transcript changes (not code)
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastAnalyzedRef.current = { transcript, code };
      return;
    }

    // Only analyze when transcript changes (user speaks/types thoughts)
    // Don't analyze on code changes
    if (transcript === lastAnalyzedRef.current.transcript) {
      return;
    }

    // Only analyze if there's actual transcript input
    if (!transcript.trim()) {
      return;
    }

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce analysis - wait 1.5 seconds after user stops speaking/typing
    debounceTimerRef.current = setTimeout(async () => {
      // Build conversation history inside the callback to get latest state
      // Use ref to always get the most current history
      const currentHistory = [...conversationHistoryRef.current];
      const previousTranscript = lastAnalyzedRef.current.transcript || '';
      
      // If transcript changed (user added more), extract the new part and add to history
      let newHistory = currentHistory;
      if (transcript.trim() && transcript !== previousTranscript) {
        if (transcript.startsWith(previousTranscript)) {
          // User added more to the transcript - extract new segment
          const newSegment = transcript.slice(previousTranscript.length).trim();
          if (newSegment) {
            newHistory = [...currentHistory, newSegment];
          }
        } else if (transcript.trim().length > previousTranscript.trim().length) {
          // Transcript changed completely but is longer - might be speech recognition reset
          // For now, treat the whole new transcript as a new message
          // (in practice, speech recognition accumulates, so this handles edge cases)
          newHistory = [...currentHistory, transcript.trim()];
        } else {
          // Transcript is completely different (shorter or unrelated) - treat as new segment
          newHistory = [...currentHistory, transcript.trim()];
        }
      }
      // Cancel any ongoing analysis
      if (currentAnalysisRef.current) {
        const analysisId = Date.now();
        currentAnalysisRef.current = analysisId;
      } else {
        currentAnalysisRef.current = Date.now();
      }
      
      const analysisId = currentAnalysisRef.current;
      setIsAnalyzing(true);
      
      try {
        const response = await analyzeWithGemini({
          transcript,
          conversationHistory: newHistory, // Send full conversation context
          code, // Still send code for context, but don't trigger on code changes
          problemTitle: PROBLEM.title,
          problemPrompt: PROBLEM.prompt,
        });

        // Only update if this is still the latest analysis request
        if (currentAnalysisRef.current === analysisId) {
          // Ensure we have a complete message before updating
          if (response.message && response.message.trim()) {
            setCoach(response);
            lastAnalyzedRef.current = { transcript, code };
            // Update conversation history (keep last 10 messages for context)
            const trimmedHistory = newHistory.slice(-10);
            setConversationHistory(trimmedHistory);
            conversationHistoryRef.current = trimmedHistory; // Keep ref in sync

            // Auto-stop mic if optimal approach detected
            if (response.shouldStopMic && isListening) {
              setInCodingPhase(true);
              stopListening();
              setCoach({
                ...response,
                title: 'Ready to Code!',
                message: 'You have the optimal approach! Start implementing. I\'ll watch your code and help if needed.',
              });
            }

            // Speak the response using Inworld API (or browser fallback)
            // Only speak if it's a new, meaningful message
            if (response.message !== lastSpokenRef.current &&
                response.message.length > 10) {
              lastSpokenRef.current = response.message;
              
              // Stop any ongoing TTS first (both Inworld and browser TTS)
              if (isTTSPlayingRef.current) {
                try {
                  if (currentAudioRef.current) {
                    currentAudioRef.current.pause();
                    currentAudioRef.current = null;
                  }
                  // Also stop browser TTS if any
                  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                  }
                } catch (e) {
                  // Ignore errors
                }
              }
              
              // Stop speech recognition BEFORE starting TTS (not after)
              const wasListening = isListening && !isPausedForTTSRef.current;
              if (wasListening && recognitionRef.current) {
                isPausedForTTSRef.current = true;
                try {
                  recognitionRef.current.stop();
                } catch (e) {
                  // Ignore errors
                }
              }
              
              isTTSPlayingRef.current = true;
              
              speakText(response.message, {
                onStart: () => {
                  // Mic is already stopped, just ensure flag is set
                  isPausedForTTSRef.current = true;
                },
                onEnd: () => {
                  isTTSPlayingRef.current = false;
                  currentAudioRef.current = null;
                  
                  // Wait longer before resuming mic (prevent feedback loop)
                  setTimeout(() => {
                    if (wasListening && isListening && !isTTSPlayingRef.current) {
                      isPausedForTTSRef.current = false;
                      if (recognitionRef.current) {
                        try {
                          recognitionRef.current.start();
                        } catch (e) {
                          if (isListening) {
                            startListening();
                          }
                        }
                      } else if (isListening) {
                        startListening();
                      }
                    } else {
                      isPausedForTTSRef.current = false;
                    }
                  }, 800); // Increased cooldown to 800ms to prevent feedback
                },
              }).catch(err => {
                console.warn('Speech synthesis error:', err);
                isTTSPlayingRef.current = false;
                isPausedForTTSRef.current = false;
                currentAudioRef.current = null;
              });
            }
          }
        }
      } catch (error) {
        if (currentAnalysisRef.current === analysisId) {
          console.error('Analysis error:', error);
          setCoach({
            level: 'neutral',
            title: 'Error',
            message: 'Could not analyze. Try again.',
          });
        }
      } finally {
        if (currentAnalysisRef.current === analysisId) {
          setIsAnalyzing(false);
          currentAnalysisRef.current = null;
        }
      }
    }, 1500); // 1.5 second debounce

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [transcript]); // Only depend on transcript, not code

  // Monitor code during coding phase (after mic stops)
  const codeAnalysisTimerRef = useRef(null);
  useEffect(() => {
    // Only monitor code if in coding phase (mic stopped due to optimal approach)
    if (!inCodingPhase) {
      return;
    }

    // Clear previous timer
    if (codeAnalysisTimerRef.current) {
      clearTimeout(codeAnalysisTimerRef.current);
    }

    // Debounce code analysis - analyze every 3 seconds while coding
    codeAnalysisTimerRef.current = setTimeout(async () => {
      // Skip if code hasn't changed meaningfully
      if (code === lastAnalyzedRef.current.code) {
        return;
      }

      // Skip if it's just starter code
      if (code === PROBLEM.jsStarter || code === PROBLEM.cppStarter) {
        return;
      }

      const analysisId = Date.now();
      currentAnalysisRef.current = analysisId;
      setIsAnalyzing(true);

      try {
        const response = await analyzeWithGemini({
          transcript: 'Analyzing code progress...', // Silent analysis during coding
          conversationHistory: conversationHistoryRef.current,
          code,
          problemTitle: PROBLEM.title,
          problemPrompt: PROBLEM.prompt,
        });

        if (currentAnalysisRef.current === analysisId && response.message) {
          // Update progress bar based on code analysis (but don't speak)
          setCoach({
            level: response.level,
            title: response.title,
            message: response.message,
          });
          lastAnalyzedRef.current.code = code;
        }
      } catch (error) {
        console.error('Code analysis error:', error);
      } finally {
        if (currentAnalysisRef.current === analysisId) {
          setIsAnalyzing(false);
          currentAnalysisRef.current = null;
        }
      }
    }, 3000); // Analyze code every 3 seconds during coding phase

    return () => {
      if (codeAnalysisTimerRef.current) {
        clearTimeout(codeAnalysisTimerRef.current);
      }
    };
  }, [code, inCodingPhase]); // Monitor code when in coding phase

  const canSpeech = useMemo(() => {
    if (typeof window === 'undefined') return false;
    
    // Check for Web Speech API support
    const hasWebSpeech = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    // Also check for MediaDevices API (required for mic access)
    const hasMediaDevices = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    
    return hasWebSpeech && hasMediaDevices;
  }, []);

  const startListening = () => {
    if (!canSpeech || isListening) return;
    
    // Stop any existing recognition first
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors when stopping
      }
    }
    
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let full = '';
      for (let i = 0; i < event.results.length; i++) {
        full += event.results[i][0].transcript;
      }
      setTranscript(full.trim());
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      // Handle specific errors
      switch (event.error) {
        case 'no-speech':
        case 'audio-capture':
          // These are non-fatal - user might start speaking, or mic might not be ready
          // Don't stop immediately, let it continue
          return;
        
        case 'not-allowed':
          alert('Microphone permission denied. Please allow microphone access in your browser settings and reload the page.');
          setIsListening(false);
          break;
        
        case 'aborted':
          // User or system aborted - this is expected when stopping
          if (!isListening) {
            return; // Already stopped intentionally
          }
          setIsListening(false);
          break;
        
        case 'network':
          console.error('Network error with speech recognition');
          setIsListening(false);
          break;
        
        case 'service-not-allowed':
          alert('Speech recognition service not available. Please try using Chrome, Edge, or Safari.');
          setIsListening(false);
          break;
        
        default:
          console.error('Unknown speech recognition error:', event.error);
          // For unknown errors, try to continue but log it
          // Only stop if it's a critical error
          if (event.error !== 'bad-grammar' && event.error !== 'language-not-supported') {
            setIsListening(false);
          }
      }
    };
    
    recognition.onend = () => {
      // If we're paused for TTS, don't auto-restart yet
      if (isPausedForTTSRef.current) {
        return; // onEnd callback from TTS will handle restart
      }
      
      // If we're still supposed to be listening, restart (for continuous mode)
      if (isListening && recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch (e) {
          // If restart fails, stop listening
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    recognition.onstart = () => {
      // Recognition started successfully
      console.log('Speech recognition started');
    };

    setIsListening(true);
    try {
      recognition.start();
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setIsListening(false);
      alert('Failed to start microphone. Make sure you have granted microphone permissions.');
    }
  };

  const stopListening = () => {
    const rec = recognitionRef.current;
    if (rec) rec.stop();
    recognitionRef.current = null;
    setIsListening(false);
  };

  // Handle chat submission
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatting) return;

    const question = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: question }]);
    setIsChatting(true);

    try {
      const response = await chatWithGemini({
        question,
        code,
        language,
        problemTitle: PROBLEM.title,
      });

      setChatMessages(prev => [...prev, { role: 'assistant', content: response.message }]);

      // If code suggestion provided, show it for user to accept/decline
      if (response.suggestedCode) {
        setPendingCodeSuggestion({
          code: response.suggestedCode,
          originalCode: code,
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I couldn\'t process your question. Please try again.' }]);
    } finally {
      setIsChatting(false);
    }
  };

  // Accept code suggestion
  const acceptCodeSuggestion = () => {
    if (!pendingCodeSuggestion) return;
    
    // Use current code state, not the original from suggestion
    const suggestion = pendingCodeSuggestion.code.trim();
    const current = code; // Use current code state
    
    // Clean up suggestion (remove markdown code fence markers if present)
    const cleanSuggestion = suggestion.replace(/^```\w*\n?/g, '').replace(/```\s*$/g, '').trim();
    
    if (language === 'C++') {
      // Check if it's an include statement
      if (cleanSuggestion.startsWith('#include')) {
        // For C++, add include at top if not already present
        if (!current.includes(cleanSuggestion)) {
          const lines = current.split('\n');
          const firstNonIncludeIdx = lines.findIndex(line => {
            const trimmed = line.trim();
            return trimmed && !trimmed.startsWith('#include') && !trimmed.startsWith('//');
          });
          if (firstNonIncludeIdx === -1) {
            // All lines are includes or comments, append at end
            setCode(current + '\n' + cleanSuggestion + '\n');
          } else {
            setCode([...lines.slice(0, firstNonIncludeIdx), cleanSuggestion, ...lines.slice(firstNonIncludeIdx)].join('\n'));
          }
        }
      } else {
        // For other C++ code, try to insert intelligently
        // If it looks like a variable declaration, insert after includes but before class/function
        const lines = current.split('\n');
        const classOrFunctionIdx = lines.findIndex(line => 
          line.trim().startsWith('class ') || 
          line.trim().startsWith('void ') ||
          line.trim().startsWith('int ') ||
          line.trim().startsWith('bool ')
        );
        if (classOrFunctionIdx > 0) {
          // Insert before class/function
          lines.splice(classOrFunctionIdx, 0, cleanSuggestion);
        } else {
          // Append at end
          lines.push(cleanSuggestion);
        }
        setCode(lines.join('\n'));
      }
    } else if (language === 'JavaScript') {
      // Check if it's an import/require
      if (cleanSuggestion.includes('import') || cleanSuggestion.includes('require')) {
        // For JS, add import at top if not already present
        if (!current.includes(cleanSuggestion)) {
          const lines = current.split('\n');
          const firstCodeIdx = lines.findIndex(line => {
            const trimmed = line.trim();
            return trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('import') && !trimmed.startsWith('const ') && !trimmed.startsWith('let ') && !trimmed.startsWith('var ');
          });
          if (firstCodeIdx === -1) {
            setCode(current + '\n' + cleanSuggestion + '\n');
          } else {
            setCode([...lines.slice(0, firstCodeIdx), cleanSuggestion, ...lines.slice(firstCodeIdx)].join('\n'));
          }
        }
      } else {
        // For other JS code, append or insert before function
        const lines = current.split('\n');
        const functionIdx = lines.findIndex(line => line.trim().startsWith('function ') || line.trim().match(/^(const|let|var)\s+\w+\s*=\s*(\(|async\s*\(|function)/));
        if (functionIdx > 0) {
          lines.splice(functionIdx, 0, cleanSuggestion);
        } else {
          lines.push(cleanSuggestion);
        }
        setCode(lines.join('\n'));
      }
    }
    
    setPendingCodeSuggestion(null);
  };

  // Decline code suggestion
  const declineCodeSuggestion = () => {
    setPendingCodeSuggestion(null);
  };

  const run = async () => {
    setRunState({ status: 'running', output: null });

    if (language === 'JavaScript') {
      const output = runJavaScriptSolution(code, PROBLEM.tests);
      setRunState({ status: 'done', output });
    } else if (language === 'C++') {
      const output = await runCppSolution(code, PROBLEM.tests);
      setRunState({ status: 'done', output });
    } else {
      setRunState({
        status: 'done',
        output: {
          ok: false,
          error: `${language} runtime not connected yet.`,
          logs: [],
          results: [],
        },
      });
    }
  };

  const topBarClass = `border ${levelStyles(coach.level)} rounded-lg`;

  return (
    <div className="min-h-screen w-full bg-black text-zinc-100">
      <div className="mx-auto flex h-screen w-full max-w-[1600px] flex-col gap-3 p-3">
        {/* AI Coach Bar */}
        <div className={topBarClass}>
          <div className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className={`min-w-0 transition-all duration-200 ${isCoachTextBlurred ? 'blur-sm select-none' : ''}`}>
              <div className="text-sm font-semibold tracking-wide">{coach.title}</div>
              <div className="text-sm text-zinc-200/90">{coach.message}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canSpeech ? (
                isListening ? (
                  <button
                    type="button"
                    onClick={stopListening}
                    className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 hover:bg-red-500/15"
                  >
                    Stop mic
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startListening}
                    className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
                  >
                    Start mic
                  </button>
                )
              ) : (
                <div className="text-xs text-zinc-400">
                  Mic not supported. Try Chrome, Edge, or Safari.
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsCoachTextBlurred(!isCoachTextBlurred)}
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
                title={isCoachTextBlurred ? 'Show thinking text' : 'Hide thinking text'}
              >
                {isCoachTextBlurred ? '👁️' : '🙈'}
              </button>
              {isAnalyzing && (
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-zinc-400"></div>
                  <span>Analyzing…</span>
                </div>
              )}
            </div>
          </div>
          <div className="border-t border-zinc-800 px-4 py-3">
            {/* Progress bar showing if user is on the right track */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Progress</span>
                <span className={coach.level === 'good' ? 'text-emerald-300' : coach.level === 'warn' ? 'text-amber-300' : 'text-zinc-400'}>
                  {coach.level === 'good' ? 'On Track ✓' : coach.level === 'warn' ? 'Needs Attention' : 'Thinking…'}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-900">
                <div
                  className={`h-full transition-all duration-500 ${
                    coach.level === 'good'
                      ? 'bg-emerald-500'
                      : coach.level === 'warn'
                      ? 'bg-amber-500'
                      : 'bg-zinc-600'
                  }`}
                  style={{
                    width: coach.level === 'good' ? '100%' : coach.level === 'warn' ? '60%' : '30%',
                  }}
                />
              </div>
              {isListening && (
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400"></div>
                  <span>Listening…</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Split view */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
          {/* Left: Problem */}
          <div className="min-h-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold">{PROBLEM.title}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
                  <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-200">
                    {PROBLEM.difficulty}
                  </span>
                  <span className="text-zinc-500">•</span>
                  <span className="text-zinc-400">NeetCode-style practice view</span>
                </div>
              </div>
              <div className="flex gap-1 rounded-md border border-zinc-800 bg-zinc-900 p-1 text-sm">
                {['Question', 'Solution', 'Submissions', 'Chat'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setActiveTab(t)}
                    className={[
                      'rounded-md px-3 py-1.5',
                      activeTab === t ? 'bg-zinc-950 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-800',
                    ].join(' ')}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 overflow-auto p-4">
              {activeTab === 'Question' ? (
                <div className="space-y-4 text-sm leading-6 text-zinc-200">
                  <p className="text-zinc-200">{PROBLEM.prompt}</p>

                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Examples
                    </div>
                    <div className="space-y-3">
                      {PROBLEM.examples.map((ex, idx) => (
                        <div
                          key={idx}
                          className="rounded-md border border-zinc-800 bg-black/40 p-3"
                        >
                          <div className="font-mono text-zinc-200">
                            <div>
                              <span className="text-zinc-500">Input:</span> {ex.input}
                            </div>
                            <div>
                              <span className="text-zinc-500">Output:</span> {ex.output}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Constraints
                    </div>
                    <ul className="list-inside list-disc text-zinc-300">
                      {PROBLEM.constraints.map((c) => (
                        <li key={c} className="font-mono text-xs">
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : activeTab === 'Solution' ? (
                <div className="space-y-3 text-sm text-zinc-300">
                  <div className="text-zinc-200">
                    Not shown yet — the goal is to coach you without giving the answer.
                  </div>
                  <div className="rounded-md border border-zinc-800 bg-black/40 p-3 text-xs text-zinc-400">
                    When we add a real AI model, we can gate "Solution" behind a "show me after I try"
                    flow.
                  </div>
                </div>
              ) : activeTab === 'Chat' ? (
                <div className="flex h-[calc(100vh-400px)] flex-col">
                  <div className="flex-1 overflow-y-auto space-y-3 pb-4">
                    {chatMessages.length === 0 ? (
                      <div className="text-sm text-zinc-400 italic">
                        Ask quick questions like "how do I implement a hashmap?"
                      </div>
                    ) : (
                      chatMessages.map((msg, idx) => {
                        // Check if message contains code blocks (```language or ```)
                        const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
                        let parts = [];
                        let lastIndex = 0;
                        let match;

                        while ((match = codeBlockRegex.exec(msg.content)) !== null) {
                          // Add text before code block
                          if (match.index > lastIndex) {
                            parts.push({ type: 'text', content: msg.content.substring(lastIndex, match.index) });
                          }
                          // Add code block
                          parts.push({ type: 'code', content: match[2].trim(), language: match[1] || '' });
                          lastIndex = codeBlockRegex.lastIndex;
                        }
                        // Add remaining text
                        if (lastIndex < msg.content.length) {
                          parts.push({ type: 'text', content: msg.content.substring(lastIndex) });
                        }
                        // If no code blocks found, treat entire message as text
                        if (parts.length === 0) {
                          parts.push({ type: 'text', content: msg.content });
                        }

                        return (
                          <div
                            key={idx}
                            className={`rounded-md p-3 ${
                              msg.role === 'user' 
                                ? 'bg-zinc-800/50 text-zinc-200' 
                                : 'bg-zinc-900/50 text-zinc-300'
                            }`}
                          >
                            <div className="mb-1 text-xs font-semibold text-zinc-400">
                              {msg.role === 'user' ? 'You' : 'AI Coach'}
                            </div>
                            <div className="space-y-2 text-sm">
                              {parts.map((part, partIdx) => {
                                if (part.type === 'code') {
                                  return (
                                    <pre
                                      key={partIdx}
                                      className="overflow-x-auto rounded-md border border-zinc-700 bg-black/60 p-3 font-mono text-xs text-zinc-200"
                                    >
                                      <code>{part.content}</code>
                                    </pre>
                                  );
                                }
                                return (
                                  <div key={partIdx} className="whitespace-pre-wrap">
                                    {part.content}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                    {isChatting && (
                      <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <div className="h-2 w-2 animate-pulse rounded-full bg-zinc-400"></div>
                        <span>Thinking…</span>
                      </div>
                    )}
                    {pendingCodeSuggestion && (
                      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
                        <div className="mb-2 text-sm font-semibold text-emerald-200">Suggested code:</div>
                        <pre className="mb-3 overflow-x-auto rounded-md border border-zinc-700 bg-black/60 p-3 font-mono text-xs text-zinc-200">
                          <code>{pendingCodeSuggestion.code}</code>
                        </pre>
                        <div className="flex gap-2">
                          <button
                            onClick={acceptCodeSuggestion}
                            className="rounded-md bg-emerald-500/20 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-500/30"
                          >
                            Accept
                          </button>
                          <button
                            onClick={declineCodeSuggestion}
                            className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <form onSubmit={handleChatSubmit} className="border-t border-zinc-800 pt-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Ask a question..."
                        className="flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-600"
                        disabled={isChatting}
                      />
                      <button
                        type="submit"
                        disabled={!chatInput.trim() || isChatting}
                        className="rounded-md bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Send
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="space-y-3 text-sm text-zinc-300">
                  <div className="text-zinc-200">Submissions will be wired later.</div>
                  <div className="rounded-md border border-zinc-800 bg-black/40 p-3 text-xs text-zinc-400">
                    We'll store attempts locally first, then add auth + a backend.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Editor + Console */}
          <div className="min-h-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-600"
                >
                  <option>JavaScript</option>
                  <option>Python</option>
                  <option>C++</option>
                </select>
                <div className="text-xs text-zinc-400">
                  {language === 'JavaScript'
                    ? 'Runs in-browser'
                    : language === 'C++'
                    ? 'Backend required (see console)'
                    : 'Runtime not connected yet'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (inCodingPhase) {
                      if (language === 'JavaScript') setCode(PROBLEM.jsStarter);
                      else if (language === 'C++') setCode(PROBLEM.cppStarter);
                    }
                  }}
                  disabled={!inCodingPhase}
                  className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={run}
                  disabled={!inCodingPhase}
                  className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {runState.status === 'running' ? 'Running…' : 'Run'}
                </button>
              </div>
            </div>

            <div className="grid min-h-0 h-full grid-rows-[1fr_220px]">
              <div className="min-h-0 overflow-hidden relative">
                {!inCodingPhase ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/95 backdrop-blur-sm">
                    <div className="text-center space-y-3 px-6">
                      <div className="text-lg font-semibold text-zinc-200">
                        Voice Phase Active
                      </div>
                      <div className="text-sm text-zinc-400 max-w-md">
                        Share your approach out loud using the microphone. The AI coach will guide you to the optimal solution. Once you reach the optimal approach, coding will be enabled.
                      </div>
                      {!isListening && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={startListening}
                            className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/15"
                          >
                            Start Mic to Begin
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
                <Editor
                  height="100%"
                  defaultLanguage={language === 'C++' ? 'cpp' : 'javascript'}
                  language={language === 'C++' ? 'cpp' : 'javascript'}
                  value={code}
                  onChange={(val) => {
                    // Only allow code changes if in coding phase
                    if (inCodingPhase) {
                      setCode(val || '');
                    }
                  }}
                  theme="vs-dark"
                  options={{
                    fontSize: 14,
                    tabSize: 2,
                    minimap: { enabled: false },
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    renderLineHighlight: 'all',
                    cursorStyle: 'line',
                    fontFamily: 'Monaco, Menlo, "Courier New", monospace',
                    padding: { top: 16, bottom: 16 },
                    readOnly: !inCodingPhase, // Disable editing when not in coding phase
                  }}
                />
              </div>

              <div className="min-h-0 border-t border-zinc-800 bg-black/40">
                <div className="flex items-center justify-between px-4 py-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Console
                  </div>
                  {runState.output?.ok === true ? (
                    <div className="text-xs text-emerald-300">All tests passed</div>
                  ) : runState.output?.ok === false ? (
                    <div className="text-xs text-amber-300">Some tests failed</div>
                  ) : (
                    <div className="text-xs text-zinc-500">—</div>
                  )}
                </div>
                <div className="h-[calc(220px-40px)] overflow-auto px-4 pb-4 font-mono text-xs text-zinc-200">
                  {runState.output ? (
                    <div className="space-y-2">
                      {runState.output.error ? (
                        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-red-200">
                          {runState.output.error}
                        </div>
                      ) : null}

                      {runState.output.results?.length ? (
                        <div className="space-y-1">
                          {runState.output.results.map((r) => (
                            <div key={r.name} className="flex flex-wrap items-center gap-2">
                              <span
                                className={[
                                  'rounded px-2 py-0.5',
                                  r.pass ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200',
                                ].join(' ')}
                              >
                                {r.pass ? 'PASS' : 'FAIL'}
                              </span>
                              <span className="text-zinc-300">{r.name}</span>
                              <span className="text-zinc-500">got</span>
                              <span className="text-zinc-200">{safeStringify(r.got)}</span>
                              <span className="text-zinc-500">expected</span>
                              <span className="text-zinc-200">{safeStringify(r.expected)}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {runState.output.logs?.length ? (
                        <div className="rounded-md border border-zinc-800 bg-black/40 p-2">
                          <div className="mb-1 text-zinc-400">logs:</div>
                          {runState.output.logs.map((l, idx) => (
                            <div key={idx} className="text-zinc-300">
                              {l}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {!runState.output.error &&
                      !runState.output.results?.length &&
                      !runState.output.logs?.length ? (
                        <div className="text-zinc-500">No output.</div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="px-0 py-2 text-zinc-500">
                      Click <span className="text-zinc-300">Run</span> to execute tests.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

