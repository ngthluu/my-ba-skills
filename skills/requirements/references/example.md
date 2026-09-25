# Shape example: booking a quiet room

This is illustrative product content, not a template to copy without discovery and confirmation. Assume a user confirmed it on 2026-09-25.

`README.md`:

```md
# Current requirements

User groups: Team members.
Goals: Find a quiet place for a focused call.

[Book a room](journeys/book-room.md)
```

`journeys/book-room.md`:

```md
# REQ-001: Book a room

Actor: Team member
Goal: Reserve a quiet room for a focused call.
User value: Can hold the call without a scheduling conflict.
Entry point: Open room availability for a chosen time.
Evidence: EVD-001

Actions and responses:
1. The member chooses a time -> Available rooms appear.
2. The member selects a room -> Its capacity and the selected time appear.
3. The member confirms -> The reservation and where to find it later appear.

Success: The member has a confirmed room for the call.
Failure and recovery: If another person takes the room before confirmation, the product explains the conflict and shows other available rooms for the time.
```

`non-functional.md`:

```md
# Quality constraints

- NFR-001: Availability results appear within 2 seconds for 95% of requests under the agreed normal load. Evidence: EVD-002.
```

`evidence.md`:

```md
# Evidence

- EVD-001 | Source: Interview | Provenance: Team member | Accessed: 2026-09-25 | Finding: Booking conflicts interrupt calls | Confidence: Direct report from one user; broader frequency unknown | Supports: REQ-001
- EVD-002 | Source: Product owner decision | Provenance: Product owner | Accessed: 2026-09-25 | Finding: 2-second result target under normal load | Confidence: Confirmed target; load definition unresolved | Supports: NFR-001
```

`ledger.md`:

```md
# Accepted changes

## 2026-09-25

- LED-001 | Decision: Establish baseline after inspecting the booking UI and interviewing a team member | Reason: First maintained requirements | Affects: REQ-001, NFR-001 | Before: no maintained requirements | After: baseline requirements for booking a quiet room | Known gaps: conflict frequency and normal-load definition
```

The integrity file is generated or prepared according to [integrity.md](integrity.md); its hashes depend on exact file bytes.
