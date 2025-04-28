# ZenMD

_Beta software: expect bugs and breaking changes..._

Package released on npm: https://www.npmjs.com/package/zenmd

## Tagline

_The simplest way to transform a directory of .md files into a static site._

## Demo

- https://idealistspace.com/zenmd - here is a post (about why ZenMD was built) on a site that's built with ZenMD. It's meta... :)
- https://thezenjournal.com - a Remix custom homepage with a ZenMD compiled `posts/` directory

## Get Started

Just one command to build and another to deploy:

1. Generate site

```bash
npx zenmd <inputFolder> --output <outputFolder or default: ./dist>
# Or if you prefer to install to a global command:
npm install zenmd -g
zenmd ...
```

2. Drag and drop the generated folder into Netlify
3. Or `netlify deploy`

## Use Cases

- Bring your own editor and host. Obsidian, Bear, Typora, VS Code... Netlify, Vercel, Cloudflare...
- Publish your [Obsidian](https://obsidian.md/) digital garden.
- Back to the future: edit .html layouts without compiling.
- Bring your own framework, and let ZenMD render your `.md` files.

## Principles

- **Simplicity at its Core**: Just a `npx` command away to transform your markdown files into a minimalistic static site.

## Features

- Transform .md to html
  - GFM markdown, with all the features supported by [remark-gfm](https://github.com/remarkjs/remark-gfm).
    - That includes table, footnotes, even raw html tags, e.g.: iframe for embeds.
  - Support images in markdown files.
  - Wiki links: `[[Another Page]] => [Another Page](/another-page)`.
  - Auto header anchor links, so you can navigate to any H2-h5 headers directly.
  - Support raw html in markdown
- Custom html Layout support (any layout.html files at the same level or above will be used, if none found, default layout will be used.)
- Filter docs with matching tags `--tags=publish:true` which will only build files with `publish` flag or `--tags=draft:false` which will not build files with `draft` flag.
- Automatically infer title from first H1
- Generates `sitemap.xml` at the output directory.
  - Requires `baseUrl` option or `BASE_URL` env var, since `sitemap.xml` requires full URL.
  - If missing base url, no sitemap will be generated.
- Automatically generates `robots.txt`

## Gaps

Here is a list of known gaps:

- This may only support a subset of your favorite markdown syntax. For example, if you work with Obsidian, your image reference will work with `![](image.jpeg)`, with ZenMD it needs to be more specific `![](./assets/image.jpeg)`
- The generated site doesn't have a RSS feed.

Feel free to create an issue or submit a PR on Github if you notice more deal breakers...

## How is this different from...?

- Hugo/jekyll and traditional SSG: no need to download a framework or generate a framework specific repo, your content (and npx) is all you need.
- Blog starter kits: less customization, simpler setup, no git repo with a dozen configs mixed with your content. No React components.
- Notion/Obsidian Publish: these are simpler solutions (no git/CLI) from bigger org and more integrated to your workflow if you use these tools heavily. ZenMD is a balance between independence and simplicity.

## References

- Built with [remark](https://github.com/remarkjs/remark)
- Default theme used [SimpleCss](https://simplecss.org/)
- Alternatives: [markdown-styles](https://github.com/mixu/markdown-styles), [remark-cli](https://www.npmjs.com/package/remark-cli), [MkDocs](https://www.mkdocs.org/)

## Who made this?

Made by [randomor](https://x.com/randomor), who also made [ZenJournal](https://thezenjournal.com)

## Development Notes

- Publish: `npm publish --access public`

## License

ZenMD is open-source software licensed under the [MIT license](LICENSE).
