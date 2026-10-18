#!/usr/bin/env python3
"""Turn a `terragrunt run --all plan --log-format json` log into a Markdown PR comment.

Usage: terragrunt-plan-comment.py <plan.jsonl> <infra dir> <environment> <exit code> > comment.md

Optional environment variables: RUN_URL (link to the workflow run), COMMIT_SHA.
"""

import json
import os
import re
import sys
from collections import defaultdict

# GitHub rejects comments over 65,536 characters.
MAX_LENGTH = 60_000

PLAN_LINE = re.compile(r"^Plan: (\d+) to add, (\d+) to change, (\d+) to destroy\.", re.M)
NO_CHANGES = "No changes. Your infrastructure matches the configuration."
DIFF_START = "OpenTofu will perform the following actions:"
SYMBOL = re.compile(r"^(\s*)(-/\+|\+/-|[~+-])(?= )")


def read_log(path, infra_dir):
    """Group plan output and errors by unit."""
    output = defaultdict(str)
    errors = defaultdict(list)
    general_errors = []
    with open(path) as f:
        for line in f:
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            unit = entry.get("working-dir")
            if unit:
                # Terragrunt logs some paths relative to the infra folder and some absolute.
                unit = os.path.relpath(unit, infra_dir) if os.path.isabs(unit) else os.path.normpath(unit)
            msg = entry.get("msg", "")
            if unit and entry.get("tf-command-args", [""])[0] == "plan" and entry.get("level") != "error":
                output[unit] += msg
            elif entry.get("level") == "error":
                (errors[unit] if unit else general_errors).append(msg.strip())
    return output, errors, general_errors


def short(unit):
    return unit.removeprefix("applications/modules/")


def diff_block(text):
    """Return the resource changes, with the change symbols moved to column 0 for diff colouring."""
    start = text.find(DIFF_START)
    end = PLAN_LINE.search(text)
    if start == -1 or not end:
        return ""
    lines = []
    for line in text[start + len(DIFF_START) : end.start()].strip("\n").splitlines():
        m = SYMBOL.match(line)
        if m:
            symbol = "!" if m.group(2) in ("~", "-/+", "+/-") else m.group(2)
            line = symbol + m.group(1) + line[m.end() :]
        lines.append(line)
    return "\n".join(lines).strip("\n")


def main():
    log_path, infra_dir, environment, exit_code = sys.argv[1:5]
    output, errors, general_errors = read_log(log_path, os.path.abspath(infra_dir))

    changed, unchanged, failed = [], [], []
    for unit in sorted(set(output) | set(e for e in errors if e)):
        m = PLAN_LINE.search(output[unit])
        if errors.get(unit) and not m and NO_CHANGES not in output[unit]:
            failed.append(unit)
        elif m:
            changed.append((unit, tuple(int(n) for n in m.groups())))
        else:
            unchanged.append(unit)

    ok = exit_code == "0" and not failed and not general_errors
    totals = [sum(c[1][i] for c in changed) for i in range(3)]

    head = [f"### {'✅' if ok else '❌'} Terragrunt plan for `{environment}`", ""]
    meta = []
    if os.environ.get("COMMIT_SHA"):
        meta.append(f"Commit `{os.environ['COMMIT_SHA'][:7]}`")
    if os.environ.get("RUN_URL"):
        meta.append(f"[workflow run]({os.environ['RUN_URL']})")
    if meta:
        head += [" · ".join(meta), ""]

    if not ok and not failed:
        head += ["The plan failed before it reached every unit. See the workflow run for the full log.", ""]
    if failed:
        head.append(f"**{len(failed)} {'unit' if len(failed) == 1 else 'units'} failed.**")
    if changed:
        head.append(
            f"**{totals[0]} to add, {totals[1]} to change, {totals[2]} to destroy** "
            f"across {len(changed)} of {len(changed) + len(unchanged) + len(failed)} units."
        )
    elif ok:
        head.append(f"**No changes** in {len(unchanged)} units.")
    head.append("")

    if changed or failed:
        head += ["| Unit | Add | Change | Destroy |", "| --- | --: | --: | --: |"]
        for unit in failed:
            head.append(f"| ❌ `{short(unit)}` | | | |")
        for unit, (add, change, destroy) in changed:
            flag = " ⚠️" if destroy else ""
            head.append(f"| `{short(unit)}`{flag} | {add} | {change} | {destroy} |")
        head.append("")

    sections = []
    for unit in failed:
        body = "\n\n".join(errors[unit])
        sections.append((f"❌ <code>{short(unit)}</code> failed", body, "text"))
    for unit, (add, change, destroy) in changed:
        sections.append(
            (f"<code>{short(unit)}</code>: {add} to add, {change} to change, {destroy} to destroy", diff_block(output[unit]), "diff")
        )
    if general_errors:
        sections.append(("Errors", "\n\n".join(general_errors), "text"))

    tail = []
    if unchanged:
        tail += [
            f"<details><summary>{len(unchanged)} units with no changes</summary>",
            "",
            ", ".join(f"`{short(u)}`" for u in unchanged),
            "",
            "</details>",
        ]

    # Keep under GitHub's limit by giving each detail section an equal share when the total is too long.
    budget = MAX_LENGTH - len("\n".join(head + tail)) - 100 * len(sections) - 500
    limit = budget if sum(len(body) for _, body, _ in sections) <= budget else budget // max(len(sections), 1)
    rendered = []
    for summary, body, lang in sections:
        if len(body) > limit:
            body = body[:limit].rsplit("\n", 1)[0] + "\n… cut short, see the workflow run for the rest"
        rendered += [f"<details><summary>{summary}</summary>", "", f"```{lang}", body, "```", "", "</details>", ""]

    print("\n".join(head + rendered + tail).rstrip() + "\n")


if __name__ == "__main__":
    main()
