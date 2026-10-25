---
name: push-to-github
description: >-
  Use this skill only when the user explicitly requests to upload changes: "push to GitHub",
  "commit and push", or "commit and push my changes". Do NOT activate this skill for requests
  that only mean pulling or downloading changes (e.g. "git pull", "download from GitHub", "sync remote to local").
---

# Push to GitHub Workflow

This skill automates the safe, standard workflow to inspect, verify, commit, and push changes to GitHub for this repository.

## Safe Guardrails & Rules
- **NEVER use force push (`--force` or `-f`)**.
- **Never rewrite history that is already pushed**: Do not amend, rebase, or reset commits that already exist on remote branches.
- **Never stage with a blanket "add everything" command**: Do not run `git add .` or `git add -A`. Stage only the specific files that belong to the intended change, reviewed from the status output.
- **Vercel production safety**: The repository is connected to Vercel, meaning every push to `main` triggers a production deployment. Only code that passes all verification checks below may be pushed.
- **No secrets in commits**: Strictly scan file names and contents for `.env` files, private keys, API keys, credentials, or tokens before committing.
- **Respect `.gitignore`**: Ensure `node_modules/`, build folders (`dist/`), environment files, and local logs are never tracked.

## Workflow Steps

### 1. Inspect Status & Changes
Run:
```powershell
git status
git branch --show-current
git remote -v
```
- Confirm the active branch (e.g., `main`) and verify that `origin` points to the expected repository URL (`https://github.com/cjlacout-ghb/RRally-v1-0.git`).
- If there is nothing to commit (clean working tree and no unpushed commits), report that to the user and stop; do not create an empty commit.

### 2. Check for Sensitive Files & Content Secrets
1. **File list check**:
   Review all modified and untracked files from `git status -uall`.
   Stop immediately and alert the user if any file is an environment file (`.env*`), private key (`*.pem`, `*.key`), credentials or token file, or a build/dependency folder (`node_modules/`, `dist/`).
2. **Content secret scan**:
   Search the content of modified/added files for potential secrets (e.g. API keys, bearer tokens, private key headers, passwords assigned in code or config).
   If anything suspicious is found, stop and report the exact file and matched pattern without committing.
3. If no files need committing and no local commits are pending push, report clean status and exit.

### 3. Verification (Mandatory Tests & Production Build)
Both unit tests and the production build must run and pass. If either fails, stop immediately, do not commit or push, and report the error to the user.

1. **Run full test suite**:
   ```powershell
   npm run test
   ```
2. **Run production build**:
   ```powershell
   npm run build
   ```
3. **Production bundle check**:
   Verify that the production bundle contains no demo-only code (such as the `"demo"` string or demo sample values). Search the build output directory (`dist/`) to confirm no demo fixtures or unintended demo references leaked into production.

### 4. Stage and Commit Specific Files
1. Stage **only** the intended files explicitly by path (do not use blanket commands like `git add .`):
   ```powershell
   git add <file1> <file2> ...
   ```
2. Show the user the exact staged list (`git diff --staged --name-status`).
3. Commit using a conventional commit message in English (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, etc.):
   - Use the message provided by the user if one was given.
   - Otherwise, write a clear, concise summary of what changed.
   ```powershell
   git commit -m "<conventional commit message>"
   ```

### 5. Fetch, Compare, and Push Safely
1. Fetch latest changes from remote without merging:
   ```powershell
   git fetch origin
   ```
2. Compare local branch with `origin/<branch>`:
   - If the remote contains commits that the local branch does not have, integrate them safely (merge or rebase of local unpushed commits only). Resolve conflicts preserving local project intent. Never alter already-pushed commits.
3. Push branch to origin:
   ```powershell
   git push origin <branch>
   ```
   (If tracking is not set yet, use `git push -u origin <branch>`).

### 6. Final State Report
Confirm the repository state:
```powershell
git status
git log -n 1
```
Report the following summary to the user:
- Staged and committed files.
- Commit hash and message.
- Remote branch status and push confirmation.
- Verification status (tests, build, bundle scan).
