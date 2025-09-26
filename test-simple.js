console.log('Starting simple test...');

const API_KEY = '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';

async function testBasicFetch() {
  try {
    console.log('Testing basic fetch to OpenRouter...');
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Literature Tracing Tool'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages: [
          {
            role: 'user',
            content: 'Say "Hello World"'
          }
        ],
        max_tokens: 10
      })
    });

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    const responseText = await response.text();
    console.log('Response text:', responseText);
    
    if (response.ok) {
      console.log('✅ API call successful!');
    } else {
      console.log('❌ API call failed');
    }
    
  } catch (error) {
    console.error('❌ Error occurred:', error.message);
  }
}

testBasicFetch();