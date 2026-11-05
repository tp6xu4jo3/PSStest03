---
name: Temporary static server
description: Avoid unintended Replit run-configuration changes when previewing the imported static site.
---

Binding a temporary Python static server to port 5000 caused Replit to add a Python module and port mapping to `.replit` automatically.

**Why:** The repository was imported without a requested run workflow, and this auto-configuration was unrelated to the requested code changes.

**How to apply:** If a temporary server changes `.replit`, restore the prior configuration with Replit's validated config replacement flow; do not edit `.replit` directly.
