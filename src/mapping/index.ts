// Public API of the mapping module. Other modules import only from here.

export { mapAnswers, toPromptedAnswers } from './map-answers';
export { normaliseLabel } from './normalise-label';
export type { LabelEntry, Segment, SegmentResult } from './segment';
export { buildLabelIndex, segment } from './segment';
