import { ImageProcessor } from '../src/lib/processing/image-processor';
import path from 'path';

async function testImageProcessor() {
  console.log('--- Testing Image Processor Directly ---');
  const imagePath = path.join(process.cwd(), 'test-image.png');
  try {
    const result = await ImageProcessor.process('test-id', imagePath);
    console.log('✅ Image processor success:');
    console.log(result);
  } catch (error) {
    console.error('❌ Image processor failed:');
    console.error(error);
    process.exit(1);
  }
}

testImageProcessor();
