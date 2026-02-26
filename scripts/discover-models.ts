import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function discoverAnthropic() {
  console.log('\n--- Anthropic Models ---');
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return console.log('No key found.');
  
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      }
    });
    const data = (await res.json()) as any;
    if (data.data) {
      data.data.forEach((m: any) => console.log('- ' + m.id + ' (' + m.display_name + ')'));
    } else {
      console.log('Error: ' + JSON.stringify(data));
    }
  } catch (err: any) {
    console.log('Fetch failed: ' + err.message);
  }
}

async function discoverOpenAI() {
  console.log('\n--- OpenAI Models ---');
  const key = process.env.OPENAI_API_KEY;
  if (!key) return console.log('No key found.');

  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': 'Bearer ' + key }
    });
    const data = (await res.json()) as any;
    if (data.data) {
      data.data
        .filter((m: any) => m.id.includes('gpt'))
        .forEach((m: any) => console.log('- ' + m.id));
    } else {
      console.log('Error: ' + JSON.stringify(data));
    }
  } catch (err: any) {
    console.log('Fetch failed: ' + err.message);
  }
}

async function discoverGemini() {
  console.log('\n--- Gemini Models ---');
  const key = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_BACKUP;
  if (!key) return console.log('No key found.');

  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + key);
    const data = (await res.json()) as any;
    if (data.models) {
      data.models.forEach((m: any) => console.log('- ' + m.name.replace('models/', '') + ' (' + m.displayName + ')'));
    } else {
      console.log('Error: ' + JSON.stringify(data));
    }
  } catch (err: any) {
    console.log('Fetch failed: ' + err.message);
  }
}

async function run() {
  await discoverAnthropic();
  await discoverOpenAI();
  await discoverGemini();
}

run();
