import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();

app.use(cors());
app.use(express.json());

app.post('/api/anthropic', async (req, res) => {
  try {
    console.log('Received request body:', JSON.stringify(req.body));
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        ...req.body,
        // Ensure the model is compatible with the API version
        model: req.body.model || 'claude-3-haiku-20240307',
        // Set default max_tokens if not provided
        max_tokens: req.body.max_tokens || 4000
      }),
    });
    
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
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3001, () => {
  console.log('Proxy server running on port 3001');
});