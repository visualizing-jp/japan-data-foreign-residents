import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { schedulePageView } from "../analytics.ts";

function write(key: string, value: string, fallback: string): void {
  const params = new URLSearchParams(window.location.search);
  if (value === fallback) params.delete(key);
  else params.set(key, value);
  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    query === "" ? window.location.pathname : `?${query}`,
  );
  schedulePageView();
}

export function useUrlState<T extends string>(
  key: string,
  fallback: T,
  isValid: (value: string) => boolean,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const raw = new URLSearchParams(window.location.search).get(key);
    return raw !== null && isValid(raw) ? (raw as T) : fallback;
  });

  useEffect(() => {
    write(key, value, fallback);
  }, [key, value, fallback]);

  return [value, setValue];
}
