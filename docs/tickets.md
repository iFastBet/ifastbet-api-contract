# Tickets — API contract 10.0.0

A receipt contains ordered bets for one game and one round. Keno accepts one
set of balls as one bet. The cashier enters the receipt total independently of
the selected outcomes; adding/removing outcomes keeps that total.

## Intake

`POST /api/tickets` accepts:

```json
{
  "round_ref": "<signed logical round reference>",
  "stage": 0,
  "stake": 1000,
  "bets": [
    {"outcome": "red", "ratio": 2},
    {"outcome": "black", "ratio": 2},
    {"outcome": "odd", "ratio": 2}
  ],
  "barcode": "<22 decimal digits>",
  "idempotency_key": "<stable operation key>"
}
```

`stake` is the receipt total. Backend allocates integer minor units using the
hall currency's `precision`. The first N−1 lines receive `floor(totalMinor / N)`;
the last receives `totalMinor − floor(totalMinor / N) × (N−1)`. At precision 2,
1000 becomes 333.33 / 333.33 / 333.34. Input order determines the remainder line.
Client-provided line stakes/payouts are never authoritative.

An empty list, repeated canonical outcomes or more than one Keno line is rejected.
Every line must meet the hall minimum, current controller quote and per-line
`max_win`. Error messages identify a zero-based `bets[index]`. One invalid line,
insufficient balance or a closed betting stage rejects the entire receipt.
The write transaction rechecks all lines and mutable settings, stores one ticket,
adds each line to round exposure and books one debit for the total.

## Stored and returned receipt

`tickets.bets` is ordered JSON with `{stake, outcome, ratio, payout}`. Header
`stake`, `payout`, status, round/game, hall/cashier, timestamps, reference and
operation credentials retain their existing meaning. Scalar ticket `outcome`
and `ratio` fields are removed. Public TypeScript types are `TicketIntake`,
`TicketBet`, `Ticket` and `TicketIntakeResponse`.

Settlement applies the existing controller and currency rounding to each line,
then sums its payouts in minor units. Receipt payout can exceed `max_win` when
each winning line remains within the immutable per-line snapshot. Any line
exceeding that snapshot makes the entire receipt `void`. Core/Control/Worker
aggregate formats are unchanged.

Summed receipt payouts use the exact minor-unit numeric ceiling instead of the
normal 10¹² amount limit of intake/emission/transfers. Those operation limits
remain in force; this permits a valid multi-line payout to exceed a single-line
`max_win` even at the upper supported betting amounts.

There is one barcode and one payout operation for the receipt, with the existing
expiry and hall restriction. Safe history/lookup responses expose only the
public `reference_code`; barcode hashes and operation keys remain hidden.
Reports continue summing header amounts and counting receipts.

## Migration and recovery

PocketBase migration `1791288000_multi_bet_tickets` converts every historical
single bet into a one-element list, retaining its stake, outcome, ratio and
payout. Receipt metadata, statuses, references, hashes, operation keys, balances,
transactions, RTP and round exposures are preserved. Rollback refuses to discard
multi-line receipts.

Backend still accepts the legacy single-bet intake payload and normalizes it to
one line. An existing operation is replayed with its original key and barcode,
even after betting closes. `sessionStorage` retains the complete original
payload, barcode and key until acceptance and printing are confirmed. New
operations store the ordered `bets` payload. Original/repeated printing uses
server-accepted lines, one total and the same barcode; informational copies
contain all lines and no payout credential.

Version 10 is a breaking response/schema change and requires coordinated
backend/frontend rollout. The current workspace uses local `file:` dependencies;
publishing the immutable tag and deploying are separate release work.
