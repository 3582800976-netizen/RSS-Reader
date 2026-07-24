type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = "确认",
  cancelText = "取消",
  onConfirm,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal modal--confirm"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
        </div>
        <p className="modal-hint">{message}</p>
        <div className="confirm-actions">
          <button type="button" className="ghost" onClick={onClose}>
            {cancelText}
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
