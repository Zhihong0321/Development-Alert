const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('simple'));

let clients = [];

// Simple notification endpoint
app.all('/notify', (req, res) => {
  const { project, event, message } = req.query;
  
  console.log(`🚨 ${project}: ${event} - ${message}`);
  
  // Send to all connected clients
  clients.forEach(client => {
    client.write(`data: ${JSON.stringify({ project, event, message })}\n\n`);
  });
  
  res.json({ success: true, clients: clients.length });
});

// SSE endpoint
app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  clients.push(res);
  console.log(`Connected clients: ${clients.length}`);
  
  req.on('close', () => {
    clients = clients.filter(client => client !== res);
    console.log(`Connected clients: ${clients.length}`);
  });
});

app.listen(PORT, () => {
  console.log(`🚨 Simple server running on port ${PORT}`);
});