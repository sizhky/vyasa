# D2 Test

This page validates D2 rendering.

```d2
---
width: 85vw
layout: elk
theme_id: 3
sketch: true
---
direction: right

"Entry Points": {
  "UI": {
    icon: "https://api.iconify.design/mdi:monitor.svg"
  }
  "Run Agent": {
    icon: "https://api.iconify.design/mdi:console.svg"
  }
}

"ChatSCM2 Agent Core": {
  "Agent Orchestrator": {
    icon: "https://api.iconify.design/mdi:brain.svg"
  }
  "Tool Planner": {
    icon: "https://api.iconify.design/mdi:graph-outline.svg"
  }
  "Config Models": {
    icon: "https://api.iconify.design/mdi:file-cog.svg"
  }
}

"Knowledge Assets": {
  "Runbooks": {
    icon: "https://api.iconify.design/mdi:book-open-page-variant.svg"
  }
  "Day 0 KB": {
    icon: "https://api.iconify.design/mdi:database.svg"
  }
  "Results": {
    icon: "https://api.iconify.design/mdi:file-chart.svg"
  }
}

"Tooling": {
  "File Search Tools": {
    icon: "https://api.iconify.design/mdi:magnify.svg"
  }
  "Runbook Tools": {
    icon: "https://api.iconify.design/mdi:clipboard-check-outline.svg"
  }
  "Oracle Tools": {
    icon: "https://api.iconify.design/mdi:wrench.svg"
  }
}

"Connectors": {
  "File Search Manager": {
    icon: "https://api.iconify.design/mdi:filter-variant.svg"
  }
  "Oracle Client": {
    icon: "https://api.iconify.design/mdi:link-variant.svg"
  }
}

"External Systems": {
  "LLM API": {
    icon: "https://api.iconify.design/mdi:cloud-cog.svg"
  }
  "File Search Index": {
    icon: "https://api.iconify.design/mdi:database-search.svg"
  }
  "Oracle DB": {
    icon: "https://api.iconify.design/mdi:database.svg"
  }
}

"Entry Points"."UI" -> "ChatSCM2 Agent Core"."Agent Orchestrator": "invokes"
"Entry Points"."Run Agent" -> "ChatSCM2 Agent Core"."Agent Orchestrator": "invokes"

"ChatSCM2 Agent Core"."Agent Orchestrator" -> "ChatSCM2 Agent Core"."Tool Planner": "plans"
"ChatSCM2 Agent Core"."Agent Orchestrator" -> "External Systems"."LLM API": "calls"
"ChatSCM2 Agent Core"."Agent Orchestrator" -> "Knowledge Assets"."Runbooks": "reads"
"ChatSCM2 Agent Core"."Agent Orchestrator" -> "Knowledge Assets"."Day 0 KB": "reads"
"ChatSCM2 Agent Core"."Agent Orchestrator" -> "Knowledge Assets"."Results": "writes"

"ChatSCM2 Agent Core"."Tool Planner" -> "Tooling"."File Search Tools": "executes"
"ChatSCM2 Agent Core"."Tool Planner" -> "Tooling"."Runbook Tools": "executes"
"ChatSCM2 Agent Core"."Tool Planner" -> "Tooling"."Oracle Tools": "executes"

"Tooling"."File Search Tools" -> "Connectors"."File Search Manager": "uses"
"Connectors"."File Search Manager" -> "External Systems"."File Search Index": "queries"

"Tooling"."Oracle Tools" -> "Connectors"."Oracle Client": "uses"
"Connectors"."Oracle Client" -> "External Systems"."Oracle DB": "queries"
```
