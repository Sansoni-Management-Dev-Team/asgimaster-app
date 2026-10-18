#!/usr/bin/env python3
"""
Retrieve NS records from the hosted_zone terragrunt module output (Account A)
and save them to a local 'record' file for use by add_ns_record.py.

Usage:
    AWS_PROFILE=<account-a-profile> python3 get_ns_records.py
"""

import json
import os
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))

# Path to the terragrunt module that manages the hosted zone.
# Adjust this if your directory structure differs.
MODULE_PATH = os.path.join(REPO_ROOT, "applications", "modules", "route53", "hosted_zone")

RECORD_FILE = os.path.join(SCRIPT_DIR, "record")


def run_terragrunt_output():
    print(f"Running terragrunt output in:\n  {MODULE_PATH}\n")
    result = subprocess.run(
        ["terragrunt", "output", "-json"],
        cwd=MODULE_PATH,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print("Error running terragrunt output:", file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        sys.exit(1)
    return json.loads(result.stdout)


def main():
    output = run_terragrunt_output()

    hosted_zones_output = output.get("hosted_zones", {})
    # terraform output -json wraps values under a "value" key
    if "value" in hosted_zones_output:
        hosted_zones = hosted_zones_output["value"]
    else:
        hosted_zones = hosted_zones_output

    if not hosted_zones:
        print("No hosted_zones found in terragrunt output.", file=sys.stderr)
        sys.exit(1)

    records = []
    for key, zone in hosted_zones.items():
        name = zone["name"].rstrip(".")
        name_servers = [ns.rstrip(".") for ns in zone["name_servers"]]
        records.append({
            "key": key,
            "name": name,
            "name_servers": name_servers,
        })
        print(f"Zone '{key}': {name}")
        for ns in name_servers:
            print(f"  NS  {ns}")

    with open(RECORD_FILE, "w") as f:
        json.dump(records, f, indent=2)
        f.write("\n")

    print(f"\nSaved to: {RECORD_FILE}")


if __name__ == "__main__":
    main()
