# Phase 2 Implementation Task Graph

```tasks
group G0 "Foundation"
  collapsed: 0
  task P2-002 "Extend posts schema and build required indexes including pgvector HNSW"
    depends_on: [P2-001D]
    graph_x: 344
    graph_y: 88
  task P2-003 "Configure Redis keyspace, TTLs, cache primitives, seen-posts, session and nudge state"
    graph_x: -64
    graph_y: 184
  task P2-004 "Deploy core background jobs: trending, connection activity, credibility, embeddings, feed cache, cleanup"
    depends_on: [P2-001D, P2-002, P2-003]
    graph_x: 704
    graph_y: 40
  task P2-005 "Backfill and enrich top 5,000 posts for ranking-quality inputs"
    depends_on: [P2-002]
    graph_x: 680
    graph_y: 184
  group P2-001 "Create database schema"
    graph_x: -80
    graph_y: 16
    pill_x: -32
    pill_y: -80
    collapsed: 0
    task P2-001A "Create user_signal_profiles table"
    task P2-001B "Create user_follows and engagement_events tables"
      depends_on: [P2-001A]
    task P2-001C "Create feed_impressions and user_interest_embeddings tables"
      depends_on: [P2-001B]
      graph_x: 856
      graph_y: 208
    task P2-001D "Create author_credibility, genny_nudge_state, and sponsored_content tables"
      depends_on: [P2-001C]
  end
end

group G1 "Workflow 1 - Cold Start"
  collapsed: 0
  graph_x: 408
  graph_y: 144
  task P2-006 "Implement 3-phase cold start model with session-based transitions"
    depends_on: [P2-001D, P2-003]
  task P2-007 "Track session engagement and phase progression rules"
    depends_on: [P2-006]
  task P2-008 "Implement graceful degradation hierarchy and 70/20/10 diversity behavior across phases"
    depends_on: [P2-006, P2-007]
  task P2-009 "Handle narrow-specialization fallback and returning-member reactivation path"
    depends_on: [P2-008]
    graph_x: 1264
    graph_y: 264
end

group G2 "Workflow 2 - Signal Collection"
  collapsed: 0
  graph_x: 816
  graph_y: 0
  task P2-010 "Implement high-confidence engagement ingestion for like, comment, share, save"
    depends_on: [P2-001D]
    graph_x: 352
    graph_y: 40
  task P2-011 "Update topic affinity, seed or behavioral embeddings, and connection activity signals"
    depends_on: [P2-003, P2-004, P2-010]
    graph_x: 752
    graph_y: 160
  task P2-012 "Process member-created content as interest signal and add ingestion retry or dead-letter handling"
    depends_on: [P2-010, P2-011]
    graph_x: 1136
    graph_y: -8
end

group G3 "Workflow 3 - Negative Signals"
  graph_x: 1344
  graph_y: 120
  task P2-013 "Implement hide, not-interested, and report flows with immediate feed effects where required"
    depends_on: [P2-010]
  task P2-014 "Apply topic suppression, creator soft-block thresholds, and preference reversal settings"
    depends_on: [P2-013]
end

group G4 "Workflow 4 - Core Ranking"
  graph_x: 1800
  graph_y: -24
  task P2-015 "Implement five-factor scoring: affinity x credibility x recency x quality x connection boost"
    depends_on: [P2-005, P2-009, P2-011, P2-014]
  task P2-016 "Build multi-channel candidate generation: ANN, topic-match, trending, serendipity"
    depends_on: [P2-004, P2-005, P2-011]
  task P2-017 "Add reranking: 70/20/10 structure, MMR diversity, author cap, transparency labels, persona or content-type weighting"
    depends_on: [P2-015, P2-016]
  task P2-018 "Add ranked-feed cache and chronological fallback paths with no empty-state guarantee"
    depends_on: [P2-017]
end

group G5 "Workflow 5 - Sponsored Content"
  graph_x: 2232
  graph_y: 120
  task P2-019 "Implement sponsored relevance gating, 1:10 insertion cap, adjacency guard, and organic-fill fallback"
    depends_on: [P2-018]
  task P2-020 "Log provider impressions and degrade to full-organic feed on sponsored-service failure"
    depends_on: [P2-019]
end

group G6 "Workflow 6 - Genny Nudges"
  graph_x: 2688
  graph_y: 0
  task P2-021 "Implement per-topic nudge eligibility, inactivity detection, cooldown pause, and state initialization"
    depends_on: [P2-001D, P2-004, P2-011]
  task P2-022 "Implement nudge explore or dismiss actions and inline feed-card attachment with fail-open behavior"
    depends_on: [P2-020, P2-021]
end

group G7 "API Surface"
  graph_x: 3120
  graph_y: 120
  task P2-023 "Ship GET /api/v1/feed with pagination, metadata, labels, sponsored markers, and optional nudge payload"
    depends_on: [P2-018, P2-022]
  task P2-024 "Ship action endpoints: engage, hide, not-interested, report, preferences, nudge explore, nudge dismiss"
    depends_on: [P2-012, P2-014, P2-022]
end

group G8 "Readiness"
  graph_x: 3480
  graph_y: 0
  task P2-025 "Add observability, latency dashboards, alerts, and availability or cache-hit monitoring"
    depends_on: [P2-023, P2-024]
  task P2-026 "Validate security, privacy, deletion, accessibility, and no-empty-feed compliance"
    depends_on: [P2-023, P2-024]
  task P2-027 "Run end-to-end, load, fallback, and production-readiness validation across all workflows"
    depends_on: [P2-025, P2-026]
end
```
