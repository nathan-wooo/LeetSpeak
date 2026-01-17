# LeetSpeak Backend Server

C++ compilation server for LeetSpeak practice platform.

## Setup

### Prerequisites

1. **Node.js** (v18+ recommended)
   ```bash
   node --version  # Should be v18 or higher
   ```

2. **g++ compiler** (GNU C++ compiler)
   ```bash
   g++ --version   # Should show g++ version
   ```
   
   **Install g++:**
   - **macOS**: `brew install gcc` or `xcode-select --install`
   - **Linux (Ubuntu/Debian)**: `sudo apt-get install build-essential`
   - **Windows**: Install [MinGW-w64](https://www.mingw-w64.org/) or use WSL

### Installation

1. Install dependencies:
   ```bash
   cd server
   npm install
   ```

2. Start the server:
   ```bash
   npm run dev    # Development mode with auto-reload
   # or
   npm start      # Production mode
   ```

The server will run on `http://localhost:3001` by default.

### Environment Variables

- `PORT` - Server port (default: 3001)

```bash
PORT=3001 npm start
```

## API Endpoints

### POST `/api/compile-cpp`

Compiles and runs C++ code against test cases.

**Request:**
```json
{
  "code": "#include <vector>\n#include <unordered_set>\n...",
  "tests": [
    { "name": "Example 1", "input": [1, 2, 3, 3], "expected": true },
    { "name": "Example 2", "input": [1, 2, 3, 4], "expected": false }
  ]
}
```

**Response:**
```json
{
  "ok": true,
  "logs": [],
  "results": [
    { "name": "Example 1", "pass": true, "got": true, "expected": true },
    { "name": "Example 2", "pass": true, "got": false, "expected": false }
  ],
  "error": null
}
```

### GET `/health`

Health check endpoint.

## Security Notes

⚠️ **Important**: This server compiles and runs untrusted C++ code. For production:

1. **Use Docker** - Containerize the compilation/execution in isolated containers
2. **Resource limits** - Set CPU/memory limits (ulimit, systemd limits)
3. **Timeouts** - Already implemented (10s compile, 5s per test)
4. **Sandboxing** - Consider using:
   - Docker containers with resource limits
   - Firejail
   - Sandboxed execution environments
   - Read-only filesystem mounts

### Docker Setup (Recommended for Production)

```dockerfile
FROM gcc:latest
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["node", "index.js"]
```

## Development

The server uses:
- **Express** - Web framework
- **child_process** - Execute g++ compilation
- **CORS** - Enable cross-origin requests from frontend

## Troubleshooting

### "g++: command not found"
- Install g++ (see Prerequisites above)
- Make sure g++ is in your PATH

### "Permission denied" errors
- Make sure the `temp` directory is writable
- Check file permissions on the server directory

### Compilation timeouts
- Increase timeout in `index.js` (currently 10 seconds)
- Check for infinite loops or very large code

### Tests failing
- Make sure C++ code follows the expected format:
  - Has a `Solution` class with `containsDuplicate(vector<int>& nums)` method
  - Outputs "true" or "false" as strings
