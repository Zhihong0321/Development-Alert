#!/usr/bin/env node

// Simple test script to send deployment notifications
const http = require('http');
const url = require('url');

const SERVER_URL = process.env.NOTIFICATION_URL || 'http://localhost:3000';
const PROJECT_NAME = process.env.PROJECT_NAME || 'eternalgy-ems-frontend';

function sendNotification(event, message = '') {
  const notifyUrl = `${SERVER_URL}/notify?project=${encodeURIComponent(PROJECT_NAME)}&event=${encodeURIComponent(event)}&message=${encodeURIComponent(message)}`;
  
  console.log(`🚨 Sending notification: ${event}`);
  console.log(`📡 URL: ${notifyUrl}`);
  
  const parsedUrl = url.parse(notifyUrl);
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 80,
    path: parsedUrl.path,
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log(`✅ Response (${res.statusCode}):`, data);
    });
  });

  req.on('error', (err) => {
    console.error('❌ Error sending notification:', err.message);
    process.exit(1);
  });

  req.end();
}

// Get event type from command line argument
const eventType = process.argv[2] || 'deployment_success';
const message = process.argv[3] || `${eventType} triggered from test script`;

sendNotification(eventType, message);