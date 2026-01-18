import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { analyzeWithGemini, chatWithGemini } from '../utils/gemini';
import { speakText, stopSpeech } from '../utils/elevenlabs';

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
      return 'border-slate-700/50 bg-slate-800/30 text-slate-200';
  }
}

// Helper function to get hints from problem JSON or fallback to defaults
function getHintsForProblem(problem) {
  if (!problem) return [];
  
  // Use hints from JSON if available
  if (problem.hints && Array.isArray(problem.hints) && problem.hints.length > 0) {
    return problem.hints;
  }
  
  // Fallback to default hints if JSON doesn't have hints
  const id = problem.id || '';
  const hints = [];
  
  if (id.includes('palindrome')) {
    hints.push(
      'A palindrome reads the same forwards and backwards. Check if characters match from both ends.',
      'Expand around centers approach: each character (or pair) can be the center of a palindrome.',
      'For each position, expand left and right while characters match. Keep track of the longest palindrome found.',
      'There are O(n²) possible centers, and checking each takes O(n) time, giving O(n²) total.'
    );
  } else if (id.includes('container') || id.includes('water')) {
    hints.push(
      'The area is width × min(height[i], height[j]). Start with maximum width.',
      'Use two pointers: one at the start and one at the end of the array.',
      'Move the pointer with the smaller height towards the center, because that\'s the only way to potentially get a larger area.',
      'This gives O(n) time complexity since each element is visited at most once.'
    );
  } else {
    // Generic hints
    hints.push(
      'Start by understanding what the problem is asking. What are the inputs and expected outputs?',
      'Think about edge cases: empty inputs, single elements, maximum values, etc.',
      'Consider different approaches: brute force, sorting, hash tables, two pointers, etc.',
      'What\'s the time and space complexity of your approach? Can you optimize it?'
    );
  }
  
  return hints;
}

// Component for Solution hints
function SolutionHints({ problem, language, currentHintIndex, setCurrentHintIndex, solutionRevealed, setSolutionRevealed }) {
  if (!problem) return null;
  
  const hints = getHintsForProblem(problem);
  const hasMoreHints = currentHintIndex < hints.length - 1;
  
  // Get solution code based on language - use JSON if available
  const getSolutionCode = () => {
    // Use solution from JSON if available
    if (problem.solution) {
      const langKey = language === 'JavaScript' ? 'javascript' : 'cpp';
      if (problem.solution[langKey]) {
        return problem.solution[langKey];
      }
    }
    
    // Fallback to default message if no solution in JSON
    return '// Solution code not yet available for this problem';
  };
  
  return (
    <div className="space-y-4 text-sm text-slate-300">
      <div className="text-slate-200 mb-4">
        <h3 className="text-lg font-semibold mb-2">Step-by-Step Hints</h3>
        <p className="text-slate-400 text-xs">
          Reveal hints one at a time to guide your thinking. Try solving it yourself first!
        </p>
      </div>
      
      {/* Show revealed hints */}
      {currentHintIndex >= 0 && (
        <div className="space-y-3">
          {hints.slice(0, currentHintIndex + 1).map((hint, idx) => (
            <div
              key={idx}
              className="rounded-md border border-purple-500/30 bg-purple-500/10 p-4 text-slate-200"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-semibold">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm leading-relaxed">{hint}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Show next hint button */}
      {hasMoreHints && !solutionRevealed && (
        <button
          onClick={() => setCurrentHintIndex(prev => prev + 1)}
          className="w-full px-4 py-3 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-400 hover:bg-purple-500/20 hover:border-purple-500/50 transition-all font-semibold"
        >
          {currentHintIndex === -1 ? 'Show First Hint' : `Show Hint ${currentHintIndex + 2}`}
        </button>
      )}
      
      {/* Show solution button */}
      {!solutionRevealed && (
        <button
          onClick={() => setSolutionRevealed(true)}
          className="w-full px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 transition-all font-semibold"
        >
          Show Complete Solution
        </button>
      )}
      
      {/* Revealed solution */}
      {solutionRevealed && (
        <div className="space-y-3 mt-4">
          <div className="text-amber-400 font-semibold text-base border-b border-amber-500/30 pb-2">
            Complete Solution
          </div>
          <pre className="rounded-md border border-slate-700/50 bg-slate-900/60 p-4 font-mono text-xs text-slate-200 overflow-x-auto">
            <code>{getSolutionCode()}</code>
          </pre>
          <div className="text-xs text-slate-400 italic">
            Remember: Understanding the approach is more valuable than memorizing the code!
          </div>
        </div>
      )}
    </div>
  );
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const problemId = searchParams.get('problem') || 'contains-duplicate';
  
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Question');
  const [language, setLanguage] = useState('JavaScript');
  const [code, setCode] = useState('');
  const [transcript, setTranscript] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]); // Keep full conversation context
  const conversationHistoryRef = useRef([]); // Ref to always have latest history
  const [isListening, setIsListening] = useState(false);
  const [inCodingPhase, setInCodingPhase] = useState(false); // Track if mic stopped due to optimal approach
  const [runState, setRunState] = useState({ status: 'idle', output: null });
  const [coach, setCoach] = useState({ level: 'neutral', title: 'Thinking…', message: 'Share your thoughts and I\'ll guide you!', progress: 0 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatMessages, setChatMessages] = useState([]); // Chat history
  const [chatInput, setChatInput] = useState(''); // Current chat input
  const [isChatting, setIsChatting] = useState(false); // Track if chat AI is responding
  const [isCoachTextBlurred, setIsCoachTextBlurred] = useState(false); // Track if coach text is blurred
  const [currentHintIndex, setCurrentHintIndex] = useState(-1); // Track which hint is shown (-1 = none)
  const [solutionRevealed, setSolutionRevealed] = useState(false); // Track if solution is revealed
  const recognitionRef = useRef(null);
  const lastAnalyzedRef = useRef({ transcript: '', code: '' });
  const lastSpokenRef = useRef('');
  const debounceTimerRef = useRef(null);
  const isInitialMountRef = useRef(true);
  const currentAnalysisRef = useRef(null); // Track ongoing analysis to prevent race conditions
  const isPausedForTTSRef = useRef(false); // Track if recognition is paused for TTS
  const currentAudioRef = useRef(null); // Track current audio element to stop it if needed
  const isTTSPlayingRef = useRef(false); // Track if TTS is currently playing

  // Load problem from JSON file
  useEffect(() => {
    const loadProblem = async () => {
      try {
        setLoading(true);
        // Use dynamic import for Vite - note: this requires the file to exist
        const problemModule = await import(`../problems/${problemId}.json`);
        const problemData = problemModule.default || problemModule;
        setProblem(problemData);
        setCode(problemData.jsStarter);
      } catch (error) {
        console.error('Error loading problem:', error);
        // Fallback: redirect to list if problem not found
        navigate('/list');
      } finally {
        setLoading(false);
      }
    };

    loadProblem();
  }, [problemId, navigate]);

  // Update code when language changes
  useEffect(() => {
    if (!problem) return;
    if (language === 'JavaScript') {
      setCode(problem.jsStarter);
    } else if (language === 'C++') {
      setCode(problem.cppStarter);
    }
  }, [language, problem]);

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
          problemTitle: problem?.title || '',
          problemPrompt: problem?.prompt || '',
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

            // Unlock coding phase if optimal approach detected OR progress is high (>= 60)
            const hasOptimalApproach = response.shouldStopMic || (response.progress !== undefined && response.progress >= 60);
            
            // Debug logging
            console.log('Unlock check:', {
              shouldStopMic: response.shouldStopMic,
              progress: response.progress,
              hasOptimalApproach,
              inCodingPhase,
              message: response.message?.substring(0, 50)
            });
            
            // Track if we're unlocking to speak the unlock message instead
            let isUnlocking = false;
            if (hasOptimalApproach && !inCodingPhase) {
              console.log('Unlocking coding phase!');
              isUnlocking = true;
              setInCodingPhase(true);
              // Stop mic if it's currently listening
              if (isListening) {
                stopListening();
              }
              const unlockMessage = 'You have the optimal approach! Start implementing. I\'ll watch your code and help if needed.';
              setCoach(prevCoach => ({
                ...response,
                title: 'Ready to Code!',
                message: unlockMessage,
                progress: response.progress !== undefined ? response.progress : (prevCoach.progress || 0),
              }));
            }

            // Speak the response using Inworld API (or browser fallback)
            // Only speak if it's a new, meaningful message
            // If unlocking, speak the unlock message; otherwise speak the response
            const messageToSpeak = isUnlocking 
              ? 'You have the optimal approach! Start implementing. I\'ll watch your code and help if needed.'
              : response.message;
              
            if (messageToSpeak && messageToSpeak !== lastSpokenRef.current &&
                messageToSpeak.length > 10) {
              lastSpokenRef.current = messageToSpeak;
              
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
              
              speakText(messageToSpeak, {
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
          setCoach(prevCoach => ({
            level: 'neutral',
            title: 'Error',
            message: 'Could not analyze. Try again.',
            progress: prevCoach.progress || 0,
          }));
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
      if (!problem || code === problem.jsStarter || code === problem.cppStarter) {
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
          problemTitle: problem?.title || '',
          problemPrompt: problem?.prompt || '',
        });

        if (currentAnalysisRef.current === analysisId && response.message) {
          // Update progress bar based on code analysis (but don't speak)
          // Don't override progress if tests already passed (keep at 100%)
          setCoach(prevCoach => ({
            level: response.level,
            title: response.title,
            message: response.message,
            progress: prevCoach.progress >= 100 ? 100 : (response.progress || prevCoach.progress || 0),
          }));
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
        problemTitle: problem?.title || '',
      });

      // Include code suggestion in message if provided
      let messageContent = response.message;
      if (response.suggestedCode) {
        // Add code suggestion to message as a code block
        messageContent += `\n\n\`\`\`${language === 'C++' ? 'cpp' : 'javascript'}\n${response.suggestedCode}\n\`\`\``;
      }
      
      setChatMessages(prev => [...prev, { role: 'assistant', content: messageContent }]);
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I couldn\'t process your question. Please try again.' }]);
    } finally {
      setIsChatting(false);
    }
  };


  const run = async () => {
    setRunState({ status: 'running', output: null });

    if (!problem) return;
    
    let output;
    if (language === 'JavaScript') {
      output = runJavaScriptSolution(code, problem.tests);
      setRunState({ status: 'done', output });
    } else if (language === 'C++') {
      output = await runCppSolution(code, problem.tests);
      setRunState({ status: 'done', output });
    } else {
      output = {
        ok: false,
        error: `${language} runtime not connected yet.`,
        logs: [],
        results: [],
      };
      setRunState({ status: 'done', output });
    }

    // Update progress based on test results
    // Only set to 100% if all tests pass
    if (output?.ok === true && output?.results?.every(r => r.pass === true)) {
      setCoach(prevCoach => ({
        ...prevCoach,
        level: 'good',
        title: 'Solution Complete!',
        message: 'All tests passed! Great job solving this problem.',
        progress: 100,
      }));
    } else if (output?.results && output.results.length > 0) {
      // Calculate progress based on passing tests
      const passedTests = output.results.filter(r => r.pass === true).length;
      const totalTests = output.results.length;
      const testProgress = Math.round((passedTests / totalTests) * 85); // Max 85% from tests, 100% only when all pass
      
      // Update progress if it's higher than current, but don't go below current
      setCoach(prevCoach => ({
        ...prevCoach,
        progress: Math.max(prevCoach.progress || 0, testProgress),
      }));
    }
  };

  const topBarClass = `border ${levelStyles(coach.level)} rounded-lg`;

  if (loading || !problem) {
    return (
      <div className="min-h-screen w-full bg-gray-900 text-slate-200 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-slate-400 mb-2">Loading problem...</div>
          <div className="h-2 w-64 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 animate-pulse" style={{ width: '60%' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-900 text-slate-200">
      {/* Navbar with back button */}
      <nav className="w-full h-16 flex items-center border-b border-white/10 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50 px-6 md:px-8">
        <button 
          onClick={() => navigate('/list')}
          className="mr-4 text-slate-400 hover:text-white transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">Back to Problems</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br rounded-md flex items-center justify-center">
            <img src="Transparent_Logo.png" alt="LeetSpeak Logo" className="h-8 w-auto object-contain" />
          </div>
          <span className="text-xl font-bold text-white">Leet<span className="text-purple-400">Speak</span></span>
        </div>
      </nav>
      <div className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-[1600px] flex-col gap-3 p-3">
        {/* AI Coach Bar */}
        <div className={topBarClass}>
          <div className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className={`min-w-0 transition-all duration-200 ${isCoachTextBlurred ? 'blur-sm select-none' : ''}`}>
              <div className="text-sm font-semibold tracking-wide text-white">{coach.title}</div>
              <div className="text-sm text-slate-200/90">{coach.message}</div>
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
                    className="rounded-md border border-slate-700/50 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/70"
                  >
                    Start mic
                  </button>
                )
              ) : (
                <div className="text-xs text-slate-400">
                  Mic not supported. Try Chrome, Edge, or Safari.
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsCoachTextBlurred(!isCoachTextBlurred)}
                className="rounded-md border border-slate-700/50 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/70"
                title={isCoachTextBlurred ? 'Show thinking text' : 'Hide thinking text'}
              >
                {isCoachTextBlurred ? '👁️' : '🙈'}
              </button>
              {isAnalyzing && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-purple-400"></div>
                  <span>Analyzing…</span>
                </div>
              )}
            </div>
          </div>
          <div className="border-t border-slate-700/50 px-4 py-3">
            {/* Progress bar showing if user is on the right track */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Progress to Solution</span>
                <span className={coach.progress >= 95 ? 'text-emerald-300' : coach.progress >= 60 ? 'text-amber-300' : 'text-slate-400'}>
                  {coach.progress >= 95 ? 'Almost Complete!' : coach.progress >= 60 ? 'Making Progress' : coach.progress >= 20 ? 'Getting Started' : 'Just Starting'}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900/50">
                <div
                  className={`h-full transition-all duration-500 ${
                    coach.progress >= 95
                      ? 'bg-emerald-500'
                      : coach.progress >= 60
                      ? 'bg-amber-500'
                      : 'bg-purple-500'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(0, coach.progress || 0))}%`,
                  }}
                />
              </div>
              {isListening && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400"></div>
                  <span>Listening…</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Split view */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
          {/* Left: Problem */}
          <div className="min-h-0 overflow-hidden rounded-lg border border-slate-700/50 bg-slate-800/30">
            <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold text-white">{problem.title}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-200">
                    {problem.difficulty}
                  </span>
                </div>
              </div>
              <div className="flex gap-1 rounded-md border border-slate-700/50 bg-slate-800/50 p-1 text-sm">
                {['Question', 'Solution', 'Chat'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setActiveTab(t)}
                    className={[
                      'rounded-md px-3 py-1.5',
                      activeTab === t ? 'bg-slate-900/80 text-white' : 'text-slate-300 hover:bg-slate-800/70',
                    ].join(' ')}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 overflow-auto p-4">
              {activeTab === 'Question' ? (
                <div className="space-y-4 text-sm leading-6 text-slate-200">
                  <p className="text-slate-200">{problem.prompt}</p>

                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Examples
                    </div>
                    <div className="space-y-3">
                      {problem.examples.map((ex, idx) => (
                        <div
                          key={idx}
                          className="rounded-md border border-slate-700/50 bg-slate-900/40 p-3"
                        >
                          <div className="font-mono text-slate-200">
                            <div>
                              <span className="text-slate-500">Input:</span> {ex.input}
                            </div>
                            <div>
                              <span className="text-slate-500">Output:</span> {ex.output}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Constraints
                    </div>
                    <ul className="list-inside list-disc text-slate-300">
                      {problem.constraints.map((c) => (
                        <li key={c} className="font-mono text-xs">
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : activeTab === 'Solution' ? (
                <SolutionHints 
                  problem={problem}
                  language={language}
                  currentHintIndex={currentHintIndex}
                  setCurrentHintIndex={setCurrentHintIndex}
                  solutionRevealed={solutionRevealed}
                  setSolutionRevealed={setSolutionRevealed}
                />
              ) : activeTab === 'Chat' ? (
                <div className="flex h-[calc(100vh-400px)] flex-col">
                  <div className="flex-1 overflow-y-auto space-y-3 pb-4">
                    {chatMessages.length === 0 ? (
                      <div className="text-sm text-slate-400 italic">
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
                                ? 'bg-slate-800/50 text-slate-200' 
                                : 'bg-slate-800/30 text-slate-300'
                            }`}
                          >
                            <div className="mb-1 text-xs font-semibold text-slate-400">
                              {msg.role === 'user' ? 'You' : 'AI Coach'}
                            </div>
                            <div className="space-y-2 text-sm">
                              {parts.map((part, partIdx) => {
                                if (part.type === 'code') {
                                  return (
                                    <pre
                                      key={partIdx}
                                      className="overflow-x-auto rounded-md border border-slate-700/50 bg-slate-900/60 p-3 font-mono text-xs text-slate-200"
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
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <div className="h-2 w-2 animate-pulse rounded-full bg-purple-400"></div>
                        <span>Thinking…</span>
                      </div>
                    )}
                  </div>
                  <form onSubmit={handleChatSubmit} className="border-t border-slate-700/50 pt-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Ask a question..."
                        className="flex-1 rounded-md border border-slate-700/50 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                        disabled={isChatting}
                      />
                      <button
                        type="submit"
                        disabled={!chatInput.trim() || isChatting}
                        className="rounded-md bg-slate-800/70 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700/70 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Send
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}
            </div>
          </div>

          {/* Right: Editor + Console */}
          <div className="min-h-0 overflow-hidden rounded-lg border border-slate-700/50 bg-slate-800/30">
            <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="rounded-md border border-slate-700/50 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option>JavaScript</option>
                  <option>Python</option>
                  <option>C++</option>
                </select>
                <div className="text-xs text-slate-400">
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
                      if (language === 'JavaScript') setCode(problem.jsStarter);
                      else if (language === 'C++') setCode(problem.cppStarter);
                    }
                  }}
                  disabled={!inCodingPhase}
                  className="rounded-md border border-slate-700/50 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/70 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm">
                    <div className="text-center space-y-3 px-6">
                      <div className="text-lg font-semibold text-slate-200">
                        Voice Phase Active
                      </div>
                      <div className="text-sm text-slate-400 max-w-md">
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

              <div className="min-h-0 border-t border-slate-700/50 bg-slate-900/40">
                <div className="flex items-center justify-between px-4 py-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Console
                  </div>
                  {runState.output?.ok === true ? (
                    <div className="text-xs text-emerald-300">All tests passed</div>
                  ) : runState.output?.ok === false ? (
                    <div className="text-xs text-amber-300">Some tests failed</div>
                  ) : (
                    <div className="text-xs text-slate-500">—</div>
                  )}
                </div>
                <div className="h-[calc(220px-40px)] overflow-auto px-4 pb-4 font-mono text-xs text-slate-200">
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
                              <span className="text-slate-300">{r.name}</span>
                              <span className="text-slate-500">got</span>
                              <span className="text-slate-200">{safeStringify(r.got)}</span>
                              <span className="text-slate-500">expected</span>
                              <span className="text-slate-200">{safeStringify(r.expected)}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {runState.output.logs?.length ? (
                        <div className="rounded-md border border-slate-700/50 bg-slate-900/40 p-2">
                          <div className="mb-1 text-slate-400">logs:</div>
                          {runState.output.logs.map((l, idx) => (
                            <div key={idx} className="text-slate-300">
                              {l}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {!runState.output.error &&
                      !runState.output.results?.length &&
                      !runState.output.logs?.length ? (
                        <div className="text-slate-500">No output.</div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="px-0 py-2 text-slate-500">
                      Click <span className="text-slate-300">Run</span> to execute tests.
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

