import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";

const SUGGESTED_QUESTIONS = [
  "Why are we losing enterprise deals?",
  "What are successful deals doing differently?",
  "What should Product focus on?",
  "Which active deals should we watch?",
  "What changed this quarter?",
];

interface Message {
  role: "user" | "assistant";
  text: string;
  sources?: string[];
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-3 shadow-sm sm:max-w-lg">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-white">{text}</p>
      </div>
    </div>
  );
}

function AssistantBubble({ text, sources }: { text: string; sources?: string[] }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:max-w-lg">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-100">{text}</p>
        {sources && sources.length > 0 && (
          <div className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-400 dark:border-slate-800">
            Based on: {sources.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.2s] dark:bg-slate-600" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.1s] dark:bg-slate-600" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 dark:bg-slate-600" />
      </div>
    </div>
  );
}

export function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function ask(q: string) {
    if (!q.trim() || loading) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", text: q }]);
    setQuestion("");
    setLoading(true);
    try {
      const res = await api.post<{ answer: string; sources: string[] }>("/api/agent/ask", { question: q });
      setMessages((m) => [...m, { role: "assistant", text: res.answer, sources: res.sources }]);
    } catch {
      setError("Something went wrong answering that. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-3xl flex-col md:h-[calc(100vh-8rem)]">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink dark:text-slate-100 sm:text-2xl">Ask Revenue Learning</h1>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="text-sm font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            New chat
          </button>
        )}
      </div>
      <p className="mb-6 text-slate-500 dark:text-slate-400">
        Combines the structured Revenue Learning database with Graph8 context to answer questions in plain
        language.
      </p>

      {messages.length === 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => ask(q)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:border-indigo-200 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-800 dark:hover:text-indigo-300"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.map((m, i) =>
          m.role === "user" ? (
            <UserBubble key={i} text={m.text} />
          ) : (
            <AssistantBubble key={i} text={m.text} sources={m.sources} />
          )
        )}
        {loading && <TypingBubble />}
        <div ref={scrollRef} />
      </div>

      {error && <div className="mb-2 text-sm text-rose-600 dark:text-rose-400">{error}</div>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about wins, losses, or patterns..."
          autoFocus
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
