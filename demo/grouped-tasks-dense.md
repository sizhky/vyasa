# Dense Grouped Tasks Demo
This page is a harsher routing fixture for checkout migration work: top programs, mid workstreams, leaf squads, cross-links, branchy DAGs.

```tasks
id: hybrid-task-dense
title: Checkout Migration Stress Test
groups:
  - { id: program, label: Checkout Program }
  - { id: platform, label: Platform Readiness, parent_group_id: program }
  - { id: data, label: Data Migration, parent_group_id: program }
  - { id: launch, label: Launch Ops, parent_group_id: program }
  - { id: api, label: API Contracts, parent_group_id: platform }
  - { id: frontend, label: Frontend Flow, parent_group_id: platform }
  - { id: backfill, label: Backfill Pipeline, parent_group_id: data }
  - { id: reconciliation, label: Reconciliation, parent_group_id: data }
  - { id: rollout, label: Rollout Control, parent_group_id: launch }
  - { id: support, label: Support Enablement, parent_group_id: launch }
  - { id: gateway, label: Gateway Schema, parent_group_id: api }
  - { id: risk, label: Risk Rules, parent_group_id: api }
  - { id: cart, label: Cart UI, parent_group_id: frontend }
  - { id: payment, label: Payment UI, parent_group_id: frontend }
  - { id: replay, label: Ledger Replay, parent_group_id: backfill }
  - { id: diff, label: Diff Checks, parent_group_id: reconciliation }
  - { id: canary, label: Canary Monitoring, parent_group_id: rollout }
  - { id: kill, label: Kill Switches, parent_group_id: rollout }
  - { id: docs, label: Help Center, parent_group_id: support }
  - { id: training, label: Support Training, parent_group_id: support }
tasks:
  - { id: t1, label: Freeze checkout schema, group_id: gateway }
  - { id: t2, label: Publish OpenAPI diff report, group_id: gateway, depends_on: [t1] }
  - { id: t3, label: Validate webhook signatures, group_id: gateway, depends_on: [t1] }
  - { id: t4, label: Update SDK samples, group_id: gateway, depends_on: [t2] }
  - { id: t5, label: Pass contract tests, group_id: gateway, depends_on: [t2, t3, t4] }
  - { id: t6, label: Add compatibility shim, group_id: risk, depends_on: [t1] }
  - { id: t7, label: Map legacy risk flags, group_id: risk, depends_on: [t6] }
  - { id: t8, label: Run regression suite, group_id: risk, depends_on: [t6] }
  - { id: t9, label: Review blocked cases, group_id: risk, depends_on: [t7, t8] }
  - { id: t10, label: Sign off risk policy, group_id: risk, depends_on: [t9] }
  - { id: t11, label: Patch cart state sync, group_id: cart, depends_on: [t1] }
  - { id: t12, label: Preserve coupons during swap, group_id: cart, depends_on: [t11] }
  - { id: t13, label: Refresh shipping estimate, group_id: cart, depends_on: [t11] }
  - { id: t14, label: Fix saved addresses, group_id: cart, depends_on: [t12, t13] }
  - { id: t15, label: Verify guest checkout, group_id: cart, depends_on: [t12, t14] }
  - { id: t16, label: Ship payment retry banner, group_id: payment, depends_on: [t10, t11] }
  - { id: t17, label: Add SCA fallback, group_id: payment, depends_on: [t16] }
  - { id: t18, label: Handle wallet decline copy, group_id: payment, depends_on: [t16] }
  - { id: t19, label: Verify saved card tokenization, group_id: payment, depends_on: [t17] }
  - { id: t20, label: Finalize payment QA, group_id: payment, depends_on: [t17, t18, t19] }
  - { id: t21, label: Run order backfill, group_id: replay, depends_on: [t1] }
  - { id: t22, label: Recompute failed captures, group_id: replay, depends_on: [t21] }
  - { id: t23, label: Snapshot checkpoint export, group_id: replay, depends_on: [t21] }
  - { id: t24, label: Audit sample orders, group_id: replay, depends_on: [t22, t23] }
  - { id: t25, label: Confirm replay parity, group_id: replay, depends_on: [t22, t24] }
  - { id: t26, label: Compare ledger deltas, group_id: diff, depends_on: [t22, t23] }
  - { id: t27, label: Investigate outliers, group_id: diff, depends_on: [t26] }
  - { id: t28, label: Approve discrepancy report, group_id: diff, depends_on: [t26, t27] }
  - { id: t29, label: Archive evidence bundle, group_id: diff, depends_on: [t28] }
  - { id: t30, label: Green-light finance signoff, group_id: diff, depends_on: [t28, t29] }
  - { id: t31, label: Wire canary dashboard, group_id: canary, depends_on: [t20, t25, t30] }
  - { id: t32, label: Add alert thresholds, group_id: canary, depends_on: [t31] }
  - { id: t33, label: Start 5 percent ramp, group_id: canary, depends_on: [t31, t32] }
  - { id: t34, label: Expand to 25 percent ramp, group_id: canary, depends_on: [t32] }
  - { id: t35, label: Confirm SLO checks, group_id: canary, depends_on: [t33, t34] }
  - { id: t36, label: Enable rollback switch, group_id: kill, depends_on: [t31] }
  - { id: t37, label: Test config propagation, group_id: kill, depends_on: [t36] }
  - { id: t38, label: Run rollback drill, group_id: kill, depends_on: [t36, t37] }
  - { id: t39, label: Approve change window, group_id: kill, depends_on: [t37, t38] }
  - { id: t40, label: Keep kill switch armed, group_id: kill, depends_on: [t39] }
  - { id: t41, label: Publish help center article, group_id: docs, depends_on: [t20, t28] }
  - { id: t42, label: Update merchant FAQ, group_id: docs, depends_on: [t41] }
  - { id: t43, label: Draft status page note, group_id: docs, depends_on: [t41] }
  - { id: t44, label: Prepare support macro, group_id: docs, depends_on: [t42, t43] }
  - { id: t45, label: Review legal copy, group_id: docs, depends_on: [t41, t44] }
  - { id: t46, label: Train support team, group_id: training, depends_on: [t41] }
  - { id: t47, label: Rehearse escalation tree, group_id: training, depends_on: [t46] }
  - { id: t48, label: Run mock customer calls, group_id: training, depends_on: [t46, t47] }
  - { id: t49, label: Confirm handoff roster, group_id: training, depends_on: [t47, t48] }
  - { id: t50, label: Sign support readiness, group_id: training, depends_on: [t49] }
  - { id: t51, label: Rehearse cutover, group_id: rollout, depends_on: [t31, t35, t45, t50] }
  - { id: t52, label: Sign release readiness, group_id: rollout, depends_on: [t51] }
  - { id: t53, label: Schedule final cutover window, group_id: rollout, depends_on: [t51, t52] }
  - { id: t54, label: Execute 10 percent ramp, group_id: rollout, depends_on: [t52, t53] }
  - { id: t55, label: Confirm 100 percent ramp, group_id: rollout, depends_on: [t54, t35] }
  - { id: t56, label: Go live, group_id: program, depends_on: [t55] }
  - { id: t57, label: Monitor auth failures, group_id: program, depends_on: [t56] }
  - { id: t58, label: Review merchant tickets, group_id: program, depends_on: [t56] }
  - { id: t59, label: Post-launch sweep, group_id: program, depends_on: [t57, t58, t25, t30] }
  - { id: t60, label: Exec readout, group_id: program, depends_on: [t59] }
```
