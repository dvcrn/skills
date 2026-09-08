# TripIt CLI examples

Use only the commands needed for the requested operation. Example create/delete commands are not instructions to run a lifecycle test.

## Command Examples

Use these common examples from `README.md`:

```bash
tripit trips create --name "Test Trip" --start 2026-03-20 --end 2026-03-23 --location "Tokyo" -o json
tripit trips list
tripit trips get <TRIP_UUID>
tripit trips update <TRIP_UUID> --name "Updated Test Trip"
tripit trips delete <TRIP_UUID>
```

Additional lifecycle examples:

```bash
# Create a trip
tripit trips create --name "CLI Example Trip" --start 2026-05-10 --end 2026-05-14 --location "Lisbon" -o json

# Add and delete a hotel
tripit hotels create --trip <TRIP_UUID> --name "Example Hotel" --checkin 2026-05-10 --checkout 2026-05-14 --checkin-time 15:00 --checkout-time 11:00 --timezone UTC --address "1 Example Ave" --city "Lisbon" --country PT -o json
tripit hotels delete <HOTEL_UUID>

# Add and delete a flight
tripit flights create --trip <TRIP_UUID> --name "Outbound Flight" --airline "Example Air" --from "San Francisco" --from-code US --to "Lisbon" --to-code PT --airline-code EA --flight-num 456 --depart-date 2026-05-10 --depart-time 08:30 --depart-tz UTC --arrive-date 2026-05-10 --arrive-time 17:00 --arrive-tz UTC -o json
tripit flights delete <FLIGHT_UUID>

# Attach and remove documents
tripit documents attach <HOTEL_UUID> --file ./confirmation.pdf --caption "Booking Confirmation"
tripit documents attach <ACTIVITY_UUID> --file ./ticket.png
tripit documents remove <HOTEL_UUID> --caption "Booking Confirmation"
tripit documents remove <HOTEL_UUID> --all

# Add and delete an activity
tripit activities create --trip <TRIP_UUID> --name "City Walk" --start-date 2026-05-11 --start-time 10:00 --end-date 2026-05-11 --end-time 12:00 --timezone UTC --address "100 Main St" --location-name "Old Town" -o json
tripit activities delete <ACTIVITY_UUID>
```

For harness-style examples that run against `index.ts` via `fnox`, read:

- [ai-test-harness-examples.md](ai-test-harness-examples.md)
