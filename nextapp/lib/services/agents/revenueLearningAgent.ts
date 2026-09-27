/** Ask Revenue Learning: reads the structured DB first, optionally asks the
 * LLM to phrase a grounded answer over that context. Ported from
 * backend/app/services/agents/revenue_learning_agent.py. */
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../../db";
import { settings } from "../../config";
import { buildOverview } from "../overview";
import type { Pattern, Recommendation } from "@prisma/client";

const QUALIFYING = ["emerging_pattern", "recurring_pattern", "strong_pattern"];

interface Ctx {
  overview: Awaited<ReturnType<typeof buildOverview>>;
  patterns: Pattern[];
  recommendations: Recommendation[];
  activeDealCount: number;
}

async function gatherContext(organizationId: string): Promise<Ctx> {
  const overview = await buildOverview({ organizationId });
  const patterns = await prisma.pattern.findMany({
    where: { organizationId, patternStrength: { in: QUALIFYING as any } },
    orderBy: { lostCount: "desc" },
  });
  const recommendations = await prisma.recommendation.findMany({
    where: { organizationId, status: { not: "dismissed" } },
  });
  const activeDealCount = await prisma.deal.count({ where: { organizationId, outcome: "open" } });

  return { overview, patterns, recommendations, activeDealCount };
}

function ruleBasedAnswer(question: string, ctx: Ctx): [string, string[], string[]] {
  const q = question.toLowerCase();
  const patterns = ctx.patterns;
  const sources = patterns.slice(0, 5).map((p) => p.name);

  if (q.includes("why") && (q.includes("losing") || q.includes("lost"))) {
    if (patterns.length === 0) {
      return ["We don't have enough analyzed lost deals yet to identify a recurring reason.", [], []];
    }
    const lines = patterns.slice(0, 3).map((p) => `- ${p.narrative}`);
    return ["Here's what's showing up repeatedly in lost deals:\n" + lines.join("\n"), sources, []];
  }

  if (q.includes("won") || q.includes("successful") || q.includes("differently")) {
    return [
      "Across won deals, the clearest recurring pattern is that economic/technical decision " +
        "makers get engaged early -- often before the Proposal stage -- rather than being looped " +
        "in late. Deals with strong champions who ran a structured evaluation also close faster.",
      sources,
      [],
    ];
  }

  if (q.includes("product") && q.includes("focus")) {
    const productRecs = ctx.recommendations.filter((r) => r.department === "product");
    if (productRecs.length === 0) return ["No recurring product-side gaps have reached pattern strength yet.", [], []];
    const lines = productRecs.slice(0, 3).map((r) => `- ${r.title}: ${r.explanation}`);
    return ["Product-side recurring findings:\n" + lines.join("\n"), [], []];
  }

  if (q.includes("active") || q.includes("watch")) {
    return [
      `There are ${ctx.activeDealCount} active deals being monitored for resemblance to past patterns. ` +
        "Check the Deal Detail page for each one's 'Past Deal Learning' section for specifics.",
      [],
      [],
    ];
  }

  if (q.includes("changed") && q.includes("quarter")) {
    return [
      `So far this period: ${ctx.overview.won_count} won, ${ctx.overview.lost_count} lost, ` +
        `${ctx.overview.awaiting_clarification} awaiting rep clarification.`,
      [],
      [],
    ];
  }

  if (q.includes("create") && q.includes("task")) {
    const top = patterns.slice(0, 2);
    if (top.length === 0) return ["No qualifying recurring patterns to act on yet.", [], []];
    const suggested = top.map((p) => `Propose a Graph8 task for: ${p.name}`);
    const lines = top.map((p) => `- ${p.name} (${p.lostCount} lost / ${p.wonCount} won)`);
    return [
      "I can propose Graph8 tasks for the top recurring issues below -- each still needs your " +
        "approval on the Recommendations page before anything is written to Graph8:\n" +
        lines.join("\n"),
      top.map((p) => p.name),
      suggested,
    ];
  }

  if (patterns.length > 0) {
    const lines = patterns.slice(0, 3).map((p) => `- ${p.narrative}`);
    return ["Here's what the data currently shows:\n" + lines.join("\n"), sources, []];
  }
  return ["I don't have enough analyzed closed deals yet to answer that with confidence.", [], []];
}

export async function ask(args: {
  organizationId: string;
  question: string;
}): Promise<[string, string[], string[]]> {
  const ctx = await gatherContext(args.organizationId);

  if (settings.anthropicApiKey) {
    const client = new Anthropic({ apiKey: settings.anthropicApiKey });
    const structuredContext = {
      won_count: ctx.overview.won_count,
      lost_count: ctx.overview.lost_count,
      awaiting_clarification: ctx.overview.awaiting_clarification,
      patterns: ctx.patterns.map((p) => ({
        name: p.name,
        narrative: p.narrative,
        lost_count: p.lostCount,
        won_count: p.wonCount,
        strength: p.patternStrength,
        confidence: p.confidence,
      })),
      recommendations: ctx.recommendations.map((r) => ({
        department: r.department,
        title: r.title,
        explanation: r.explanation,
      })),
      active_deal_count: ctx.activeDealCount,
    };

    const response = await client.messages.create({
      model: settings.llmModel,
      max_tokens: 600,
      system:
        "You are the Ask Revenue Learning assistant. Answer ONLY using the structured JSON " +
        "context provided -- never invent numbers or patterns not present in it. Use hedged, " +
        "evidence-based language, never claim certainty beyond what the data shows. If the " +
        "context doesn't support an answer, say so plainly.",
      messages: [
        { role: "user", content: `Context (JSON):\n${JSON.stringify(structuredContext)}\n\nQuestion: ${args.question}` },
      ],
    });
    const answer = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const sources = structuredContext.patterns.slice(0, 5).map((p) => p.name);
    return [answer, sources, []];
  }

  return ruleBasedAnswer(args.question, ctx);
}
