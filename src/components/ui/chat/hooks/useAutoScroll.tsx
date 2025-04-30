import { useCallback, useEffect, useRef, useState } from "react";

interface ScrollState {
  isAtBottom: boolean;
  autoScrollEnabled: boolean;
}

interface UseAutoScrollOptions {
  offset?: number;
  smooth?: boolean;
  content?: React.ReactNode;
}

export function useAutoScroll(options: UseAutoScrollOptions = {}) {
  const { offset = 20, smooth = false, content } = options;
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastContentHeight = useRef(0);

  const [scrollState, setScrollState] = useState<ScrollState>({
    isAtBottom: true,
    autoScrollEnabled: true,
  });

  const checkIsAtBottom = useCallback(
    (element: HTMLElement) => {
      const { scrollTop, scrollHeight, clientHeight } = element;
      const distanceToBottom = Math.abs(
        scrollHeight - scrollTop - clientHeight,
      );
      return distanceToBottom <= offset;
    },
    [offset],
  );

  const scrollToBottom = useCallback(
    (instant?: boolean) => {
      if (!scrollRef.current) return;

      const targetScrollTop =
        scrollRef.current.scrollHeight - scrollRef.current.clientHeight;

      if (instant) {
        scrollRef.current.scrollTop = targetScrollTop;
      } else {
        scrollRef.current.scrollTo({
          top: targetScrollTop,
          behavior: smooth ? "smooth" : "auto",
        });
      }

      // Only update isAtBottom state if scrolling occurred
      setScrollState((prev) => ({
        ...prev,
        isAtBottom: true,
      }));
    },
    [smooth],
  );

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;

    const element = scrollRef.current;
    const { scrollTop, scrollHeight, clientHeight } = element;
    const distanceToBottom = Math.abs(scrollHeight - scrollTop - clientHeight);
    const currentlyAtBottom = distanceToBottom <= offset;

    setScrollState((prevState) => {
      let newAutoScrollEnabled = prevState.autoScrollEnabled;

      // If user was at the bottom and scrolls up (is no longer at the bottom)
      if (prevState.isAtBottom && !currentlyAtBottom) {
        newAutoScrollEnabled = false; // Disable auto-scroll
      }
      // If user was NOT at the bottom and scrolls back down TO the bottom
      else if (!prevState.isAtBottom && currentlyAtBottom) {
        newAutoScrollEnabled = true; // Re-enable auto-scroll
      }

      // Return the new state
      return {
        isAtBottom: currentlyAtBottom,
        autoScrollEnabled: newAutoScrollEnabled,
      };
    });
  }, [checkIsAtBottom, offset]); // Include offset in dependencies

  // Add this function
  const scrollToBottomAndEnableAutoScroll = useCallback(() => {
    setScrollState((prev) => ({
      ...prev,
      autoScrollEnabled: true, // Explicitly enable auto-scroll
    }));
    scrollToBottom(false); // Scroll smoothly
  }, [scrollToBottom]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    element.addEventListener("scroll", handleScroll, { passive: true });
    return () => element.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const currentHeight = scrollElement.scrollHeight;
    const hasNewContent = currentHeight !== lastContentHeight.current;

    if (hasNewContent) {
      if (scrollState.autoScrollEnabled) {
        requestAnimationFrame(() => {
          scrollToBottom(lastContentHeight.current === 0);
        });
      }
      lastContentHeight.current = currentHeight;
    }
  }, [content, scrollState.autoScrollEnabled, scrollToBottom]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver(() => {
      if (scrollState.autoScrollEnabled) {
        scrollToBottom(true);
      }
    });

    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [scrollState.autoScrollEnabled, scrollToBottom]);

  return {
    scrollRef,
    isAtBottom: scrollState.isAtBottom,
    autoScrollEnabled: scrollState.autoScrollEnabled,
    scrollToBottom: () => scrollToBottom(false),
    scrollToBottomAndEnableAutoScroll, // Export the new function
  };
}