# wework Example Output

These are representative outputs from the `wework` CLI to help parse columns and confirm command success.

## Desks by City

Command:

```bash
wework desks --city Bangkok --date 2025-12-09
```

Output:

```text
✓ Fetched available spaces
Location                      Reservable ID                           Location ID                             Available
------------------------------------------------------------------------------------------------------------------------
Spring Tower                  9f610828-4629-11ea-9b35-063f9368b941    de07b26d-959e-4fd7-9d27-6e89293cfc64    0
T-One Building                c61971d2-624d-11e9-a390-0e1e2abc3cd0    5d5314ad-ecb9-4b30-a221-8b4103a2ac75    0
The Parq                      98410a16-4ecb-11ea-ad64-063f9368b941    d32cde0e-d067-42b4-bb81-bfa7c59f49c2    0
```

## Locations by City

Command:

```bash
wework locations --city tokyo
```

Output:

```text
✓ Locations fetched
Location                      UUID                                    Latitude       Longitude
-----------------------------------------------------------------------------------------------
Metropolitan Plaza Building   b9277fee-11c7-4be5-a8bb-5a2626f6db4a    35.728848      139.709300
Hareza Ikebukuro              1736efcf-ceb9-47b0-bbb8-5a12ae80b2c0    35.732403      139.715530
D-Tower Nishishinjuku         cae77178-7e67-4bcc-be42-2172473bc3ab    35.694960      139.689830
Link Square Shinjuku          94eb089d-e7f9-48bc-90e3-15f95e6bc0b8    35.686787      139.702870
Iceberg                       116e4926-5161-4af1-babe-04aede564197    35.666510      139.703960
Shibuya Scramble Square       4551855b-7eee-4fb4-8f43-5756c8dde881    35.658672      139.701980
the ARGYLE aoyama             bd5d75df-9e98-442c-ab92-a012351c58a4    35.669610      139.715790
Kojimachi                     5a4c59a8-2892-4deb-88a1-922bb1396e1f    35.685738      139.731840
```

## Booking a Date Range

Command:

```bash
wework book --city "Tokyo" --name "Shibuya Scramble Square" --date 2026-02-18~2026-02-20
```

## Upcoming Bookings

Command:

```bash
wework bookings
```

Output:

```text
✓ Fetched upcoming bookings
Date                Time                     Location                      Address                                 Credits Used
-------------------------------------------------------------------------------------------------------------------------------------------------
2026-02-19 Thu      18:00 ~ 05:00 (JST)      Shibuya Scramble Square       Shibuya Scramble Square 39F, 2-24-12 S  0
```
