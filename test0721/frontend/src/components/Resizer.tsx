import { useEffect, useRef, useState } from "react";

type Props = {
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
};

export default function Resizer({ onResize, onResizeEnd }: Props) {
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);

  useEffect(() => {
    if (!dragging) return;

    function onMove(e: MouseEvent) {
      const delta = e.clientX - startXRef.current;
      if (delta !== 0) {
        onResize(delta);
        startXRef.current = e.clientX;
      }
    }

    function onUp() {
      setDragging(false);
      onResizeEnd?.();
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragging, onResize, onResizeEnd]);

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
