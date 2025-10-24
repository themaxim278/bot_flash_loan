import type { Opportunity } from '../discovery/types';
import type { EvaluationContext, EvaluatedOpportunity } from './types';
export declare function chooseNotionalUsd(opp: Opportunity, ctx: EvaluationContext): number;
export declare function evaluateOpportunity(opp: Opportunity, ctx: EvaluationContext): EvaluatedOpportunity;
