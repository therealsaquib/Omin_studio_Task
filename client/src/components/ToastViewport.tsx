import { useEffect, useState } from "react";
import { CircleCheck, CircleX, X } from "lucide-react";

interface ToastMessage {
  id: number;
  message: string;
  tone: "success" | "error";
}

export function notifyToast(message: string, tone: ToastMessage["tone"] = "error") {
  window.dispatchEvent(new CustomEvent("omni:toast", { detail: { message, tone } }));
}

export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<Omit<ToastMessage, "id">>).detail;
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { ...detail, id }]);
      window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 5000);
    };
    window.addEventListener("omni:toast", onToast);
    return () => window.removeEventListener("omni:toast", onToast);
  }, []);

  return (
    <div className="toast-viewport" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"} key={toast.id}>
          {toast.tone === "success" ? <CircleCheck size={17} /> : <CircleX size={17} />}
          <span>{toast.message}</span>
          <button aria-label="Dismiss notification" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}><X size={15} /></button>
        </div>
      ))}
    </div>
  );
}
