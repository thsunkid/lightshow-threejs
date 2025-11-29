/**
 * Workstream D: Mapping Engine & Integration
 *
 * This module is responsible for:
 * - Mapping audio features to lighting commands
 * - Applying style profiles
 * - Rule evaluation and action generation
 */

export { MappingEngine } from './MappingEngine';
export { RuleEvaluator } from './rules/RuleEvaluator';
export {
  getDefaultRules,
  getGenreRules,
  createCustomRule,
  validateRule,
  mergeRuleSets,
  DEFAULT_PALETTES
} from './rules/DefaultRules';
