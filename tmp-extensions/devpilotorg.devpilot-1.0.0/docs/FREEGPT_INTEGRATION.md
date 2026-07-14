Free-GPT4 Integration
=====================

DevPilot can use a self-hosted Free-GPT4 web API (for example, Free-GPT4-WEB-API) as a local AI provider.

Quick steps
- Clone or install a Free-GPT4 web API server (see the project's README).
- Run the server locally (default example):

```bash
git clone https://github.com/aledipa/Free-GPT4-WEB-API.git
cd Free-GPT4-WEB-API
pip install -r requirements.txt
python3 FreeGPT4_Server.py --enable-gui
```

- In VS Code, open Settings (DevPilot) and set `devpilot.freegptUrl` to the server URL, e.g. `http://127.0.0.1:5500`.
- DevPilot will probe the configured URL at startup and use it as the AI provider if reachable. If no URL is configured, DevPilot will attempt to auto-detect a local server at `http://127.0.0.1:5500`.

Notes
- The FreeGPT server may accept either GET requests with a `text` query parameter or POST JSON `{ text: "..." }`.
- This integration is optional. If you have an OpenAI API key configured, DevPilot will prefer OpenAI unless no key exists and a reachable FreeGPT server is detected.
