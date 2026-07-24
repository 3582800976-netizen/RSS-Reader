import { useEffect, useRef, useState } from "react";

type Props = {
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
};

export default function Resizer({ onResize, onResizeEnd }: Props) {
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const onResizeRef = useRef(onResize);
  const onResizeEndRef = useRef(onResizeEnd);
  onResizeRef.current = onResize;
  onResizeEndRef.current = onResizeEnd;

  useEffect(() => {
    if (!dragging) return;

    let raf = 0;
    let pending = 0;

    function flush() {
      raf = 0;
      if (pending === 0) return;
      const delta = pending;
      pending = 0;
      onResizeRef.current(delta);
    }

    function onMove(e: MouseEvent) {
      const delta = e.clientX - startXRef.current;
      if (delta === 0) return;
      startXRef.current = e.clientX;
      pending += delta;
      if (!raf) raf = requestAnimationFrame(flush);
    }

    function onUp() {
      if (raf) {
        cancelAnimationFrame(raf);
        flush();
      }
      setDragging(false);
      onResizeEndRef.current?.();
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.body.classList.add("is-col-resizing");

    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.body.classList.remove("is-col-resizing");
    };
  }, [dragging]);

  return (
    <div
      className={`resizer ${dragging ? "dragging" : ""}`}
      onMouseDown={(e) => {
        e.preventDefault();
        startXRef.current = e.clientX;
        setDragging(true);
      }}
      role="separator"
      aria-orientation="vertical"
    />
  );
}
