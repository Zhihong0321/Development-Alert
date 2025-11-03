#!/usr/bin/env node

const https = require('https');

// Test Railway webhook endpoint
const WEBHOOK_URL = 'https://development-alert-production.up.railway.app/webhook';

function testWebhook(eventType = 'deployment.success') {
  const testPayload = {
    type: eventType,
    project: {
      id: 'test-project-123',
      name: 'Test Project from Script'
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

  const postData = JSON.stringify(testPayload);
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': 'Railway-Webhook-Test/1.0'
    }
  };

  console.log(`🚨 Testing Railway webhook: ${eventType}`);
  console.log(`📡 URL: ${WEBHOOK_URL}`);
  console.log(`📦 Payload:`, JSON.stringify(testPayload, null, 2));

  const req = https.request(WEBHOOK_URL, options, (res) => {
    let data = '';
    
    console.log(`📊 Status Code: ${res.statusCode}`);
    console.log(`📋 Headers:`, res.headers);
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log(`✅ Response:`, data);
      try {
        const response = JSON.parse(data);
        if (response.success) {
          console.log(`🎉 Webhook test successful!`);
          console.log(`📡 Clients notified: ${response.clientsNotified}`);
        } else {
          console.log(`❌ Webhook test failed:`, response);
        }
      } catch (e) {
        console.log(`⚠️ Non-JSON response:`, data);
      }
    });
  });

  req.on('error', (err) => {
    console.error('❌ Error testing webhook:', err.message);
  });

  req.write(postData);
  req.end();
}

// Test different event types
const eventType = process.argv[2] || 'deployment.success';
testWebhook(eventType);