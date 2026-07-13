"""Processing (ingest) step — the discrete, machine-only phase.

Distinct from user annotation: this decides what the machine can know once, at first
insert. Currently that's the running `subtype` for the unambiguous cases. Trail running
is left unset on purpose — the user classifies it trail/mountain by hand.
See CLAUDE.md > Processing vs annotation.
"""
from __future__ import annotations


def seed_subtype(activity_type: str | None) -> str | None:
    at = (activity_type or "").lower()
    if at == "running":
        return "road"
    if "running" in at and ("treadmill" in at or "indoor" in at):
        return "treadmill"
    return None  # trail/mountain → user; non-running → no subtype
