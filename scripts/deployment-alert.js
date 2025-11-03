#!/usr/bin/env node

/**
 * Deployment Alert Script
 * 
 * This script sends deployment notifications to the notification server.
 * Usage: node scripts/deployment-alert.js [event_type] [message]
 * 
 * Environment Variables:
 * - NOTIFICATION_URL: URL of the notification server (default: http://localhost:3000)
 * - PROJECT_NAME: Name of the project (default: current directory name)
 */

const http = require('http');
const https = require('https');
const url = require('url');
const path = require('path');

// Configuration
const SERVER_URL = process.env.NOTIFICATION_URL || 'http://localhost:3000';
const PROJECT_NAME = process.env.PROJECT_NAME || path.basename(process.cwd());

function sendNotification(event, message = '') {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    const notifyUrl = `${SERVER_URL}/notify?project=${encodeURIComponent(PROJECT_NAME)}&event=${encodeURIComponent(event)}&message=${encodeURIComponent(message)}&timestamp=${encodeURIComponent(timestamp)}`;
    
    console.log(`🚨 Sending deployment alert: ${event}`);
    
    const parsedUrl = new URL(notifyUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      timeout: 5000
    };

    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ Deployment alert sent: ${event} (${res.statusCode})`);
          try {
            const response = JSON.parse(data);
            if (response.clientsNotified > 0) {
              console.log(`📡 Notified ${response.clientsNotified} connected client(s)`);
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
          resolve({ statusCode: res.statusCode, data });
        } else {
          console.error(`❌ Failed to send alert: HTTP ${res.statusCode}`);
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Error sending deployment alert:', err.message);
      reject(err);
    });

    req.on('timeout', () => {
      console.error('❌ Request timeout');
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Main execution
async function main() {
  const eventType = process.argv[2] || 'deployment_success';
  const message = process.argv[3] || '';
  
  try {
    await sendNotification(eventType, message);
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to send notification:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { sendNotification };