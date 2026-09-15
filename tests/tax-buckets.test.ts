import { describe, expect, it } from "vitest";
import { validateScenario } from "../src/domain";
import { contributeToTaxBuckets, growTaxBuckets, totalTaxBucketBalance, withdrawFromTaxBuckets } from "../src/engine/tax-buckets";
import { makeScenario } from "./fixtures";

describe("tax-bucket accounting", () => {
  it("applies the same portfolio growth and explicit contribution allocation", () => {
    const grown = growTaxBuckets({ taxable: 30, taxDeferred: 60, roth: 10 }, 1.1);
    expect(grown).toEqual({ taxable: 33, taxDeferred: 66, roth: 11 });
    const contributed = contributeToTaxBuckets(grown, 100, { taxable: 0.2, taxDeferred: 0.5, roth: 0.3 });
    expect(contributed).toEqual({ taxable: 53, taxDeferred: 116, roth: 41 });
    expect(totalTaxBucketBalance(contributed)).toBe(210);
  });

  it("grosses withdrawals up only for the taxable portion of each bucket", () => {
    const result = withdrawFromTaxBuckets(
      { taxable: 100, taxDeferred: 100, roth: 100 },
      150,
      0.2,
      { withdrawalOrder: "taxable-first", taxableGainShare: 0.5 }
    );
    expect(result.balances.taxable).toBe(0);
    expect(result.balances.taxDeferred).toBeCloseTo(25, 12);
    expect(result.balances.roth).toBe(100);
    expect(result.grossWithdrawal).toBeCloseTo(175, 12);
    expect(result.estimatedTax).toBeCloseTo(25, 12);
    expect(result.netFunded).toBeCloseTo(150, 12);
    expect(result.unfundedNet).toBe(0);
  });

  it("honors Roth-first and reports an unfunded remainder", () => {
    const result = withdrawFromTaxBuckets(
      { taxable: 10, taxDeferred: 10, roth: 10 },
      50,
      0.2,
      { withdrawalOrder: "roth-first", taxableGainShare: 0.5 }
    );
    expect(result.balances).toEqual({ taxable: 0, taxDeferred: 0, roth: 0 });
    expect(result.grossWithdrawal).toBe(30);
    expect(result.estimatedTax).toBe(3);
    expect(result.netFunded).toBe(27);
    expect(result.unfundedNet).toBe(23);
  });

  it("handles zero need without changing balances", () => {
    const balances = { taxable: 10, taxDeferred: 20, roth: 30 };
    const result = withdrawFromTaxBuckets(balances, 0, 0.2, { withdrawalOrder: "tax-deferred-first", taxableGainShare: 0.5 });
    expect(result.balances).toEqual(balances);
    expect(result.grossWithdrawal).toBe(0);
  });

  it("validates balances, contribution shares, gain share, and ordering", () => {
    const scenario = makeScenario({
      taxBuckets: {
        enabled: true,
        startingBalances: { taxable: -1, taxDeferred: 60, roth: 10 },
        contributionShares: { taxable: 0.5, taxDeferred: 0.5, roth: 0.5 },
        withdrawalOrder: "dynamic" as "taxable-first",
        taxableGainShare: 2
      }
    });
    const errors = validateScenario(scenario).join(" ");
    expect(errors).toContain("withdrawal order");
    expect(errors).toContain("gain share");
    expect(errors).toContain("balances must be nonnegative");
    expect(errors).toContain("contribution shares must total 100%");
  });

  it("requires enabled starting bucket balances to equal the portfolio", () => {
    const scenario = makeScenario({
      taxBuckets: {
        enabled: true,
        startingBalances: { taxable: 1, taxDeferred: 2, roth: 3 },
        contributionShares: { taxable: 0.25, taxDeferred: 0.5, roth: 0.25 },
        withdrawalOrder: "taxable-first",
        taxableGainShare: 0.5
      }
    });
    expect(validateScenario(scenario).join(" ")).toContain("must equal the starting portfolio");
  });
});
