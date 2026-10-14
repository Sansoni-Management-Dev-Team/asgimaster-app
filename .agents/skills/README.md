# Skills

Product and workflow skills live here, one folder per skill (`<name>/SKILL.md`).

`.claude/skills` is a symlink to this folder so Claude Code picks the skills up. Keeping the real files under `.agents/` means other agent tools can read them too.

`device-testing` is ours. The others are vendored from [expo/skills](https://github.com/expo/skills) and [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) and pinned in `skills-lock.json` at the repository root. Update them with `npx skills update`, and do not edit them by hand.
