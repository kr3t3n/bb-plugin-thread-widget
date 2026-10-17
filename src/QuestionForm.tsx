import { useState } from "react";
import {
  cancelPluginRequest,
  respondToQuestionRequest,
  unansweredQuestion,
  type PluginRequest,
  type QuestionAnswer,
  type WidgetQuestion,
} from "./plugin-requests";

/** The widget's copy of bb's question form, for agent questions. */
export function QuestionForm({
  request,
  questions,
  onDone,
}: {
  request: PluginRequest;
  questions: WidgetQuestion[];
  onDone: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({});
  const [busy, setBusy] = useState<"submit" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const answerOf = (id: string): QuestionAnswer => answers[id] ?? { selected: [] };
  const update = (id: string, patch: Partial<QuestionAnswer>) =>
    setAnswers((current) => ({ ...current, [id]: { ...(current[id] ?? { selected: [] }), ...patch } }));

  const toggle = (question: WidgetQuestion, value: string) => {
    const selected = answerOf(question.id).selected;
    if (question.multiSelect) {
      update(question.id, {
        selected: selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value],
      });
    } else {
      update(question.id, { selected: selected.includes(value) ? [] : [value] });
    }
  };

  const submit = async () => {
    const missing = unansweredQuestion(questions, answers);
    if (missing !== null) {
      setError(`Answer this question: ${missing.prompt}`);
      return;
    }
    setError(null);
    setBusy("submit");
    try {
      const payload: Record<string, QuestionAnswer> = {};
      for (const question of questions) {
        const answer = answerOf(question.id);
        const freeText = answer.freeText?.trim();
        payload[question.id] = freeText ? { selected: answer.selected, freeText } : { selected: answer.selected };
      }
      await respondToQuestionRequest(request, payload);
      onDone();
    } catch (cause) {
      setBusy(null);
      setError(cause instanceof Error ? cause.message : "bb did not accept the answers.");
    }
  };

  const dismiss = async () => {
    setBusy("cancel");
    try {
      await cancelPluginRequest(request);
      onDone();
    } catch (cause) {
      setBusy(null);
      setError(cause instanceof Error ? cause.message : "bb did not dismiss the question.");
    }
  };

  return (
    <form
      className="thread-widget-question"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void submit();
      }}
    >
      <strong>{request.title ?? (questions.length === 1 ? "Question" : `${questions.length} questions`)}</strong>
      {questions.map((question) => {
        const answer = answerOf(question.id);
        return (
          <fieldset key={question.id} disabled={busy !== null}>
            <legend>{question.prompt}</legend>
            {question.options.map((option) => (
              <label key={option.value} className="thread-widget-question-option">
                <input
                  type={question.multiSelect ? "checkbox" : "radio"}
                  name={`${request.id}-${question.id}`}
                  checked={answer.selected.includes(option.value)}
                  onChange={() => toggle(question, option.value)}
                  onClick={(event) => {
                    // A second click clears a single-choice answer, so free text can stand alone.
                    if (!question.multiSelect && answer.selected.includes(option.value)) {
                      event.preventDefault();
                      toggle(question, option.value);
                    }
                  }}
                />
                <span>
                  {option.label}
                  {option.description ? <small>{option.description}</small> : null}
                </span>
              </label>
            ))}
            {question.allowFreeText ? (
              <textarea
                rows={question.options.length > 0 ? 1 : 3}
                placeholder={question.options.length > 0 ? "Or write your own answer" : "Your answer"}
                value={answer.freeText ?? ""}
                onChange={(event) => update(question.id, { freeText: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    void submit();
                  }
                }}
              />
            ) : null}
          </fieldset>
        );
      })}
      {error ? (
        <p className="thread-widget-secret-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="thread-widget-secret-actions">
        <button type="button" onClick={() => void dismiss()} disabled={busy !== null}>
          {busy === "cancel" ? "Dismissing…" : "Dismiss"}
        </button>
        <button type="submit" className="is-primary" disabled={busy !== null}>
          {busy === "submit" ? "Sending…" : "Send answers"}
        </button>
      </div>
    </form>
  );
}
