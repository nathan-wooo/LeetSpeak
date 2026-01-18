/**
 * Inworld AI API integration for text-to-speech
 * Converts AI coach responses to spoken audio
 */

const INWORLD_API_KEY = import.meta.env.VITE_INWORLD_API_KEY;
// Use a basic voice name (like "Ronald", "Nova", "Adam") or a custom voiceId
// Basic voices: Ronald, Nova, Adam, Ashley, Dennis, Alex (and others)
const INWORLD_VOICE_ID = "Alex"; 
// Support both VITE_INWORLD_VOICE_ID and VITE_INWORLD_VOICE_NAME for flexibility
const INWORLD_API_URL = 'https://api.inworld.ai';

/**
 * Convert text to speech using Inworld API
 * @param {string} text - Text to convert to speech
 * @returns {Promise<{audioData: ArrayBuffer}|null>} - Audio data or null if failed
 */
export async function textToSpeech(text) {
  if (!INWORLD_API_KEY) {
    // Silently fall back to browser TTS
    return null;
  }

  if (!text || !text.trim()) {
    return null;
  }

  // voiceId is required by Inworld API
  // You can use basic voice names like "Ronald", "Nova", "Adam", "Ashley", "Dennis", "Alex"
  // Or use a custom voiceId from your Inworld character
  if (!INWORLD_VOICE_ID) {
    // If no voice is set, fall back to browser TTS
    return null;
  }

  try {
    // Inworld TTS API endpoint: POST /tts/v1/voice
    // Docs: https://docs.inworld.ai/docs/node/templates/tts
    // Basic voices you can use: Ronald, Nova, Adam, Ashley, Dennis, Alex
    // These can be used directly as voice_id in the API call
    const requestBody = {
      text: text.trim(),
      voice_id: INWORLD_VOICE_ID, // Can be a basic voice name like "Ronald" or a custom voiceId
      audio_config: {
        audio_encoding: 'MP3',
        speaking_rate: 1,
      },
      temperature: 1.1,
      model_id: 'inworld-tts-1', // Default Inworld TTS model (or 'inworld-tts-1-max' for better quality)
    };

    const response = await fetch(`${INWORLD_API_URL}/tts/v1/voice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Inworld uses Basic auth (not Bearer) - API key should be Base64 encoded
        'Authorization': `Basic ${INWORLD_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText, error: errorText };
      }
      
      console.error('Inworld TTS API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      
      // Check for invalid voice ID error
      if (response.status === 400 || response.status === 404) {
        const errorMsg = errorData.message || errorData.error || '';
        if (errorMsg.includes('voice') || errorMsg.includes('Voice') || errorMsg.includes('not found')) {
          console.warn('Inworld: Invalid voice ID. Please check VITE_INWORLD_VOICE_ID in your .env file.');
        }
      }
      
      // Fall back to browser TTS
      return null;
    }

    // Inworld TTS returns audio data
    // Check content type to see how to handle it
    const contentType = response.headers.get('content-type') || '';
    console.log('Inworld TTS response content-type:', contentType);

    if (contentType.includes('audio')) {
      // Direct audio response (MP3, WAV, etc.)
      const audioData = await response.arrayBuffer();
      console.log('Inworld: Received audio data, size:', audioData.byteLength);
      return { audioData };
    } else {
      // Inworld returns JSON with base64-encoded audio in audioContent field
      const text = await response.text();
      
      // Try to parse as JSON
      try {
        const data = JSON.parse(text);
        
        // Inworld API returns audioContent as base64-encoded string
        if (data.audioContent) {
          // Decode base64 to binary data
          const base64Audio = data.audioContent;
          const binaryString = atob(base64Audio);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const audioData = bytes.buffer;
          console.log('Inworld: Decoded audio from base64, size:', audioData.byteLength);
          return { audioData };
        }
        
        // Legacy support for other field names
        if (data.audioData || data.audio) {
          return { audioData: data.audioData || data.audio };
        }
        
        console.warn('Inworld: JSON response does not contain audioContent field:', data);
      } catch (parseError) {
        console.warn('Inworld: Failed to parse response as JSON:', parseError);
      }
      
      return null;
    }
  } catch (error) {
    console.error('Inworld TTS request failed:', error);
    // Fall back to browser TTS
    return null;
  }
}

/**
 * Play text as speech using Inworld API or browser fallback
 * @param {string} text - Text to speak
 * @param {Object} options - Options for speech
 * @param {Function} options.onStart - Called when speech starts (pause mic here)
 * @param {Function} options.onEnd - Called when speech ends (resume mic here)
 */
// Global reference to current audio element for stopping
let currentAudioElement = null;

export async function speakText(text, options = {}) {
  if (!text || !text.trim()) return;

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

  // Try Inworld first (if API key is set)
  if (INWORLD_API_KEY) {
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
          // If Inworld audio fails, fall back to browser TTS
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
