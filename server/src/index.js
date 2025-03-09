import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

// Configure environment variables
dotenv.config();

// Get directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes (need to update this to use dynamic import or convert routes to ES modules)
// For now, we'll comment this out and implement a basic route directly
// const apiRoutes = require('./routes/api');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3002; // Changed from 3001 to 3002

// Apply middleware
app.use(helmet({
  // Disable the Content-Security-Policy to allow connections in development
  contentSecurityPolicy: false
})); // Security headers

// Configure CORS with more specific options
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // Add your frontend URLs
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'anthropic-version']
})); 

app.use(express.json()); // Parse JSON bodies
app.use(morgan('dev')); // HTTP request logger

// Temporary direct implementation of the Anthropic API route
app.post('/api/anthropic', async (req, res) => {
  try {
    console.log('Received request:', req.body);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: req.body.model || 'claude-3-haiku-20240307',
        max_tokens: req.body.max_tokens || 4000,
        messages: req.body.messages
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      return res.status(response.status).send(errorText);
    }
    
    const data = await response.json();
    
    // Log token usage details
    console.log('Token usage details:');
    console.log(`- Input tokens: ${data.usage?.input_tokens || 'N/A'}`);
    console.log(`- Output tokens: ${data.usage?.output_tokens || 'N/A'}`);
    console.log(`- Total tokens: ${(data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)}`);
    
    // Include token usage in the response to the client
    const responseWithTokens = {
      ...data,
      token_usage: {
        input_tokens: data.usage?.input_tokens || 0,
        output_tokens: data.usage?.output_tokens || 0,
        total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      }
    };
    res.json(responseWithTokens);
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API routes - commented out until converted to ES modules
// app.use('/api', apiRoutes);

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../../client/build')));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../../client/build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export for testing (using ES modules syntax)
export default app;