# LeetSpeak 🎤

**Real interviews aren't silent. Learn to speak your code.**

LeetSpeak is an AI-powered coding practice platform that helps developers prepare for technical interviews by practicing articulating their thought process out loud. Just like in real interviews, you'll explain your approach before coding while receiving real-time, conversational guidance from an AI coach.

![LeetSpeak Logo](public/LeetSpeakImage.png)

## 🎯 Problem

- LeetCode is fundamental to tech interviews, but most practice happens in silence
- When forced to speak and think simultaneously during interviews, many candidates freeze up
- Traditional coding practice doesn't prepare you for the verbal communication aspect of interviews

## ✨ Solution

LeetSpeak bridges this gap by:

- **Voice-driven practice**: Speak your thought process while solving problems
- **Real-time AI coaching**: Receive instant, Socratic feedback without spoiling the solution
- **Progressive unlocking**: Code editing is enabled only after you've articulated the optimal approach
- **Multi-language support**: Practice with JavaScript, Python, and C++

## 🚀 Features

- 🎤 **Voice Recognition**: Uses Web Speech API to capture your spoken thoughts
- 🤖 **AI Coaching**: Google Gemini API provides intelligent, conversational guidance
- 🔊 **Text-to-Speech**: Inworld AI speaks feedback naturally
- 💻 **Monaco Editor**: Full-featured code editor for implementation
- 🧪 **Test Runner**: Run your code against test cases with instant feedback
- 💬 **Chat Assistant**: Ask quick questions about syntax and patterns
- 📊 **Progress Tracking**: Visual progress bar shows how close you are to the solution
- 🎯 **Step-by-step Hints**: Progressive hints system to guide without giving answers

## 🛠️ Tech Stack

### Frontend
- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **TailwindCSS** - Styling
- **React Router** - Navigation
- **Monaco Editor** - Code editor component
- **Lucide React** - Icons

### AI & Speech
- **Google Gemini API** - AI coaching and code analysis
- **Web Speech API** - Speech recognition
- **Elevenlabs API** - AI Voice

### Backend
- **Node.js/Express** 
- **g++**
- **Firebase**

### Deployment
- **Netlify** - Frontend hosting with a .tech domain

## 📋 Prerequisites

- **Node.js** (v18 or higher)
- **npm** 
- **g++** compiler (optional, only needed for C++ support)
  - macOS: `brew install gcc`
  - Windows: Install [MinGW](https://www.mingw-w64.org/)

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd LeetSpeak
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Install Backend Dependencies

```bash
cd server
npm install
cd ..
```

### 4. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
# Required: Google Gemini API Key
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Required: Elevenlabs Text to Speech
VITE_ELEVENLABS_API_KEY=your_elevenlabs_api_key_here



### 5. Start the Development Servers

**Terminal 1 - Frontend:**
```bash
npm run dev
```

**Terminal 2 - Backend (for C++ support):**
```bash
cd server
npm start
```

The frontend will be available at `http://localhost:5173` (or the port Vite assigns).

The backend server runs on `http://localhost:3001` by default.

### 6. Access the Application

Open your browser and navigate to `http://localhost:5173`.


## 🎮 How to Use

### 1. Choose a Problem
Navigate to the problem list and select a LeetCode problem to practice.

### 2. Voice Phase
- Click **"Start mic"** to begin voice recognition
- Speak your approach and thought process out loud
- The AI coach listens and provides real-time feedback
- Continue until you articulate the optimal approach

### 3. Coding Phase
- Once you've identified the optimal approach, code editing unlocks automatically
- Implement your solution in the Monaco editor
- Use JavaScript or C++ (Python support coming soon)
- The AI continues to monitor your code and provide hints

### 4. Test Your Solution
- Click **"Run"** to execute your code against test cases
- View results in the console output
- Iterate based on feedback and test results

### 5. Get Help
- Use the **Chat** tab to ask quick questions about syntax or patterns
- Reveal **Hints** progressively if you're stuck
- View the **Solution** only as a last resort

## 🧪 Adding New Problems

### Neetcode 150

The problem list is built from **Neetcode 150**. 

### Problem File Structure

Problems are stored as JSON files in `src/problems/`. Each problem file should follow this structure:

```json
{
  "id": "problem-id",
  "title": "Problem Title",
  "difficulty": "Easy|Medium|Hard",
  "topic": "Array|String|...",
  "prompt": "Problem description...",
  "examples": [
    { "input": "...", "output": "..." }
  ],
  "constraints": ["constraint 1", "constraint 2"],
  "jsStarter": "function solution() { ... }",
  "cppStarter": "class Solution { ... }",
  "tests": [
    { "name": "Test 1", "input": [...], "expected": ... }
  ],
  "hints": ["hint 1", "hint 2"],
  "solution": {
    "javascript": "...",
    "cpp": "..."
  }
}
```

After adding a problem JSON file, run `npm run fetch-neetcode` to regenerate the manifest (or add the problem to `src/data/neetcode150.json` manually).

## 🔧 Configuration

### Changing the Gemini Model

Edit `src/utils/gemini.js`:

```javascript
const GEMINI_MODEL = 'gemini-2.5-pro'; // or 'gemini-2.5-flash' for faster responses
```

### Changing the Voice

Edit `src/utils/inworld.js` or set in `.env`:

```javascript
const INWORLD_VOICE_ID = "Nova"; // Options: Ronald, Nova, Adam, Ashley, etc.
```
