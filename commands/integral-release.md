---
description: Validate and prepare a project milestone or release for human review
agent: integral
subagent: false
---

Prepare a verifiable delivery for this scope: $ARGUMENTS

Establish the intended milestone from the request and existing plan, changelog, issue, or acceptance criteria. Do not silently expand scope or publish, deploy, tag, upload, or create remote releases. “Prepare a release” means local validation and handoff only unless the user separately authorizes publication.

Use progressive quality:
- Small milestone: inspect the relevant diff and acceptance criteria; run focused checks for the changed path.
- Functional milestone: add related integration checks, affected-flow validation, and a targeted regression review.
- Final or high-impact release: run relevant broader unit/integration/regression and functional checks, plus proportionate security and performance review. Use Playwright or other browser/E2E tests only when the application and risk justify them.
- Security, data integrity, authentication, and infrastructure changes require critical checks before proceeding, regardless of milestone size.

Reuse prior results only when no relevant source, dependency, configuration, environment, or acceptance criterion has changed. Run the minimum checks needed to close evidence gaps. Never claim an unavailable or unexecuted check passed. If the working tree contains unrelated or user changes, preserve and clearly distinguish them.

Prepare only necessary documentation and record verified status in the existing project plan or delivery mechanism; do not create duplicate tracking files. Give a concise handoff: implemented scope, checks and results, known limitations, blockers, and steps requiring human functional review. Do not ask the user to repeat technical checks Integral can perform.
