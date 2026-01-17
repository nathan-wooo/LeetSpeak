# Backend C++ Server Setup Guide

This guide will help you set up the C++ compilation backend server for LeetSpeak.

## Quick Start

### 1. Install Prerequisites

**g++ Compiler** (required):
- **macOS**: 
  ```bash
  brew install gcc
  # or if you have Xcode Command Line Tools:
  xcode-select --install
  ```
- **Linux (Ubuntu/Debian)**: 
  ```bash
  sudo apt-get update
  sudo apt-get install build-essential
  ```
- **Windows**: Install [MinGW-w64](https://www.mingw-w64.org/) or use WSL

**Verify installation**:
```bash
g++ --version
# Should show something like: g++ (GCC) 11.2.0
```

### 2. Install Backend Dependencies

```bash
cd server
npm install
```

### 3. Start the Backend Server

```bash
npm run dev    # Development mode (auto-reload on changes)
# or
npm start      # Production mode
```

The server will start on **http://localhost:3001**

### 4. Start the Frontend (in a separate terminal)

```bash
# From the root directory
cd ..  # Go back to root if you're in server/
npm run dev
```

The frontend will start on **http://localhost:5173** (or similar)

### 5. Test It!

1. Open http://localhost:5173 in your browser
2. Select **C++** from the language dropdown
3. Write your C++ solution
4. Click **Run** - it should compile and execute!

## Troubleshooting

### "g++: command not found"
**Problem**: g++ compiler is not installed or not in PATH.

**Solution**:
- Install g++ (see Prerequisites above)
- Make sure it's in your PATH: `which g++`
- Restart your terminal after installation

### "Cannot connect to C++ compilation server"
**Problem**: Backend server is not running.

**Solution**:
1. Make sure the server is running: `cd server && npm start`
2. Check if port 3001 is available: `lsof -i :3001`
3. Verify the server is responding: `curl http://localhost:3001/health`

### "Compilation error"
**Problem**: C++ code has syntax errors.

**Solution**:
- Check the error message in the console output
- Make sure your code follows the expected format (Solution class with `containsDuplicate` method)
- Verify includes are correct

### Permission Errors
**Problem**: Cannot write to temp directory.

**Solution**:
```bash
# Make sure temp directory is writable
cd server
mkdir -p temp
chmod 755 temp
```

## Development

### File Structure
```
server/
  ├── index.js          # Main server file
  ├── package.json      # Dependencies
  ├── README.md         # Server docs
  ├── .gitignore        # Ignore temp files
  └── temp/             # Temporary compiled files (auto-created)
```

### API Endpoint

**POST** `/api/compile-cpp`

Compiles and runs C++ code against test cases.

**Request**:
```json
{
  "code": "#include <vector>\nclass Solution { ... }",
  "tests": [
    { "name": "Example 1", "input": [1, 2, 3, 3], "expected": true }
  ]
}
```

**Response**:
```json
{
  "ok": true,
  "logs": [],
  "results": [
    { "name": "Example 1", "pass": true, "got": true, "expected": true }
  ],
  "error": null
}
```

### Environment Variables

Set `PORT` to change the server port (default: 3001):
```bash
PORT=3001 npm start
```

## Security Notes

⚠️ **Important**: This server compiles and runs untrusted C++ code. Current protections:
- ✅ Timeouts (10s compile, 5s per test)
- ✅ Resource limits (1MB buffer)
- ⚠️ **For production**, use Docker or a sandboxing solution

### Production Recommendations

1. **Use Docker** - Containerize compilation/execution
2. **Set resource limits** - CPU/memory via ulimit or systemd
3. **Use a sandbox** - Firejail, Docker, or isolated VMs
4. **Rate limiting** - Prevent abuse
5. **Authentication** - Protect your API

See `server/README.md` for more details.

## Next Steps

- ✅ Backend server is ready!
- ✅ Frontend is connected!
- 🎉 Start coding C++ solutions!

If you encounter issues, check the console output in both frontend and backend terminals.
