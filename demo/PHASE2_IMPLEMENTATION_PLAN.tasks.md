---
title: Phase 2 AI Feed Implementation Tasks
---

```tasks
id: phase2-ai-feed
title: Phase 2 AI-FEED Build Graph
groups:
  - id: FND
    label: Foundation
  - id: WF1
    label: Workflow 1 Cold Start
  - id: WF2
    label: Workflow 2 Engagement Signals
  - id: WF3
    label: Workflow 3 Negative Signals
  - id: WF4
    label: Workflow 4 Ranking Engine
  - id: WF5
    label: Workflow 5 Sponsored Content
  - id: WF6
    label: Workflow 6 Genny Nudges
  - id: INT
    label: Integration + Release
  - id: FND-SCHEMA
    label: Database + Schema
    parent_group_id: FND
  - id: FND-JOBS
    label: Redis + Jobs
    parent_group_id: FND
  - id: WF1-DATA
    label: Signals + Phase Logic
    parent_group_id: WF1
  - id: WF1-API
    label: Feed bootstrap API
    parent_group_id: WF1
  - id: WF2-INGEST
    label: Event Capture
    parent_group_id: WF2
  - id: WF2-LEARN
    label: Affinity Updates
    parent_group_id: WF2
  - id: WF3-API
    label: User Controls
    parent_group_id: WF3
  - id: WF3-PROC
    label: Suppression Processing
    parent_group_id: WF3
  - id: WF4-CAND
    label: Candidate Generation
    parent_group_id: WF4
  - id: WF4-SCORE
    label: Scoring + Re-rank
    parent_group_id: WF4
  - id: WF5-GATE
    label: Eligibility Gate
    parent_group_id: WF5
  - id: WF5-UX
    label: Labeling + QA
    parent_group_id: WF5
  - id: WF6-RULES
    label: Nudge Eligibility
    parent_group_id: WF6
  - id: WF6-INLINE
    label: Feed Integration
    parent_group_id: WF6
  - id: INT-PERF
    label: Performance
    parent_group_id: INT
  - id: INT-RELEASE
    label: Production Readiness
    parent_group_id: INT
  - id: FND-SCHEMA-1
    label: Finalize user_signal_profiles schema
    parent_group_id: FND-SCHEMA
  - id: FND-SCHEMA-2
    label: Add ranking cache tables and indexes
    parent_group_id: FND-SCHEMA
    depends_on: [FND-SCHEMA-1]
  - id: FND-SCHEMA-3
    label: Add migrations for lookup paths
    parent_group_id: FND-SCHEMA
    depends_on: [FND-SCHEMA-2]
  - id: FND-JOBS-1
    label: Define job contracts for workers
    parent_group_id: FND-JOBS
    depends_on: [FND-SCHEMA-3]
  - id: FND-JOBS-2
    label: Wire Redis hot-path keys and TTL policy
    parent_group_id: FND-JOBS
    depends_on: [FND-JOBS-1]
  - id: FND-JOBS-3
    label: Add scheduling and retry policy
    parent_group_id: FND-JOBS
    depends_on: [FND-JOBS-2]
  - id: WF1-1
    label: Model onboarding signal inputs
    parent_group_id: WF1-DATA
    depends_on: [FND-SCHEMA-3]
  - id: WF1-2
    label: Implement cold start phase transitions
    parent_group_id: WF1-DATA
    depends_on: [WF1-1]
  - id: WF1-3
    label: Persist phase state in user profiles
    parent_group_id: WF1-DATA
    depends_on: [WF1-2]
  - id: WF1-4
    label: Load signal profile on request path
    parent_group_id: WF1-API
    depends_on: [WF1-3]
  - id: WF1-5
    label: Serve phase-aware starter feed
    parent_group_id: WF1-API
    depends_on: [WF1-4]
  - id: WF1-6
    label: Add cold start fallback behavior
    parent_group_id: WF1-API
    depends_on: [WF1-5]
  - id: WF2-1
    label: Capture feed impressions and engagements
    parent_group_id: WF2-INGEST
    depends_on: [FND-JOBS-3]
  - id: WF2-2
    label: Normalize like save comment share events
    parent_group_id: WF2-INGEST
    depends_on: [WF2-1]
  - id: WF2-3
    label: Add durable event logging
    parent_group_id: WF2-INGEST
    depends_on: [WF2-2]
  - id: WF2-4
    label: Compute topic affinity deltas
    parent_group_id: WF2-LEARN
    depends_on: [WF2-3]
  - id: WF2-5
    label: Update session engagement counters
    parent_group_id: WF2-LEARN
    depends_on: [WF2-4]
  - id: WF2-6
    label: Publish behavioral signal snapshots
    parent_group_id: WF2-LEARN
    depends_on: [WF2-5]
  - id: WF3-1
    label: Add not interested and hide endpoints
    parent_group_id: WF3-API
    depends_on: [WF2-3]
  - id: WF3-2
    label: Record creator and topic suppression state
    parent_group_id: WF3-API
    depends_on: [WF3-1]
  - id: WF3-3
    label: Enforce three-hide threshold
    parent_group_id: WF3-API
    depends_on: [WF3-2]
  - id: WF3-4
    label: Project negative signals into profile state
    parent_group_id: WF3-PROC
    depends_on: [WF3-3]
  - id: WF3-5
    label: Apply topic suppression and creator caps
    parent_group_id: WF3-PROC
    depends_on: [WF3-4]
  - id: WF3-6
    label: Add regression cases for suppression logic
    parent_group_id: WF3-PROC
    depends_on: [WF3-5]
  - id: WF4-1
    label: Build semantic ANN candidate channel
    parent_group_id: WF4-CAND
    depends_on: [WF1-4, WF2-6]
  - id: WF4-2
    label: Build topic match candidate channel
    parent_group_id: WF4-CAND
    depends_on: [WF4-1]
  - id: WF4-3
    label: Build trending and serendipity channels
    parent_group_id: WF4-CAND
    depends_on: [WF4-1, WF4-2]
  - id: WF4-4
    label: Implement multiplicative scoring formula
    parent_group_id: WF4-SCORE
    depends_on: [WF4-1, WF4-2, WF4-3]
  - id: WF4-5
    label: Add MMR diversity and author caps
    parent_group_id: WF4-SCORE
    depends_on: [WF4-4]
  - id: WF4-6
    label: Attach transparency labels
    parent_group_id: WF4-SCORE
    depends_on: [WF4-5]
  - id: WF5-1
    label: Define sponsored relevance threshold
    parent_group_id: WF5-GATE
    depends_on: [WF4-6]
  - id: WF5-2
    label: Filter sponsored pool against feed context
    parent_group_id: WF5-GATE
    depends_on: [WF5-1]
  - id: WF5-3
    label: Enforce one-in-ten insertion cap
    parent_group_id: WF5-GATE
    depends_on: [WF5-2]
  - id: WF5-4
    label: Render sponsored disclosure labels
    parent_group_id: WF5-UX
    depends_on: [WF5-3]
  - id: WF5-5
    label: Test sponsored ordering and fallback
    parent_group_id: WF5-UX
    depends_on: [WF5-4]
  - id: WF5-6
    label: Verify cache behavior with sponsored posts
    parent_group_id: WF5-UX
    depends_on: [WF5-5]
  - id: WF6-1
    label: Implement inactivity window rules
    parent_group_id: WF6-RULES
    depends_on: [WF4-6]
  - id: WF6-2
    label: Evaluate topic inactivity and cooldown
    parent_group_id: WF6-RULES
    depends_on: [WF6-1]
  - id: WF6-3
    label: Define inline nudge card payload
    parent_group_id: WF6-RULES
    depends_on: [WF6-2]
  - id: WF6-4
    label: Attach nudge cards to ranked feed
    parent_group_id: WF6-INLINE
    depends_on: [WF6-3]
  - id: WF6-5
    label: Style and place nudge cards
    parent_group_id: WF6-INLINE
    depends_on: [WF6-4]
  - id: WF6-6
    label: Validate nudge cooldown behavior
    parent_group_id: WF6-INLINE
    depends_on: [WF6-5]
  - id: INT-1
    label: Run feed latency benchmarks
    parent_group_id: INT-PERF
    depends_on: [WF5-6, WF6-6]
  - id: INT-2
    label: Tune cache hit rate and query budgets
    parent_group_id: INT-PERF
    depends_on: [INT-1]
  - id: INT-3
    label: Stress test 500 concurrent sessions
    parent_group_id: INT-PERF
    depends_on: [INT-2]
  - id: INT-4
    label: Complete end-to-end request flow checks
    parent_group_id: INT-RELEASE
    depends_on: [INT-3]
  - id: INT-5
    label: Finalize graceful degradation paths
    parent_group_id: INT-RELEASE
    depends_on: [INT-4]
  - id: INT-6
    label: Prepare launch checklist and signoff
    parent_group_id: INT-RELEASE
    depends_on: [INT-5]
tasks:
  - id: T-FND-1
    label: Finalize schema review notes
    group_id: FND-SCHEMA-1
  - id: T-FND-2
    label: Implement migration scripts
    group_id: FND-SCHEMA-2
    depends_on: [T-FND-1]
  - id: T-FND-3
    label: Add hot-path redis keys
    group_id: FND-JOBS-1
    depends_on: [T-FND-2]
  - id: T-WF1-1
    label: Add phase transition unit tests
    group_id: WF1-DATA
    depends_on: [T-FND-3]
  - id: T-WF1-2
    label: Wire profile loading into feed endpoint
    group_id: WF1-API
    depends_on: [T-WF1-1]
  - id: T-WF1-3
    label: Add cold-start fallback response
    group_id: WF1-API
    depends_on: [T-WF1-2]
  - id: T-WF2-1
    label: Emit impression and engagement events
    group_id: WF2-INGEST
    depends_on: [T-FND-3]
  - id: T-WF2-2
    label: Update affinity snapshots from events
    group_id: WF2-LEARN
    depends_on: [T-WF2-1]
  - id: T-WF3-1
    label: Persist hidden-topic state
    group_id: WF3-API
    depends_on: [T-WF2-2]
  - id: T-WF3-2
    label: Enforce creator suppression caps
    group_id: WF3-PROC
    depends_on: [T-WF3-1]
  - id: T-WF4-1
    label: Materialize semantic candidates
    group_id: WF4-CAND
    depends_on: [T-WF1-3, T-WF2-2]
  - id: T-WF4-2
    label: Compute ranking scores
    group_id: WF4-SCORE
    depends_on: [T-WF4-1]
  - id: T-WF4-3
    label: Enforce MMR and author caps
    group_id: WF4-SCORE
    depends_on: [T-WF4-2]
  - id: T-WF4-4
    label: Render transparency labels
    group_id: WF4-SCORE
    depends_on: [T-WF4-3]
  - id: T-WF5-1
    label: Filter sponsored inventory
    group_id: WF5-GATE
    depends_on: [T-WF4-4]
  - id: T-WF5-2
    label: Insert labeled sponsored cards
    group_id: WF5-UX
    depends_on: [T-WF5-1]
  - id: T-WF6-1
    label: Gate nudges by inactivity window
    group_id: WF6-RULES
    depends_on: [T-WF4-4]
  - id: T-WF6-2
    label: Attach nudge cards to feed
    group_id: WF6-INLINE
    depends_on: [T-WF6-1]
  - id: T-INT-1
    label: Benchmark feed latency
    group_id: INT-PERF
    depends_on: [T-WF5-2, T-WF6-2]
  - id: T-INT-2
    label: Finalize graceful degradation
    group_id: INT-RELEASE
    depends_on: [T-INT-1]
  - id: T-INT-3
    label: Prepare launch checklist
    group_id: INT-RELEASE
    depends_on: [T-INT-2]
```
