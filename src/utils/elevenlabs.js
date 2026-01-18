/**
 * ElevenLabs TTS API integration for text-to-speech
 * Converts AI coach responses to spoken audio
 */

const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
// ElevenLabs voice ID - get from https://elevenlabs.io/voices
// Default to a common voice, but you can set VITE_ELEVENLABS_VOICE_ID in .env
const ELEVENLABS_VOICE_ID = import.meta.env.VITE_ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Default: Rachel
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

/**
 * Convert text to speech using ElevenLabs API
 * @param {string} text - Text to convert to speech
 * @returns {Promise<{audioData: ArrayBuffer}|null>} - Audio data or null if failed
 */
export async function textToSpeech(text) {
  if (!ELEVENLABS_API_KEY) {
    // Silently fall back to browser TTS
    return null;
  }

  if (!text || !text.trim()) {
    return null;
  }

  try {
    // ElevenLabs TTS API endpoint: POST /v1/text-to-speech/{voice_id}
    // Docs: https://elevenlabs.io/docs/api-reference/text-to-speech
    const response = await fetch(`${ELEVENLABS_API_URL}/${ELEVENLABS_VOICE_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: 'eleven_turbo_v2_5', // Can be 'eleven_monolingual_v1' or 'eleven_multilingual_v1'
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText, error: errorText };
      }
      
      console.error('ElevenLabs TTS API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      
      // Fall back to browser TTS
      return null;
    }

    // ElevenLabs returns audio as MP3 directly
    const audioData = await response.arrayBuffer();
    console.log('ElevenLabs: Received audio data, size:', audioData.byteLength);
    return { audioData };
  } catch (error) {
    console.error('ElevenLabs TTS request failed:', error);
    // Fall back to browser TTS
    return null;
  }
}

/**
 * Play text as speech using ElevenLabs API or browser fallback
 * @param {string} text - Text to speak
 * @param {Object} options - Options for speech
 * @param {Function} options.onStart - Called when speech starts (pause mic here)
 * @param {Function} options.onEnd - Called when speech ends (resume mic here)
 */
// Global reference to current audio element for stopping
let currentAudioElement = null;

export async function speakText(text, options = {}) {
  if (!text || !text.trim()) return;

  // Remove backticks from text before TTS (TTS will speak them out loud)
  text = text.replace(/`/g, '');

  const { onStart, onEnd } = options;

  // Stop any ongoing audio first
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement = null;
    } catch (e) {
      // Ignore errors
    }
  }

  // Try ElevenLabs first (if API key is set)
  if (ELEVENLABS_API_KEY) {
    const result = await textToSpeech(text);
    
    if (result?.audioData) {
      try {
        // Create blob from audio data and play it
        const blob = new Blob([result.audioData], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        currentAudioElement = audio;
        
        // Pause mic when audio starts playing
        audio.onplay = () => {
          if (onStart) onStart();
        };
        
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          if (currentAudioElement === audio) {
            currentAudioElement = null;
          }
          if (onEnd) onEnd();
        };
        
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          if (currentAudioElement === audio) {
            currentAudioElement = null;
          }
          if (onEnd) onEnd();
          // If ElevenLabs audio fails, fall back to browser TTS
          fallbackToBrowserTTS(text, options);
        };
        
        audio.play().catch(() => {
          URL.revokeObjectURL(audioUrl);
          if (currentAudioElement === audio) {
            currentAudioElement = null;
          }
          fallbackToBrowserTTS(text, options);
        });
        return;
      } catch (err) {
        // Fall through to browser TTS
      }
    }
  }

  // Fallback to browser's Web Speech API (works without Inworld)
  fallbackToBrowserTTS(text, options);
}

/**
 * Fallback to browser's native Web Speech API
 * @param {string} text - Text to speak
 * @param {Object} options - Options for speech
 * @param {Function} options.onStart - Called when speech starts (pause mic here)
 * @param {Function} options.onEnd - Called when speech ends (resume mic here)
 */
function fallbackToBrowserTTS(text, options = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Browser TTS not available');
    if (options.onEnd) options.onEnd();
    return;
  }

  const { onStart, onEnd } = options;
  
  // Cancel any ongoing browser TTS first
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  
  // Pause mic when speech starts
  if (onStart) {
    utterance.onstart = onStart;
  }
  
  // Resume mic when speech ends
  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }
  
  window.speechSynthesis.speak(utterance);
}

/**
 * Stop any ongoing speech
 */
export function stopSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
