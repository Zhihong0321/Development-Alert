# Deployment Alert 🚨

Audio notifications for Railway deployment events with zero-setup integration.

## What This Does

Get instant audio notifications when your Railway deployments start, succeed, fail, or crash. No webhook configuration needed - just add simple curl commands to your build scripts.

## Quick Start

1. Deploy this app to Railway or any hosting service
2. Copy the notification URL from the home page
3. Add the provided curl commands to your Railway project's build scripts
4. Get audio alerts for all deployment events!

## Features

- 🔊 **Distinct Audio Notifications** - Different sounds for each event type
- 🚀 **Zero Setup** - No webhook configuration required
- 📱 **Real-time Dashboard** - Live event feed and history
- 🎛️ **Customizable Sounds** - Upload your own notification sounds
- 🔧 **AI Agent Friendly** - Clear documentation for automated setup
- 📊 **Event History** - Track all your deployment events

## Event Types

- `build_start` - When Railway starts building your project
- `build_success` - When build completes successfully
- `build_failure` - When build fails
- `deployment_success` - When deployment succeeds
- `deployment_failure` - When deployment fails
- `service_crash` - When your service crashes after deployment

## Example Integration

### Node.js (package.json)
```json
{
  "scripts": {
    "build": "curl -f 'https://your-app.railway.app/notify?project=my-app&event=build_start' || true && npm run compile && curl -f 'https://your-app.railway.app/notify?project=my-app&event=build_success' || (curl -f 'https://your-app.railway.app/notify?project=my-app&event=build_failure' || true && exit 1)"
  }
}
```

### Docker (Dockerfile)
```dockerfile
RUN curl -f 'https://your-app.railway.app/notify?project=my-app&event=build_start' || true
# ... your build steps ...
RUN curl -f 'https://your-app.railway.app/notify?project=my-app&event=build_success' || true
```

## Development

```bash
npm install
npm run dev    # Start development server
npm start      # Start production server
```

## Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/deployment-alert)

1. Click the Railway button above
2. Deploy the service
3. Visit your deployed URL for setup instructions
4. Add the notification commands to your projects

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Express.js with CORS
- **Audio**: Web Audio API with HTML5 fallback
- **Storage**: localStorage for persistence
- **Deployment**: Railway, Vercel, or any Node.js hosting

## License

MIT License - feel free to use this in your projects!

---

Built for developers who are tired of watching deployment timers ⏰ → 🔊