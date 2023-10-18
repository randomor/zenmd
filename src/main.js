import fs from 'fs/pormises';
import { marked } from 'marked';
import matter from 'gray-matter';
import path from 'path';
import { glob } from 'glob';

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

// export const fileToHtml = (inputFile, outputPath = './dist/', options = {}) => {
//   console.log(inputFile, "found file");
//   return "file"
// }

export const fileToHtml = async (inputFile, outputPath = './dist/', options = {}) => {
  console.log("Converting: ", inputFile, outputPath);
  return new Promise((resolve, reject) => {
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

      const inputFileName = path.parse(inputFile).name;

      const outputFileName = (frontMatter.slug && `${frontMatter.slug}.html`) || `${inputFileName}.html`;

      const outputFolder = outputPath;

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

        resolve(true);

        console.log(`Conversion complete! Output saved to ${outputFilePath}`);
      });
    });
  });
}

// Load Markdown file and convert it to HTML
export const markdownToHtml = async (inputPattern, outputPath, options = {}) => {
  try {
    const globOptions = {
      cwd: process.cwd(),
    };
    const files = await glob(inputPattern, globOptions);
    files.forEach(file => {
      fileToHtml(file, outputPath, options);
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