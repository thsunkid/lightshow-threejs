/**
 * Workstream D: Mapping Engine & Integration
 *
 * This module is responsible for:
 * - Mapping audio features to lighting commands
 * - Applying style profiles
 * - Rule evaluation and action generation
 * - Intelligent show planning
 * - Lighting variations and responses
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
export {
  ShowPlanner,
  type ShowPlan,
  type Scene,
  type LightingLook,
  type Transition,
  type LightingTheme,
} from './ShowPlanner';
export {
  VariationSelector,
  type LightingVariation,
  BEAT_VARIATIONS,
  ENERGY_VARIATIONS,
  SPECTRAL_VARIATIONS,
  SECTION_VARIATIONS,
} from './LightingVariations';
