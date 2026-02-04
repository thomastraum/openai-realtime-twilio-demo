# Tre Voice Setup

Tre Hayes voice assistant via Twilio + OpenAI Realtime API.

## Status

- [x] Repo cloned and configured
- [x] Twilio credentials set
- [x] OpenAI API key set
- [x] Default personality = Tre Hayes
- [ ] **Waiting for:** UK phone number from Twilio

## Quick Start (once you have the phone number)

**Terminal 1 - WebSocket Server:**
```bash
cd ~/.openclaw/workspace/tre-voice/websocket-server
npm run dev
```

**Terminal 2 - Web App:**
```bash
cd ~/.openclaw/workspace/tre-voice/webapp
npm run dev
```

**Terminal 3 - ngrok (makes server public):**
```bash
ngrok http 8081
```

Then:
1. Open http://localhost:3000
2. Copy ngrok URL (e.g., `https://abc123.ngrok.io`)
3. Set Twilio webhook to: `https://abc123.ngrok.io/twiml`
4. Call your Twilio number!

## Voice Options

Available voices (can change in web UI):
- **ash** (default) - neutral
- **ballad** - warm
- **coral** - upbeat
- **sage** - calm
- **verse** - expressive

## Costs

- OpenAI Realtime: ~$0.06/min audio
- Twilio: ~$0.01/min calls + $1/month number

## Files Modified

- `webapp/.env` - Twilio creds
- `websocket-server/.env` - OpenAI key
- `webapp/components/session-configuration-panel.tsx` - Tre personality

## Next Steps

1. Thomas completes UK regulatory bundle on Twilio
2. Buy UK phone number
3. Test call!
