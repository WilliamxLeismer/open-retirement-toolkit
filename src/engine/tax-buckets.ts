import type { TaxBucket, TaxBucketSettings, WithdrawalOrder } from "../domain";

export type TaxBucketBalances = Record<TaxBucket, number>;

export interface TaxBucketWithdrawal {
  balances: TaxBucketBalances;
  grossWithdrawal: number;
  estimatedTax: number;
  netFunded: number;
  unfundedNet: number;
}

const ORDERS: Record<WithdrawalOrder, TaxBucket[]> = {
  "taxable-first": ["taxable", "taxDeferred", "roth"],
  "tax-deferred-first": ["taxDeferred", "taxable", "roth"],
  "roth-first": ["roth", "taxable", "taxDeferred"]
};

export const totalTaxBucketBalance = (balances: TaxBucketBalances) =>
  balances.taxable + balances.taxDeferred + balances.roth;

export function growTaxBuckets(balances: TaxBucketBalances, growthFactor: number): TaxBucketBalances {
  return {
    taxable: balances.taxable * growthFactor,
    taxDeferred: balances.taxDeferred * growthFactor,
    roth: balances.roth * growthFactor
  };
}

export function contributeToTaxBuckets(
  balances: TaxBucketBalances,
  contribution: number,
  shares: TaxBucketBalances
): TaxBucketBalances {
  return {
    taxable: balances.taxable + contribution * shares.taxable,
    taxDeferred: balances.taxDeferred + contribution * shares.taxDeferred,
    roth: balances.roth + contribution * shares.roth
  };
}

export function withdrawFromTaxBuckets(
  balances: TaxBucketBalances,
  netNeed: number,
  effectiveTaxRate: number,
  settings: Pick<TaxBucketSettings, "withdrawalOrder" | "taxableGainShare">
): TaxBucketWithdrawal {
  const remaining = { ...balances };
  let unfundedNet = Math.max(0, netNeed);
  let grossWithdrawal = 0;
  let estimatedTax = 0;
  for (const bucket of ORDERS[settings.withdrawalOrder]) {
    if (unfundedNet <= 0) break;
    const taxableShare = bucket === "taxDeferred" ? 1 : bucket === "taxable" ? settings.taxableGainShare : 0;
    const netFactor = Math.max(0.01, 1 - effectiveTaxRate * taxableShare);
    const gross = Math.min(remaining[bucket], unfundedNet / netFactor);
    const tax = gross * effectiveTaxRate * taxableShare;
    remaining[bucket] -= gross;
    grossWithdrawal += gross;
    estimatedTax += tax;
    unfundedNet = Math.max(0, unfundedNet - (gross - tax));
  }
  return { balances: remaining, grossWithdrawal, estimatedTax, netFunded: Math.max(0, netNeed) - unfundedNet, unfundedNet };
}
