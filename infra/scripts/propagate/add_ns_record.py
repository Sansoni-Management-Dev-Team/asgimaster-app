#!/usr/bin/env python3
"""
Add NS records to a Route53 hosted zone in Account B.
Reads the NS records from the 'record' file created by get_ns_records.py.

Non-interactive: all inputs are supplied via environment variables so this
can run unattended in CI.

Env vars:
    AWS_PROFILE        AWS CLI profile/credentials for Account B (required,
                        unless credentials are provided another way, e.g.
                        an assumed role in CI).
    PARENT_ZONE_NAME    Parent hosted zone name in Account B, e.g.
                        "nationalsalescentre.com.au" (required).
    ZONE_KEY            Key of the zone to propagate from the record file
                        (required if the record file has more than one
                        zone; auto-selected if there is only one).
    TTL                 TTL in seconds for the NS record (optional,
                        default: 172800).

Usage:
    PARENT_ZONE_NAME=nationalsalescentre.com.au \
        AWS_PROFILE=<account-b-profile> python3 add_ns_record.py
"""

import json
import os
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RECORD_FILE = os.path.join(SCRIPT_DIR, "record")

DEFAULT_TTL = 172800


def run_aws(args):
    result = subprocess.run(
        ["aws"] + args,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print("AWS CLI error:", file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        sys.exit(1)
    return result.stdout.strip()


def get_hosted_zone_id(zone_name):
    # Route53 stores zone names with a trailing dot
    search_name = zone_name.rstrip(".") + "."
    output = run_aws([
        "route53", "list-hosted-zones",
        "--query", f"HostedZones[?Name=='{search_name}'].Id",
        "--output", "text",
    ])
    if not output:
        print(f"No hosted zone found with name: {zone_name}", file=sys.stderr)
        sys.exit(1)
    # ID comes back as /hostedzone/XXXXXXXXXXXX
    return output.strip().split("/")[-1]


def load_records():
    if not os.path.exists(RECORD_FILE):
        print(f"Record file not found: {RECORD_FILE}", file=sys.stderr)
        print("Run get_ns_records.py first.", file=sys.stderr)
        sys.exit(1)
    with open(RECORD_FILE) as f:
        return json.load(f)


def upsert_ns_record(hosted_zone_id, record_name, name_servers, ttl):
    change_batch = {
        "Changes": [
            {
                "Action": "UPSERT",
                "ResourceRecordSet": {
                    "Name": record_name,
                    "Type": "NS",
                    "TTL": ttl,
                    "ResourceRecords": [{"Value": ns} for ns in name_servers],
                },
            }
        ]
    }
    output = run_aws([
        "route53", "change-resource-record-sets",
        "--hosted-zone-id", hosted_zone_id,
        "--change-batch", json.dumps(change_batch),
    ])
    return json.loads(output)


def select_zone(records):
    if len(records) == 1:
        return records[0]

    zone_key = os.environ.get("ZONE_KEY")
    if not zone_key:
        print("Multiple zones found in record file. Set ZONE_KEY to select one:", file=sys.stderr)
        for zone in records:
            print(f"  {zone['key']}: {zone['name']}", file=sys.stderr)
        sys.exit(1)

    for zone in records:
        if zone["key"] == zone_key:
            return zone

    print(f"No zone with key '{zone_key}' found in record file.", file=sys.stderr)
    sys.exit(1)


def main():
    records = load_records()

    print("NS records loaded from record file:")
    for zone in records:
        print(f"  {zone['name']}")
        for ns in zone["name_servers"]:
            print(f"    NS  {ns}")
    print()

    selected = select_zone(records)

    zone_name = os.environ.get("PARENT_ZONE_NAME", "").strip()
    if not zone_name:
        print("PARENT_ZONE_NAME environment variable is required.", file=sys.stderr)
        sys.exit(1)

    print(f"Looking up hosted zone ID for: {zone_name}")
    zone_id = get_hosted_zone_id(zone_name)
    print(f"Found hosted zone ID: {zone_id}")

    ttl_input = os.environ.get("TTL", "").strip()
    ttl = int(ttl_input) if ttl_input else DEFAULT_TTL

    print("\nUPSERT NS record:")
    print(f"  Parent zone : {zone_name} ({zone_id})")
    print(f"  Record name : {selected['name']}")
    print(f"  NS values   : {', '.join(selected['name_servers'])}")
    print(f"  TTL         : {ttl}")

    result = upsert_ns_record(zone_id, selected["name"], selected["name_servers"], ttl)
    info = result.get("ChangeInfo", {})
    print(f"\nDone. Change ID: {info.get('Id', '')}  Status: {info.get('Status', '')}")


if __name__ == "__main__":
    main()
