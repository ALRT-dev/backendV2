import { mdToPdf } from "md-to-pdf";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Converts a markdown file to PDF.
 *
 * Usage:
 *  yarn convert-md-to-pdf <markdown-file-name>
 *
 * Example:
 *  yarn convert-md-to-pdf README.md
 */
async function convertToPdf() {
  // Get the markdown file name from command line args or use default
  const mdFileName = process.argv[2];
  if (!mdFileName || !mdFileName.endsWith(".md")) {
    console.error(
      "Please provide a valid markdown file name as an argument (e.g., README.md)"
    );
    process.exit(1);
  }

  const projectRoot = join(__dirname, "..", "..");
  const inputFile = join(projectRoot, mdFileName);
  const outputFile = inputFile.replace(/\.md$/, ".pdf");

  try {
    console.log(`Converting ${mdFileName} to PDF...`);

    const pdf = await mdToPdf(
      { path: inputFile },
      {
        dest: outputFile,
        pdf_options: {
          format: "A4",
          margin: {
            top: "20mm",
            right: "20mm",
            bottom: "20mm",
            left: "20mm",
          },
          printBackground: true,
        },
        stylesheet: [
          "https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.1/github-markdown.min.css",
        ],
        body_class: ["markdown-body"],
        css: `
          .markdown-body {
            box-sizing: border-box;
            min-width: 200px;
            max-width: 980px;
            margin: 0 auto;
            padding: 45px;
            font-size: 14px;
            line-height: 1.6;
          }
          
          @media print {
            .markdown-body {
              padding: 20px;
            }
          }
          
          pre {
            background-color: #f6f8fa !important;
            border-radius: 6px;
            padding: 16px;
            overflow-x: auto;
          }
          
          code {
            background-color: #f6f8fa;
            border-radius: 3px;
            padding: 0.2em 0.4em;
            font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
          }
          
          pre code {
            background-color: transparent;
            padding: 0;
          }
          
          table {
            border-collapse: collapse;
            width: 100%;
            margin: 16px 0;
          }
          
          table th,
          table td {
            padding: 6px 13px;
            border: 1px solid #d0d7de;
          }
          
          table tr {
            background-color: #ffffff;
            border-top: 1px solid hsla(210, 18%, 87%, 1);
          }
          
          table tr:nth-child(2n) {
            background-color: #f6f8fa;
          }
          
          h1 {
            border-bottom: 1px solid #d0d7de;
            padding-bottom: 0.3em;
            margin-top: 24px;
            margin-bottom: 16px;
            font-size: 2em;
            font-weight: 600;
          }
          
          h2 {
            border-bottom: 1px solid #d0d7de;
            padding-bottom: 0.3em;
            margin-top: 24px;
            margin-bottom: 16px;
            font-size: 1.5em;
            font-weight: 600;
          }
          
          h3 {
            margin-top: 24px;
            margin-bottom: 16px;
            font-size: 1.25em;
            font-weight: 600;
          }
          
          blockquote {
            border-left: 4px solid #d0d7de;
            padding: 0 1em;
            color: #57606a;
            margin: 0 0 16px 0;
          }
          
          hr {
            border: 0;
            border-top: 2px solid #d0d7de;
            margin: 24px 0;
          }
        `,
        launch_options: {
          headless: true,
        },
      }
    );

    console.log(`✅ PDF created successfully: ${outputFile}`);
    console.log(`📄 File size: ${(pdf.content.length / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error("❌ Error converting to PDF:", error);
    process.exit(1);
  }
}

convertToPdf();
