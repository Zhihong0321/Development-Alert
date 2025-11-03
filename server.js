const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'railway-webhook-secret';

// Middleware
app.use(cors());
app.use(express.raw({ type: 'application/json' })); // For webhook signature verification
app.use(express.static('public'));

// Store recent notifications for display
let recentNotifications = [];
// Store SSE connections for real-time updates
let sseClients = [];

// Railway webhook event mapping
const RAILWAY_EVENT_MAP = {
  'deployment.initialize': 'initializing',
  'deployment.queued': 'queued', 
  'deployment.building': 'building',
  'deployment.deploying': 'deploying',
  'deployment.success': 'deployment_success',
  'deployment.failed': 'deployment_failure',
  'deployment.crashed': 'service_crash',
  'deployment.sleeping': 'sleeping',
  'deployment.removed': 'removed',
  'deployment.skipped': 'skipped'
};

// Verify Railway webhook signature
function verifyWebhookSignature(payload, signature) {
  if (!signature) return false;
  
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

// Railway webhook endpoint
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-railway-signature'];
  const payload = req.body;
  
  // Verify webhook signature (optional but recommended)
  if (WEBHOOK_SECRET && signature && !verifyWebhookSignature(payload, signature)) {
    console.log('❌ Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  let webhookData;
  try {
    webhookData = JSON.parse(payload.toString());
  } catch (error) {
    console.log('❌ Invalid JSON payload');
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  
  const { type, project, deployment, environment } = webhookData;
  
  // Map Railway event to our notification system
  const eventType = RAILWAY_EVENT_MAP[type] || type;
  
  const notification = {
    id: Date.now(),
    project: project?.name || 'Unknown Project',
    event: eventType,
    timestamp: new Date().toISOString(),
    message: generateEventMessage(type, deployment, environment),
    receivedAt: new Date().toISOString(),
    railwayData: {
      type,
      projectId: project?.id,
      deploymentId: deployment?.id,
      environment: environment?.name,
      status: deployment?.status,
      url: deployment?.url
    }
  };
  
  // Enhanced logging
  console.log(`🚨 [${notification.receivedAt}] RAILWAY WEBHOOK RECEIVED:`);
  console.log(`   Project: ${notification.project} (${project?.id})`);
  console.log(`   Event: ${type} → ${eventType}`);
  console.log(`   Environment: ${environment?.name || 'N/A'}`);
  console.log(`   Deployment ID: ${deployment?.id || 'N/A'}`);
  console.log(`   Status: ${deployment?.status || 'N/A'}`);
  console.log(`   URL: ${deployment?.url || 'N/A'}`);
  console.log(`   Connected clients: ${sseClients.length}`);
  
  // Store notification (keep last 100)
  recentNotifications.unshift(notification);
  if (recentNotifications.length > 100) {
    recentNotifications = recentNotifications.slice(0, 100);
  }
  
  // Broadcast to all connected SSE clients
  broadcastNotification(notification);
  
  // Send response
  res.json({ 
    success: true, 
    received: notification,
    playSound: true,
    clientsNotified: sseClients.length
  });
});

// Generate human-readable message from Railway webhook data
function generateEventMessage(type, deployment, environment) {
  const env = environment?.name || 'production';
  const url = deployment?.url;
  
  switch (type) {
    case 'deployment.initialize':
      return `Deployment initialized for ${env}`;
    case 'deployment.queued':
      return `Deployment queued for ${env}`;
    case 'deployment.building':
      return `Building deployment for ${env}`;
    case 'deployment.deploying':
      return `Deploying to ${env}`;
    case 'deployment.success':
      return url ? `Successfully deployed to ${env} at ${url}` : `Successfully deployed to ${env}`;
    case 'deployment.failed':
      return `Deployment failed for ${env}`;
    case 'deployment.crashed':
      return `Service crashed in ${env}`;
    case 'deployment.sleeping':
      return `Service sleeping in ${env}`;
    case 'deployment.removed':
      return `Deployment removed from ${env}`;
    case 'deployment.skipped':
      return `Deployment skipped for ${env}`;
    default:
      return `${type} in ${env}`;
  }
}

// Legacy notification endpoint (for backward compatibility)
app.all('/notify', (req, res) => {
  const { project, event, timestamp, message } = req.query;
  
  const notification = {
    id: Date.now(),
    project: project || 'Manual Notification',
    event: event || 'unknown',
    timestamp: timestamp || new Date().toISOString(),
    message: message || '',
    receivedAt: new Date().toISOString(),
    isLegacy: true
  };
  
  console.log(`📢 [${notification.receivedAt}] LEGACY NOTIFICATION:`);
  console.log(`   Project: ${notification.project}`);
  console.log(`   Event: ${notification.event}`);
  console.log(`   Message: ${notification.message}`);
  console.log(`   Connected clients: ${sseClients.length}`);
  
  recentNotifications.unshift(notification);
  if (recentNotifications.length > 100) {
    recentNotifications = recentNotifications.slice(0, 100);
  }
  
  broadcastNotification(notification);
  
  res.json({ 
    success: true, 
    received: notification,
    playSound: true,
    clientsNotified: sseClients.length
  });
});

// Broadcast notification to all SSE clients
function broadcastNotification(notification) {
  console.log(`📡 Broadcasting to ${sseClients.length} connected clients...`);
  
  sseClients.forEach((client, index) => {
    try {
      client.write(`data: ${JSON.stringify({
        type: 'notification',
        notification: notification
      })}\n\n`);
      console.log(`   ✅ Sent to client ${index + 1}`);
    } catch (error) {
      console.log(`   ❌ Failed to send to client ${index + 1}:`, error.message);
      // Remove dead client
      sseClients.splice(index, 1);
    }
  });
}

// Server-Sent Events endpoint for real-time notifications
app.get('/events', (req, res) => {
  console.log('🔌 New SSE client connected');
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });
  
  // Add client to list
  sseClients.push(res);
  console.log(`📊 Total connected clients: ${sseClients.length}`);
  
  // Send initial connection message
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    message: 'Connected to deployment notifications',
    clientCount: sseClients.length
  })}\n\n`);
  
  // Send recent notifications
  if (recentNotifications.length > 0) {
    res.write(`data: ${JSON.stringify({
      type: 'history',
      notifications: recentNotifications.slice(0, 5)
    })}\n\n`);
  }
  
  // Handle client disconnect
  req.on('close', () => {
    console.log('🔌 SSE client disconnected');
    const index = sseClients.indexOf(res);
    if (index !== -1) {
      sseClients.splice(index, 1);
    }
    console.log(`📊 Total connected clients: ${sseClients.length}`);
  });
  
  // Keep connection alive
  const keepAlive = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({
        type: 'ping',
        timestamp: new Date().toISOString()
      })}\n\n`);
    } catch (error) {
      clearInterval(keepAlive);
      const index = sseClients.indexOf(res);
      if (index !== -1) {
        sseClients.splice(index, 1);
      }
    }
  }, 30000); // Ping every 30 seconds
  
  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

// Get recent notifications
app.get('/notifications', (req, res) => {
  res.json(recentNotifications.slice(0, 10)); // Return last 10
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
        .container { max-width: 900px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 10px; }
        .subtitle { color: #666; margin-bottom: 30px; }
        .endpoint { background: #f8f9fa; padding: 15px; border-radius: 5px; font-family: monospace; margin: 20px 0; }
        .example { background: #2d3748; color: #e2e8f0; padding: 15px; border-radius: 5px; margin: 10px 0; overflow-x: auto; }
        .copy-btn { background: #4299e1; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-left: 10px; }
        .event-types { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .event-type { background: #f7fafc; padding: 15px; border-radius: 5px; border-left: 4px solid #4299e1; }
        
        /* Sound Customization Styles */
        .sound-section { background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 30px 0; }
        .sound-controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; }
        .sound-control { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .sound-control h4 { margin: 0 0 15px 0; color: #2d3748; display: flex; align-items: center; gap: 10px; }
        .sound-buttons { display: flex; gap: 10px; margin: 10px 0; flex-wrap: wrap; }
        .btn { padding: 8px 16px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; }
        .btn-primary { background: #4299e1; color: white; }
        .btn-success { background: #48bb78; color: white; }
        .btn-danger { background: #f56565; color: white; }
        .btn-secondary { background: #a0aec0; color: white; }
        .file-input { margin: 10px 0; }
        .sound-status { font-size: 12px; color: #666; margin-top: 5px; }
        .volume-control { margin: 20px 0; }
        .volume-slider { width: 100%; margin: 10px 0; }
        
        /* Event Icons */
        .event-icon { font-size: 20px; }
        
        /* Notification Log Styles */
        .log-entry {
          display: flex;
          align-items: flex-start;
          padding: 8px;
          border-bottom: 1px solid #f1f5f9;
          transition: background-color 0.3s ease;
        }
        
        .log-entry.new {
          background-color: #e6fffa;
          animation: highlight 2s ease-out;
        }
        
        .log-entry.system-message {
          background-color: #f7fafc;
          font-style: italic;
        }
        
        .log-entry.system-message.success {
          background-color: #f0fff4;
          color: #22543d;
        }
        
        .log-entry.system-message.error {
          background-color: #fed7d7;
          color: #742a2a;
        }
        
        .log-time {
          min-width: 80px;
          color: #a0aec0;
          font-size: 12px;
          margin-right: 10px;
          margin-top: 2px;
        }
        
        .log-content {
          flex: 1;
          line-height: 1.4;
        }
        
        .log-icon {
          margin-right: 8px;
          font-size: 16px;
        }
        
        @keyframes highlight {
          0% { background-color: #bee3f8; }
          100% { background-color: #e6fffa; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚨 Railway Deployment Alert</h1>
        <p class="subtitle">Real-time audio notifications for Railway deployment events via webhooks</p>
        
        <div style="background: #e6fffa; border: 1px solid #38b2ac; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h2>🎯 Railway Webhook Setup</h2>
          <p><strong>Add this webhook URL to your Railway project:</strong></p>
          <div class="endpoint">
            ${req.get('host').includes('railway.app') ? 'https' : req.protocol}://${req.get('host')}/webhook
            <button class="copy-btn" onclick="copyToClipboard('${req.get('host').includes('railway.app') ? 'https' : req.protocol}://${req.get('host')}/webhook')">Copy</button>
          </div>
          <p style="margin-top: 15px; color: #2d3748; font-size: 14px;">
            <strong>Setup Instructions:</strong><br>
            1. Go to your Railway project settings<br>
            2. Navigate to "Webhooks" section<br>
            3. Click "New Webhook"<br>
            4. Paste the URL above<br>
            5. Select all deployment events<br>
            6. Save the webhook
          </p>
        </div>
        
        <h2>📋 Supported Railway Webhook Events</h2>
        <div class="event-types">
          <div class="event-type">
            <strong>🚀 deployment.initialize</strong><br>
            Deployment process starts
          </div>
          <div class="event-type">
            <strong>⏳ deployment.queued</strong><br>
            Deployment added to queue
          </div>
          <div class="event-type">
            <strong>🔨 deployment.building</strong><br>
            Build process started
          </div>
          <div class="event-type">
            <strong>📦 deployment.deploying</strong><br>
            Deploying to environment
          </div>
          <div class="event-type">
            <strong>✅ deployment.success</strong><br>
            Deployment completed successfully
          </div>
          <div class="event-type">
            <strong>❌ deployment.failed</strong><br>
            Deployment failed
          </div>
          <div class="event-type">
            <strong>💥 deployment.crashed</strong><br>
            Service crashed after deployment
          </div>
          <div class="event-type">
            <strong>😴 deployment.sleeping</strong><br>
            Service went to sleep
          </div>
          <div class="event-type">
            <strong>🗑️ deployment.removed</strong><br>
            Deployment was removed
          </div>
          <div class="event-type">
            <strong>⏭️ deployment.skipped</strong><br>
            Deployment was skipped
          </div>
        </div>
        
        <div style="background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <h3>🔧 Manual Testing Endpoint</h3>
          <p>For testing or custom integrations (legacy support):</p>
          <div class="endpoint" style="font-size: 14px;">
            ${req.get('host').includes('railway.app') ? 'https' : req.protocol}://${req.get('host')}/notify?project=PROJECT&event=EVENT&message=MESSAGE
            <button class="copy-btn" onclick="copyToClipboard('${req.get('host').includes('railway.app') ? 'https' : req.protocol}://${req.get('host')}/notify')">Copy</button>
          </div>
          <p style="font-size: 12px; color: #666; margin-top: 10px;">
            Example: <code>/notify?project=my-app&event=deployment_success&message=Deploy completed</code>
          </p>
        </div>
        
        <div style="background: #fff5f5; border: 1px solid #feb2b2; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <h3>⚠️ Important Security Notes</h3>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>HTTPS Required:</strong> Railway webhooks require HTTPS endpoints (automatically handled when deployed)</li>
            <li>Keep this dashboard open in your browser to receive audio notifications</li>
            <li>Click anywhere on the page to enable audio (browser requirement)</li>
            <li>Webhook events are automatically processed - no manual setup needed</li>
            <li>All events are logged in real-time with full Railway deployment details</li>
          </ul>
        </div>
        
        <!-- Sound Customization Section -->
        <div class="sound-section">
          <h2>🔊 Sound Customization</h2>
          <p>Customize notification sounds for each event type. Default sounds are generated using Web Audio API.</p>
          
          <div class="volume-control">
            <label for="volume">Master Volume:</label>
            <input type="range" id="volume" class="volume-slider" min="0" max="1" step="0.1" value="0.7" onchange="setVolume(this.value)">
            <span id="volumeDisplay">70%</span>
          </div>
          
          <div class="sound-controls">
            <div class="sound-control">
              <h4><span class="event-icon">🔨</span> Build Start</h4>
              <div class="sound-buttons">
                <button class="btn btn-primary" onclick="testSound('build_start')">Test Sound</button>
                <button class="btn btn-secondary" onclick="document.getElementById('file_build_start').click()">Upload Custom</button>
                <button class="btn btn-danger" onclick="removeCustomSound('build_start')">Reset to Default</button>
              </div>
              <input type="file" id="file_build_start" class="file-input" accept="audio/*" style="display:none" onchange="uploadCustomSound('build_start', this.files[0])">
              <div id="status_build_start" class="sound-status">Using default sound</div>
            </div>
            
            <div class="sound-control">
              <h4><span class="event-icon">✅</span> Build Success</h4>
              <div class="sound-buttons">
                <button class="btn btn-primary" onclick="testSound('build_success')">Test Sound</button>
                <button class="btn btn-secondary" onclick="document.getElementById('file_build_success').click()">Upload Custom</button>
                <button class="btn btn-danger" onclick="removeCustomSound('build_success')">Reset to Default</button>
              </div>
              <input type="file" id="file_build_success" class="file-input" accept="audio/*" style="display:none" onchange="uploadCustomSound('build_success', this.files[0])">
              <div id="status_build_success" class="sound-status">Using default sound</div>
            </div>
            
            <div class="sound-control">
              <h4><span class="event-icon">❌</span> Build Failure</h4>
              <div class="sound-buttons">
                <button class="btn btn-primary" onclick="testSound('build_failure')">Test Sound</button>
                <button class="btn btn-secondary" onclick="document.getElementById('file_build_failure').click()">Upload Custom</button>
                <button class="btn btn-danger" onclick="removeCustomSound('build_failure')">Reset to Default</button>
              </div>
              <input type="file" id="file_build_failure" class="file-input" accept="audio/*" style="display:none" onchange="uploadCustomSound('build_failure', this.files[0])">
              <div id="status_build_failure" class="sound-status">Using default sound</div>
            </div>
            
            <div class="sound-control">
              <h4><span class="event-icon">🚀</span> Deployment Success</h4>
              <div class="sound-buttons">
                <button class="btn btn-primary" onclick="testSound('deployment_success')">Test Sound</button>
                <button class="btn btn-secondary" onclick="document.getElementById('file_deployment_success').click()">Upload Custom</button>
                <button class="btn btn-danger" onclick="removeCustomSound('deployment_success')">Reset to Default</button>
              </div>
              <input type="file" id="file_deployment_success" class="file-input" accept="audio/*" style="display:none" onchange="uploadCustomSound('deployment_success', this.files[0])">
              <div id="status_deployment_success" class="sound-status">Using default sound</div>
            </div>
            
            <div class="sound-control">
              <h4><span class="event-icon">💥</span> Deployment Failure</h4>
              <div class="sound-buttons">
                <button class="btn btn-primary" onclick="testSound('deployment_failure')">Test Sound</button>
                <button class="btn btn-secondary" onclick="document.getElementById('file_deployment_failure').click()">Upload Custom</button>
                <button class="btn btn-danger" onclick="removeCustomSound('deployment_failure')">Reset to Default</button>
              </div>
              <input type="file" id="file_deployment_failure" class="file-input" accept="audio/*" style="display:none" onchange="uploadCustomSound('deployment_failure', this.files[0])">
              <div id="status_deployment_failure" class="sound-status">Using default sound</div>
            </div>
            
            <div class="sound-control">
              <h4><span class="event-icon">🚨</span> Service Crash</h4>
              <div class="sound-buttons">
                <button class="btn btn-primary" onclick="testSound('service_crash')">Test Sound</button>
                <button class="btn btn-secondary" onclick="document.getElementById('file_service_crash').click()">Upload Custom</button>
                <button class="btn btn-danger" onclick="removeCustomSound('service_crash')">Reset to Default</button>
              </div>
              <input type="file" id="file_service_crash" class="file-input" accept="audio/*" style="display:none" onchange="uploadCustomSound('service_crash', this.files[0])">
              <div id="status_service_crash" class="sound-status">Using default sound</div>
            </div>
          </div>
        </div>
        
        <h2>Railway Deployment Events</h2>
        <div class="event-types">
          <div class="event-type">
            <strong>🔄 initializing</strong><br>
            Deployment is being initialized
          </div>
          <div class="event-type">
            <strong>⏳ queued</strong><br>
            Deployment is queued for processing
          </div>
          <div class="event-type">
            <strong>🔨 building</strong><br>
            Railway is building your project
          </div>
          <div class="event-type">
            <strong>🚀 deploying</strong><br>
            Deployment is in progress
          </div>
          <div class="event-type">
            <strong>✅ deployment_success</strong><br>
            Deployment completed successfully
          </div>
          <div class="event-type">
            <strong>❌ deployment_failure</strong><br>
            Deployment failed
          </div>
          <div class="event-type">
            <strong>💥 service_crash</strong><br>
            Service crashed after deployment
          </div>
          <div class="event-type">
            <strong>😴 sleeping</strong><br>
            Service is sleeping (idle)
          </div>
          <div class="event-type">
            <strong>🗑️ removed</strong><br>
            Deployment was removed
          </div>
          <div class="event-type">
            <strong>⏭️ skipped</strong><br>
            Deployment was skipped
          </div>
        </div>
        
        <h2>🚀 Railway Webhook Integration</h2>
        
        <h3>Step 1: Deploy This Service</h3>
        <div class="example">
# Deploy to Railway
railway login
railway link [your-project-id]
railway up

# Or deploy to any hosting service that supports webhooks
        </div>
        
        <h3>Step 2: Configure Railway Webhook</h3>
        <div class="example">
1. Go to your Railway project → Settings → Webhooks
2. Click "New Webhook"
3. Endpoint: ${req.get('host').includes('railway.app') ? 'https' : req.protocol}://${req.get('host')}/webhook
4. Select Events:
   ✅ Initialized    ✅ Queued       ✅ Building
   ✅ Deploying      ✅ Success      ✅ Failed
   ✅ Crashed        ✅ Sleeping     ✅ Removed
5. Save Webhook
        </div>
        
        <h3>Step 3: Open Dashboard & Deploy</h3>
        <div class="example">
1. Keep this dashboard open: ${req.get('host').includes('railway.app') ? 'https' : req.protocol}://${req.get('host')}
2. Deploy your Railway project
3. Get real-time audio notifications! 🔊
        </div>
        
        <!-- Live Notification Log -->
        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 30px 0;">
          <h2>📊 Live Notification Log</h2>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <div>
              <strong>Connection Status:</strong> <span id="connectionStatus">⚪ Disconnected</span>
            </div>
            <div id="notificationPermission"></div>
          </div>
          
          <div id="notificationLog" style="background: white; border: 1px solid #e2e8f0; border-radius: 5px; height: 300px; overflow-y: auto; padding: 10px; font-family: monospace; font-size: 14px;">
            <div class="log-entry system-message">
              <div class="log-time">--:--:--</div>
              <div class="log-content">
                <span class="log-icon">💡</span>
                Waiting for notifications... Send a test notification or trigger a deployment to see live updates here.
              </div>
            </div>
          </div>
        </div>
        
        <h3>🧪 Test Your Setup</h3>
        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin: 15px 0;">
          <button onclick="testNotification()" style="background: #48bb78; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
            🚀 Test Deployment Success
          </button>
          <button onclick="testWebhook('deployment.building')" style="background: #ed8936; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
            🔨 Test Building Event
          </button>
          <button onclick="testWebhook('deployment.failed')" style="background: #f56565; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
            ❌ Test Failure Event
          </button>
          <button onclick="connectToNotifications()" style="background: #4299e1; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
            🔄 Reconnect
          </button>
        </div>
        
        <div style="background: #f0fff4; border: 1px solid #9ae6b4; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <h4>📊 Webhook Payload Example</h4>
          <p style="margin-bottom: 10px;">Railway sends webhook payloads like this:</p>
          <div class="example" style="font-size: 12px;">
{
  "type": "deployment.success",
  "project": {
    "id": "abc123",
    "name": "my-awesome-app"
  },
  "deployment": {
    "id": "def456", 
    "status": "SUCCESS",
    "url": "https://my-app.railway.app"
  },
  "environment": {
    "name": "production"
  }
}
          </div>
        </div>
        
        <p style="margin-top: 30px; color: #666; font-size: 14px;">
          Replace MY_PROJECT with your actual project name. The || true ensures builds don't fail if notifications fail.
        </p>
      </div>
      
      <script>
        // Sound system with better browser compatibility
        class DeploymentSounds {
          constructor() {
            this.audioContext = null;
            this.isInitialized = false;
            this.volume = 0.7;
            this.loadSettings();
          }

          // Initialize audio context (must be called after user interaction)
          async initAudio() {
            if (this.isInitialized) return true;
            
            try {
              this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
              
              // Resume if suspended (browser autoplay policy)
              if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
              }
              
              this.isInitialized = true;
              console.log('Audio initialized successfully');
              return true;
            } catch (e) {
              console.warn('Web Audio API not supported:', e);
              return false;
            }
          }

          // Load settings from localStorage
          loadSettings() {
            this.volume = parseFloat(localStorage.getItem('volume') || '0.7');
          }

          // Generate a tone
          async generateTone(frequency, duration, type = 'sine', volume = null) {
            if (!await this.initAudio()) return;
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.type = type;

            const vol = (volume !== null ? volume : this.volume) * 0.3; // Reduce volume to prevent distortion
            
            // Smooth envelope
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(vol, this.audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
          }

          // Generate sequence of tones
          async generateSequence(notes, noteDuration = 0.2) {
            for (let i = 0; i < notes.length; i++) {
              const note = notes[i];
              setTimeout(() => {
                this.generateTone(note.frequency, noteDuration, note.type || 'sine');
              }, i * noteDuration * 1000);
            }
          }

          // Fallback: Play simple beep using HTML5 Audio with data URL
          playFallbackBeep(frequency = 800, duration = 200) {
            try {
              // Create a simple beep sound as data URL
              const beepSound = this.createBeepDataURL(frequency, duration);
              const audio = new Audio(beepSound);
              audio.volume = this.volume * 0.5;
              audio.play().catch(e => console.warn('Fallback beep failed:', e));
              console.log('Playing fallback beep');
            } catch (e) {
              console.warn('Fallback beep failed:', e);
            }
          }

          // Create a simple beep sound as data URL (very basic)
          createBeepDataURL(frequency, duration) {
            // This is a very simple approach - just return a short data URL for a basic sound
            // In a real implementation, you'd generate actual audio data
            return "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT";
          }

          // Play custom sound from file
          async playCustomSound(base64Data) {
            try {
              const audio = new Audio(base64Data);
              audio.volume = this.volume;
              await audio.play();
              console.log('Playing custom sound');
            } catch (e) {
              console.warn('Could not play custom sound:', e);
              throw e;
            }
          }

          // Default sound patterns with fallback
          async playBuildStart() {
            console.log('Playing build start sound');
            try {
              if (await this.initAudio()) {
                await this.generateTone(440, 0.3, 'sine');
              } else {
                this.playFallbackBeep(440, 300);
              }
            } catch (e) {
              console.warn('Build start sound failed, using fallback');
              this.playFallbackBeep(440, 300);
            }
          }

          async playBuildSuccess() {
            console.log('Playing build success sound');
            try {
              if (await this.initAudio()) {
                await this.generateSequence([
                  { frequency: 523, type: 'sine' },  // C5
                  { frequency: 659, type: 'sine' },  // E5
                  { frequency: 784, type: 'sine' }   // G5
                ], 0.15);
              } else {
                this.playFallbackBeep(659, 200);
              }
            } catch (e) {
              console.warn('Build success sound failed, using fallback');
              this.playFallbackBeep(659, 200);
            }
          }

          async playBuildFailure() {
            console.log('Playing build failure sound');
            try {
              if (await this.initAudio()) {
                await this.generateSequence([
                  { frequency: 400, type: 'sawtooth' },
                  { frequency: 300, type: 'sawtooth' },
                  { frequency: 200, type: 'sawtooth' }
                ], 0.2);
              } else {
                this.playFallbackBeep(300, 400);
              }
            } catch (e) {
              console.warn('Build failure sound failed, using fallback');
              this.playFallbackBeep(300, 400);
            }
          }

          async playDeploymentSuccess() {
            console.log('Playing deployment success sound');
            try {
              if (await this.initAudio()) {
                await this.generateSequence([
                  { frequency: 523, type: 'sine' },  // C5
                  { frequency: 659, type: 'sine' },  // E5
                  { frequency: 784, type: 'sine' },  // G5
                  { frequency: 1047, type: 'sine' }  // C6
                ], 0.12);
              } else {
                this.playFallbackBeep(784, 150);
              }
            } catch (e) {
              console.warn('Deployment success sound failed, using fallback');
              this.playFallbackBeep(784, 150);
            }
          }

          async playDeploymentFailure() {
            console.log('Playing deployment failure sound');
            try {
              if (await this.initAudio()) {
                await this.generateSequence([
                  { frequency: 800, type: 'square' },
                  { frequency: 600, type: 'square' },
                  { frequency: 800, type: 'square' },
                  { frequency: 600, type: 'square' }
                ], 0.15);
              } else {
                this.playFallbackBeep(700, 300);
              }
            } catch (e) {
              console.warn('Deployment failure sound failed, using fallback');
              this.playFallbackBeep(700, 300);
            }
          }

          async playServiceCrash() {
            console.log('Playing service crash sound');
            try {
              if (await this.initAudio()) {
                await this.generateSequence([
                  { frequency: 1000, type: 'sawtooth' },
                  { frequency: 800, type: 'sawtooth' },
                  { frequency: 1000, type: 'sawtooth' },
                  { frequency: 800, type: 'sawtooth' },
                  { frequency: 1000, type: 'sawtooth' }
                ], 0.1);
              } else {
                this.playFallbackBeep(900, 100);
              }
            } catch (e) {
              console.warn('Service crash sound failed, using fallback');
              this.playFallbackBeep(900, 100);
            }
          }

          // Set volume
          setVolume(volume) {
            this.volume = volume;
            localStorage.setItem('volume', volume);
          }
        }

        // Initialize sound system
        const deploymentSounds = new DeploymentSounds();

        // Sound mapping for Railway events
        const soundMethods = {
          // Railway webhook events
          initializing: () => deploymentSounds.playInitializing(),
          queued: () => deploymentSounds.playQueued(),
          building: () => deploymentSounds.playBuilding(),
          deploying: () => deploymentSounds.playDeploying(),
          deployment_success: () => deploymentSounds.playDeploymentSuccess(),
          deployment_failure: () => deploymentSounds.playDeploymentFailure(),
          service_crash: () => deploymentSounds.playServiceCrash(),
          sleeping: () => deploymentSounds.playSleeping(),
          removed: () => deploymentSounds.playRemoved(),
          skipped: () => deploymentSounds.playSkipped(),
          
          // Legacy events (backward compatibility)
          build_start: () => deploymentSounds.playBuilding(),
          build_success: () => deploymentSounds.playDeploymentSuccess(),
          build_failure: () => deploymentSounds.playDeploymentFailure()
        };

        // Main function to play notification sound
        async function playNotificationSound(eventType) {
          try {
            console.log('Playing notification sound for:', eventType);
            
            // Check for custom sound first
            const customSound = localStorage.getItem(\`sound_\${eventType}\`);
            if (customSound) {
              await deploymentSounds.playCustomSound(customSound);
            } else if (soundMethods[eventType]) {
              await soundMethods[eventType]();
            } else {
              console.warn('Unknown event type:', eventType);
            }
          } catch (e) {
            console.error('Error playing sound:', e);
            updateSoundStatus(eventType, 'Error playing sound - check browser permissions');
          }
        }

        // Test sound function
        async function testSound(eventType) {
          console.log('Testing sound for:', eventType);
          try {
            await playNotificationSound(eventType);
            updateSoundStatus(eventType, 'Sound test successful!');
          } catch (e) {
            console.error('Sound test failed:', e);
            updateSoundStatus(eventType, 'Sound test failed - click to enable audio');
          }
        }

        // Upload custom sound
        function uploadCustomSound(eventType, file) {
          if (!file) {
            console.warn('No file selected');
            return;
          }
          
          console.log('Uploading custom sound for:', eventType, file.name);
          updateSoundStatus(eventType, 'Uploading...');
          
          const reader = new FileReader();
          reader.onload = function(e) {
            try {
              localStorage.setItem(\`sound_\${eventType}\`, e.target.result);
              updateSoundStatus(eventType, \`Custom sound uploaded: \${file.name}\`);
              console.log('Custom sound saved for:', eventType);
            } catch (err) {
              console.error('Error saving custom sound:', err);
              updateSoundStatus(eventType, 'Error uploading sound');
            }
          };
          reader.onerror = function() {
            console.error('Error reading file');
            updateSoundStatus(eventType, 'Error reading file');
          };
          reader.readAsDataURL(file);
        }

        // Remove custom sound
        function removeCustomSound(eventType) {
          localStorage.removeItem(\`sound_\${eventType}\`);
          updateSoundStatus(eventType, 'Reset to default sound');
          console.log('Removed custom sound for:', eventType);
        }

        // Update sound status display
        function updateSoundStatus(eventType, message) {
          const statusElement = document.getElementById(\`status_\${eventType}\`);
          if (statusElement) {
            statusElement.textContent = message;
            statusElement.style.color = '#48bb78';
            setTimeout(() => {
              if (statusElement.textContent === message) {
                statusElement.style.color = '#666';
                // Show current status
                const customSound = localStorage.getItem(\`sound_\${eventType}\`);
                if (customSound) {
                  statusElement.textContent = 'Custom sound loaded';
                } else {
                  statusElement.textContent = 'Using default sound';
                }
              }
            }, 3000);
          }
        }

        // Set volume
        function setVolume(volume) {
          deploymentSounds.setVolume(volume);
          console.log('Volume set to:', Math.round(volume * 100) + '%');
        }

        // Real-time notification system
        let eventSource = null;
        let connectionStatus = 'disconnected';
        
        function connectToNotifications() {
          if (eventSource) {
            eventSource.close();
          }
          
          console.log('🔌 Connecting to notification stream...');
          updateConnectionStatus('connecting');
          
          eventSource = new EventSource('/events');
          
          eventSource.onopen = function() {
            console.log('✅ Connected to notification stream');
            updateConnectionStatus('connected');
          };
          
          eventSource.onmessage = function(event) {
            try {
              const data = JSON.parse(event.data);
              console.log('📨 Received SSE message:', data);
              
              switch (data.type) {
                case 'connected':
                  console.log('🎉 Successfully connected to notifications');
                  showNotificationLog('Connected to deployment notifications', 'success');
                  break;
                  
                case 'notification':
                  console.log('🚨 New notification received:', data.notification);
                  handleNewNotification(data.notification);
                  break;
                  
                case 'history':
                  console.log('📚 Received notification history:', data.notifications.length, 'items');
                  data.notifications.forEach(notification => {
                    displayNotificationInLog(notification, false); // Don't play sound for history
                  });
                  break;
                  
                case 'ping':
                  // Keep-alive ping, no action needed
                  break;
                  
                default:
                  console.log('❓ Unknown message type:', data.type);
              }
            } catch (e) {
              console.error('❌ Error parsing SSE message:', e);
            }
          };
          
          eventSource.onerror = function(event) {
            console.error('❌ SSE connection error:', event);
            updateConnectionStatus('error');
            
            // Attempt to reconnect after 5 seconds
            setTimeout(() => {
              if (connectionStatus === 'error') {
                console.log('🔄 Attempting to reconnect...');
                connectToNotifications();
              }
            }, 5000);
          };
        }
        
        function updateConnectionStatus(status) {
          connectionStatus = status;
          const statusElement = document.getElementById('connectionStatus');
          if (statusElement) {
            switch (status) {
              case 'connected':
                statusElement.innerHTML = '🟢 Connected';
                statusElement.style.color = '#48bb78';
                break;
              case 'connecting':
                statusElement.innerHTML = '🟡 Connecting...';
                statusElement.style.color = '#ed8936';
                break;
              case 'error':
                statusElement.innerHTML = '🔴 Disconnected';
                statusElement.style.color = '#f56565';
                break;
              default:
                statusElement.innerHTML = '⚪ Unknown';
                statusElement.style.color = '#a0aec0';
            }
          }
        }
        
        function handleNewNotification(notification) {
          console.log('🎵 Processing notification for sound:', notification.event);
          
          // Display in log
          displayNotificationInLog(notification, true);
          
          // Play sound
          playNotificationSound(notification.event);
          
          // Show browser notification if permission granted
          if (Notification.permission === 'granted') {
            new Notification(\`Deployment Alert: \${notification.project}\`, {
              body: \`\${notification.event}: \${notification.message}\`,
              icon: '/favicon.ico'
            });
          }
        }
        
        function displayNotificationInLog(notification, isNew = false) {
          const logContainer = document.getElementById('notificationLog');
          if (!logContainer) return;
          
          const logEntry = document.createElement('div');
          logEntry.className = \`log-entry \${isNew ? 'new' : ''}\`;
          
          const eventIcon = getEventIcon(notification.event);
          const timestamp = new Date(notification.receivedAt || notification.timestamp).toLocaleTimeString();
          
          logEntry.innerHTML = \`
            <div class="log-time">\${timestamp}</div>
            <div class="log-content">
              <span class="log-icon">\${eventIcon}</span>
              <strong>\${notification.project}</strong>: \${notification.event}
              \${notification.message ? \`<br><small>\${notification.message}</small>\` : ''}
            </div>
          \`;
          
          logContainer.insertBefore(logEntry, logContainer.firstChild);
          
          // Keep only last 20 entries
          while (logContainer.children.length > 20) {
            logContainer.removeChild(logContainer.lastChild);
          }
          
          // Remove 'new' class after animation
          if (isNew) {
            setTimeout(() => {
              logEntry.classList.remove('new');
            }, 2000);
          }
        }
        
        function getEventIcon(event) {
          const icons = {
            build_start: '🔨',
            build_success: '✅',
            build_failure: '❌',
            deployment_success: '🚀',
            deployment_failure: '💥',
            service_crash: '🚨'
          };
          return icons[event] || '📢';
        }
        
        function showNotificationLog(message, type = 'info') {
          const logContainer = document.getElementById('notificationLog');
          if (!logContainer) return;
          
          const logEntry = document.createElement('div');
          logEntry.className = \`log-entry system-message \${type}\`;
          logEntry.innerHTML = \`
            <div class="log-time">\${new Date().toLocaleTimeString()}</div>
            <div class="log-content">
              <span class="log-icon">ℹ️</span>
              \${message}
            </div>
          \`;
          
          logContainer.insertBefore(logEntry, logContainer.firstChild);
        }
        
        // Request notification permission
        function requestNotificationPermission() {
          if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
              console.log('Notification permission:', permission);
              updateNotificationPermissionStatus();
            });
          }
        }
        
        function updateNotificationPermissionStatus() {
          const statusElement = document.getElementById('notificationPermission');
          if (statusElement && 'Notification' in window) {
            switch (Notification.permission) {
              case 'granted':
                statusElement.innerHTML = '🔔 Browser notifications enabled';
                statusElement.style.color = '#48bb78';
                break;
              case 'denied':
                statusElement.innerHTML = '🔕 Browser notifications blocked';
                statusElement.style.color = '#f56565';
                break;
              default:
                statusElement.innerHTML = '<button onclick="requestNotificationPermission()" class="btn btn-secondary">Enable Browser Notifications</button>';
            }
          }
        }

        // Other functions
        function copyToClipboard(text) {
          navigator.clipboard.writeText(text).then(() => {
            alert('Copied to clipboard!');
          });
        }
        
        function testNotification() {
          fetch('/notify?project=test&event=deployment_success&message=Test notification from web interface')
            .then(res => res.json())
            .then(data => {
              console.log('✅ Test notification sent:', data);
              showNotificationLog(\`Test notification sent (notified \${data.clientsNotified} clients)\`, 'success');
            })
            .catch(err => {
              console.error('❌ Error sending test notification:', err);
              showNotificationLog('Error sending test notification: ' + err.message, 'error');
            });
        }
        
        function testWebhook(eventType) {
          const testPayload = {
            type: eventType,
            project: {
              id: 'test-project-123',
              name: 'Test Project'
            },
            deployment: {
              id: 'test-deployment-456',
              status: eventType.includes('success') ? 'SUCCESS' : eventType.includes('failed') ? 'FAILED' : 'BUILDING',
              url: eventType.includes('success') ? 'https://test-app.railway.app' : null
            },
            environment: {
              name: 'production'
            }
          };
          
          fetch('/webhook', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(testPayload)
          })
          .then(res => res.json())
          .then(data => {
            console.log('✅ Test webhook sent:', data);
            showNotificationLog(\`Test webhook \${eventType} sent (notified \${data.clientsNotified} clients)\`, 'success');
          })
          .catch(err => {
            console.error('❌ Error sending test webhook:', err);
            showNotificationLog('Error sending test webhook: ' + err.message, 'error');
          });
        }
        
        // Initialize volume display and sound system
        document.addEventListener('DOMContentLoaded', function() {
          console.log('🚀 Page loaded, initializing deployment alert system...');
          
          const volumeSlider = document.getElementById('volume');
          const volumeDisplay = document.getElementById('volumeDisplay');
          
          // Load saved volume
          const savedVolume = localStorage.getItem('volume') || '0.7';
          volumeSlider.value = savedVolume;
          volumeDisplay.textContent = Math.round(savedVolume * 100) + '%';
          
          // Update volume display
          volumeSlider.addEventListener('input', function() {
            volumeDisplay.textContent = Math.round(this.value * 100) + '%';
          });
          
          // Update sound status for custom sounds
          const eventTypes = ['build_start', 'build_success', 'build_failure', 'deployment_success', 'deployment_failure', 'service_crash'];
          eventTypes.forEach(eventType => {
            const customSound = localStorage.getItem(\`sound_\${eventType}\`);
            if (customSound) {
              updateSoundStatus(eventType, 'Custom sound loaded');
            }
          });
          
          // Initialize notification permission status
          updateNotificationPermissionStatus();
          
          // Connect to live notifications
          connectToNotifications();
          
          // Add click handler to initialize audio on first interaction
          document.body.addEventListener('click', function initAudio() {
            console.log('🎵 First click detected, initializing audio...');
            if (window.deploymentSounds) {
              deploymentSounds.initAudio().then(success => {
                if (success) {
                  console.log('✅ Audio system ready!');
                  showNotificationLog('Audio system initialized - sounds will now play', 'success');
                } else {
                  console.warn('❌ Audio system failed to initialize');
                  showNotificationLog('Audio system failed to initialize - check browser permissions', 'error');
                }
              });
            }
            // Remove this listener after first click
            document.body.removeEventListener('click', initAudio);
          }, { once: true });
        });
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🚨 Deployment Alert server running on port ${PORT}`);
  console.log(`📡 Notification endpoint: http://localhost:${PORT}/notify`);
});