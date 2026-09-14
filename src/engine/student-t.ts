import { normalSample } from "./prng";

export function chiSquaredSample(random: () => number, degreesOfFreedom: number): number {
  if (!Number.isInteger(degreesOfFreedom) || degreesOfFreedom <= 0) {
    throw new Error("Chi-squared degrees of freedom must be a positive integer.");
  }
  let sum = 0;
  for (let index = 0; index < degreesOfFreedom; index++) {
    const sample = normalSample(random);
    sum += sample * sample;
  }
  return sum;
}

export function standardizedStudentTSample(random: () => number, degreesOfFreedom: number): number {
  if (!Number.isInteger(degreesOfFreedom) || degreesOfFreedom <= 2) {
    throw new Error("Student's t degrees of freedom must be an integer greater than 2.");
  }
  const z = normalSample(random);
  const varianceDraw = Math.max(Number.MIN_VALUE, chiSquaredSample(random, degreesOfFreedom));
  const t = z / Math.sqrt(varianceDraw / degreesOfFreedom);
  return t * Math.sqrt((degreesOfFreedom - 2) / degreesOfFreedom);
}
