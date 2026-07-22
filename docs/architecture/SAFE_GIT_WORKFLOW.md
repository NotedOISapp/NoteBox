No direct pushes to main.

All work must happen on a branch.

All production changes require a pull request.

All pull requests require CI.

All releases happen from short-lived release branches created from current `main`.

Hotfixes branch from `main` and merge back into `main` through a pull request.

Never use scripts that initialize git and push directly to main.
