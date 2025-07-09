const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment
dotenv.config();

const app = express();

// Basic middleware 
app.use(express.json());
app.use(cors());

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint working' });
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Auth routes 
try {
  const authRoutes = require('./dist/routes/auth.js');
  app.use('/auth', authRoutes.default || authRoutes);
  console.log('✅ Auth routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load auth routes:', error.message);
  process.exit(1);
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

const PORT = 3503;
app.listen(PORT, () => {
  console.log(`🚀 Test server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 OAuth test: http://localhost:${PORT}/auth/slack/url?tenant_id=test&user_id=test`);
});