import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import natural from 'natural';
import { encoding_for_model } from 'tiktoken';
import compromise from 'compromise'

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// Function to fetch documentation from GitHub with local file fallback
async function fetchDocumentation() {
  try {
    // Primary approach: Fetch from GitHub
    console.log('Fetching documentation from GitHub...');
    const githubUrl = 'https://raw.githubusercontent.com/sirbonneville/docs_app/refs/heads/main/llms-full.txt';
    const response = await fetch(githubUrl);
    
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
    // Use accurate token counting
    const docTokens = countTokens(documentation);
    console.log(`Tokens in documentation (using tiktoken): ${docTokens}`);
    
    // Get the user's query
    const userQuery = req.body.messages[0].content;
    console.log(`User query: "${userQuery}" (${userQuery.length} characters)`);
    const queryTokens = countTokens(userQuery);
    console.log(`Query tokens: ${queryTokens}`);
    
    // Split documentation into chunks using content-aware chunking
    const chunksData = splitIntoChunks(documentation);
    console.log(`Split documentation into ${chunksData.chunks.length} chunks`);
    
    // Find relevant chunks based on the query using hybrid approach
    // Claude 3.5 Haiku has a 200k token context window
    const relevantChunks = findRelevantChunks(userQuery, chunksData, 200000);
    console.log(`Selected ${relevantChunks.length} relevant chunks`);
    
    // Ensure we don't exceed Claude's token limits
    if (relevantChunks.length === 0) {
      console.error('No relevant chunks found');
      return res.status(500).json({ error: 'No relevant documentation found for your query' });
    }
    
    // Format chunks with their metadata for better context and track sources
    const formattedChunks = [];
    const sourcesUsed = [];
    
    relevantChunks.forEach(chunk => {
      const { text, metadata, score } = chunk;
      let formattedText = text;
      
      // Add metadata as a header if available
      if (metadata && metadata.heading) {
        formattedText = `## ${metadata.heading}\n\n${text}`;
        
        // Track source information for citation
        if (!sourcesUsed.some(source => source.title === metadata.heading)) {
          sourcesUsed.push({
            title: metadata.heading,
            slug: metadata.heading.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
          });
        }
      }
      
      formattedChunks.push(formattedText);
    });
    
    // Combine relevant chunks with metadata
    const contextText = formattedChunks.join('\n\n---\n\n');
    const contextTokens = countTokens(contextText);
    console.log(`Combined context: ${contextTokens} tokens`);
    
    // Add a system prompt to guide Claude's behavior with improved context-awareness and formatting instructions
    const systemPrompt = "You are a documentation assistant specialized in answering questions based EXCLUSIVELY on the provided documentation context. Your ONLY source of truth is the documentation text provided in each query - do not rely on any prior knowledge about the subject matter. If the exact information isn't clearly stated in the documentation, respond with 'The provided documentation does not contain specific information about [topic of question]' and DO NOT attempt to provide any information beyond what's explicitly in the documentation context. For made-up, hypothetical, or specific questions not addressed in the documentation, clearly state 'The documentation does not contain information about [specific topic].' NEVER reference information outside the provided context. NEVER apologize for not knowing something that's not in the documentation. NEVER provide general knowledge responses when specific information is not in the documentation. When asked about specific products, features, or comparisons that aren't mentioned in the documentation, state clearly that this specific information is not covered in the provided documentation. Format your responses with proper HTML-compatible markdown: use ## for headings (not #), * for bullet points, **text** for bold. Structure your response with clear paragraphs and use numbered lists for steps or processes. Be concise but thorough in your explanations. ALWAYS end your response with a '## Sources Used' section that lists the documentation sources you referenced, formatted as a bulleted list with each source name as a hyperlink using the slug provided in the source metadata.";    
    
    // Create a new messages array with context
    const messagesWithContext = [
      {
        role: "user",
        content: `Documentation context:\n${contextText}\n\nUser query: ${userQuery}\n\nPlease answer the query based on the provided documentation context. Format your response with proper markdown for readability.`
      }
    ];
    
    // Log the total size of the message being sent
    const totalMessageTokens = countTokens(messagesWithContext[0].content);
    console.log(`Total message size: ${totalMessageTokens} tokens`);
    
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
        'x-api-key': process.env.ANTHROPIC_API_KEY, // Replace hardcoded API key with environment variable
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

// Function to count tokens using tiktoken
function countTokens(text, modelName = 'gpt-4') {
  try {
    // Use encoding_for_model instead of getEncoding
    const encoding = encoding_for_model(modelName);
    const tokens = encoding.encode(text);
    return tokens.length;
  } catch (error) {
    console.error('Error counting tokens with tiktoken:', error);
    // Fallback to character-based estimation if tiktoken fails
    return Math.ceil(text.length / 4);
  }
}

// Function to extract document structure (headings, sections, etc.)
function extractDocumentStructure(text) {
  // Use compromise to identify headings and section boundaries
  const doc = compromise(text);
  
  // Extract potential headings (lines that look like titles)
  const headingLines = [];
  const lines = text.split('\n');
  
  // Simple heuristic for heading detection
  const headingRegex = /^(#+\s|\d+\.\s|[A-Z][^.!?]+:)\s*\w+/;
  
  lines.forEach((line, index) => {
    if (headingRegex.test(line.trim()) || 
        (line.trim().length > 0 && 
         line.trim().length < 100 && 
         line.trim() === line.trim().toUpperCase())) {
      headingLines.push({ line, index });
    }
  });
  
  return { headingLines, lines };
}

// Function to split text into chunks of approximately the specified token size
function splitIntoChunks(text, maxChunkSize = 2000) {
  // Extract document structure to make better chunking decisions
  const { headingLines, lines } = extractDocumentStructure(text);
  
  // Store metadata with each chunk
  const allChunks = [];
  const allChunkMetadata = [];
  
  // If text is very large, split it into sections first based on major headings
  let sections = [];
  let sectionMetadata = [];
  
  if (headingLines.length > 0) {
    // Use headings to create initial sections
    headingLines.forEach((heading, idx) => {
      const startIdx = heading.index;
      const endIdx = idx < headingLines.length - 1 ? headingLines[idx + 1].index : lines.length;
      
      const sectionLines = lines.slice(startIdx, endIdx);
      const sectionText = sectionLines.join('\n');
      
      sections.push(sectionText);
      sectionMetadata.push({
        heading: heading.line.trim(),
        lineStart: startIdx,
        lineEnd: endIdx - 1
      });
    });
  } else {
    // If no headings found, use the original approach
    const maxSectionTokens = 25000; // Approximately 100,000 characters
    let remaining = text;
    let offset = 0;
    
    while (remaining.length > 0) {
      // Find a good break point (paragraph boundary)
      let breakPoint = remaining.indexOf('\n\n', maxSectionTokens);
      if (breakPoint === -1 || breakPoint > maxSectionTokens * 1.5) {
        breakPoint = remaining.indexOf('.', maxSectionTokens);
        if (breakPoint === -1 || breakPoint > maxSectionTokens * 1.5) {
          breakPoint = maxSectionTokens;
        } else {
          breakPoint += 1; // Include the period
        }
      } else {
        breakPoint += 2; // Include the newlines
      }
      
      const section = remaining.slice(0, breakPoint);
      sections.push(section);
      sectionMetadata.push({
        heading: 'Section ' + (sections.length),
        charStart: offset,
        charEnd: offset + breakPoint
      });
      
      remaining = remaining.slice(breakPoint);
      offset += breakPoint;
    }
  }
  
  // Now process each section into chunks
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const metadata = sectionMetadata[i];
    
    // Split by paragraphs first
    const paragraphs = section.split('\n\n').filter(p => p.trim().length > 0);
    let currentChunk = [];
    let currentTokens = 0;
    let currentMetadata = {
      ...metadata,
      paragraphStart: 0
    };
    
    for (let j = 0; j < paragraphs.length; j++) {
      const paragraph = paragraphs[j];
      const paragraphTokens = countTokens(paragraph);
      
      // If a single paragraph is too large, split it further
      if (paragraphTokens > maxChunkSize) {
        // First add any accumulated paragraphs
        if (currentChunk.length > 0) {
          const chunkText = currentChunk.join('\n\n');
          allChunks.push(chunkText);
          currentMetadata.paragraphEnd = j - 1;
          allChunkMetadata.push(currentMetadata);
          
          currentChunk = [];
          currentTokens = 0;
          currentMetadata = {
            ...metadata,
            paragraphStart: j
          };
        }
        
        // Split the large paragraph into sentences
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        let sentenceChunk = [];
        let sentenceTokens = 0;
        
        for (const sentence of sentences) {
          const tokens = countTokens(sentence);
          
          if (sentenceTokens + tokens > maxChunkSize && sentenceChunk.length > 0) {
            const sentenceText = sentenceChunk.join(' ');
            allChunks.push(sentenceText);
            allChunkMetadata.push({
              ...metadata,
              paragraphIndex: j,
              isSentenceChunk: true
            });
            
            sentenceChunk = [sentence];
            sentenceTokens = tokens;
          } else {
            sentenceChunk.push(sentence);
            sentenceTokens += tokens;
          }
        }
        
        if (sentenceChunk.length > 0) {
          const sentenceText = sentenceChunk.join(' ');
          allChunks.push(sentenceText);
          allChunkMetadata.push({
            ...metadata,
            paragraphIndex: j,
            isSentenceChunk: true
          });
        }
      } else if (currentTokens + paragraphTokens > maxChunkSize && currentChunk.length > 0) {
        // Current chunk is full, save it and start a new one
        const chunkText = currentChunk.join('\n\n');
        allChunks.push(chunkText);
        currentMetadata.paragraphEnd = j - 1;
        allChunkMetadata.push(currentMetadata);
        
        // Start new chunk
        currentChunk = [paragraph];
        currentTokens = paragraphTokens;
        currentMetadata = {
          ...metadata,
          paragraphStart: j
        };
      } else {
        currentChunk.push(paragraph);
        currentTokens += paragraphTokens;
      }
    }
    
    if (currentChunk.length > 0) {
      const chunkText = currentChunk.join('\n\n');
      allChunks.push(chunkText);
      currentMetadata.paragraphEnd = paragraphs.length - 1;
      allChunkMetadata.push(currentMetadata);
    }
  }
  
  console.log(`Split text into ${allChunks.length} chunks using tiktoken and content-aware chunking`);
  
  // Store metadata for later use
  return { chunks: allChunks, metadata: allChunkMetadata };
}

// Function to find relevant chunks based on query similarity with hybrid approach
function findRelevantChunks(query, chunksData, maxContextTokens = 140000) {
  // Destructure the chunks and metadata
  const { chunks, metadata } = chunksData;
  
  // Calculate how many tokens we should aim to use (60-70% of context window)
  const targetTokens = Math.floor(maxContextTokens * 0.65);
  
  // Estimate query complexity based on length and structure
  const queryTokens = countTokens(query);
  const queryComplexity = Math.min(1.0, queryTokens / 100); // 0.0 to 1.0 scale
  
  // Adjust maxChunks based on query complexity
  // More complex queries might need more context
  let dynamicMaxChunks = Math.max(2, Math.ceil(3 + queryComplexity * 5));
  
  // Extract keywords from query
  const queryWords = query.toLowerCase().split(/\W+/).filter(word => word.length > 3);
  const tokenizer = new natural.WordTokenizer();
  const queryTokenized = tokenizer.tokenize(query.toLowerCase());
  
  // Use TF-IDF for better keyword matching
  const tfidf = new natural.TfIdf();
  
  // Add all chunks to the TF-IDF model
  chunks.forEach((chunk, i) => {
    tfidf.addDocument(chunk);
  });
  
  // Get TF-IDF scores for query terms
  const tfidfScores = [];
  queryTokenized.forEach(term => {
    const scores = [];
    tfidf.tfidfs(term, (i, measure) => {
      scores.push({ index: i, score: measure });
    });
    tfidfScores.push(scores);
  });
  
  // Score each chunk using multiple methods
  const scoredChunks = chunks.map((chunk, index) => {
    const chunkLower = chunk.toLowerCase();
    let keywordScore = 0;
    let tfidfScore = 0;
    let fuzzyScore = 0;
    
    // 1. Keyword matching score
    for (const word of queryWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = (chunkLower.match(regex) || []).length;
      keywordScore += matches;
    }
    
    // 2. TF-IDF score
    queryTokenized.forEach((term, i) => {
      const termScores = tfidfScores[i];
      const matchingScore = termScores.find(s => s.index === index);
      if (matchingScore) {
        tfidfScore += matchingScore.score;
      }
    });
    
    // 3. Fuzzy matching for domain-specific terms
    // Use natural's string distance algorithms for fuzzy matching
    const queryTerms = query.split(' ');
    const chunkTerms = chunk.split(' ');
    
    for (const qTerm of queryTerms) {
      if (qTerm.length < 4) continue; // Skip short terms
      
      for (const cTerm of chunkTerms) {
        if (cTerm.length < 4) continue; // Skip short terms
        
        // Calculate Jaro-Winkler distance (higher = more similar)
        const distance = natural.JaroWinklerDistance(qTerm.toLowerCase(), cTerm.toLowerCase());
        if (distance > 0.85) { // High similarity threshold
          fuzzyScore += distance - 0.85; // Only count similarity above threshold
        }
      }
    }
    
    // 4. Exact phrase matching (highest weight)
    const exactPhraseMatches = (chunkLower.match(new RegExp(query.toLowerCase(), 'g')) || []).length;
    const phraseScore = exactPhraseMatches * 15;
    
    // 5. Heading/section relevance bonus
    const metaData = metadata[index];
    let structureBonus = 0;
    
    if (metaData && metaData.heading) {
      const headingLower = metaData.heading.toLowerCase();
      for (const word of queryWords) {
        if (headingLower.includes(word)) {
          structureBonus += 5; // Significant bonus for heading matches
        }
      }
    }
    
    // Combine scores with appropriate weights
    const totalScore = 
      (keywordScore * 1.0) + 
      (tfidfScore * 2.0) + 
      (fuzzyScore * 1.5) + 
      (phraseScore * 3.0) + 
      (structureBonus * 2.0);
    
    return { 
      chunk, 
      score: totalScore,
      metadata: metadata[index],
      tokens: countTokens(chunk)
    };
  });
  
  // Sort by score (descending)
  const rankedChunks = scoredChunks.sort((a, b) => b.score - a.score);
  
  // Dynamically select chunks to fill the target token count
  let selectedChunks = [];
  let totalTokenCount = 0;
  let chunkCount = 0;
  
  for (const item of rankedChunks) {
    // Only include chunks with positive scores
    if (item.score <= 0) break;
    
    // Check if we've reached our dynamic chunk limit
    if (chunkCount >= dynamicMaxChunks) break;
    
    // Check if adding this chunk would exceed our target token count
    if (totalTokenCount + item.tokens > targetTokens) {
      // If we already have some chunks, stop here
      if (selectedChunks.length > 0) break;
      
      // If this is the first chunk and it's too big, we still need to include something
      // so we'll take it anyway
    }
    
    selectedChunks.push({
      text: item.chunk,
      metadata: item.metadata,
      score: item.score
    });
    
    totalTokenCount += item.tokens;
    chunkCount++;
  }
  
  console.log(`Selected ${selectedChunks.length} chunks with total of ~${totalTokenCount} tokens`);
  
  // If no chunks have matches, return a small subset of random chunks
  if (selectedChunks.length === 0) {
    const randomChunks = chunks
      .sort(() => Math.random() - 0.5)
      .slice(0, 2)
      .map((chunk, i) => ({
        text: chunk,
        metadata: metadata[i],
        score: 0
      }));
    
    return randomChunks;
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