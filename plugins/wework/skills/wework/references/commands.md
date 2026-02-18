# wework Command Reference

## Root Command

`wework` supports:

- `book`: Book a workspace
- `bookings`: List your upcoming bookings
- `calendar`: Generate an ICS calendar file
- `desks`: List available desks
- `locations`: List available locations by city
- `completion`: Generate shell completion scripts

Global flags:

- `--username <value>`
- `--password <value>`

## Subcommands

### `wework locations`

- Purpose: list available WeWork locations in a city
- Flags:
  - `--city <city-name>`

### `wework desks`

- Purpose: list available desks
- Flags:
  - `--city <city-name>`
  - `--location-uuid <uuid>`
  - `--date <YYYY-MM-DD>` (defaults to current date)

### `wework book`

- Purpose: create a booking
- Flags:
  - `--city <city-name>`
  - `--name <space-name>`
  - `--location-uuid <uuid>`
  - `--date <YYYY-MM-DD>` (defaults to current date)

### `wework bookings`

- Purpose: list upcoming bookings
- No command-specific flags

### `wework calendar`

- Purpose: export bookings as ICS
- Flags:
  - `--calendar-path <path>` (default: `wework_bookings.ics`)

### `wework completion`

- Purpose: generate shell completion scripts
- Subcommands:
  - `bash`
  - `zsh`
  - `fish`
  - `powershell`

## Authentication

Preferred: environment variables.

```bash
export WEWORK_USERNAME="your_username"
export WEWORK_PASSWORD="your_password"
```

Fallback: pass global flags on commands (`--username`, `--password`).

## Install

```bash
npm install -g wework-cli
```

Alternative install paths from repository README:

```bash
brew tap dvcrn/formulas
brew install wework
# or
go install github.com/dvcrn/wework-cli/cmd/wework@latest
```

## Example Commands

Use these real-world examples as templates:

```bash
# Check desks for Bangkok on a specific date
wework desks --city Bangkok --date 2025-12-09

# List Tokyo locations
wework locations --city tokyo

# Book a date range in one location
wework book --city "Tokyo" --name "Shibuya Scramble Square" --date 2026-02-18~2026-02-20

# List upcoming bookings
wework bookings
```
