---
id: repo:localme/cross-cutting/logging
parent: repo:localme/cross-cutting
title: Logging
level: repo
kind: cross-cutting
applies_to: [repo:localme]
domains:
  - platform
keywords:
  - logging
  - ndjson
  - serilog
---

# Logging

Platform-wide structured logging implementation to ensure safe, parseable operator visibility.

## Configuration Keys
- `logging.level`: The threshold for logging output (default: `info` in production, `debug` in development).
- `logging.sink`: Output destination, either `stdout` (NDJSON per line) or `file`.
- `logging.file_path`: Absolute or relative path to the log file when `sink` is `file`.

## Format and Security
All logs are emitted as structured NDJSON.
**Credential Redaction:** The logger automatically redacts passwords, tokens, API keys, and secret values before writing to the sink to prevent credential leakage in operator logs.
