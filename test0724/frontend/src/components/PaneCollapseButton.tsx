type Props = {
  collapsed: boolean;
  collapseLabel: string;
  expandLabel: string;
  onClick?: () => void;
};

/** 展开态：左箭头（点击后向左收起） */
function LeftArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path
        d="M10 3.5 5.5 8 10 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 收起态：右箭头（点击后向右展开） */
function RightArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path
        d="M6 3.5 10.5 8 6 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PaneCollapseButton({
  collapsed,
  collapseLabel,
  expandLabel,
  onClick,
}: Props) {
  const label = collapsed ? expandLabel : collapseLabel;

  return (
    <button
      type="button"
      className="pane-collapse-btn"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {collapsed ? <RightArrowIcon /> : <LeftArrowIcon />}
    </button>
  );
}
