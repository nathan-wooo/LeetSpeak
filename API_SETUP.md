# AI Coach API Setup Guide

This guide will help you set up the Google Gemini API and Inworld AI API for the real-time AI coaching feature.

## Overview

The AI Coach bar uses:
- **Google Gemini API** - Analyzes your thought process and code to provide hints
- **Inworld AI API** - Converts AI responses to speech so you can hear guidance

## 1. Google Gemini API Setup

### Get Your API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your API key

### Add to Environment

Create a `.env` file in the root directory:

```bash

```

### How It Works

- Gemini analyzes your spoken/typed thoughts + current code
- Provides hints like "Think about time complexity" or "Consider using a Set"
- **Does NOT give answers** - only guides you with questions and hints
- Responds in 1-2 sentences max

## 2. Inworld AI API Setup (Optional but Recommended)

### Get Your API Key

1. Go to [Inworld AI Studio](https://studio.inworld.ai/)
2. Sign up or log in
3. Create a new project or use an existing one
4. Go to Settings → API Keys
5. Copy your API key

### Get Your Voice ID (Optional)

A **Voice ID** is the identifier for a specific character/agent voice in your Inworld workspace. It's NOT your workspace ID.

**To find your Voice ID:**

1. In [Inworld Studio](https://studio.inworld.ai/), go to your **Characters/Agents** page
2. Click on a character you want to use for TTS
3. Go to the character's **Settings** or **Voice** settings
4. Look for **Voice ID** or **API Voice ID** in the settings
5. Copy that ID

**Note:** If you don't have a character yet, you can:
- Create a new character in Inworld Studio, or
- Skip Inworld TTS and use browser's built-in speech (works without voice ID)

### Add to Environment

Add to your `.env` file:

```bash
VITE_INWORLD_API_KEY=cDh6UWFVaWQ0WjBTbFVsaGtsYUNpenN3T3l6MXh3eWQ6dkFKTXJrOHVNRlAxaE9rZVNrZ3piRUZmVTlQV1o5Y2EzOTNaaTRvb1VNM0VBWEU0cmdxejFVYUhWdjN6M2RMaA==
```

### How It Works

- When Gemini responds with a hint, Inworld converts it to speech
- You hear the guidance as you code (like a real interview coach)
- Falls back to browser's Web Speech API if Inworld is unavailable

## 3. Complete .env File Example

Create a `.env` file in the root directory:

```env
# Google Gemini API Key (Required for AI coaching)
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Inworld AI API Key (Optional, for text-to-speech)
VITE_INWORLD_API_KEY=your_inworld_api_key_here

# Inworld Voice ID (Use a basic voice name like "Ronald", "Nova", "Adam", "Ashley", "Dennis", or "Alex")
# Or use a custom voice ID from your Inworld character
VITE_INWORLD_VOICE_ID=Ronald

# Backend API URL (optional, defaults to http://localhost:3001)
VITE_API_URL=http://localhost:3001
```

## 4. Usage

### Enable AI Coaching

1. Make sure your `.env` file has `VITE_GEMINI_API_KEY` set
2. Restart your dev server: `npm run dev`
3. The AI Coach bar will automatically analyze as you type/think

### How to Use

1. **Type your thoughts** in the transcript input, or
2. **Click "Start mic"** to speak your thoughts aloud
3. The AI Coach bar will show real-time feedback:
   - 🟢 **On Track** - You're heading in the right direction
   - 🟡 **Consider This** - Think about time/space complexity or approach
   - ⚪ **Thinking…** - Waiting for your input

4. **Hear guidance** - If Inworld API is set up, responses are spoken aloud

### Example Flow

**You think**: "I'm thinking of using a for loop to check duplicates..."

**AI responds** (via Gemini): "Think about time complexity. Is there a way to check in O(n) instead of O(n²)?"

**You hear** (via Inworld): Audio of the response spoken naturally

## 5. Troubleshooting

### "API Key Missing" Error

**Problem**: The AI Coach shows "Set VITE_GEMINI_API_KEY in your .env file"

**Solution**:
1. Create `.env` file in the root directory
2. Add `VITE_GEMINI_API_KEY=your_key`
3. **Restart your dev server** (Vite needs restart to load new env vars)

### No Speech Audio

**Problem**: You don't hear the AI responses

**Solutions**:
1. Check if Inworld API key is set in `.env`
2. Check browser console for errors
3. The app will fall back to browser's Web Speech API if Inworld fails
4. Make sure your browser allows audio (check browser permissions)

### "Connection Error" Message

**Problem**: AI Coach shows connection errors

**Solutions**:
1. Check your internet connection
2. Verify your Gemini API key is correct
3. Check browser console for detailed error messages
4. Make sure you haven't exceeded API rate limits

### Analysis Not Updating

**Problem**: AI Coach doesn't respond when you type/think

**Solutions**:
1. There's a 1.5 second debounce - wait after typing
2. Make sure `.env` file has correct API key
3. Check browser console for errors
4. Restart dev server if needed

## 6. API Costs

### Google Gemini API

- **Free tier**: Generous free quota (check current limits)
- **Pricing**: Very affordable after free tier
- **This app**: Uses ~100-200 tokens per request (very cheap)

### Inworld AI API

- **Credits**: You mentioned you have lots of credits!
- **This app**: One API call per AI response
- **Fallback**: Uses browser's free Web Speech API if unavailable

## 7. Customization

### Adjust Debounce Time

In `src/pages/Practice.jsx`, change the debounce delay:

```javascript
}, 1500); // Change this value (in milliseconds)
```

### Change AI Prompt

Edit `src/utils/gemini.js` to customize the coaching prompt:

```javascript
const prompt = `You are a coding interview coach...`;
```

### Adjust Speech Settings

Edit `src/utils/inworld.js` to customize voice/speed:

```javascript
utterance.rate = 0.9;  // Speech rate (0.1 to 10)
utterance.pitch = 1.0; // Voice pitch
utterance.volume = 1.0; // Volume (0 to 1)
```

## Next Steps

1. ✅ Get Gemini API key → Add to `.env`
2. ✅ Get Inworld API key → Add to `.env` (optional)
3. ✅ Restart dev server
4. 🎉 Start coding and let the AI coach guide you!

The AI Coach will analyze your thoughts in real-time and provide helpful hints without giving away the answer - just like a real interview coach!
