import { useEffect } from "react";

const LOCK_COUNT_KEY = "umbraScrollLockCount";
const BODY_OVERFLOW_KEY = "umbraBodyOverflow";
const HTML_OVERFLOW_KEY = "umbraHtmlOverflow";

export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked || typeof document === "undefined") {
      return;
    }

    const { body, documentElement } = document;
    const currentCount = Number(body.dataset[LOCK_COUNT_KEY] ?? "0");

    if (currentCount === 0) {
      body.dataset[BODY_OVERFLOW_KEY] = body.style.overflow;
      documentElement.dataset[HTML_OVERFLOW_KEY] = documentElement.style.overflow;
      body.style.overflow = "hidden";
      documentElement.style.overflow = "hidden";
    }

    body.dataset[LOCK_COUNT_KEY] = String(currentCount + 1);

    return () => {
      const nextCount = Math.max(0, Number(body.dataset[LOCK_COUNT_KEY] ?? "1") - 1);

      if (nextCount === 0) {
        body.style.overflow = body.dataset[BODY_OVERFLOW_KEY] ?? "";
        documentElement.style.overflow = documentElement.dataset[HTML_OVERFLOW_KEY] ?? "";
        delete body.dataset[LOCK_COUNT_KEY];
        delete body.dataset[BODY_OVERFLOW_KEY];
        delete documentElement.dataset[HTML_OVERFLOW_KEY];
        return;
      }

      body.dataset[LOCK_COUNT_KEY] = String(nextCount);
    };
  }, [locked]);
}
