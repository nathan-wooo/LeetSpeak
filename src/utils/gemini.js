/**
 * Gemini API — all calls are proxied through the Express backend so the
 * API key never leaves the server.  The backend also enforces per-user
 * rate limiting and Firebase auth.
 */

import { auth } from './firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function geminiPost(path, body) {
  const user = auth.currentUser;
  if (!user) throw new Error('NOT_AUTHENTICATED');

  const token = await user.getIdToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    const data = await res.json();
    return { _rateLimited: true, message: data.message };
  }

  if (res.status === 401) {
    return { _authError: true };
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Server error ${res.status}`);
  }

  return res.json();
}

/**
 * Chat with AI coach for quick questions (like "how to implement hashmap")
 */
export async function chatWithGemini({ question, code, language, problemTitle }) {
  try {
    const data = await geminiPost('/api/gemini/chat', {
      question,
      code,
      language,
      problemTitle,
    });

    if (data._rateLimited) {
      return { message: data.message, rateLimited: true };
    }

    if (data._authError) {
      return { message: 'Please sign in to use the AI coach.' };
    }

    const text = data.text || 'No response generated.';

    const codeMatch = text.match(/CODE_SUGGESTION:\s*([\s\S]+)$/);
    const suggestedCode = codeMatch ? codeMatch[1].trim() : null;
    const message = codeMatch
      ? text.substring(0, text.indexOf('CODE_SUGGESTION:')).trim()
      : text;

    return { message, suggestedCode };
  } catch (error) {
    console.error('Chat error:', error);
    if (error.message === 'NOT_AUTHENTICATED') {
      return { message: 'Please sign in to use the AI coach.' };
    }
    return {
      message: "Sorry, I couldn't process your question. Please try again.",
    };
  }
}

/**
 * Analyze user's thought process and code to provide coaching hints
 */
export async function analyzeWithGemini({
  transcript,
  conversationHistory = [],
  code,
  problemTitle,
  problemPrompt,
}) {
  if (!transcript?.trim() && (!code || code.trim().length < 20)) {
    return {
      level: 'neutral',
      title: 'Thinking…',
      message: "Share your thoughts out loud or type them, and I'll help guide you!",
      progress: 0,
    };
  }

  try {
    const data = await geminiPost('/api/gemini/analyze', {
      transcript,
      conversationHistory,
      code,
      problemTitle,
      problemPrompt,
    });

    if (data._rateLimited) {
      return {
        level: 'neutral',
        title: 'Usage Limit Reached',
        message: data.message,
        progress: 0,
        shouldStopMic: true,
        rateLimited: true,
      };
    }

    if (data._authError) {
      return {
        level: 'neutral',
        title: 'Sign In Required',
        message: 'Please sign in to use the AI coach.',
        progress: 0,
      };
    }

    const fullResponse = data.text || '';

    if (!fullResponse) {
      return {
        level: 'neutral',
        title: 'No Response',
        message: 'Could not get analysis. Try again.',
        progress: 0,
      };
    }

    // Extract progress percentage
    const progressMatch = fullResponse.match(/PROGRESS:\s*(\d+)/i);
    let progress = 0;
    if (progressMatch) {
      progress = Math.max(0, Math.min(100, parseInt(progressMatch[1], 10)));
    } else {
      const fallbackMatch = fullResponse.match(/progress[:\s]+(\d+)/i);
      if (fallbackMatch) {
        progress = Math.max(0, Math.min(100, parseInt(fallbackMatch[1], 10)));
      }
    }

    const message = fullResponse.replace(/PROGRESS:\s*\d+.*$/i, '').trim();

    const messageLower = message.toLowerCase();
    let level = 'neutral';
    let title = 'Thinking…';
    let shouldStopMic = false;

    const optimalIndicators = [
      'great approach', 'excellent', 'perfect approach', "you've got it",
      "that's the right way", 'start coding', 'begin implementing',
      'optimal solution', 'correct approach', 'ready to code',
      'excellent plan', 'great plan', "that's a great", "that's an excellent",
    ];

    const codingPromptIndicators = [
      'how would you translate', 'translate that', 'implement that',
      'start translating', 'begin implementing', 'write the code',
      'code that', 'code it', 'implement it',
    ];

    const hasOptimalIndicators = optimalIndicators.some((i) =>
      messageLower.includes(i),
    );
    const hasCodingPrompt = codingPromptIndicators.some((i) =>
      messageLower.includes(i),
    );

    const hasOptimalApproach =
      (hasOptimalIndicators && progress >= 30) ||
      hasCodingPrompt ||
      progress >= 60;

    if (hasOptimalApproach) {
      level = 'good';
      title = 'Ready to Code!';
      shouldStopMic = true;
    } else if (progress >= 80) {
      level = 'good';
      title = 'Almost There!';
      shouldStopMic = true;
    } else if (progress >= 60) {
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
      message: message || "Share your thoughts and I'll guide you!",
      shouldStopMic,
      progress,
    };
  } catch (error) {
    console.error('Gemini API error:', error);
    if (error.message === 'NOT_AUTHENTICATED') {
      return {
        level: 'neutral',
        title: 'Sign In Required',
        message: 'Please sign in to use the AI coach.',
        progress: 0,
      };
    }
    return {
      level: 'neutral',
      title: 'Connection Error',
      message: 'Could not connect to AI coach. Check your internet connection.',
      progress: 0,
    };
  }
}
