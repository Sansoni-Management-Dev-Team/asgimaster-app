# Linear CLI

Run `linear auth login` to store the key in Keychain. Put the reported workspace slug in the repo-root `.linear.toml`:

```toml
workspace = "your-workspace-slug"
```

Verify with `linear auth whoami`, then use normal `linear` commands. The repo setting selects its workspace without changing the global default. An exported `LINEAR_API_KEY` overrides stored credentials.
