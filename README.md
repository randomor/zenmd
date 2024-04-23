# ZenMD

_Beta software: expect bugs and breaking changes..._

## Tagline
_The simplest way to transform a directory of .md files into a static site._

## Use Cases
- Bring your own editor and host. Obsidian, Bear, Typora, VS Code... Netlify, Vercel, Cloudflare...
- Publish your [Obsidian](https://obsidian.md/) digital garden.
- Back to the future: edit .html layouts without compiling.

## Principles
- **Simplicity at its Core**: Just a `npx` command away to transform your markdown files into a minimalistic static site.

## Features
- Transform .md to html
  - GFM markdown, with all the features supported by [remark-gfm](https://github.com/remarkjs/remark-gfm).
    - That includes table, footnotes, even raw html tags, e.g.: iframe for embeds.
  - Support images in markdown files.
  - Wiki links: `[[Another Page]] => [Another Page](/another-page)`.
  - Auto header anchor links, so you can navigate to any H2-h5 headers directly.
- Custom html Layout support (any layout.html files at the same level or above will be used, if none found, default layout will be used.)
- Filter docs with matching tags `--tags=publish:true` which will only render files with `publish` flag or `--tags=draft:false` which will not render files with `draft` flag.
- Automatically infer title from first H1
- Generates `sitemap.xml` at the output directory.
- Automatically generates `robots.txt`

## Get Started

Getting started with `zenmd` is as easy as one, two!

1. Generate site
  ```bash
  npx zenmd <inputFolder> --output <outputFolder or default: ./dist>
  # Or if you prefer to install to a global command:
  npm install zenmd -g
  zenmd ...
  ```
2. Drag and drop the generated folder into Netlify
2. Or `netlify deploy`

## Development Notes
- Publish: `npm publish --access public`

## References
- Built with [remark](https://github.com/remarkjs/remark)
- Default theme used [TailwindCSS Typography](https://tailwindcss.com/docs/typography-plugin)
- Alternatives: [markdown-styles](https://github.com/mixu/markdown-styles), [remark-cli](https://www.npmjs.com/package/remark-cli)


## Who made this?
Made by [randomor](https://x.com/randomor), who also made [ZenJournal](https://thezenjournal.com) 