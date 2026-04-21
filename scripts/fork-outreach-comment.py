#!/usr/bin/env python3
"""Batch-comment on upstream issues that have been resolved in the fork.

Posts a standardized "fixed in community fork" pointer on every listed
upstream issue, one comment per issue, via `gh issue comment`. Tracks what
has been commented in scripts/.outreach-log.jsonl so re-runs are idempotent.

Defaults to --dry-run (prints what would be sent, sends nothing). Pass
--execute to actually post. Intended workflow:

    # 1. Review the list and the rendered comments:
    python3 scripts/fork-outreach-comment.py

    # 2. If satisfied, post them:
    python3 scripts/fork-outreach-comment.py --execute

    # 3. Re-running after --execute is safe: already-commented issues are
    #    skipped. Use --force to override.

The mapping issue → (commit, version) is maintained inline below. When a
new release lands, update FORK_FIX_MAP accordingly (source of truth:
CHANGELOG.md).
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


REPO_UPSTREAM = "jacksteamdev/obsidian-mcp-tools"
REPO_FORK = "istefox/obsidian-mcp-connector"
COMMUNITY_STORE_PR = 11919
LOG_PATH = Path(__file__).resolve().parent / ".outreach-log.jsonl"


@dataclass(frozen=True)
class FixRef:
    version: str  # fork release version where the fix landed
    sha: str  # primary commit SHA (short form)
    note: str = ""  # optional extra context (shown in --list only)


# Source of truth for each mapping: CHANGELOG.md in this repo.
# Update when a new release pins a previously-unpinned upstream issue.
# Issues NOT listed here are intentionally excluded (meta, duplicate, unclear).
FORK_FIX_MAP: dict[int, FixRef] = {
    26: FixRef("0.3.0", "2121ecf", "platform override for server binary"),
    28: FixRef("0.3.0", "4552c18", "install server outside vault"),
    29: FixRef("0.3.0", "c2f4549", "command execution support (Fase 1+2+3)"),
    30: FixRef("0.3.0", "046268b", "patch_vault_file nested sections (shared w/ #71)"),
    31: FixRef("0.3.0", "", "installer path handling on Linux (shared w/ #36)"),
    33: FixRef("0.3.0", "", "404 error and schema issues"),
    35: FixRef("0.3.0", "", "non-Claude-Desktop client docs (shared w/ #60)"),
    36: FixRef("0.3.0", "", "download path duplicate /home/<user> (shared w/ #31)"),
    37: FixRef("0.3.3", "75fe2a3", "trailing slash → HTTP 500"),
    39: FixRef("0.3.0", "95f4247", "search_vault_smart 404 (pinned retroactively)"),
    40: FixRef("0.3.0", "", "custom HTTP/HTTPS ports via env (shared w/ #67)"),
    41: FixRef("0.3.0", "939f167", "execute_template fails without tags"),
    59: FixRef("0.3.4", "6110b89", "native MCP image/audio content for get_vault_file"),
    60: FixRef("0.3.0", "", "support for Claude Code (shared w/ #35)"),
    61: FixRef("0.3.0", "", "enable/disable individual MCP tools"),
    62: FixRef("0.3.0", "939f167", "limit parameter on search_vault_simple"),
    63: FixRef("0.3.3", "75fe2a3", "additionalProperties: {} breaks Letta validation"),
    66: FixRef("0.3.3", "75fe2a3", "OBSIDIAN_API_URL honored"),
    67: FixRef("0.3.0", "", "configurable ports via env (shared w/ #40)"),
    68: FixRef("0.3.0", "939f167", "Local REST API v3.4+ compatibility"),
    71: FixRef("0.3.0", "046268b", "patch_vault_file nested sections (shared w/ #30)"),
    77: FixRef("0.3.0", "388b22e", "regression guard for no-arg inputSchema"),
    78: FixRef("0.3.0", "", "patch_vault_file non-ASCII headings (covered retroactively)"),
}

# Indirectly covered by #28 (install outside vault). Commented on only with
# --include-indirect, because the argument "this covers your bug too" is less
# airtight and needs case-by-case verification.
INDIRECT_MAP: dict[int, FixRef] = {
    27: FixRef("0.3.0", "4552c18", "Windows issues — install path fix (#28) likely resolves"),
    38: FixRef("0.3.0", "4552c18", "MCP SuperAssistant error — install path fix (#28) likely resolves"),
}


COMMENT_TEMPLATE_DIRECT = """\
For anyone still waiting on this — it's been fixed in the community fork at \
https://github.com/{fork} (commit `{sha_clause}`, released in **v{version}**).

You can install today via [BRAT](https://github.com/TfTHacker/obsidian42-brat) \
by pointing to `{fork}`, or wait for the community-store entry pending at \
obsidianmd/obsidian-releases#{store_pr}.

Opening from the fork side to surface the pointer — feel free to close if \
you're satisfied, or keep open to track the upstream decision."""


COMMENT_TEMPLATE_INDIRECT = """\
For anyone still watching this — I believe this is resolved indirectly in the \
community fork at https://github.com/{fork} by the install-location fix for \
#28 (commit `{sha_clause}`, released in **v{version}**). The underlying \
root cause (MCP server binary stuck in a hard-coded path) was the same.

If you still hit the bug on the fork, please open a fresh issue at \
{fork}/issues — happy to look at it. Install via [BRAT](https://github.com/TfTHacker/obsidian42-brat) \
pointing to `{fork}`, or wait for obsidianmd/obsidian-releases#{store_pr}."""


def render_comment(issue: int, ref: FixRef, *, indirect: bool) -> str:
    template = COMMENT_TEMPLATE_INDIRECT if indirect else COMMENT_TEMPLATE_DIRECT
    sha_clause = ref.sha if ref.sha else "see CHANGELOG.md"
    return template.format(
        fork=REPO_FORK,
        sha_clause=sha_clause,
        version=ref.version,
        store_pr=COMMUNITY_STORE_PR,
    )


def load_log() -> dict[int, dict]:
    if not LOG_PATH.is_file():
        return {}
    entries: dict[int, dict] = {}
    with LOG_PATH.open() as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            entries[int(entry["issue"])] = entry
    return entries


def append_log(entry: dict) -> None:
    with LOG_PATH.open("a") as fh:
        fh.write(json.dumps(entry) + "\n")


def post_comment(issue: int, body: str) -> tuple[bool, str]:
    """Shell out to `gh issue comment` and capture URL of the new comment."""
    try:
        result = subprocess.run(
            [
                "gh",
                "issue",
                "comment",
                str(issue),
                "--repo",
                REPO_UPSTREAM,
                "--body",
                body,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        return True, (result.stdout.strip() or "ok")
    except subprocess.CalledProcessError as exc:
        return False, (exc.stderr or exc.stdout or str(exc)).strip()


def cmd_list(args: argparse.Namespace) -> int:
    print(f"{'#':>4}  {'ver':<7} {'commit':<9} note")
    print("-" * 72)
    print("DIRECT FIXES (default target):")
    for issue in sorted(FORK_FIX_MAP):
        ref = FORK_FIX_MAP[issue]
        print(f"  #{issue:<3} {ref.version:<7} {(ref.sha or '—'):<9} {ref.note}")
    print()
    print("INDIRECT (requires --include-indirect):")
    for issue in sorted(INDIRECT_MAP):
        ref = INDIRECT_MAP[issue]
        print(f"  #{issue:<3} {ref.version:<7} {(ref.sha or '—'):<9} {ref.note}")
    print()
    log = load_log()
    if log:
        print(f"Already logged (in {LOG_PATH.name}): {sorted(log)}")
    else:
        print(f"No comments logged yet ({LOG_PATH.name} absent).")
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    targets: dict[int, tuple[FixRef, bool]] = {
        n: (ref, False) for n, ref in FORK_FIX_MAP.items()
    }
    if args.include_indirect:
        for n, ref in INDIRECT_MAP.items():
            targets[n] = (ref, True)
    if args.issue is not None:
        if args.issue not in targets and args.issue in INDIRECT_MAP:
            targets = {args.issue: (INDIRECT_MAP[args.issue], True)}
        elif args.issue in targets:
            targets = {args.issue: targets[args.issue]}
        else:
            print(f"Issue #{args.issue} not in mapping. Run --list to see available.", file=sys.stderr)
            return 2

    log = load_log()
    if args.execute:
        print("🚀 EXECUTE mode — comments will be posted.")
    else:
        print("🧪 DRY-RUN — nothing will be posted. Pass --execute when ready.")
    print(f"Targets: {len(targets)} issue(s)")
    print()

    posted = 0
    skipped = 0
    failed: list[tuple[int, str]] = []

    for issue in sorted(targets):
        ref, indirect = targets[issue]

        if issue in log and not args.force:
            logged_at = log[issue].get("timestamp", "?")
            print(f"⏭  #{issue:<3} already commented on {logged_at} — skipping (use --force to override)")
            skipped += 1
            continue

        body = render_comment(issue, ref, indirect=indirect)
        banner = f"#{issue} ({'indirect' if indirect else 'direct'}) — v{ref.version} / {ref.sha or 'see CHANGELOG'}"
        print(f"━━━ {banner}")
        print(body)
        print()

        if not args.execute:
            continue

        ok, info = post_comment(issue, body)
        if ok:
            print(f"✅ posted: {info}")
            append_log(
                {
                    "issue": issue,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "version": ref.version,
                    "sha": ref.sha,
                    "indirect": indirect,
                    "comment_url": info,
                }
            )
            posted += 1
        else:
            print(f"❌ failed: {info}")
            failed.append((issue, info))
        print()

    print("=" * 50)
    if args.execute:
        print(f"Posted: {posted}, Skipped: {skipped}, Failed: {len(failed)}")
        if failed:
            print("\nFailed issues:")
            for n, msg in failed:
                print(f"  #{n}: {msg[:200]}")
            return 1
    else:
        print(f"Would post: {len(targets) - skipped}, Skipped (already logged): {skipped}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd")

    p_list = sub.add_parser("list", help="Show the issue → fix mapping")
    p_list.set_defaults(func=cmd_list)

    p_run = sub.add_parser("run", help="Render comments (default dry-run)")
    p_run.add_argument("--execute", action="store_true", help="Actually post comments")
    p_run.add_argument(
        "--include-indirect",
        action="store_true",
        help="Also comment on indirectly-covered issues (#27, #38)",
    )
    p_run.add_argument("--issue", type=int, help="Target only this issue number")
    p_run.add_argument(
        "--force",
        action="store_true",
        help="Re-post even on issues already in the log",
    )
    p_run.set_defaults(func=cmd_run)

    # Default to 'run' with dry-run if no subcommand given.
    args = parser.parse_args()
    if args.cmd is None:
        args = parser.parse_args(["run"])

    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
