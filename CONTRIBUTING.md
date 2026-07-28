# Contributing to animated-code

Thanks for taking the time to contribute! Everyone is welcome here, whether this is your first open source contribution or your thousandth.

This guide explains how to report issues, suggest changes, and open pull requests. By taking part, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- Report a bug
- Suggest a feature or improvement
- Improve the documentation
- Fix an open issue
- Help review pull requests

## Reporting bugs and requesting features

Before opening a new issue, search the [existing issues](https://github.com/eddiejaoude/animated-code/issues) to avoid duplicates.

If nothing matches, open a new issue using the relevant template:

- **Bug report** for something that isn't working as expected
- **Feature request** for a new idea or improvement

The more detail you provide, the easier it is for others to help.

## Development workflow

### 1. Set up the project

Follow the [Getting started](README.md#getting-started) steps in the README to install dependencies and run the app locally.

### 2. Find something to work on

Browse the [open issues](https://github.com/eddiejaoude/animated-code/issues). Issues labelled `good first issue` are a good place to start.

Comment on the issue to let others know you're working on it, and wait to be assigned before starting larger changes. This avoids duplicated effort.

### 3. Create a branch

Create a branch from `main` with a short, descriptive name:

```bash
git checkout -b fix/export-button-alignment
```

### 4. Make your changes

- Keep each pull request focused on one thing.
- Match the existing code style.
- Run the linter and tests before committing:

  ```bash
  npm run lint
  npm test
  ```

### 5. Commit your work

Write clear commit messages that explain what changed and why. We follow the [Conventional Commits](https://www.conventionalcommits.org/) style:

```
feat: add frame duration control
fix: correct playback timing on loop
docs: update setup instructions
```

### 6. Open a pull request

Push your branch and open a pull request against `main`. Fill in the pull request template so reviewers understand your change, and link the issue it addresses (for example, `Closes #123`).

A maintainer will review your pull request. Please be patient and responsive to feedback; review is a normal part of the process.

## Questions

If you're stuck or unsure about anything, open a [discussion](https://github.com/eddiejaoude/animated-code/discussions) or ask in the issue you're working on. We're happy to help.
