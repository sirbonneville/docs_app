import fetch from 'node-fetch';

/**
 * Test script to verify if Claude has access to our documentation
 * 
 * This script sends specific queries that can only be answered correctly
 * if Claude has access to the documentation in llm-full.txt
 */

async function testClaudeDocAccess() {
  // Questions that can only be answered correctly if Claude has access to our documentation
  const testQuestions = [
    {
      question: "What is the minimum version of Ollama required by PiecesOS?",
      expectedInfo: "0.5.5", // This specific version is mentioned in the documentation
      note: "This specific version number is only mentioned in our documentation"
    },
    {
      question: "What are the three core pillars of Pieces functionality?",
      expectedInfo: "Long-Term Memory Engine (LTM-2), Pieces Drive, Pieces Copilot",
      note: "These specific pillars are only mentioned in our documentation"
    },
    {
      question: "What is a completely made-up question that shouldn't be in the docs?",
      expectedInfo: null,
      note: "Claude should indicate this information isn't in the documentation"
    }
  ];

  console.log('=== TESTING CLAUDE DOCUMENTATION ACCESS ===');
  console.log('This test will verify if Claude has access to our documentation');
  console.log('by asking questions that can only be answered with information');
  console.log('from our documentation file.\n');

  for (const test of testQuestions) {
    console.log(`\n--- TESTING QUESTION: ${test.question} ---`);
    console.log(`Note: ${test.note}`);
    
    try {
      const response = await fetch('http://localhost:3001/api/anthropic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: test.question
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const claudeResponse = data.content[0].text;

      console.log('\nClaude response:');
      console.log('----------------');
      console.log(claudeResponse);
      console.log('----------------');

      // Simple analysis of the response
      if (test.expectedInfo) {
        if (claudeResponse.includes(test.expectedInfo)) {
          console.log('\n✅ PASS: Response contains expected information');
          console.log(`Expected to find: "${test.expectedInfo}"`);
        } else {
          console.log('\n❌ FAIL: Response does not contain expected information');
          console.log(`Expected to find: "${test.expectedInfo}"`);
        }
      } else {
        // For the made-up question
        if (claudeResponse.toLowerCase().includes("don't have") || 
            claudeResponse.toLowerCase().includes("don't know") || 
            claudeResponse.toLowerCase().includes("not in the documentation") ||
            claudeResponse.toLowerCase().includes("cannot find") ||
            claudeResponse.toLowerCase().includes("no information")) {
          console.log('\n✅ PASS: Claude correctly indicated this information is not in the docs');
        } else {
          console.log('\n❌ FAIL: Claude attempted to answer a question not in the docs');
        }
      }
    } catch (error) {
      console.error(`Error testing question: ${error.message}`);
    }
  }

  console.log('\n=== TEST SUMMARY ===');
  console.log('If Claude passed the tests with specific information from our documentation,');
  console.log('it means the documentation context is being properly provided to Claude.');
  console.log('If Claude failed the tests, it means:');
  console.log('1. The documentation is not being properly provided to Claude, or');
  console.log('2. The server.mjs endpoint is being used instead of server.js');
}

testClaudeDocAccess();