"""Graph8Provider: the single seam between our business logic and Graph8.

DemoGraph8Provider and LiveGraph8Provider are the only two implementations.
Nothing outside `services/graph8/` should know which one is active — the
factory in `factory.py` picks one based on whether the org has a live API key
configured, and everything else depends on this interface.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.services.graph8.schemas import G8Deal, G8DealBundle


class Graph8Provider(ABC):
    mode: str

    @abstractmethod
    def get_deal_bundle(self, graph8_deal_id: str) -> G8DealBundle:
        """Fetch a single deal plus its associated evidence sources."""

    @abstractmethod
    def list_closed_deals(self) -> list[G8Deal]:
        """List all closed (won/lost) deals — used for seeding/backfill."""

    @abstractmethod
    def list_active_deals(self) -> list[G8Deal]:
        """List open deals — used by the future-warning engine."""

    @abstractmethod
    def create_task(
        self,
        *,
        graph8_deal_id: str,
        title: str,
        description: str,
        assignee_hint: str | None = None,
    ) -> str:
        """Create a Graph8 task linked to a deal. Returns the Graph8 object id.

        CONFIRMED real endpoint family: /tasks (+ /tasks/{id}/subtasks, /replies,
        /resolve) exist in Graph8's OpenAPI spec. Exact create-task request shape
        for LiveGraph8Provider is UNCONFIRMED pending real API access — see
        docs/ARCHITECTURE.md §1.
        """

    @abstractmethod
    def create_note(self, *, graph8_deal_id: str, body: str) -> str | None:
        """Best-effort: attach a note summarizing an approved learning.

        Returns None if the provider has no note-creation capability rather than
        inventing one.
        """
