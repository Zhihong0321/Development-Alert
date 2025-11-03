const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Notification endpoint
app.all('/notify', (req, res) => {
  const { project, event, timestamp, message } = req.query;
  
  console.log(`[${new Date().toISOString()}] ${project}: ${event}`);
  
  // Send to all connected clients (will implement SSE later)
  res.json({ 
    success: true, 
    received: { project, event, timestamp: timestamp || new Date().toISOString(), message }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve main page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Deployment Alert 🚨</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 10px; }
        .subtitle { color: #666; margin-bottom: 30px; }
        .endpoint { background: #f8f9fa; padding: 15px; border-radius: 5px; font-family: monospace; margin: 20px 0; }
        .example { background: #2d3748; color: #e2e8f0; padding: 15px; border-radius: 5px; margin: 10px 0; overflow-x: auto; }
        .copy-btn { background: #4299e1; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-left: 10px; }
        .event-types { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .event-type { background: #f7fafc; padding: 15px; border-radius: 5px; border-left: 4px solid #4299e1; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚨 Deployment Alert</h1>
        <p class="subtitle">Audio notifications for Railway deployment events - zero setup integration</p>
        
        <h2>Your Notification Endpoint</h2>
        <div class="endpoint">
          ${req.protocol}://${req.get('host')}/notify
          <button class="copy-btn" onclick="copyToClipboard('${req.protocol}://${req.get('host')}/notify')">Copy</button>
        </div>
        
        <h2>Event Types</h2>
        <div class="event-types">
          <div class="event-type">
            <strong>build_start</strong><br>
            When Railway starts building
          </div>
          <div class="event-type">
            <strong>build_success</strong><br>
            When build completes successfully
          </div>
          <div class="event-type">
            <strong>build_failure</strong><br>
            When build fails
          </div>
          <div class="event-type">
            <strong>deployment_success</strong><br>
            When deployment succeeds
          </div>
          <div class="event-type">
            <strong>deployment_failure</strong><br>
            When deployment fails
          </div>
          <div class="event-type">
            <strong>service_crash</strong><br>
            When service crashes
          </div>
        </div>
        
        <h2>Quick Integration Examples</h2>
        
        <h3>Node.js (package.json)</h3>
        <div class="example">
{
  "scripts": {
    "build": "curl -f '${req.protocol}://${req.get('host')}/notify?project=MY_PROJECT&event=build_start' || true && npm run compile && curl -f '${req.protocol}://${req.get('host')}/notify?project=MY_PROJECT&event=build_success' || (curl -f '${req.protocol}://${req.get('host')}/notify?project=MY_PROJECT&event=build_failure' || true && exit 1)"
  }
}
        </div>
        
        <h3>Docker (Dockerfile)</h3>
        <div class="example">
RUN curl -f '${req.protocol}://${req.get('host')}/notify?project=MY_PROJECT&event=build_start' || true
# ... your build steps ...
RUN curl -f '${req.protocol}://${req.get('host')}/notify?project=MY_PROJECT&event=build_success' || true
CMD curl -f '${req.protocol}://${req.get('host')}/notify?project=MY_PROJECT&event=deployment_success' || true && npm start
        </div>
        
        <h3>Test Your Setup</h3>
        <button onclick="testNotification()" style="background: #48bb78; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
          Send Test Notification
        </button>
        
        <p style="margin-top: 30px; color: #666; font-size: 14px;">
          Replace MY_PROJECT with your actual project name. The || true ensures builds don't fail if notifications fail.
        </p>
      </div>
      
      <script>
        function copyToClipboard(text) {
          navigator.clipboard.writeText(text).then(() => {
            alert('Copied to clipboard!');
          });
        }
        
        function testNotification() {
          fetch('/notify?project=test&event=build_success&message=Test notification')
            .then(res => res.json())
            .then(data => {
              alert('Test notification sent! Check your browser console for the response.');
              console.log('Test notification response:', data);
            })
            .catch(err => {
              alert('Error sending test notification: ' + err.message);
            });
        }
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🚨 Deployment Alert server running on port ${PORT}`);
  console.log(`📡 Notification endpoint: http://localhost:${PORT}/notify`);
});