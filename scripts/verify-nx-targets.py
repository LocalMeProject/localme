#!/usr/bin/env python3
"""
verify-nx-targets.py
Verifies that all project.json files across an enterprise Nx monorepo implement
the mandatory standard targets (lint, test, build, audit) and conform to tagging conventions.
"""

import argparse
import json
import os
import sys
from typing import Dict, List, Tuple


MANDATORY_TARGETS = ["lint", "test", "build", "audit"]
VALID_PROFILES = {"profile:a", "profile:b", "profile:c", "profile:d"}
VALID_SCOPES = {"scope:backend", "scope:frontend", "scope:mobile", "scope:shared"}

EXCLUDED_DIRS = {
    "node_modules",
    ".git",
    ".nx",
    "dist",
    "build",
    "coverage",
    ".cache",
    ".venv",
    "vendor",
    "templates",
    "__pycache__",
}


def find_project_json_files(root_dir: str) -> List[str]:
    matches = []
    for current_root, dirs, files in os.walk(root_dir):
        # Prune excluded directories
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS and not d.startswith(".")]
        
        if "project.json" in files:
            matches.append(os.path.join(current_root, "project.json"))
            
    return sorted(matches)


def verify_project_file(file_path: str, strict_tags: bool = True) -> Tuple[bool, List[str]]:
    errors: List[str] = []
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        return False, [f"Failed to parse JSON: {e}"]
    
    if not isinstance(data, dict):
        return False, ["Root JSON value must be an object."]
    
    name = data.get("name")
    if not name or not isinstance(name, str):
        errors.append("Missing or invalid 'name' field.")
        
    targets = data.get("targets")
    if not isinstance(targets, dict):
        errors.append("Missing or invalid 'targets' object.")
    else:
        for mandatory in MANDATORY_TARGETS:
            if mandatory not in targets:
                errors.append(f"Missing mandatory Nx target: '{mandatory}'")
            else:
                target_def = targets[mandatory]
                if not isinstance(target_def, dict):
                    errors.append(f"Target '{mandatory}' definition must be an object.")
                elif "executor" not in target_def and "command" not in target_def and "dependsOn" not in target_def:
                    errors.append(f"Target '{mandatory}' must define an 'executor', 'command', or 'dependsOn'.")

    if strict_tags:
        tags = data.get("tags")
        if not isinstance(tags, list):
            errors.append("Missing 'tags' array in project.json.")
        else:
            tag_set = set(str(t).lower() for t in tags)
            if not tag_set.intersection(VALID_PROFILES):
                errors.append(f"Missing valid profile tag (expected one of: {', '.join(sorted(VALID_PROFILES))})")
            if not tag_set.intersection(VALID_SCOPES):
                errors.append(f"Missing valid scope tag (expected one of: {', '.join(sorted(VALID_SCOPES))})")

    return len(errors) == 0, errors


def main():
    parser = argparse.ArgumentParser(description="Verify enterprise Nx project.json target contracts.")
    parser.add_argument("--root", default=".", help="Root directory to scan (default: current directory)")
    parser.add_argument("--no-strict-tags", dest="strict_tags", action="store_false", help="Do not enforce profile: and scope: tags")
    parser.add_argument("--json", action="store_true", help="Output results in JSON format")
    
    args = parser.parse_args()

    if not os.path.exists(args.root):
        print(f"[ERROR] Specified root directory '{args.root}' does not exist.", file=sys.stderr)
        sys.exit(1)

    project_files = find_project_json_files(args.root)
    
    results = {}
    total_errors = 0
    
    for pf in project_files:
        valid, errors = verify_project_file(pf, strict_tags=args.strict_tags)
        rel_path = os.path.relpath(pf, args.root)
        results[rel_path] = {
            "valid": valid,
            "errors": errors,
        }
        total_errors += len(errors)
        
    all_valid = total_errors == 0
    
    if args.json:
        out = {
            "root": args.root,
            "total_projects": len(project_files),
            "compliant": all_valid,
            "total_errors": total_errors,
            "projects": results,
        }
        print(json.dumps(out, indent=2))
    else:
        print(f"=== Nx Monorepo Target Contract Verification ===")
        print(f"Scanned {len(project_files)} project.json file(s) under '{args.root}'.\n")
        
        if len(project_files) == 0:
            print("[INFO] No project.json files found to inspect.")
            sys.exit(0)
            
        for path, info in results.items():
            if info["valid"]:
                print(f"[PASS] {path} (implements {', '.join(MANDATORY_TARGETS)})")
            else:
                print(f"[FAIL] {path}:")
                for err in info["errors"]:
                    print(f"       - {err}")
                    
        print(f"\nResult: {'ALL PASSED' if all_valid else f'FAILED with {total_errors} defect(s)'}")
        
    sys.exit(0 if all_valid else 1)


if __name__ == "__main__":
    main()
