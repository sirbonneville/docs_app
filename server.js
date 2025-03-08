import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// Function to fetch documentation from GitHub or local file
async function fetchDocumentation() {
  try {
    // Use local file instead of GitHub to ensure proper chunking
    console.log('Using local documentation file...');
    const localPath = path.join(__dirname, 'data/llm-full.txt');
    if (fs.existsSync(localPath)) {
      const text = fs.readFileSync(localPath, 'utf8');
      console.log(`Successfully loaded local documentation: ${text.length} characters`);
      return text;
    } else {
      console.error('Local documentation file not found at:', localPath);
      return null;
    }
    
    if (!response.ok) {
      throw new Error(`Failed to fetch documentation from GitHub: ${response.status} ${response.statusText}`);
    }
    
    const text = await response.text();
    console.log(`Successfully fetched documentation from GitHub: ${text.length} characters`);
    return text;
  } catch (githubError) {
    console.error('Error fetching from GitHub:', githubError);
    
    // Fallback to local file if GitHub fetch fails
    try {
      console.log('Falling back to local documentation file...');
      const localPath = path.join(__dirname, 'data/llm-full.txt');
      if (fs.existsSync(localPath)) {
        const text = fs.readFileSync(localPath, 'utf8');
        console.log(`Successfully loaded local documentation: ${text.length} characters`);
        return text;
      } else {
        console.error('Local documentation file not found at:', localPath);
        return null;
      }
    } catch (localError) {
      console.error('Error fetching documentation:', localError);
      return null;
    }
  }
}

// API endpoints
app.post('/api/anthropic', async (req, res) => {
  try {
    console.log('Received request:', req.body);
    
    // Fetch documentation
    const documentation = await fetchDocumentation();
    
    if (!documentation) {
      console.error('Failed to fetch documentation');
      return res.status(500).json({ error: 'Failed to fetch documentation' });
    }
    
    // Log documentation size
    console.log(`Documentation size: ${documentation.length} characters`);
    // Rough token estimation (approx 4 chars per token)
    const estimatedTokens = Math.ceil(documentation.length / 4);
    console.log(`Estimated tokens in documentation: ~${estimatedTokens}`);
    
    // Get the user's query
    const userQuery = req.body.messages[0].content;
    console.log(`User query: "${userQuery}" (${userQuery.length} characters)`);
    
    // Split documentation into chunks of approximately 10,000 tokens each
    const chunks = splitIntoChunks(documentation);
    console.log(`Split documentation into ${chunks.length} chunks`);
    
    // Find relevant chunks based on the query
    const relevantChunks = findRelevantChunks(userQuery, chunks, 3);
    console.log(`Selected ${relevantChunks.length} relevant chunks`);
    
    // Combine relevant chunks (with a limit to avoid token overflow)
    const contextText = relevantChunks.join('\n\n');
    console.log(`Combined context size: ${contextText.length} characters (estimated ~${Math.ceil(contextText.length / 4)} tokens)`);
    
    // Add a system prompt to guide Claude's behavior with improved formatting instructions
    const systemPrompt = "You are a documentation assistant specialized in answering questions based on the provided documentation. Focus exclusively on the documentation content when answering questions. If the information isn't clearly stated in the documentation, acknowledge this limitation rather than making assumptions. Format your responses with proper HTML-compatible markdown: use ## for headings (not #), * for bullet points, **text** for bold. Do not use triple hash marks (###) or other non-standard markdown. Structure your response with clear paragraphs and use numbered lists for steps or processes. Be concise but thorough in your explanations.";
    
    // Create a new messages array with context
    const messagesWithContext = [
      {
        role: "user",
        content: `Documentation context:\n${contextText}\n\nUser query: ${userQuery}\n\nPlease answer the query based on the provided documentation context. Format your response with proper markdown for readability.`
      }
    ];
    
    // Log the total size of the message being sent
    const totalMessageSize = messagesWithContext[0].content.length;
    console.log(`Total message size: ${totalMessageSize} characters (estimated ~${Math.ceil(totalMessageSize / 4)} tokens)`);
    
    // Update the request body with system prompt
    const requestBody = {
      ...req.body,
      model: "claude-3-5-haiku-20241022",
      system: systemPrompt,
      max_tokens: 8000,
      messages: messagesWithContext
    };
    
    // Log the stringified request body size
    const requestBodyString = JSON.stringify(requestBody);
    console.log(`Request body size: ${requestBodyString.length} bytes`);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody),
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
    
    console.log('Processed API response:', data);
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

// Function to split text into chunks of approximately the specified size
function splitIntoChunks(text, maxChunkSize = 2000) {
  // Simple chunking by paragraphs and then combining until we reach target size
  // Using a much smaller chunk size (2000 tokens) to ensure we don't exceed Claude's token limits
  const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;
  
  for (const paragraph of paragraphs) {
    // Rough estimation: 1 token ≈ 4 characters
    const paragraphSize = Math.ceil(paragraph.length / 4);
    
    if (currentSize + paragraphSize > maxChunkSize && currentChunk.length > 0) {
      // Current chunk is full, save it and start a new one
      chunks.push(currentChunk.join('\n\n'));
      
      // Start new chunk
      currentChunk = [paragraph];
      currentSize = paragraphSize;
    } else {
      currentChunk.push(paragraph);
      currentSize += paragraphSize;
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n\n'));
  }
  
  return chunks;
}

// Function to find relevant chunks based on query similarity
function findRelevantChunks(query, chunks, maxChunks = 3) {
  // Simple keyword matching for now
  const queryWords = query.toLowerCase().split(/\W+/).filter(word => word.length > 3);
  
  // Score each chunk based on keyword matches
  const scoredChunks = chunks.map(chunk => {
    const chunkLower = chunk.toLowerCase();
    let score = 0;
    
    for (const word of queryWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = (chunkLower.match(regex) || []).length;
      score += matches;
    }
    
    // Add bonus points for exact phrase matches
    const exactPhraseMatches = (chunkLower.match(new RegExp(query.toLowerCase(), 'g')) || []).length;
    score += exactPhraseMatches * 10;
    
    return { chunk, score };
  });
  
  // Sort by score (descending) and take top N
  const selectedChunks = scoredChunks
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks)
    .filter(item => item.score > 0) // Only include chunks with matches
    .map(item => item.chunk);
  
  // If no chunks have matches, return a small subset of random chunks
  if (selectedChunks.length === 0) {
    return chunks
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);
  }
  
  return selectedChunks;
}

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'client/dist')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

app.listen(3001, () => {
  console.log('Server running on port 3001');
});