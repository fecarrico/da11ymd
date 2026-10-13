🇧🇷 Leia em português: [README.md](README.md)

# DA11Y.md website

This repository holds the website of [DA11Y.md](https://github.com/fecarrico/DA11Y.md). DA11Y.md is the design edition of [A11Y.md](https://github.com/fecarrico/A11Y.md), and it brings the same accessibility rules to whoever designs interfaces in design software, people and AI agents alike.

**Live:** https://fecarrico.github.io/da11ymd/

## The page follows A11Y.md

The page was built with AI following A11Y.md on the Shield profile. It is the strictest profile of the standard, and it asks for WCAG 2.2 level AAA. Two files record how that was done, and both are in Portuguese.

- [`REPORT.md`](REPORT.md) is the verification report. It says what was tested, what was measured and what is still untested.
- [`A11Y-DECISIONS.md`](A11Y-DECISIONS.md) keeps the choices between equally accessible solutions, so the page follows a single pattern.

On every push to `main`, the A11Y.md static checker runs before publishing, and if it fails, the page is not published. It only finds what can be found by reading the code. What depends on people testing, like screen readers and real devices, is in the report.

## Running it

The page is HTML, CSS and JavaScript, with no build step. It loads the scene data with `fetch`, so it needs a local server. From the repository root, run the command and open http://localhost:8000 in your browser.

```sh
python3 -m http.server 8000 -d pagina
```
