#!/usr/bin/env node

/**
 * Test script for background tab notifications
 * 
 * This script sends multiple notifications with delays to test
 * how the system handles notifications when the browser tab
 * is in the background.
 */

const { sendNotification } = require('./scripts/deployment-alert.js');

const notifications = [
  { event: 'build_start', message: 'Starting build process...', delay: 0 },
  { event: 'build_success', message: 'Build completed successfully!', delay: 3000 },
  { event: 'deployment_success', message: 'Deployment to production complete!', delay: 6000 },
  { event: 'service_crash', message: 'Service crashed - immediate attention needed!', delay: 9000 }
];

async function runBackgroundTest() {
  console.log('🧪 Starting background notification test...');
  console.log('📱 Switch to another tab/window now to test background behavior!');
  console.log('⏰ Notifications will be sent every 3 seconds...\n');

  for (let i = 0; i < notifications.length; i++) {
    const notification = notifications[i];
    
    setTimeout(async () => {
      try {
        console.log(`📨 Sending notification ${i + 1}/${notifications.length}: ${notification.event}`);
        await sendNotification(notification.event, notification.message);
      } catch (error) {
        console.error(`❌ Failed to send notification ${i + 1}:`, error.message);
      }
      
      if (i === notifications.length - 1) {
        console.log('\n✅ Background test completed!');
        console.log('🔄 Return to the dashboard tab to see missed notification handling.');
      }
    }, notification.delay);
  }
}

runBackgroundTest();