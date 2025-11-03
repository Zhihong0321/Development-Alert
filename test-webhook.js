#!/usr/bin/env node

/**
 * Railway Webhook Test Script
 * 
 * This script simulates Railway webhook events for testing the notification system.
 * Usage: node test-webhook.js [event_type] [project_name]
 */

const http = require('http');
const crypto = require('crypto');

const SERVER_URL = process.env.NOTIFICATION_URL || 'http://localhost:3000';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'railway-webhook-secret';

// Railway webhook event types
const RAILWAY_EVENTS = [
  'deployment.initialize',
  'deployment.queued', 
  'deployment.building',
  'deployment.deploying',
  'deployment.success',
  'deployment.failed',
  'deployment.crashed',
  'deployment.sleeping',
  'deployment.removed',
  'deployment.skipped'
];

function generateWebhookPayload(eventType, projectName = 'Test Project') {
  const deploymentId = `test-${Date.now()}`;
  const projectId = `proj-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    type: eventType,
    project: {
      id: projectId,
      name: projectName
    },
    deployment: {
      id: deploymentId,
      status: eventType.includes('success') ? 'SUCCESS' : 
              eventType.includes('failed') ? 'FAILED' :
              eventType.includes('crashed') ? 'CRASHED' : 'BUILDING',
      url: eventType.includes('success') ? `https://${projectName.toLowerCase().replace(/\s+/g, '-')}.railway.app` : null
    },
    environment: {
      name: 'production'
    },
    timestamp: new Date().toISOString()
  };
}

function generateSignature(payload) {
  return crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
}

async function sendWebhook(eventType, projectName) {
  const payload = generateWebhookPayload(eventType, projectName);
  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString);
  
  console.log(`🚨 Sending Railway webhook: ${eventType}`);
  console.log(`📡 Project: ${projectName}`);
  console.log(`🔗 URL: ${SERVER_URL}/webhook`);
  
  const url = new URL(`${SERVER_URL}/webhook`);
  
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payloadString),
      'X-Railway-Signature': signature,
      'User-Agent': 'Railway-Webhook-Test/1.0'
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ Webhook sent successfully (${res.statusCode})`);
          try {
            const response = JSON.parse(data);
            if (response.clientsNotified > 0) {
              console.log(`📡 Notified ${response.clientsNotified} connected client(s)`);
            }
            console.log(`📋 Response:`, response);
          } catch (e) {
            console.log(`📋 Response: ${data}`);
          }
          resolve({ statusCode: res.statusCode, data });
        } else {
          console.error(`❌ Webhook failed: HTTP ${res.statusCode}`);
          console.error(`📋 Response: ${data}`);
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Error sending webhook:', err.message);
      reject(err);
    });

    req.write(payloadString);
    req.end();
  });
}

// Main execution
async function main() {
  const eventType = process.argv[2];
  const projectName = process.argv[3] || 'Test Project';
  
  if (!eventType) {
    console.log('🎯 Railway Webhook Test Script');
    console.log('');
    console.log('Usage: node test-webhook.js [event_type] [project_name]');
    console.log('');
    console.log('Available event types:');
    RAILWAY_EVENTS.forEach(event => {
      console.log(`  - ${event}`);
    });
    console.log('');
    console.log('Examples:');
    console.log('  node test-webhook.js deployment.success "My Awesome App"');
    console.log('  node test-webhook.js deployment.failed');
    console.log('  node test-webhook.js deployment.building "Frontend App"');
    process.exit(0);
  }
  
  if (!RAILWAY_EVENTS.includes(eventType)) {
    console.error(`❌ Invalid event type: ${eventType}`);
    console.error(`Valid events: ${RAILWAY_EVENTS.join(', ')}`);
    process.exit(1);
  }
  
  try {
    await sendWebhook(eventType, projectName);
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to send webhook:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { sendWebhook, generateWebhookPayload };