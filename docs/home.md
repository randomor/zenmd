---
title: Read Me
---
# ZenMD

## Tagline

_One single command to transform a directory of .md files into a static site._

## Use Cases

- Bring your own editor and host. Obsidian, Bear, Typora, VS Code... Netlify, Vercel, Cloudflare...
- Publish your [Obsidian](https://obsidian.md/) digital garden.

## Principles

- **Simplicity at its Core**: Just an `npx` command away to transform your markdown files into a beautiful static site.
- **Versatile Publishing**: Creates a `dist` that is ready to be published to any static hosting site.

  - **Command**: 
    ```bash
    npx add zenmd
    ```
  
## Readme

Getting started with `zenmd` is as easy as one, two!

1. Generate site
  ```bash
  npx zenmd docs --output dist
  ```
2. Drag and drop the generated folder into Netlify

### Core Process
- Find all mark down docs under input folder
- Filter docs with matching tags `--tags publish:true
- 
