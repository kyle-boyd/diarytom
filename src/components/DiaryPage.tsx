"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Message = { role: "user" | "assistant"; content: string };

const GHOST_PHRASES = ["type...", "talk to me."];
const FLASH_DURATION = 280;
const SCROLL_FLASH_THROTTLE_MS = 450;
const CLICK_PROMPT_DURATION = 280;
const LETTER_DELAY_MS = 25;
const USER_MESSAGE_FADE_DELAY_SEC = 1;

/** ~200 wpm → reading time in seconds */
function getReadingTimeSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return words / (200 / 60);
}

/** Delay before AI message starts fading = base (4s) + reading time; clamp 5–15s */
function getAIMessageFadeDelayMs(text: string): number {
  const readingSec = getReadingTimeSeconds(text);
  const totalSec = 4 + readingSec;
  const clamped = Math.max(5, Math.min(15, totalSec));
  return clamped * 1000;
}

export default function DiaryPage() {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [scrollFlash, setScrollFlash] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const [clickPrompt, setClickPrompt] = useState<{ x: number; y: number } | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [inputRevealed, setInputRevealed] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentResponse, setCurrentResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fadingUserText, setFadingUserText] = useState<string | null>(null);
  const [fadingAssistantIndices, setFadingAssistantIndices] = useState<Set<number>>(new Set());
  const scheduledFadeRef = useRef<Set<number>>(new Set());
  const assistantFadeTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const scrollFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollFlashTimeRef = useRef<number>(0);
  const clickPromptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showScrollFlash = useCallback(() => {
    if (scrollFlashTimeoutRef.current) clearTimeout(scrollFlashTimeoutRef.current);
    const text = GHOST_PHRASES[Math.floor(Math.random() * GHOST_PHRASES.length)];
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = rect.left + Math.random() * (rect.width - 120) + 60;
    const y = rect.top + Math.random() * (rect.height - 80) + 40;
    setScrollFlash({ text, x, y });
    scrollFlashTimeoutRef.current = setTimeout(() => {
      setScrollFlash(null);
      scrollFlashTimeoutRef.current = null;
    }, FLASH_DURATION);
  }, []);

  const handleScroll = useCallback(() => {
    const now = Date.now();
    if (now - lastScrollFlashTimeRef.current < SCROLL_FLASH_THROTTLE_MS) return;
    lastScrollFlashTimeRef.current = now;
    showScrollFlash();
  }, [showScrollFlash]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (messages.length > 0 || inputValue) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-about]") || target.closest("footer a")) return;
      setInputRevealed(true);
      if (clickPromptTimeoutRef.current) clearTimeout(clickPromptTimeoutRef.current);
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setClickPrompt({ x, y });
      clickPromptTimeoutRef.current = setTimeout(() => {
        setClickPrompt(null);
        clickPromptTimeoutRef.current = null;
      }, CLICK_PROMPT_DURATION);
    },
    [messages.length, inputValue]
  );

  const sendMessage = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue("");
    setFadingUserText(text);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsLoading(true);
    setCurrentResponse("");

    try {
      const history = [...messages, { role: "user" as const, content: text }];
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      let data: { error?: string; content?: string } = {};
      try {
        data = await res.json();
      } catch {
        data = { error: res.ok ? "Invalid response." : "Request failed." };
      }
      if (!res.ok) throw new Error(data.error || "Request failed");
      const fullText = typeof data.content === "string" ? data.content.trim() : "";
      if (!fullText) throw new Error("The diary had nothing to say. Try rephrasing.");
      await new Promise((r) => setTimeout(r, 2000));
      for (let i = 0; i <= fullText.length; i++) {
        await new Promise((r) => setTimeout(r, LETTER_DELAY_MS));
        setCurrentResponse(fullText.slice(0, i));
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: fullText },
      ]);
      setCurrentResponse("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Perhaps the diary is reluctant to reply just now. Try again.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: message,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, messages]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  // Schedule AI message fade based on reading time when new assistant messages are added
  useEffect(() => {
    messages.forEach((msg, index) => {
      if (msg.role !== "assistant" || scheduledFadeRef.current.has(index)) return;
      scheduledFadeRef.current.add(index);
      const delayMs = getAIMessageFadeDelayMs(msg.content);
      const t = setTimeout(() => {
        setFadingAssistantIndices((prev) => new Set([...prev, index]));
        assistantFadeTimeoutsRef.current.delete(index);
      }, delayMs);
      assistantFadeTimeoutsRef.current.set(index, t);
    });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (scrollFlashTimeoutRef.current) clearTimeout(scrollFlashTimeoutRef.current);
      if (clickPromptTimeoutRef.current) clearTimeout(clickPromptTimeoutRef.current);
      assistantFadeTimeoutsRef.current.forEach((t) => clearTimeout(t));
      assistantFadeTimeoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (messages.length > 0 || isLoading) return;
      if (inputRef.current?.matches(":focus")) return;
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== "Enter") {
        e.preventDefault();
        setInputRevealed(true);
        setInputValue((v) => v + e.key);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [messages.length, isLoading]);

  const showInput = inputRevealed || inputValue.length > 0 || messages.length > 0;
  const showClickPrompt = clickPrompt && !inputValue && messages.length === 0;

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-full overflow-y-auto overflow-x-hidden bg-[#f5f0e6]"
      onScroll={handleScroll}
      onClick={handleClick}
    >
      {/* Ghost scroll flash: direct child of scroll container, viewport-fixed */}
      <AnimatePresence>
        {scrollFlash && (
          <motion.span
            key={`${scrollFlash.x}-${scrollFlash.y}-${scrollFlash.text}`}
            className="ghost-text pointer-events-none fixed z-20 font-serif text-[#1a1510]"
            style={{
              left: `${scrollFlash.x}px`,
              top: `${scrollFlash.y}px`,
              fontSize: "1rem",
              opacity: 0.2,
            }}
            initial={{ opacity: 0.2 }}
            animate={{ opacity: 0.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.06 }}
          >
            {scrollFlash.text}
          </motion.span>
        )}
      </AnimatePresence>

      <div
        ref={contentRef}
        className="relative min-h-[300dvh] px-6 pt-12 pb-24 md:px-12 md:pt-16"
      >
        {/* Click prompt: cursor + "type here" at bottom center */}
        <AnimatePresence>
          {showClickPrompt && (
            <motion.div
              className="ghost-text pointer-events-none fixed bottom-[4.5rem] left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 font-serif text-[#1a1510]"
              initial={{ opacity: 0.6 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <span className="inline-block h-4 w-px animate-pulse bg-[#1a1510]" />
              <span className="text-sm opacity-80">type here</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages: only assistant replies in the list; each fades after reading-time delay */}
        <div className="max-w-2xl">
          {messages.map(
            (msg, fullIndex) =>
              msg.role === "assistant" && (
                <div key={fullIndex} className="mb-6">
                  <motion.p
                    initial={{ opacity: 0.9 }}
                    animate={{
                      opacity: fadingAssistantIndices.has(fullIndex) ? 0 : 1,
                    }}
                    transition={{
                      duration: 0.35,
                      ease: "easeOut",
                    }}
                    className="font-serif text-[#1a1510] leading-relaxed"
                  >
                    {msg.content}
                  </motion.p>
                </div>
              )
          )}
          {currentResponse && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-serif text-[#1a1510] leading-relaxed"
            >
              {currentResponse}
            </motion.p>
          )}
        </div>

        {/* Fading user text: stays 1s after enter, then fades out */}
        <AnimatePresence>
          {fadingUserText && (
            <motion.div
              key="fading-user"
              className="fixed bottom-[4.5rem] left-1/2 z-10 -translate-x-1/2 font-serif text-[#1a1510]"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{
                delay: USER_MESSAGE_FADE_DELAY_SEC,
                duration: 0.35,
                ease: "easeOut",
              }}
              onAnimationComplete={() => setFadingUserText(null)}
            >
              {fadingUserText}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input at bottom center: hidden while fading or loading so screen stays blank until AI responds */}
        {showInput && !fadingUserText && !isLoading && (
          <div className="fixed bottom-[4.5rem] left-1/2 z-10 flex -translate-x-1/2 items-baseline justify-center font-serif text-[#1a1510]">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder=""
              className="min-w-[8ch] max-w-[min(80vw,24rem)] border-0 bg-transparent p-0 font-serif text-[#1a1510] outline-none placeholder:opacity-50"
              aria-label="Type your message"
            />
          </div>
        )}
      </div>

      {/* Footer: at bottom of page, scroll to reach */}
      <footer className="py-8 text-center">
        <button
          type="button"
          data-about
          onClick={() => setAboutOpen(true)}
          className="cursor-pointer text-sm text-[#1a1510]/40 transition hover:text-[#1a1510]/60"
        >
          About
        </button>
      </footer>

      {/* About overlay */}
      <AnimatePresence>
        {aboutOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6"
            onClick={() => setAboutOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }}
              className="max-w-md rounded-lg bg-[#f5f0e6] p-8 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="font-serif text-[#1a1510] leading-relaxed space-y-4">
                <p>
                  &quot;Never trust something that can think for itself if you
                  can&apos;t see where it keeps its brain.&quot;
                  <br />
                  <span className="text-[#1a1510]/80">—Arthur Weasley</span>
                </p>
                <p>
                  If you haven&apos;t guessed already, this is a digital version
                  of Tom Riddle&apos;s diary. I built this little page when
                  writing an{" "}
                  <a
                    href="https://www.linkedin.com/feed/update/urn:li:activity:7422696565443674112/?updateEntityUrn=urn%3Ali%3Afs_updateV2%3A%28urn%3Ali%3Aactivity%3A7422696565443674112%2CFEED_DETAIL%2CEMPTY%2CDEFAULT%2Cfalse%29"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-[#1a1510]/40 hover:decoration-[#1a1510] transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    article
                  </a>{" "}
                  about how our interaction with AI can shape us; treating an AI
                  tool too much like a human may be dangerous. Tom Riddle&apos;s
                  diary is a perfect analogy.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAboutOpen(false)}
                className="mt-6 w-full cursor-pointer rounded border border-[#1a1510]/20 bg-transparent py-2 font-serif text-sm text-[#1a1510] transition hover:bg-[#1a1510]/5"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
