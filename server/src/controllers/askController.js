const { Anthropic } = require('@anthropic-ai/sdk');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const embeddingService = require('../services/embeddingService');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Cache for document embeddings to avoid reprocessing
let documentEmbeddings = null;

/**
 * Handles user queries by fetching relevant documentation,
 * constructing a prompt for Claude, and returning the response
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handleQuery(req, res) {
  try {
    const { query, conversationId = uuidv4() } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Fetch relevant documentation chunks based on query similarity
    const documentationContext = await getRelevantDocumentation(query);
    
    // Construct prompt for Claude
    const prompt = constructPrompt(query, documentationContext);
    
    // Send prompt to Claude
    const response = await sendToAnthropic(prompt);
    
    // Return response to client
    return res.status(200).json({
      answer: response,
      conversationId
    });
  } catch (error) {
    console.error('Error handling query:', error);
    return res.status(500).json({
      error: 'Failed to process query',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    });
  }
}

/**
 * Fetches relevant documentation chunks based on the user query
 * @param {string} query - User's question
 * @returns {string} - Relevant documentation text
 */
async function getRelevantDocumentation(query) {
  try {
    // First try to fetch from Supabase if configured
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      // Implement vector search or other retrieval method here
      const { data, error } = await supabase
        .from('documentation')
        .select('content')
        .textSearch('content', query.split(' ').join(' & '));
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        return data.map(doc => doc.content).join('\n\n');
      }
    }
    
    // Fallback to local file with embedding-based retrieval
    const filePath = path.join(__dirname, '../../../data/llm-full.txt');
    if (fs.existsSync(filePath)) {
      // Process document and create embeddings if not already cached
      if (!documentEmbeddings) {
        console.log('Processing document and creating embeddings...');
        documentEmbeddings = await embeddingService.processDocument(filePath);
      }
      
      // Find relevant chunks based on query similarity
      const relevantChunks = await embeddingService.findRelevantChunks(query, documentEmbeddings);
      console.log(`Found ${relevantChunks.length} relevant chunks for query: "${query}"`);
      
      // Join relevant chunks into a single context string
      return relevantChunks.map(chunk => chunk.text).join('\n\n');
    }
    
    return 'No documentation available.';
  } catch (error) {
    console.error('Error fetching documentation:', error);
    throw error;
  }
}

/**
 * Constructs a prompt for Claude based on the user query and documentation context
 * @param {string} query - User's question
 * @param {string} documentationContext - Relevant documentation text
 * @returns {string} - Formatted prompt for Claude
 */
function constructPrompt(query, documentationContext) {
  return `
<context>
${documentationContext}
</context>

Human: Based on the documentation provided in the context, ${query}

Assistant:`;
}

/**
 * Sends a prompt to Anthropic's Claude API and returns the response
 * @param {string} prompt - Formatted prompt for Claude
 * @returns {string} - Claude's response
 */
async function sendToAnthropic(prompt) {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', // Updated to Claude 3.5 Haiku
      max_tokens: 4000,
      system: "You are a helpful documentation assistant that provides accurate information based on the documentation provided. If the answer isn't in the documentation, politely say so rather than making up information.",
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });
    
    return message.content[0].text;
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    throw error;
  }
}

module.exports = {
  handleQuery
};