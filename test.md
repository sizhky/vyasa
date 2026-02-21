---
title: Reveal Diagram Repro
slides: true
reveal:
  transition: slide
  slideNumber: true
  theme: white
  fontSize: 18px
---

## Control Slide
No diagram here. Use this to verify baseline Reveal layout and scaling.

---

## Mermaid Repro
- point 1
- point 2
- point 3
```mermaid
flowchart LR
  A[Start] --> B{Deterministic?}
  B -->|Yes| C[Keep]
  B -->|No| D[Measure]
  D --> E[Patch]
  E --> B
```

--

```mermaid
flowchart LR
  A[Start] --> B{Deterministic?}
  B -->|Yes| C[Keep]
  B -->|No| D[Measure]
  D --> E[Patch]
  E --> B
  E --> F
  F --> G
  G --> H
  H --> I
  I --> J
```

---

```mermaid
flowchart TD
  A[Start] --> B{Deterministic?}
  B -->|Yes| C[Keep]
  B -->|No| D[Measure]
  D --> E[Patch]
  E --> B
  E --> F
  F --> G
  G --> H
  H --> I
  I --> J
```


--

```mermaid
flowchart TD
    subgraph clients["Client Channels"]
        web["Web Experience"]
        chat["Collaboration Channels"]
        api_clients["Enterprise Integrations"]
    end

    subgraph access["Access and Protection"]
        edge["Global Edge + Threat Protection"]
        gateway["API Gateway + Identity Controls"]
    end

    subgraph platform["Application and Intelligence Platform"]
        services["Core Business Services"]
        orchestration["AI Orchestration Services"]
        subgraph elastic["Elastic Processing Capacity"]
            workers["Parallel Worker Pool"]
            scaling["Dynamic Scaling Controls"]
        end
    end

    subgraph connectors["Data Connectors"]
        gchat["Google Chat"]
        gdocs["Google Docs"]
        gdrive["Google Drive"]
        gmail["Gmail"]
        enterprise_apis["Enterprise APIs"]
        enterprise["Enterprise Connectors"]
    end

    subgraph data["Data and Knowledge Foundation"]
        operational["Operational Data Services"]
        knowledge["Knowledge and Retrieval Services"]
        archive["Secure Storage and Backup"]
    end

    subgraph trainer["Trainer and Behavior Governance"]
        persona["Trainer Persona Workspace"]
        policy_updates["Prompt/Policy Update Controls"]
        evaluation["Evaluation and Approval Gate"]
    end

    subgraph llm_ops["LLM Ops and Cost Governance"]
        token_metering["Token Usage Metering"]
        budgets["Per-User and Tenant Budgets"]
        caps["Quotas, Rate Limits, and Hard Caps"]
        subgraph quality["LLM Quality Monitoring"]
            accuracy["Accuracy and Response Quality"]
            drift["Drift and Regression Detection"]
        end
    end

    subgraph llm_gateway["LLM Gateway"]
        hub["Unified LLM Access Hub"]
        openai["OpenAI"]
        anthropic["Anthropic"]
        gemini["Google Gemini"]
        other_llms["Other Enterprise LLMs"]
    end

    subgraph trust["Security, Governance, and Reliability"]
        security["Encryption, Secrets, and Role Controls"]
        governance["Auditability and Policy Enforcement"]
        reliability["Autoscaling, Replication, and Monitoring"]
    end

    clients --> access --> platform --> connectors --> data
    platform --> hub
    trainer --> platform
    llm_ops --> platform
    quality --> platform
    quality --> hub
    hub --> llm_ops
    hub --> openai
    hub --> anthropic
    hub --> gemini
    hub --> other_llms
    trust --> access
    trust --> platform
    trust --> connectors
    trust --> data
    trust --> trainer
    trust --> llm_ops
    trust --> hub
```

---

## D2 Repro
- point 1
- point 2
- point 3

```d2
direction: right

A: Start -> B: Deterministic?
B -> C: Keep
B -> D: Measure
D -> E: Patch
E -> B
```

--

```d2
direction: right

A: Start -> B: Deterministic?
B -> C: Keep
B -> D: Measure
D -> E: Patch
E -> B
```

