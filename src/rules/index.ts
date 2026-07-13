import type { Rule } from "../types.js";
import { DescriptionsMissing } from "./descriptions-missing.js";
import { DescriptionsTooShort } from "./descriptions-too-short.js";
import { DescriptionsTooLong } from "./descriptions-too-long.js";
import { SchemasParamDescMissing } from "./schemas-param-desc-missing.js";
import { SurfaceToolBudget } from "./surface-tool-budget.js";
import { SurfaceTokenBudget } from "./surface-token-budget.js";
import { NamingConvention } from "./naming-convention.js";
import { AnnotationsMissingHints } from "./annotations-missing-hints.js";
import { SchemasLoose } from "./schemas-loose.js";
import { SchemasComplexityBudget } from "./schemas-complexity-budget.js";
import { DesignOverlapCluster } from "./design-overlap-cluster.js";
import { DesignCrudMirror } from "./design-crud-mirror.js";
import { DesignConfusableParams } from "./design-confusable-params.js";
import { DesignEnumInProse } from "./design-enum-in-prose.js";
import { DesignDuplicateLeadingWords } from "./design-duplicate-leading-words.js";
import { DesignClientDirectives } from "./design-client-directives.js";
import { DesignNegativeGuidancePresent } from "./design-negative-guidance-present.js";
import { DesignListNoLimit } from "./design-list-no-limit.js";
import { DesignEnumCombinationUnencoded } from "./design-enum-combination-unencoded.js";

export class RuleRegistry {
  static all(): Rule[] {
    return [
      new DescriptionsMissing(),
      new DescriptionsTooShort(),
      new DescriptionsTooLong(),
      new SchemasParamDescMissing(),
      new SurfaceToolBudget(),
      new SurfaceTokenBudget(),
      new NamingConvention(),
      new AnnotationsMissingHints(),
      new SchemasLoose(),
      new SchemasComplexityBudget(),
      new DesignOverlapCluster(),
      new DesignCrudMirror(),
      new DesignConfusableParams(),
      new DesignEnumInProse(),
      new DesignDuplicateLeadingWords(),
      new DesignClientDirectives(),
      new DesignNegativeGuidancePresent(),
      new DesignListNoLimit(),
      new DesignEnumCombinationUnencoded()
    ];
  }

  static byId(id: string): Rule | undefined {
    return this.all().find((rule) => rule.id === id);
  }
}
