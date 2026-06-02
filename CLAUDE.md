# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Static HTML/CSS/JS GitHub Pages site hosted at `lightfor.github.io`. No build step — files served directly by GitHub Pages.

## Development

Open HTML files directly in browser or use any static file server:

```
npx serve .
# or
python -m http.server 8080
```

Deploy by pushing to `main` branch — GitHub Pages publishes automatically.

## Structure

Flat static site. Entry point: `index.html`. No framework, no bundler, no package manager required.
