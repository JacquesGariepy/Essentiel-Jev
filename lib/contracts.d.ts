/** Integration-facing declarations. Runtime validation lives in native JavaScript modules. */
export type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue };
export type Description = string | null | JSONValue[] | { [key: string]: JSONValue };
export type State = string | JSONValue[] | { [key: string]: JSONValue };
export interface ChoiceQuestion { type: 'choice'; instructions: Description; criteria: Record<string, Description>; }
export interface ScoreQuestion { type: 'score'; instructions: Description; criteria: Description[]; }
export interface NoulQuestion { type: 'noul'; instructions: Description; criteria?: { true?: Description; false?: Description }; }
export type Question = ChoiceQuestion | ScoreQuestion | NoulQuestion;
export interface ChoiceAnswer { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number>; }
export interface ScoreAnswer { type: 'score'; score: number; confidence: number; probabilities: Record<string, number>; legend: Record<string, Description>; }
/** Noul deliberately has no separate confidence field. */
export interface NoulAnswer { type: 'noul'; noul: number; }
export type Answer = ChoiceAnswer | ScoreAnswer | NoulAnswer;
export interface SystemOneRequest { model: string; state: State; questions: Record<string, Question>; }
export interface TokenUsage { input_tokens: number; output_tokens?: number; }
export interface SystemOneResponse { model: string; answers: Record<string, Answer>; usage: TokenUsage; }
export interface ReviewGates { confidence: number; noulLow: number; noulHigh: number; }
export interface ReviewResult { route: 'review' | 'inspect'; uncertain: string[]; externalActionAllowed: false; gates: ReviewGates; }
export interface EvaluationRun {
  id: string; mode: 'live' | 'fixture' | 'imported-unverified'; createdAt: string;
  title?: string; decisionId?: string; model: string; usage: TokenUsage;
  state: State; questions: Record<string, Question>; answers: Record<string, Answer>;
  review: ReviewResult; outcomes: Record<string, string | number | boolean>;
}
export type Bucket = 'act' | 'review' | 'read' | 'archived' | 'pending';
export type EvaluationMode = 'live' | 'demo' | 'pending' | 'error';
export type Action = 'NONE' | 'RESPOND' | 'CONFIRM' | 'PROVIDE' | 'ATTEND' | 'REVIEW' | 'UNKNOWN';
export interface SourceDocument { id?: string; title: string; source?: string; text: string; receivedAt?: string; synthetic?: boolean; }
export interface EvaluationRecord extends SourceDocument {
  id: string; bucket: Bucket; suggestedBucket?: Bucket; mode: EvaluationMode;
  action?: Action; reason?: string; flags?: string[]; evidence?: string; evidenceId?: string | null;
  suggestedDate?: string | null; confirmedDate?: string | null; evaluatedAt?: string;
  model?: string; ruleset?: string; goal?: string | null; usage?: TokenUsage;
  answers?: Record<string, ChoiceAnswer | NoulAnswer>;
  history: Array<{ at: string; actor: 'human' | 'system'; type: string; [key: string]: unknown }>;
}
export type Currency = 'CAD' | 'USD' | 'EUR' | 'GBP';
export interface Transaction { id: string; title: string; direction: 'income' | 'expense'; amountMinor: number; currency: Currency; date: string; category: string; }
