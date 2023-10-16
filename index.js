const fs = require('fs');
const { marked } = require('marked');
const matter = require('gray-matter');
const path = require('path');
const { glob } = require('glob');

const configImagePath = (imageDir = 'assets', currentFile) => {
  // Create a custom renderer
  const renderer = new marked.Renderer();

  // Override the image renderer
  renderer.image = function (href, title, text) {
    // Prepend 'assets/' to the image path
    const targetHref = path.join(imageDir, href);
    const outputDir = path.join('./dist/', imageDir);
    // Create the output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join('./dist/', imageDir, href);

    // Get current file's directory
    const currentFileDir = path.dirname(currentFile);
    // Get the relative path from the current file to the image
    const imagePath = path.join(currentFileDir, href);

    fs.cpSync(imagePath, outputPath);
    return `<img src="${targetHref}" alt="${text}" title="${title || text}">`;
  };

  // Use the custom renderer
  marked.setOptions({ renderer });
}

const fileToHtml = (inputFile, outputFile, options) => {
  console.log("Converting: ", inputFile, outputFile, options);
  fs.readFile(inputFile, 'utf8', (err, data) => {
    if (err) {
      console.error(`Error reading file ${inputFile}:`, err);
      return;
    }

    const parsedMarkdown = matter(data);
    
    configImagePath('assets', inputFile);

    // Convert Markdown to HTML using marked
    const htmlContent = marked(parsedMarkdown.content);
    const frontMatter = parsedMarkdown.data;

    const { title = 'Untitled' } = frontMatter;
    // Log Front Matter to Console
    console.log('Front Matter:', frontMatter);

    const outputFileName = outputFile || (frontMatter.slug && `${frontMatter.slug}.html`) || 'output.html';

    const outputFolder = options.outputFolder || './dist/';

    // create output folder if it doesn't exist
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder);
    }

    const outputFilePath = path.join(outputFolder, outputFileName);

    const htmlOutput = wrapHtml(title, htmlContent);
    
    fs.writeFile(outputFilePath, htmlOutput, (err) => {
      if (err) {
        console.error(`Error writing to file ${outputFilePath}:`, err);
        return;
      }

      console.log(`Conversion complete! Output saved to ${outputFilePath}`);
    });
  });
}

// Load Markdown file and convert it to HTML
const markdownToHtml = async (inputPattern, outputFile, options = { outputFolder: './dist/' }) => {
  try {
    const files = await glob(inputPattern);
    files.forEach(file => {
      fileToHtml(file, outputFile, options);
    });
  } catch (err) {
    console.error('Error converting Markdown to HTML:', err);
  }
};

// Wrap the HTML content with necessary HTML & Tailwind tags
const wrapHtml = (title, content) => {
  return `
  <!doctype html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.tailwindcss.com?plugins=forms,typography,aspect-ratio,line-clamp"></script>
    <title>${title}</title>
  </head>
  <body>
    <main  class="prose lg:prose-xl max-w-full mx-auto p-24">
      <h1>${title}</h1>
      ${content}
    </main>
  </body>
  </html>
  `;
};

// Example usage
markdownToHtml('../fluencidian/**/*.md');
