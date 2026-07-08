#!/usr/bin/env python3

import argparse
import pathlib
import re
import subprocess
import tempfile

TITLE_RE = re.compile(r"^#\s+(.+)$", re.MULTILINE)
LABEL_RE = re.compile(r"\*\*Labels:\*\*\s*(.+)")

#!/usr/bin/env python3
#
# gh-issue-insert.py
#
# Import Markdown files as GitHub issues and optionally add them to a
# GitHub Projects v2 project.
#
# Each Markdown file should contain:
#
#   # Issue title
#
#   **Size:** S · **Labels:** bug, enhancement
#
#   Issue body text...
#
# The first level-1 Markdown heading (# ...) becomes the issue title.
# The remainder of the file becomes the issue body.
# If a **Labels:** line is present, those labels are applied to the issue.
#
# Note that the labels must be created before
#
# Prerequisites:
#
#   1. Install GitHub CLI:
#
#        https://cli.github.com/
#
#   2. Authenticate once:
#
#        gh auth login
#
#      Verify authentication:
#
#        gh auth status
#
#      For GitHub Projects v2 support, ensure the token has the project
#      scope:
#
#        gh auth refresh -s project
#
# Usage:
#
#   Import issues into a repository:
#
#       python3 gh-issue-insert.py issues \
#           --repo OWNER/REPOSITORY
#
#   Import issues and add them to a GitHub Project:
#
#       python3 gh-issue-insert.py issues \
#           --repo OWNER/REPOSITORY \
#           --project-owner OWNER \
#           --project-number PROJECT_NUMBER
#
# Example:
#
#       python3 gh-issue-insert.py issues \
#           --repo sparsileg/astryx \
#           --project-owner sparsileg \
#           --project-number 4
#
# Finding the project number:
#
#   The project number is the number shown in the project URL:
#
#       https://github.com/users/OWNER/projects/4
#
#   or:
#
#       https://github.com/orgs/OWNER/projects/4
#
# Notes:
#
#   - The target repository must already exist.
#   - GitHub labels must exist before issues are created unless the script
#     is configured to create missing labels automatically.
#   - The authenticated GitHub user must have permission to create issues
#     in the repository and write access to the GitHub Project.
#   - GH_TOKEN may be used for automation environments instead of
#     interactive authentication:
#
#       export GH_TOKEN=<token>
#
#   - Re-running the script will create duplicate issues unless duplicate
#     detection is added.
#

def ensure_label(repo, label):
    existing = subprocess.run(
        [
            "gh", "label", "list",
            "--repo", repo,
            "--search", label,
            "--json", "name"
        ],
        capture_output=True,
        text=True,
        check=True
    )

    if f'"name":"{label}"' not in existing.stdout:
        subprocess.run(
            [
                "gh", "label", "create",
                label,
                "--repo", repo
            ],
            check=True
        )

def run(cmd):
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        check=True
    )
    return result.stdout.strip()

def get_issue_node_id(repo, issue_number):
    query = f"""
    query {{
      repository(owner:"{repo.split('/')[0]}", name:"{repo.split('/')[1]}") {{
        issue(number:{issue_number}) {{
          id
        }}
      }}
    }}
    """

    return run([
        "gh", "api", "graphql",
        "-f", f"query={query}",
        "--jq", ".data.repository.issue.id"
    ])

def get_project_id(owner, project_number):
    return run([
        "gh", "project", "view",
        str(project_number),
        "--owner", owner,
        "--format", "json",
        "--jq", ".id"
    ])

def add_to_project(project_id, issue_node):
    mutation = """
    mutation($project:ID!, $content:ID!) {
      addProjectV2ItemById(
        input:{
          projectId:$project,
          contentId:$content
        }) {
        item { id }
      }
    }
    """

    run([
        "gh", "api", "graphql",
        "-f", f"query={mutation}",
        "-F", f"project={project_id}",
        "-F", f"content={issue_node}"
    ])

def create_issue(repo, mdfile, project_id=None):
    text = mdfile.read_text(encoding="utf-8")

    title_match = TITLE_RE.search(text)
    if not title_match:
        print(f"Skipping {mdfile}: no title")
        return

    title = title_match.group(1).strip()

    labels = []
    m = LABEL_RE.search(text)
    if m:
        labels = [x.strip() for x in m.group(1).split(",")]

    for label in labels:
        ensure_label(repo, label)

    body = text[title_match.end():].lstrip()

    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".md",
        delete=False,
        encoding="utf-8",
    ) as f:
        f.write(body)
        bodyfile = f.name

    cmd = [
        "gh", "issue", "create",
        "--repo", repo,
        "--title", title,
        "--body-file", bodyfile,
    ]

    for label in labels:
        cmd.extend(["--label", label])

    url = run(cmd)

    issue_number = int(url.rstrip("/").split("/")[-1])

    print(f"Created #{issue_number}: {title}")

    if project_id:
        node = get_issue_node_id(repo, issue_number)
        add_to_project(project_id, node)
        print("  Added to project")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("directory")
    parser.add_argument("--repo", required=True,
                        help="owner/repo")
    parser.add_argument("--project-number", type=int,
                        help="GitHub Project number")
    parser.add_argument("--project-owner",
                        help="Project owner (user or org)")
    args = parser.parse_args()

    project_id = None

    if args.project_number:
        if not args.project_owner:
            parser.error("--project-owner is required with --project-number")
        project_id = get_project_id(
            args.project_owner,
            args.project_number
        )

    files = sorted(pathlib.Path(args.directory).glob("*.md"))

    for md in files:
        create_issue(args.repo, md, project_id)

if __name__ == "__main__":
    main()
