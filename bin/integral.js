#!/usr/bin/env node

import { runInstaller } from "../lib/installer.js"

runInstaller(process.argv.slice(2))
  .then((result) => {
    if (result === false) process.exitCode = 1
  })
  .catch((error) => {
    console.error(`Integral installation failed: ${error.message}`)
    process.exitCode = 1
  })
