/** Feedback purpose controls lifecycle and available interactions, not severity. */
export type FeedbackKind = 'status' | 'hint' | 'action';
export type FeedbackSeverity = 'error' | 'warning' | 'info' | 'success';
export type ActionFeedbackOwner = 'model-validation' | 'removal-review';
export type BlockingActionOwner = Exclude<ActionFeedbackOwner, 'model-validation'>;
