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

## Mobile-first rule

All pages must work well on phones. Required:
- `<meta name="viewport" content="width=device-width, initial-scale=1.0">` on every page
- No fixed-width layouts that overflow on small screens
- Tables that can't reflow must be hidden on mobile (`display:none` at `≤680px`) with a card/list alternative shown instead
- Touch targets (buttons, links) minimum 44px tall
- Font sizes: body `≥0.9rem`, headings use `clamp()` or `vw` units

## Structure

Flat static site. Entry point: `index.html`. No framework, no bundler, no package manager required.
