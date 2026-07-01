# Contributing to Yard

Thanks for contributing! A quick guide:

- Fork the repo and create a feature branch: `git checkout -b feat/your-change`
- Run the dev server locally: `npm install && npm run dev`
- Keep changes small and focused; add tests where appropriate.
- For UI changes, include screenshots or short recording.
- Open a PR with a clear description and link to any related issue.

Testing
- E2E tests use Playwright: `npm run test:e2e`.

Code style
- Follow existing project conventions. Run linters (if added) before submitting.

Security
- Do not commit secrets. Use `.env` and `.env.example` for required environment variables.

Questions
- Open an issue or reach out to the maintainers.
