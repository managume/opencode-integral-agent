---
description: Initialize global and project memories without overwriting them
agent: integral
subagent: false
---

Initialize both memories using the installed Node.js helper:

!`node -e "import(Buffer.from('__INTEGRAL_LEARN_HELPER_URL__','base64').toString()).then(m=>m.main({configDir:Buffer.from('__INTEGRAL_CONFIG_DIR__','base64').toString()}))"`

The helper uses the Git root (or the current directory if Git is unavailable), creates only missing files using exclusive creation, and leaves existing paths—including symlinks—untouched. Summarize its output; if it reports an error, do not claim both memories were initialized.

Do not copy preferences between scopes. Global memory is for general preferences; local memory belongs to the project. This command initializes files; it does not add preferences automatically.
