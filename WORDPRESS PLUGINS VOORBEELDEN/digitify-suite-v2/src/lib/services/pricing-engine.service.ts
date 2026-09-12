// ============================================================================
// Pricing Engine Service
//
// Evaluates pricing rules against user selections to produce a real-time
// price breakdown. Stateless — can run server-side or client-side.
//
// Rule types:
//   FIXED       — Add a flat amount (optionally conditional)
//   PER_UNIT    — amount × value of a field
//   MULTIPLIER  — Multiply running subtotal by a factor
//   TIERED      — Lookup price per unit from tier brackets
//   CONDITIONAL — Add amount when a JSON-logic condition matches
//   PERCENTAGE  — Percentage of subtotal (e.g. tax)
//   DISCOUNT    — Subtract flat amount or percentage
// ============================================================================

export interface PricingRuleConfig {
  key: string;
  label: string;
  ruleType:
    | "FIXED"
    | "PER_UNIT"
    | "MULTIPLIER"
    | "TIERED"
    | "CONDITIONAL"
    | "PERCENTAGE"
    | "DISCOUNT";
  config: Record<string, any>;
  isOptional: boolean;
  position: number;
}

export interface PricingLineItem {
  key: string;
  label: string;
  amount: number;
  type: "addition" | "multiplier" | "tax" | "discount";
  detail?: string; // "5 × €150", "21% van €1.250"
}

export interface PricingResult {
  lineItems: PricingLineItem[];
  subtotal: number;
  taxAmount: number;
  discount: number;
  total: number;
}

/**
 * Evaluate a simple JSON-logic-like condition against selections.
 * Supports: ==, !=, in, not_in, >, <, >=, <=, and, or
 * This is a minimal evaluator — not full json-logic.
 */
function evaluateCondition(
  condition: Record<string, any> | null | undefined,
  selections: Record<string, any>
): boolean {
  if (!condition || Object.keys(condition).length === 0) return true;

  const op = Object.keys(condition)[0];
  const args = condition[op];

  const resolveValue = (v: any): any => {
    if (v && typeof v === "object" && "var" in v) {
      return selections[v.var];
    }
    return v;
  };

  switch (op) {
    case "==":
      return resolveValue(args[0]) === resolveValue(args[1]);
    case "!=":
      return resolveValue(args[0]) !== resolveValue(args[1]);
    case ">":
      return Number(resolveValue(args[0])) > Number(resolveValue(args[1]));
    case ">=":
      return Number(resolveValue(args[0])) >= Number(resolveValue(args[1]));
    case "<":
      return Number(resolveValue(args[0])) < Number(resolveValue(args[1]));
    case "<=":
      return Number(resolveValue(args[0])) <= Number(resolveValue(args[1]));
    case "in": {
      const needle = resolveValue(args[0]);
      const haystack = resolveValue(args[1]);
      if (Array.isArray(haystack)) return haystack.includes(needle);
      if (typeof haystack === "string") return haystack.includes(needle);
      return false;
    }
    case "and":
      return (args as any[]).every((a) => evaluateCondition(a, selections));
    case "or":
      return (args as any[]).some((a) => evaluateCondition(a, selections));
    default:
      return true;
  }
}

/**
 * Calculate the total price based on pricing rules and user selections.
 *
 * @param rules - Ordered array of pricing rules from the configurator version
 * @param selections - Key-value map of user selections
 * @returns Full pricing breakdown with line items
 */
export function calculatePrice(
  rules: PricingRuleConfig[],
  selections: Record<string, any>
): PricingResult {
  const lineItems: PricingLineItem[] = [];
  let runningSubtotal = 0;
  let taxAmount = 0;
  let discountAmount = 0;

  // Sort by position
  const sorted = [...rules].sort((a, b) => a.position - b.position);

  for (const rule of sorted) {
    const { config } = rule;

    // Check condition if present
    if (config.condition && !evaluateCondition(config.condition, selections)) {
      continue;
    }

    switch (rule.ruleType) {
      case "FIXED": {
        const amount = Number(config.amount ?? 0);
        if (amount > 0) {
          runningSubtotal += amount;
          lineItems.push({
            key: rule.key,
            label: rule.label,
            amount,
            type: "addition",
          });
        }
        break;
      }

      case "PER_UNIT": {
        const quantity = Number(selections[config.fieldKey] ?? 0);
        const unitPrice = Number(config.amountPerUnit ?? 0);
        const amount = quantity * unitPrice;
        if (amount > 0) {
          runningSubtotal += amount;
          lineItems.push({
            key: rule.key,
            label: rule.label,
            amount,
            type: "addition",
            detail: `${quantity} × €${unitPrice.toFixed(2)}`,
          });
        }
        break;
      }

      case "TIERED": {
        const quantity = Number(selections[config.fieldKey] ?? 0);
        const tiers = (config.tiers ?? []) as Array<{
          min: number;
          max: number;
          price: number;
        }>;
        // Find matching tier
        const tier = tiers.find(
          (t) => quantity >= t.min && quantity <= t.max
        );
        if (tier) {
          const amount = quantity * tier.price;
          runningSubtotal += amount;
          lineItems.push({
            key: rule.key,
            label: rule.label,
            amount,
            type: "addition",
            detail: `${quantity} × €${tier.price.toFixed(2)} (staffel)`,
          });
        }
        break;
      }

      case "CONDITIONAL": {
        // Condition already checked above
        const amount = Number(config.amount ?? 0);
        if (amount > 0) {
          runningSubtotal += amount;
          lineItems.push({
            key: rule.key,
            label: rule.label,
            amount,
            type: "addition",
          });
        }
        break;
      }

      case "MULTIPLIER": {
        const factor = Number(config.factor ?? 1);
        if (factor !== 1) {
          const extraAmount = runningSubtotal * (factor - 1);
          runningSubtotal *= factor;
          lineItems.push({
            key: rule.key,
            label: rule.label,
            amount: extraAmount,
            type: "multiplier",
            detail: `×${factor}`,
          });
        }
        break;
      }

      case "DISCOUNT": {
        let amount = 0;
        if (config.percentage) {
          amount = runningSubtotal * (Number(config.percentage) / 100);
        } else {
          amount = Number(config.amount ?? 0);
        }
        if (amount > 0) {
          discountAmount += amount;
          runningSubtotal -= amount;
          lineItems.push({
            key: rule.key,
            label: rule.label,
            amount: -amount,
            type: "discount",
            detail: config.percentage
              ? `${config.percentage}% korting`
              : undefined,
          });
        }
        break;
      }

      case "PERCENTAGE": {
        const pct = Number(config.percentage ?? 0);
        const base =
          config.of === "subtotal" ? runningSubtotal : runningSubtotal;
        const amount = base * (pct / 100);
        taxAmount += amount;
        lineItems.push({
          key: rule.key,
          label: rule.label,
          amount,
          type: "tax",
          detail: `${pct}% van €${base.toFixed(2)}`,
        });
        break;
      }
    }
  }

  return {
    lineItems,
    subtotal: runningSubtotal,
    taxAmount,
    discount: discountAmount,
    total: runningSubtotal + taxAmount,
  };
}
