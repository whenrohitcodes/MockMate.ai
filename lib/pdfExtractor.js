// Pure Node.js script to extract text from PDF using pdf-parse v2
// This runs outside webpack's module system

const { PDFParse } = require('pdf-parse');
const fs = require('fs');

async function extractPdfText(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text;
  } catch (error) {
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
}

// Handle command-line usage with file path
if (require.main === module) {
  const filePath = process.argv[2];
  
  if (!filePath) {
    console.error(JSON.stringify({ success: false, error: 'No file path provided' }));
    process.exit(1);
  }
  
  extractPdfText(filePath)
    .then(text => {
      console.log(JSON.stringify({ success: true, text }));
    })
    .catch(error => {
      console.error(JSON.stringify({ success: false, error: error.message }));
      process.exit(1);
    });
}

module.exports = { extractPdfText };
