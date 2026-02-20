
import sharp from 'sharp';

async function testSharp() {
  console.log('Using sharp version:', sharp.format);
  try {
    const buffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    })
    .png()
    .toBuffer();
    console.log('Buffer created. Length:', buffer.length);
    
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(process.cwd(), 'test-sharp-io.png');
    fs.writeFileSync(filePath, buffer);
    console.log('File written to:', filePath);
    
    const meta = await sharp(filePath).metadata();
    console.log('Read back metadata:', meta);
    
    fs.unlinkSync(filePath);
    console.log('Cleanup success.');
  } catch (e) {
    console.error('Sharp failed:', e);
  }
}

testSharp();
