import * as React from "react";
import { Loader2, MessageSquareText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { trackAppHealth } from "@/lib/app-health";

const TURNSTILE_SITE_KEY = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? "0x4AAAAAAECKLi5Ke0ylWglf";

type Citation = {
  chunk_id: string;
  document_id?: string;
  filename?: string | null;
  excerpt?: string;
  score?: number;
};

type RagResult = {
  answer: string;
  citations: Citation[];
  trace_id?: string | null;
  route?: string | null;
  answer_mode?: string | null;
};

const API_BASE: string =
  (import.meta.env.PUBLIC_API_URL as string | undefined) ??
  (typeof window !== "undefined" && (window as any).__API_BASE__) ??
  "";

function ragEndpoint(): string {
  if (API_BASE) return `${API_BASE}/rag/query`;
  return "/api/rag/query";
}

export function RagAsk() {
  const [question, setQuestion] = React.useState(
    "What are the strongest recent signals in language model research?",
  );
  const [result, setResult] = React.useState<RagResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);
  const [turnstileResetSignal, setTurnstileResetSignal] = React.useState(0);

  async function ask(nextQuestion = question) {
    const q = nextQuestion.trim();
    if (q.length < 3 || !turnstileToken) return;
    trackAppHealth("cited_answer_requested");
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(ragEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, top_k: 8, turnstileToken }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || body.detail || `HTTP ${response.status}`);
      }
      setResult(await response.json());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The answer service is unavailable. Please try again.",
      );
    } finally {
      setLoading(false);
      setTurnstileToken(null);
      setTurnstileResetSignal((value) => value + 1);
    }
  }

  const examples = [
    "Which underrated accepted papers look like sleepers?",
    "What clusters are strongest around transformers and vision?",
    "Which topics have high OpenReview ratings?",
  ];

  return (
    <div className="space-y-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask();
        }}
        className="space-y-3"
      >
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={3}
          placeholder="Ask a cited research question..."
          className="w-full rounded-lg border bg-card px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/50"
        />
        <TurnstileWidget
          siteKey={TURNSTILE_SITE_KEY}
          action="turnstile-spin-v2"
          resetSignal={turnstileResetSignal}
          onTokenChange={setTurnstileToken}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={loading || question.trim().length < 3 || !turnstileToken}>
            {loading ? (
              <>
                <Loader2 className="animate-spin" /> Asking...
              </>
            ) : (
              <>
                <MessageSquareText /> Ask RAG
              </>
            )}
          </Button>
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setQuestion(example);
                void ask(example);
              }}
              disabled={loading || !turnstileToken}
              className="inline-flex min-h-11 items-center rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50 lg:min-h-0"
            >
              {example}
            </button>
          ))}
        </div>
      </form>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <p>No answer was generated. {error}</p>
          <p className="mt-2">
            Retry after verification, or{" "}
            <a className="underline" href="#search">
              search the paper index
            </a>
            .
          </p>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="rounded-lg border bg-background/50 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {result.route && <Badge variant="outline">{result.route}</Badge>}
              {result.answer_mode && <Badge variant="outline">{result.answer_mode}</Badge>}
              {result.trace_id && (
                <span className="font-mono text-xs text-muted-foreground">
                  trace {result.trace_id.slice(0, 10)}
                </span>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {result.answer}
            </p>
          </div>

          {result.citations?.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Citations
              </div>
              {result.citations.map((citation, index) => (
                <div
                  key={`${citation.chunk_id}-${index}`}
                  className="rounded-lg border bg-card p-3"
                >
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-mono text-foreground/80">
                      {citation.filename ?? citation.document_id ?? citation.chunk_id}
                    </span>
                    {typeof citation.score === "number" && (
                      <span className="font-mono text-muted-foreground">
                        {citation.score.toFixed(3)}
                      </span>
                    )}
                  </div>
                  {citation.excerpt && (
                    <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                      {citation.excerpt}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
