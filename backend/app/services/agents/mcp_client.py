"""Boundary for Graph8 MCP tool calls used by the Ask Revenue Learning agent.

NOT exercised against a real Graph8 MCP server in this build -- there is no live
Graph8 MCP connection available in this environment/session. This class defines
the shape the agent expects (`call_tool`) so wiring in a real MCP client later
(e.g. via an MCP Python SDK client session against Graph8's MCP endpoint) only
touches this file, not `revenue_learning_agent.py`.

Per docs/ARCHITECTURE.md §18/§41: MCP is for live, agentic Graph8 context/actions
(e.g. "what does this contact's activity look like right now") -- it must never
replace the deterministic webhook -> investigation -> pattern pipeline, which
remains the source of truth this agent reads from first.
"""

from __future__ import annotations


class Graph8MCPClient:
    available = False

    def call_tool(self, tool_name: str, arguments: dict) -> dict:
        raise NotImplementedError(
            "No live Graph8 MCP connection configured in this environment. "
            "The agent falls back to the structured Revenue Learning database."
        )
