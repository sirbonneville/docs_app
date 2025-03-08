/**
 * Embedding Service
 * 
 * This service handles document chunking and embedding using Voyage AI.
 * It provides functions to split documents into manageable chunks,
 * create embeddings for these chunks, and retrieve relevant chunks
 * based on query similarity.
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Constants for chunking and embedding
const MAX_CHUNK_SIZE = 512; // Target token size for each chunk
const CHUNK_OVERLAP = 50; // Number of tokens to overlap between chunks

/**
 * Split text into chunks of approximately MAX_CHUNK_SIZE tokens
 * with CHUNK_OVERLAP tokens of overlap between chunks
 * 
 * @param {string} text - The text to split into chunks
 * @returns {Array<string>} - Array of text chunks
 */
function splitIntoChunks(text) {
  // Simple chunking by paragraphs and then combining until we reach target size
  // This is a basic implementation - a more sophisticated one would use a tokenizer
  const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;
  
  for (const paragraph of paragraphs) {
    // Rough estimation: 1 token ≈ 4 characters
    const paragraphSize = Math.ceil(paragraph.length / 4);
    
    if (currentSize + paragraphSize > MAX_CHUNK_SIZE && currentChunk.length > 0) {
      // Current chunk is full, save it and start a new one
      chunks.push(currentChunk.join('\n\n'));
      
      // Start new chunk with overlap by keeping some of the previous paragraphs
      const overlapSize = currentChunk.length > 1 ? 1 : 0; // Simple overlap strategy
      currentChunk = currentChunk.slice(-overlapSize);
      currentSize = currentChunk.reduce((sum, p) => sum + Math.ceil(p.length / 4), 0);
    }
    
    currentChunk.push(paragraph);
    currentSize += paragraphSize;
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n\n'));
  }
  
  return chunks;
}

/**
 * Create embeddings for an array of text chunks using Voyage AI API
 * 
 * @param {Array<string>} chunks - Array of text chunks to embed
 * @returns {Promise<Array<{text: string, embedding: Array<number>}>>} - Array of chunks with their embeddings
 */
async function createEmbeddings(chunks) {
  if (!process.env.VOYAGE_API_KEY) {
    throw new Error('VOYAGE_API_KEY environment variable is not set');
  }
  
  try {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`
      },
      body: JSON.stringify({
        input: chunks,
        model: 'voyage-3',
        input_type: 'document'
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Voyage API error: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    
    // Combine chunks with their embeddings
    return chunks.map((text, index) => ({
      text,
      embedding: data.data[index].embedding
    }));
  } catch (error) {
    console.error('Error creating embeddings:', error);
    throw error;
  }
}

/**
 * Process a document file, split it into chunks, and create embeddings
 * 
 * @param {string} filePath - Path to the document file
 * @returns {Promise<Array<{text: string, embedding: Array<number>}>>} - Array of chunks with their embeddings
 */
async function processDocument(filePath) {
  try {
    // Read the document file
    const text = fs.readFileSync(filePath, 'utf8');
    
    // Split into chunks
    const chunks = splitIntoChunks(text);
    console.log(`Split document into ${chunks.length} chunks`);
    
    // Create embeddings for chunks
    const embeddedChunks = await createEmbeddings(chunks);
    console.log(`Created embeddings for ${embeddedChunks.length} chunks`);
    
    return embeddedChunks;
  } catch (error) {
    console.error('Error processing document:', error);
    throw error;
  }
}

/**
 * Create an embedding for a query using Voyage AI API
 * 
 * @param {string} query - The query to embed
 * @returns {Promise<Array<number>>} - The query embedding
 */
async function createQueryEmbedding(query) {
  if (!process.env.VOYAGE_API_KEY) {
    throw new Error('VOYAGE_API_KEY environment variable is not set');
  }
  
  try {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`
      },
      body: JSON.stringify({
        input: [query],
        model: 'voyage-3',
        input_type: 'query'
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Voyage API error: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error creating query embedding:', error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 * 
 * @param {Array<number>} vec1 - First vector
 * @param {Array<number>} vec2 - Second vector
 * @returns {number} - Cosine similarity score
 */
function cosineSimilarity(vec1, vec2) {
  // Since Voyage embeddings are normalized to length 1,
  // dot product equals cosine similarity
  return vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
}

/**
 * Find the most relevant chunks for a query based on embedding similarity
 * 
 * @param {string} query - The user query
 * @param {Array<{text: string, embedding: Array<number>}>} embeddedChunks - Array of chunks with embeddings
 * @param {number} topK - Number of most relevant chunks to return
 * @returns {Promise<Array<{text: string, similarity: number}>>} - Array of relevant chunks with similarity scores
 */
async function findRelevantChunks(query, embeddedChunks, topK = 3) {
  try {
    // Create embedding for the query
    const queryEmbedding = await createQueryEmbedding(query);
    
    // Calculate similarity scores
    const chunksWithScores = embeddedChunks.map(chunk => ({
      text: chunk.text,
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
    }));
    
    // Sort by similarity score (descending) and take top K
    return chunksWithScores
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  } catch (error) {
    console.error('Error finding relevant chunks:', error);
    throw error;
  }
}

module.exports = {
  splitIntoChunks,
  createEmbeddings,
  processDocument,
  createQueryEmbedding,
  findRelevantChunks
};