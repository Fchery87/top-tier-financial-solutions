# Triage Labels

The triage workflow uses these canonical roles and label strings.

| Canonical role | Label string | Meaning |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | Maintainer needs to evaluate the issue. |
| `needs-info` | `needs-info` | Waiting on the reporter or requester for more information. |
| `ready-for-agent` | `ready-for-agent` | Fully specified and ready for an AFK agent to implement. |
| `ready-for-human` | `ready-for-human` | Requires human implementation or judgment before work can proceed. |
| `wontfix` | `wontfix` | Will not be actioned. |

## Consumer Rules

- Apply exactly one active triage-state label unless the user explicitly asks otherwise.
- Remove obsolete triage-state labels when moving an issue to a new state.
- Do not invent alternate labels for these roles without updating this file first.
