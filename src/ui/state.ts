import type { Answer, FormModel, MappingResult } from "../form-model";
export type Step = "choose" | "check" | "answer" | "review" | "save";
export interface State {
  step: Step;
  lang: "en" | "hi";
  form?: FormModel;
  answers: Answer[];
  result?: MappingResult;
  current: number;
  saved: boolean;
  large: boolean;
}
export function initialState(): State {
  return {
    step: "choose",
    lang: "en",
    answers: [],
    current: 0,
    saved: true,
    large: false,
  };
}
export function navigate(state: State, step: Step): State {
  return { ...state, step };
}
export function nextField(
  form: FormModel,
  result: MappingResult,
  start = 0,
): number {
  return form.fields.findIndex(
    (f, i) => i >= start && result.fields[f.id]?.status !== "filled",
  );
}
