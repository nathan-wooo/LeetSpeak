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
    };
  }

  // If no transcript and code is mostly empty, return neutral
  if (!transcript?.trim() && (!code || code.trim().length < 20)) {
    return {
      level: 'neutral',
      title: 'Thinking…',
      message: 'Share your thoughts out loud or type them, and I\'ll help guide you!',
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
- DO remember the conversation context and respond to their latest question/statement
- DO provide hints and questions to guide them based on what they've already shared
- DO ask about time/space complexity when they're going in wrong direction
- DO encourage them when they're on the right track
- DO point out potential issues (e.g., "Consider edge cases", "Think about O(n²) vs O(n)")
- When the student has clearly identified the optimal approach (e.g., "I'll use a Set" for finding duplicates), encourage them with phrases like "Great approach!" or "Excellent, you've got it! Start coding that solution."
- Keep responses SHORT (1-2 sentences max)
- Use a supportive, Socratic teaching style
- Reference previous parts of the conversation when relevant (e.g., "Yes, that approach you mentioned..." or "Following up on what you said about...")

Respond with ONLY the coaching message, no markdown, no code examples.`;

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
      };
    }

    const data = await response.json();
    const message = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (!message) {
      return {
        level: 'neutral',
        title: 'No Response',
        message: 'Could not get analysis. Try again.',
      };
    }

    // Determine level and whether optimal approach is reached
    const messageLower = message.toLowerCase();
    let level = 'neutral';
    let title = 'Thinking…';
    let shouldStopMic = false;

    // Check if user has optimal approach (signals to stop mic and start coding)
    const optimalIndicators = [
      'great approach', 'excellent', 'perfect approach', 'you\'ve got it', 
      'that\'s the right way', 'start coding', 'begin implementing',
      'optimal solution', 'correct approach', 'ready to code'
    ];
    
    const hasOptimalApproach = optimalIndicators.some(indicator => 
      messageLower.includes(indicator)
    ) || (
      messageLower.includes('good') && 
      (messageLower.includes('approach') || messageLower.includes('solution'))
    );

    if (hasOptimalApproach) {
      level = 'good';
      title = 'Ready to Code!';
      shouldStopMic = true;
    } else if (messageLower.includes('good') || messageLower.includes('right track') || messageLower.includes('correct')) {
      level = 'good';
      title = 'On Track ✓';
    } else if (
      messageLower.includes('wrong') ||
      messageLower.includes('consider') ||
      messageLower.includes('think about') ||
      messageLower.includes('time complexity') ||
      messageLower.includes('space complexity')
    ) {
      level = 'warn';
      title = 'Consider This';
    }

    return {
      level,
      title,
      message,
      shouldStopMic,
    };
  } catch (error) {
    console.error('Gemini API error:', error);
    return {
      level: 'neutral',
      title: 'Connection Error',
      message: 'Could not connect to AI coach. Check your internet connection.',
    };
  }
}
