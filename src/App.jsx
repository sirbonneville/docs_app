// ... existing code ...

const handleSubmit = async (e) => {
  e.preventDefault();
  
  setIsLoading(true);
  setError(null);
  
  try {
    console.log('Sending request with input:', inputValue);
    
    // Using the correct endpoint
    const response = await fetch('http://localhost:3001/api/anthropic', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: inputValue
          }
        ]
      }),
    });
    
    const responseText = await response.text();
    console.log('Raw response:', responseText);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${responseText}`);
    }
    
    const data = JSON.parse(responseText);
    console.log('Parsed response:', data);
    
    // Updated to match the actual response structure
    setResults(data.content[0].text);
  } catch (err) {
    console.error('Error querying API:', err);
    setError(`Failed to get results: ${err.message}`);
  } finally {
    setIsLoading(false);
  }
};

// ... existing code ...