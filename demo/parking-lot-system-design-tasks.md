# Parking Lot System Design Demo
This page is a dense system-design fixture for a parking lot product.
It stresses grouped tasks, fan-out, joins, and end-to-end operational flow.

```tasks
id: parking-lot-design
title: Parking Lot System Design
groups:
  - { id: ingest, label: Event Ingestion }
  - { id: identity, label: Vehicle Identity }
  - { id: session, label: Parking Sessions }
  - { id: realtime, label: Real-Time Status }
  - { id: billing, label: Billing and Enforcement }
  - { id: analytics, label: Reporting and Search }
  - { id: ops, label: Ops and Reliability }
  - { id: api, label: Public APIs }
  - { id: edge, label: Gate Edge Devices }
  - { id: stream, label: Event Stream }
  - { id: plates, label: Plate Normalization }
  - { id: permits, label: Permit Matching }
  - { id: rules, label: Tariff Rules }
  - { id: payments, label: Payment Capture }
  - { id: alerts, label: Alerts and Escalations }
  - { id: storage, label: Persistent Store }
  - { id: audit, label: Audit Trail }
  - { id: search, label: Search and Filters }
  - { id: export, label: Exports and Integrations }
tasks:
  - { id: t1, label: Define parking lot record schema, group_id: storage }
  - { id: t2, label: Define event envelope for entry and exit, group_id: api, depends_on: [t1] }
  - { id: t3, label: Add idempotency key strategy, group_id: api, depends_on: [t2] }
  - { id: t4, label: Accept gate webhook payloads, group_id: edge, depends_on: [t2] }
  - { id: t5, label: Validate device signatures, group_id: edge, depends_on: [t4] }
  - { id: t6, label: Buffer offline gate events, group_id: edge, depends_on: [t4] }
  - { id: t7, label: Publish canonical events to stream, group_id: stream, depends_on: [t3, t5, t6] }
  - { id: t8, label: Deduplicate repeated scans, group_id: stream, depends_on: [t7] }
  - { id: t9, label: Sequence events by site and lane, group_id: stream, depends_on: [t7] }
  - { id: t10, label: Persist raw event ledger, group_id: storage, depends_on: [t8, t9] }
  - { id: t11, label: Create vehicle identity resolver, group_id: plates, depends_on: [t1] }
  - { id: t12, label: Normalize plate formats by region, group_id: plates, depends_on: [t11] }
  - { id: t13, label: Attach confidence score to OCR reads, group_id: plates, depends_on: [t11] }
  - { id: t14, label: Resolve repeated plates to one vehicle profile, group_id: plates, depends_on: [t12, t13] }
  - { id: t15, label: Match permit holders to plate profiles, group_id: permits, depends_on: [t14] }
  - { id: t16, label: Load time-bound permit rules, group_id: permits, depends_on: [t15] }
  - { id: t17, label: Decide paid vs permit vs guest flow, group_id: session, depends_on: [t10, t16] }
  - { id: t18, label: Open parking session on entry, group_id: session, depends_on: [t17] }
  - { id: t19, label: Close parking session on exit, group_id: session, depends_on: [t18] }
  - { id: t20, label: Handle missing exit with timeout close, group_id: session, depends_on: [t18] }
  - { id: t21, label: Reconcile duplicate open sessions, group_id: session, depends_on: [t18, t20] }
  - { id: t22, label: Maintain live occupancy counter, group_id: realtime, depends_on: [t18, t19, t21] }
  - { id: t23, label: Expose site availability snapshot, group_id: realtime, depends_on: [t22] }
  - { id: t24, label: Push occupancy changes to dashboard, group_id: realtime, depends_on: [t22, t23] }
  - { id: t25, label: Compute base tariff rules, group_id: rules, depends_on: [t1] }
  - { id: t26, label: Add grace period and rounding rules, group_id: rules, depends_on: [t25] }
  - { id: t27, label: Add lost-ticket and overstays policy, group_id: rules, depends_on: [t25] }
  - { id: t28, label: Calculate session fee on close, group_id: billing, depends_on: [t19, t26, t27] }
  - { id: t29, label: Authorize card on file, group_id: payments, depends_on: [t28] }
  - { id: t30, label: Capture payment after exit, group_id: payments, depends_on: [t29] }
  - { id: t31, label: Retry failed capture with backoff, group_id: payments, depends_on: [t29, t30] }
  - { id: t32, label: Issue receipt and settlement record, group_id: payments, depends_on: [t30, t31] }
  - { id: t33, label: Flag enforcement candidate for unpaid exit, group_id: billing, depends_on: [t28, t30] }
  - { id: t34, label: Create citation workflow stub, group_id: billing, depends_on: [t33] }
  - { id: t35, label: Track manual cashier adjustments, group_id: billing, depends_on: [t28, t32] }
  - { id: t36, label: Write immutable audit entry per state change, group_id: audit, depends_on: [t10, t18, t19, t30, t35] }
  - { id: t37, label: Correlate audit entries by session id, group_id: audit, depends_on: [t36] }
  - { id: t38, label: Build timeline view for investigators, group_id: search, depends_on: [t37] }
  - { id: t39, label: Filter sessions by plate, site, date, group_id: search, depends_on: [t38] }
  - { id: t40, label: Search unpaid exits and cash gaps, group_id: search, depends_on: [t33, t35, t39] }
  - { id: t41, label: Generate daily revenue summary, group_id: analytics, depends_on: [t32, t35] }
  - { id: t42, label: Generate occupancy heatmap, group_id: analytics, depends_on: [t22, t24] }
  - { id: t43, label: Generate enforcement exception report, group_id: analytics, depends_on: [t33, t34, t40] }
  - { id: t44, label: Export CSV for finance, group_id: export, depends_on: [t41, t43] }
  - { id: t45, label: Export webhook feed for city partner, group_id: export, depends_on: [t36, t41] }
  - { id: t46, label: Configure SLA alerts for stream lag, group_id: alerts, depends_on: [t7, t10] }
  - { id: t47, label: Alert on gate device offline, group_id: alerts, depends_on: [t4, t6] }
  - { id: t48, label: Alert on payment failure spike, group_id: alerts, depends_on: [t31] }
  - { id: t49, label: Alert on occupancy mismatch, group_id: alerts, depends_on: [t22, t23, t24] }
  - { id: t50, label: Add replay tool for missed events, group_id: ops, depends_on: [t7, t10, t36] }
  - { id: t51, label: Add dead-letter queue for bad payloads, group_id: ops, depends_on: [t5, t7] }
  - { id: t52, label: Add retention policy for raw logs, group_id: ops, depends_on: [t10, t36] }
  - { id: t53, label: Add backfill job for offline gates, group_id: ops, depends_on: [t6, t50] }
  - { id: t54, label: Add role-based access for enforcement staff, group_id: ops, depends_on: [t38, t40] }
  - { id: t55, label: Add PII redaction for exports, group_id: ops, depends_on: [t44, t45, t54] }
  - { id: t56, label: Define deploy rollback checklist, group_id: ops, depends_on: [t46, t47, t48, t49] }
  - { id: t57, label: Load test peak arrival burst, group_id: ops, depends_on: [t22, t28, t41, t46] }
  - { id: t58, label: Run end-to-end reconciliation drill, group_id: ops, depends_on: [t19, t30, t36, t40, t43] }
  - { id: t59, label: Verify multi-site failover behavior, group_id: ops, depends_on: [t50, t51, t53, t56] }
  - { id: t60, label: Go live parking lot platform, group_id: ops, depends_on: [t57, t58, t59, t55] }
```
