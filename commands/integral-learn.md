---
description: Initialize global and project memories without overwriting them
agent: integral
subagent: false
---

Initialize both memories using the package initializer:

!`bash -c 'python3 "${XDG_CONFIG_HOME:-$HOME/.config}/opencode/commands/integral-learn-init.py"'`

The initializer uses the Git root (or the current directory if Git is unavailable), creates only missing files using exclusive creation, and leaves existing paths—including symlinks—untouched. Summarize the initializer's output; if it reports an error, do not claim both memories were initialized.

Do not copy preferences between scopes. Global memory is for general preferences; local memory belongs to the project. This command initializes files; it does not add preferences automatically.
