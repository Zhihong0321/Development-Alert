const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store recent notifications for display
let recentNotifications = [];

// Notification endpoint
app.all('/notify', (req, res) => {
  const { project, event, timestamp, message } = req.query;
  
  const notification = {
    id: Date.now(),
    project: project || 'unknown',
    event: event || 'unknown',
    timestamp: timestamp || new Date().toISOString(),
    message: message || ''
  };
  
  console.log(`[${notification.timestamp}] ${notification.project}: ${notification.event}`);
  
  // Store notification (keep last 50)
  recentNotifications.unshift(notification);
  if (recentNotifications.length > 50) {
    recentNotifications = recentNotifications.slice(0, 50);
  }
  
  // Send to all connected clients (will implement SSE later)
  res.json({ 
    success: true, 
    received: notification,
    playSound: true  // Signal client to play sound
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
        
        <h2>Event Types</h2>
        <div class="event-types">
          <div class="event-type">
            <strong>🔨 build_start</strong><br>
            When Railway starts building
          </div>
          <div class="event-type">
            <strong>✅ build_success</strong><br>
            When build completes successfully
          </div>
          <div class="event-type">
            <strong>❌ build_failure</strong><br>
            When build fails
          </div>
          <div class="event-type">
            <strong>🚀 deployment_success</strong><br>
            When deployment succeeds
          </div>
          <div class="event-type">
            <strong>💥 deployment_failure</strong><br>
            When deployment fails
          </div>
          <div class="event-type">
            <strong>🚨 service_crash</strong><br>
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
      
      <script src="/sounds.js"></script>
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
              alert('Test notification sent! You should hear a sound if audio is enabled.');
              console.log('Test notification response:', data);
              // Play the sound for the test
              playNotificationSound('build_success');
            })
            .catch(err => {
              alert('Error sending test notification: ' + err.message);
            });
        }
        
        // Initialize volume display and sound system
        document.addEventListener('DOMContentLoaded', function() {
          console.log('Page loaded, initializing sound system...');
          
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
          
          // Add click handler to initialize audio on first interaction
          document.body.addEventListener('click', function initAudio() {
            console.log('First click detected, initializing audio...');
            if (window.deploymentSounds) {
              deploymentSounds.initAudio().then(success => {
                if (success) {
                  console.log('Audio system ready!');
                } else {
                  console.warn('Audio system failed to initialize');
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