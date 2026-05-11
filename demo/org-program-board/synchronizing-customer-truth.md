---
title: ORG-11 Board
---

Now: blocked by fragmented systems across CRM, billing, product, and support.
Friction: every forecast, renewal, and board pack reconciles different numbers.
Board ask: fund one integration spine and force shared KPI definitions.

```items
---
title: ORG-11 Synchronizing Customer Truth
default_open_depth: 2
color_by: status
color_palette:
  On Track: "#86efac"
  At Risk: "#fcd34d"
  Blocked: "#fca5a5"
---
Critical Path:
  - DT-01 :: Unifying Customer Identity | owner: Asha | status: Blocked | outcome: one account and contact key across systems | metric: match rate | risk: duplicate records
  - DT-02 :: Standardizing KPI Definitions | owner: Leena | status: At Risk | outcome: one definition for pipeline, ARR, churn, and activation | metric: metric variance | risk: local spreadsheet logic
Data Sources:
  - DT-03 :: Connecting CRM and Billing | owner: Vikram | status: At Risk | outcome: bookings and invoices reconcile daily | metric: reconciliation lag | risk: brittle mappings
  - DT-04 :: Connecting Product and Support | owner: Neeraj | status: On Track | outcome: usage and service signals land in shared model | metric: data freshness | risk: event gaps
Consumption Layer:
  - DT-05 :: Publishing Executive Metrics | owner: Leena | status: On Track | outcome: board pack and forecast use one source | metric: board prep time | risk: shadow reporting
  - DT-06 :: Enforcing Operating Reviews | owner: Asha | status: At Risk | outcome: every function reviews the same numbers weekly | metric: KPI review compliance | risk: side-channel reporting

DT-01 ->|creates stable join keys for| DT-03, DT-04
DT-02 ->|defines what downstream reporting is allowed to mean for| DT-05, DT-06
DT-03, DT-04 ->|supply reconciled source data into| DT-05
DT-05 ->|feeds one board narrative into| DT-06
```
