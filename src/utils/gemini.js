/**
 * Google Gemini API integration for analyzing coding thought process
 * Provides hints and guidance without giving direct answers
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
// Use gemini-2.5-flash (fast, efficient) or gemini-2.5-pro (better quality)
// Available models: gemini-2.5-flash, gemini-2.5-pro, gemini-2.0-flash, gemini-flash-latest, gemini-pro-latest
const GEMINI_MODEL = 'gemini-2.5-flash'; // Fast and efficient for coaching hints
// Use v1beta API
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Analyze user's thought process and code to provide coaching hints
 * @param {Object} params
 * @param {string} params.transcript - User's current spoken/typed thought process
 * @param {string[]} params.conversationHistory - Full conversation history for context
 * @param {string} params.code - Current code they're writing
 * @param {string} params.problemTitle - Title of the problem
 * @param {string} params.problemPrompt - Problem description
 * @returns {Promise<{level: string, title: string, message: string}>}
 */
/**
 * Chat with AI coach for quick questions (like "how to implement hashmap")
 * @param {Object} params
 * @param {string} params.question - User's question
 * @param {string} params.code - Current code context
 * @param {string} params.language - Programming language (JavaScript/C++)
 * @param {string} params.problemTitle - Title of the problem
 * @returns {Promise<{message: string, suggestedCode?: string}>}
 */
export async function chatWithGemini({ question, code, language, problemTitle }) {
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const GEMINI_MODEL = 'gemini-2.5-flash';
  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  if (!GEMINI_API_KEY) {
    return {
      message: 'Gemini API key not configured. Please set VITE_GEMINI_API_KEY in your .env file.',
    };
  }

  const prompt = `You are a coding assistant helping with ${problemTitle}. The user is asking: "${question}"

Current code context:
\`\`\`${language === 'C++' ? 'cpp' : 'javascript'}
${code || '// No code yet'}
\`\`\`

IMPORTANT RULES:
- Provide a brief, helpful explanation (2-3 sentences max)
- If the question is about implementing something (like "how to use hashmap" or "how to implement a set"), provide ONLY helper code examples showing syntax/usage
- DO NOT provide complete solutions to the problem - only helper examples
- For "how to implement X" questions, show ONLY how to declare and use X (e.g., for "how to implement a set", show: \`unordered_set<int> mySet;\` and basic operations like \`mySet.insert(x)\`, \`mySet.count(x)\`)
- DO NOT show the entire problem solution - only the helper syntax/pattern they asked about
- For code suggestions, ALWAYS wrap code in markdown code fences: \`\`\`${language === 'C++' ? 'cpp' : 'javascript'}\n<code>\n\`\`\`
- Keep code examples minimal - just enough to show the pattern/syntax (2-5 lines max)
- Format code suggestions clearly so they can be easily extracted
- When providing code examples in your explanation, use markdown code fences

If you're suggesting code, end your response with a line starting with "CODE_SUGGESTION:" followed by the code (without markdown fences). Only suggest the helper code, NOT the full solution.`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 500,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';

    // Extract code suggestion if present
    const codeMatch = text.match(/CODE_SUGGESTION:\s*([\s\S]+)$/);
    const suggestedCode = codeMatch ? codeMatch[1].trim() : null;
    const message = codeMatch ? text.substring(0, text.indexOf('CODE_SUGGESTION:')).trim() : text;

    return {
      message,
      suggestedCode,
    };
  } catch (error) {
    console.error('Chat error:', error);
    return {
      message: 'Sorry, I couldn\'t process your question. Please try again.',
    };
  }
}

export async function analyzeWithGemini({ transcript, conversationHistory = [], code, problemTitle, problemPrompt }) {
  if (!GEMINI_API_KEY) {
    return {
      level: 'neutral',
      title: 'API Key Missing',
      message: 'Set VITE_GEMINI_API_KEY in your .env file to enable AI coaching.',
      progress: 0,
    };
  }

  // If no transcript and code is mostly empty, return neutral
  if (!transcript?.trim() && (!code || code.trim().length < 20)) {
    return {
      level: 'neutral',
      title: 'Thinking…',
      message: 'Share your thoughts out loud or type them, and I\'ll help guide you!',
      progress: 0,
    };
  }

  // Build conversation context
  const conversationContext = conversationHistory.length > 0
    ? `Previous conversation:\n${conversationHistory.map((msg, idx) => `- ${msg}`).join('\n')}\n\nLatest: "${transcript}"`
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
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1000, // Increased to ensure complete responses
        },
      }),
    });

    if (!response.ok) {
      let errorText;
      try {
        const errorJson = await response.json();
        errorText = JSON.stringify(errorJson, null, 2);
        console.error('Gemini API error:', errorText);
        
        // Try to provide helpful error message
        if (errorJson.error?.code === 404) {
          return {
            level: 'neutral',
            title: 'Model Not Found',
            message: `Model "${GEMINI_MODEL}" not found. Try changing GEMINI_MODEL to "gemini-pro" or check available models.`,
            progress: 0,
          };
        }
      } catch {
        errorText = await response.text();
        console.error('Gemini API error:', errorText);
      }
      
      return {
        level: 'neutral',
        title: 'Analysis Error',
        message: 'Could not analyze. Check your API key and model name.',
        progress: 0,
      };
    }

    const data = await response.json();
    const fullResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (!fullResponse) {
      return {
        level: 'neutral',
        title: 'No Response',
        message: 'Could not get analysis. Try again.',
        progress: 0,
      };
    }

    // Extract progress percentage from response
    const progressMatch = fullResponse.match(/PROGRESS:\s*(\d+)/i);
    let progress = 0;
    if (progressMatch) {
      progress = Math.max(0, Math.min(100, parseInt(progressMatch[1], 10)));
    } else {
      // Fallback: try to extract from message if AI doesn't follow format exactly
      const fallbackMatch = fullResponse.match(/progress[:\s]+(\d+)/i);
      if (fallbackMatch) {
        progress = Math.max(0, Math.min(100, parseInt(fallbackMatch[1], 10)));
      }
    }

    // Extract just the message (remove PROGRESS line)
    const message = fullResponse.replace(/PROGRESS:\s*\d+.*$/i, '').trim();

    // Determine level and whether optimal approach is reached based on progress and message
    const messageLower = message.toLowerCase();
    let level = 'neutral';
    let title = 'Thinking…';
    let shouldStopMic = false;

    // Check if user has optimal approach (signals to stop mic and start coding)
    const optimalIndicators = [
      'great approach', 'excellent', 'perfect approach', 'you\'ve got it', 
      'that\'s the right way', 'start coding', 'begin implementing',
      'optimal solution', 'correct approach', 'ready to code',
      'excellent plan', 'great plan', 'that\'s a great', 'that\'s an excellent'
    ];
    
    // Check for phrases that indicate they should start coding
    const codingPromptIndicators = [
      'how would you translate', 'translate that', 'implement that', 
      'start translating', 'begin implementing', 'write the code',
      'code that', 'code it', 'implement it'
    ];
    
    const hasOptimalIndicators = optimalIndicators.some(indicator => 
      messageLower.includes(indicator)
    );
    
    const hasCodingPrompt = codingPromptIndicators.some(indicator =>
      messageLower.includes(indicator)
    );
    
    // Unlock if: (optimal indicators with progress >= 30) OR (coding prompt) OR (progress >= 60)
    const hasOptimalApproach = (hasOptimalIndicators && progress >= 30) || hasCodingPrompt || progress >= 60;

    if (hasOptimalApproach) {
      level = 'good';
      title = 'Ready to Code!';
      shouldStopMic = true;
    } else if (progress >= 80) {
      // High progress should also unlock coding phase
      level = 'good';
      title = 'Almost There!';
      shouldStopMic = true;
    } else if (progress >= 60) {
      // Progress >= 60 should unlock coding phase
      level = 'good';
      title = 'Making Progress';
      shouldStopMic = true;
    } else if (progress >= 40) {
      level = 'warn';
      title = 'On the Right Track';
    } else if (progress >= 20) {
      level = 'warn';
      title = 'Getting Started';
    } else {
      level = 'neutral';
      title = 'Thinking…';
    }

    return {
      level,
      title,
      message: message || 'Share your thoughts and I\'ll guide you!',
      shouldStopMic,
      progress,
    };
  } catch (error) {
    console.error('Gemini API error:', error);
    return {
      level: 'neutral',
      title: 'Connection Error',
      message: 'Could not connect to AI coach. Check your internet connection.',
      progress: 0,
    };
  }
}
