import { useState } from "react";
import {
  cancelPluginRequest,
  respondToSecretRequest,
  secretValueError,
  type PluginRequest,
  type SecretRequest,
} from "./plugin-requests";

/**
 * The widget's copy of bb's secret form. Values stay in this component's
 * state until bb's server takes them; nothing logs or stores them.
 */
export function SecretForm({
  request,
  secret,
  onDone,
}: {
  request: PluginRequest;
  secret: SecretRequest;
  onDone: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<"submit" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    for (const field of secret.fields) {
      const problem = secretValueError(values[field.name] ?? "");
      if (problem !== null) {
        setError(`${field.name}: ${problem}`);
        return;
      }
    }
    setError(null);
    setBusy("submit");
    try {
      const answer: Record<string, string> = {};
      for (const field of secret.fields) answer[field.name] = values[field.name] ?? "";
      await respondToSecretRequest(request, answer);
      setValues({});
      onDone();
    } catch (cause) {
      setBusy(null);
      setError(cause instanceof Error ? cause.message : "bb did not accept the secrets.");
    }
  };

  const cancel = async () => {
    setBusy("cancel");
    try {
      await cancelPluginRequest(request);
      setValues({});
      onDone();
    } catch (cause) {
      setBusy(null);
      setError(cause instanceof Error ? cause.message : "bb did not cancel the request.");
    }
  };

  return (
    <form
      className="thread-widget-secret"
      autoComplete="off"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void submit();
      }}
    >
      <strong>{request.title ?? "Add secrets"}</strong>
      {secret.purpose ? <p>{secret.purpose}</p> : null}
      <p className="thread-widget-secret-path">
        Secrets will be written directly to <code>{secret.path}</code>
      </p>
      {secret.fields.map((field) => {
        const id = `thread-widget-secret-${request.id}-${field.name}`;
        const shown = revealed[field.name] === true;
        return (
          <div key={field.name} className="thread-widget-secret-field">
            <label htmlFor={id} translate="no">
              {field.name}
            </label>
            {field.description ? <span>{field.description}</span> : null}
            <div className="thread-widget-secret-input">
              <input
                id={id}
                type={shown ? "text" : "password"}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={busy !== null}
                value={values[field.name] ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setValues((current) => ({ ...current, [field.name]: value }));
                }}
              />
              <button
                type="button"
                aria-label={shown ? `Hide ${field.name}` : `Show ${field.name}`}
                onClick={() => setRevealed((current) => ({ ...current, [field.name]: !shown }))}
              >
                {shown ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        );
      })}
      {error ? (
        <p className="thread-widget-secret-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="thread-widget-secret-actions">
        <button type="button" onClick={() => void cancel()} disabled={busy !== null}>
          {busy === "cancel" ? "Cancelling…" : "Cancel"}
        </button>
        <button type="submit" className="is-primary" disabled={busy !== null}>
          {busy === "submit" ? "Adding…" : "Add secrets"}
        </button>
      </div>
    </form>
  );
}
