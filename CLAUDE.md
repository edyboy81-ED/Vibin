# Vibin AR — Developer Notes

## Release Notes Rule

**Do NOT update `app/components/WhatsNewModal.tsx` during development.**

The changelog and version number in `WhatsNewModal.tsx` must only be updated when creating a pull request to merge into `main` (i.e., a production release). The release date must reflect the actual date the PR is merged to `main`, not the date the feature was developed.

When preparing a production release:
1. Determine the new version number (increment minor for features, patch for fixes)
2. Add a new entry to the top of `CHANGELOG` in `WhatsNewModal.tsx` with the full date (e.g., `May 11, 2026`)
3. Update the `VERSION` constant at the top of the file
4. Update the version label in `app/layout.tsx` footer to match

During development on the feature branch, do not touch `WhatsNewModal.tsx` or the footer version string.

## Git Workflow

- Development branch: `claude/resume-session-58wck` (or the current session branch)
- Production: `main` — deployed automatically by Vercel on push
- All development work is committed to the dev branch and merged to `main` via GitHub pull request
- The user merges PRs through GitHub UI — do not attempt to push directly to `main`

## Stack

- Next.js 15 App Router, TypeScript, Tailwind CSS v3.4
- Prisma v5 + PostgreSQL (Neon)
- Production DB: Neon main branch
- Development DB: Neon `development` branch (configured in `.env.local`)
- Deployed on Vercel (auto-deploys from `main`)
