import * as React from "react";

type JsonDataState<T> = {
  data: T[];
  error: string | null;
  loading: boolean;
};

export function useJsonData<T>(
  initialData: T[] | undefined,
  src: string | undefined,
): JsonDataState<T> {
  const hasInitialData = Boolean(initialData?.length);
  const [data, setData] = React.useState<T[]>(initialData ?? []);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(Boolean(src && !hasInitialData));

  React.useEffect(() => {
    if (!src || hasInitialData) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(src, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<T[]>;
      })
      .then(setData)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "The data could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [hasInitialData, src]);

  return { data, error, loading };
}
