# Linear access

Use the native Linear CLI for delivery tracking. Before reading or changing backlog records, verify the selected workspace is `mlai-aus`; never assume the global default belongs to this project. The repository workspace selector is authoritative in [the local configuration](../.linear.toml).

Authenticate through the CLI's keyring-backed flow. Keep API keys out of source, documentation and command output; be aware that an exported API key can override keyring credentials. Repository workspace selection must not silently change another project's global workspace.

Requirements remain in the [feature specifications](features/README.md). Keep delivery sequencing, accounting and verification evidence in Linear, PRs or thread artifacts, without using ticket state as evidence that a product requirement changed.
