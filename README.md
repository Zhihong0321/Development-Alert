# Railway Deployment Alert 🚨

Real-time audio notifications for Railway deployment events via webhooks. Get instant sound alerts for every stage of your deployment pipeline.

## What This Does

Automatically receive audio notifications for all Railway deployment events through webhooks. No manual integration needed - just configure the webhook and get real-time alerts for initializing, building, deploying, success, failures, crashes, and more.

## Quick Start

1. **Deploy this service:**
```bash
# Clone and deploy
git clone <this-repo>
cd deployment-alert
npm install
npm start

# Or deploy directly to Railway
railway login
railway up
```

2. **Configure Railway webhook:**
   - Go to your Railway project → Settings → Webhooks
   - Click "New Webhook"
   - Endpoint: `https://your-deployed-app.railway.app/webhook`
   - Select all deployment events
   - Save webhook

3. **Open dashboard and deploy:**
   - Visit your deployed URL
   - Deploy your Railway project
   - Get real-time audio notifications! 🔊

## Features

- 🎯 **Railway Webhook Integration** - Native support for all Railway deployment events
- 🔊 **Distinct Audio Notifications** - Unique sounds for each deployment stage
- 📊 **Real-time Dashboard** - Live notification log with Railway project details
- 🌐 **Browser Notifications** - Desktop notifications with deployment URLs
- 📡 **Server-sent Events** - Instant updates without polling
- 🎵 **Custom Sounds** - Upload your own notification sounds
- 📱 **Mobile-friendly** - Responsive design works on all devices
- 🔐 **Webhook Security** - Optional signature verification
- 📈 **Enhanced Logging** - Detailed logs with Railway project and deployment info

## Railway Deployment Events

| Railway Event | Icon | Description | Sound Pattern |
|---------------|------|-------------|---------------|
| `deployment.initialize` | 🔄 | Deployment is being initialized | Soft tone |
| `deployment.queued` | ⏳ | Deployment is queued for processing | Double beep |
| `deployment.building` | 🔨 | Railway is building your project | Triangle wave |
| `deployment.deploying` | 🚀 | Deployment is in progress | Rising tones |
| `deployment.success` | ✅ | Deployment completed successfully | Victory fanfare |
| `deployment.failed` | ❌ | Deployment failed | Descending tones |
| `deployment.crashed` | 💥 | Service crashed after deployment | Urgent alarm |
| `deployment.sleeping` | 😴 | Service is sleeping (idle) | Gentle fade |
| `deployment.removed` | 🗑️ | Deployment was removed | Low tone |
| `deployment.skipped` | ⏭️ | Deployment was skipped | Skip pattern |

## Integration Examples

### Using the Built-in Script (Recommended)

The easiest way to integrate is using the provided script:

```bash
# Set environment variables (optional)
export NOTIFICATION_URL="http://localhost:3000"
export PROJECT_NAME="my-awesome-project"

# Send notifications
node scripts/deployment-alert.js deployment_success "Deployment completed successfully!"
node scripts/deployment-alert.js build_failure "Build failed: missing dependency"
```

### Package.json Integration

Add to your `package.json` scripts:

```json
{
  "scripts": {
    "deploy": "node scripts/deployment-alert.js build_start && npm run build && node scripts/deployment-alert.js build_success && npm run start-prod && node scripts/deployment-alert.js deployment_success",
    "build": "npm run compile || (node scripts/deployment-alert.js build_failure && exit 1)"
  }
}
```

### Railway Integration

Add to your Railway deployment hooks:

```bash
# Build start hook
curl -f "https://your-notification-server.railway.app/notify?project=$RAILWAY_PROJECT_NAME&event=build_start" || true

# Build success hook  
curl -f "https://your-notification-server.railway.app/notify?project=$RAILWAY_PROJECT_NAME&event=build_success" || true

# Deployment success hook
curl -f "https://your-notification-server.railway.app/notify?project=$RAILWAY_PROJECT_NAME&event=deployment_success&message=Deployed to $RAILWAY_ENVIRONMENT" || true
```

### Docker Integration

```dockerfile
# Dockerfile
ARG NOTIFICATION_URL=https://your-notification-server.railway.app
ARG PROJECT_NAME=my-project

# Notify build start
RUN curl -f "${NOTIFICATION_URL}/notify?project=${PROJECT_NAME}&event=build_start" || true

# Your build steps here
COPY . .
RUN npm install
RUN npm run build

# Notify build success
RUN curl -f "${NOTIFICATION_URL}/notify?project=${PROJECT_NAME}&event=build_success" || true

# Notify deployment success on container start
CMD curl -f "${NOTIFICATION_URL}/notify?project=${PROJECT_NAME}&event=deployment_success" || true && npm start
```

## API Reference

### Notification Endpoint

```
GET /notify?project=PROJECT_NAME&event=EVENT_TYPE&message=MESSAGE&timestamp=ISO_TIMESTAMP
```

**Parameters:**
- `project` (required) - Name of your project
- `event` (required) - Event type (see table above)
- `message` (optional) - Additional message
- `timestamp` (optional) - ISO timestamp (defaults to current time)

**Response:**
```json
{
  "success": true,
  "received": {
    "id": 1699123456789,
    "project": "my-project",
    "event": "deployment_success",
    "timestamp": "2025-11-03T07:08:24.234Z",
    "message": "Deployment completed",
    "receivedAt": "2025-11-03T07:08:24.234Z"
  },
  "playSound": true,
  "clientsNotified": 1
}
```

### Real-time Events

Connect to `/events` for server-sent events:

```javascript
const eventSource = new EventSource('/events');
eventSource.onmessage = function(event) {
  const data = JSON.parse(event.data);
  if (data.type === 'notification') {
    console.log('New notification:', data.notification);
  }
};
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NOTIFICATION_URL` | Notification server URL for scripts | `https://your-app.railway.app` (production) or `http://localhost:3000` (local) |
| `PROJECT_NAME` | Default project name for scripts | Current directory name |

## Dashboard Features

### Sound Customization
- Test different event sounds
- Upload custom sound files
- Adjust volume levels
- Enable/disable browser notifications

### Live Monitoring
- Real-time notification log
- Connection status indicator
- Audio system status
- Client count display

### Browser Compatibility
- Works in all modern browsers
- Fallback audio system for older browsers
- Mobile-responsive design

## Troubleshooting

### No Sound Playing
1. Click anywhere on the dashboard to enable audio (browser autoplay policy)
2. Check volume settings
3. Ensure browser allows audio playback
4. Try the sound test buttons

### Connection Issues
1. Verify the server is running on the correct port
2. Check firewall settings
3. Use the "Reconnect" button on the dashboard
4. Check browser console for errors

### Notifications Not Received
1. Verify the notification URL is correct
2. Check server logs for incoming requests
3. Ensure the dashboard is open and connected
4. Test with the built-in test notification button

## Development

### Running in Development
```bash
npm run dev
```

### Testing Notifications
```bash
# Test different event types
node test-notification.js build_start "Starting build process"
node test-notification.js deployment_success "Deployment completed successfully"
node test-notification.js service_crash "Service crashed unexpectedly"
```

## Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/deployment-alert)

1. Click the Railway button above
2. Deploy the service
3. Visit your deployed URL for setup instructions
4. Add the notification commands to your projects

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Express.js with CORS and Server-Sent Events
- **Audio**: Web Audio API with HTML5 fallback
- **Storage**: localStorage for persistence
- **Real-time**: Server-Sent Events (SSE)
- **Deployment**: Railway, Vercel, or any Node.js hosting

## License

MIT License - feel free to use this in your projects!

---

Built for developers who are tired of watching deployment timers ⏰ → 🔊