import 'dotenv/config';

console.log('API Key First 10 chars:', process.env.ANTHROPIC_API_KEY?.substring(0, 10));

async function main() {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hello, world' }],
      }),
    });

    if (!response.ok) {
        console.error('HTTP Error:', response.status, response.statusText);
        console.error('Body:', await response.text());
        return;
    }

    const data = await response.json();
    console.log('Success:', JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('Fetch Failure:', error);
  }
}

main();
