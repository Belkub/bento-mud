/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MudInputs {
  prevCasingInternalDiameter: number; // num1
  nextCasingInternalDiameter: number; // num2
  bitDiameter: number; // num3
  washoutCoefficient: number; // num4 (kav)
  bentoniteConcentration: number; // num5 (bent)
  weightingAgentConcentration: number; // num6 (ut)
  marbleConcentration: number; // num7 (kolm)
  weightingAgentDensity: number; // num8 (put)
  bentoniteColloidalContent: number; // num9 (kolb)
  rockPorosity: number; // num10 (por)
  cuttingContentOfSection: number; // num11 (glin)
  dispersionMediumDensity: number; // num12 (disp)
  isWeighted: boolean; // num13 (rut)
  filterCakeThickness: number; // num14 (korc)
  intervalStart: number; // num15 (start)
  intervalEnd: number; // num16 (fin)
  unweightedDensity: number; // num17 (dens)
  weightedDensity: number; // num18 (densu)
  cleaningStages: number; // num19 (num_o)
  mudVolumeInTanks: number; // num20 (value)
  prevIntervalVolume: number; // num21 (value_pre)
  lpPolymerConcentration: number;
  hpPolymerConcentration: number;
  xcPolymerConcentration: number;
  // Trajectory fields (optional, will be 0 if not provided)
  inclinationStart?: number;
  inclinationEnd?: number;
  azimuthStart?: number;
  azimuthEnd?: number;
  surveyPoints?: Array<{ md: number; inclination: number; azimuth: number }>;
}

export interface CalculationResults {
  cbent: number;
  ccolr: number;
  ccol: number;
  cshp: number;
  kolm: number;
  ut: number;
  icup: number;
  octf: number;
  
  korc: number;
  vk: number;
  Ff: number;
  Fs: number;
  F: number;
  Vkon: number;
  Vp: number;
  Vper: number;
  value_pre: number;

  csh_mass: number;
  csh_volume: number;
  Csh: number;
  Cr: number;
  TotalSolidSlurry: number;
  WaterSlurry: number;

  viscosity: number;
  filtrationIndex: number;
  chartData: Array<{ conc: number, LP: number, HP: number, XC: number, COLLOID: number }>;
}
