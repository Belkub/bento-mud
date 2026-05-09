/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MudInputs, CalculationResults } from '../types';

export function calculateMudParameters(inputs: MudInputs): CalculationResults {
  const d1 = inputs.prevCasingInternalDiameter;
  const d2 = inputs.nextCasingInternalDiameter;
  const bit = inputs.bitDiameter;
  const kav = inputs.washoutCoefficient;
  const bent = inputs.bentoniteConcentration;
  const rut = inputs.isWeighted;
  const ut_in = rut ? inputs.weightingAgentConcentration : 0;
  const kolm_in = inputs.marbleConcentration;
  const put_in = inputs.weightingAgentDensity;
  const kolb_in = inputs.bentoniteColloidalContent;
  const por = inputs.rockPorosity;
  const glin = inputs.cuttingContentOfSection;
  const disp = inputs.dispersionMediumDensity;
  const korc_in = inputs.filterCakeThickness;
  const start = inputs.intervalStart;
  const fin = inputs.intervalEnd;
  const dens = inputs.unweightedDensity;
  const densu = inputs.weightedDensity;
  const num_o = inputs.cleaningStages;
  const value = inputs.mudVolumeInTanks;
  const value_pre_in = inputs.prevIntervalVolume;

  const bit_m = bit * 0.001;
  const d1_m = d2 * 0.001;

  // Calculation of cake volume
  const vk = 3.14 * bit * 0.001 * korc_in * (fin - start) * 0.001;
  
  // Colloidal phase concentration
  const ccol = (bent * kolb_in + ut_in * 1.5 + kolm_in * 30) * 0.001 / 2.6;
  
  // Interval volume
  const vint = (fin - start) * kav * 3.14 * ((bit_m * bit_m) / 4);

  // Unweighted mud calculations
  const constant_01_6 = 0.01 * 6; // From OCR: (1-(0.01*6))
  const utvn = 1000 * 2.6 * (dens - disp) * (1 - constant_01_6) / (2.6 - dens * (1 - constant_01_6 + constant_01_6 * 2.6));
  const vcn = 1 + (utvn * 0.001 / 2.6);
  const ictf = utvn / vcn;
  const ictfp = 0.1 * ictf / (2.6 * 0.01 * glin + 2.6 * 0.01 * (100 - glin));
  const cvf = 100 - ictfp;

  // Weighted mud
  let icup = 0;
  let octf = 0;
  let cvfu = cvf;

  if (rut) {
    const put = put_in;
    const ucu = 1000 * put * (densu - dens) * (1 - constant_01_6) / (put - densu * (1 - constant_01_6 + constant_01_6 * put));
    const vc = 1 + (ucu * 0.001 / put);
    icup = 0.1 * (ucu / vc) / put;
    octf = icup + ictfp;
    cvfu = 100 - octf;
  } else {
    octf = ictfp;
  }

  // Slurry / Pulse
  let uctp = 0;
  if (num_o === 4) {
    uctp = 1000 * 2.6 * (1.9 - dens) * (1 - constant_01_6) / (2.6 - 1.9 * (1 - constant_01_6 + constant_01_6 * 2.6));
  } else {
    uctp = 1000 * 2.6 * (1.6 - dens) * (1 - constant_01_6) / (2.6 - 1.6 * (1 - constant_01_6 + constant_01_6 * 2.6));
  }
  
  const vc_slurry = 1 + (uctp * 0.001 / 2.6);
  const ict_slurry = uctp / vc_slurry;
  const ictp_slurry = 0.1 * ict_slurry / 2.6;
  const crp_slurry = 100 - ictp_slurry * (100 / (100 - por));

  // Losses
  const Ff = (rut ? cvfu : cvf) * vk / ccol;
  const Fs = crp_slurry * vint / (100 - crp_slurry);
  const F = Ff + Fs;

  // Well volume at end
  const Vkon = 3.14 * ((d1 * d1 * 0.001 * 0.001) / 4) * start + ((3.14 * bit * bit * 0.001 * 0.001) / 4) * (fin - start) * kav;
  
  // Volume of prepared mud
  const Vp = F + Vkon + value - value_pre_in;
  
  // Volume to next interval
  const Vper = value + Vkon - ((3.14 * d1_m * d1_m * 0.001) / 12) * fin;

  // Phase composition of slurry
  const Csh = ictp_slurry;
  const Cr_slurry = (crp_slurry * 0.01 * octf);

  // Sufficient bentonite
  const cbent = bent - ((ictf - kolm_in) * (15 / 100) * (glin / 100)) / (kolb_in / 100);
  const ccolr = ccol * 10 * 2.6;
  const cshp = ictfp - (0.1 * (kolm_in + cbent) / 2.6);

  // Filtration logic integrated
  const L = inputs.lpPolymerConcentration;
  const H = inputs.hpPolymerConcentration;
  const X = inputs.xcPolymerConcentration;
  const korc = korc_in;

  let N = 0;
  if (korc > 0.5) {
    N = 0.001 + (0.001 * L + 0.0025 * H + 0.0035 * X) * 0.26;
  } else if (korc > 0 && korc <= 0.5) {
    N = 0.001 + (0.001 * L + 0.0025 * H + 0.0035 * X) * 0.74;
  }

  const factor = korc > 0.5 ? 0.26 : 0.74;
  const commonNum = 1800 * 1000000 * 0.00563 * (0.0000000000000000453 / ccol) * 101325;
  const filtrationIndex = commonNum / (N * 0.001 * korc);

  // Check for solids overflow (no room for cuttings)
  // bent/26 + kolm_in/26 + ut_in/(put_in*10) are volume percentages
  const totalSolidVolumePercentageInput = (bent / 26) + (kolm_in / 26) + (ut_in / (put_in * 10));
  // octf is the required total solid volume percentage for target density (dens or densu)
  const hasSolidsOverflow = totalSolidVolumePercentageInput >= octf || cshp < 0 || Csh < 0;

  const chartData = Array.from({ length: 20 }, (_, i) => {
    const conc = i + 1;
    
    const lpLine = commonNum / ((0.001 + (0.001 * conc + 0.0025 * H + 0.0035 * X) * factor) * 0.001 * korc);
    const hpLine = commonNum / ((0.001 + (0.001 * L + 0.0025 * conc + 0.0035 * X) * factor) * 0.001 * korc);
    const xcLine = commonNum / ((0.001 + (0.001 * L + 0.0025 * H + 0.0035 * conc) * factor) * 0.001 * korc);
    
    // For colloid curve, vary ccol. conc (1-20) maps to ccol (0.1% to 4%)
    const varCcol = conc * 0.2;
    const commonNumCol = 1800 * 1000000 * 0.00563 * (0.0000000000000000453 / varCcol) * 101325;
    const colloidLine = commonNumCol / (N * 0.001 * korc);

    return { 
      conc, 
      'LP': lpLine,
      'HP': hpLine, 
      'XC': xcLine,
      'COLLOID': colloidLine
    };
  });

  return {
    cbent,
    ccolr,
    ccol,
    cshp,
    kolm: kolm_in,
    ut: ut_in,
    icup,
    octf,
    korc: korc_in,
    vk,
    Ff,
    Fs,
    F,
    Vkon,
    Vp,
    Vper,
    value_pre: value_pre_in,
    csh_mass: (vint * (1 - por * 0.01) * (num_o === 4 ? 1.9 : 1.6) / (Csh * 0.01)),
    csh_volume: (vint * (1 - por * 0.01) / (Csh * 0.01)),
    Csh,
    Cr: Cr_slurry,
    TotalSolidSlurry: Csh + Cr_slurry,
    WaterSlurry: 100 - Csh - Cr_slurry,
    viscosity: N,
    filtrationIndex,
    hasSolidsOverflow,
    chartData,
    materialConsumption: {
      bentonite: bent * Math.max(0, Vp),
      weightingAgent: ut_in * Math.max(0, Vp),
      marble: kolm_in * Math.max(0, Vp),
      lpPolymer: inputs.lpPolymerConcentration * Math.max(0, Vp),
      hpPolymer: inputs.hpPolymerConcentration * Math.max(0, Vp),
      xcPolymer: inputs.xcPolymerConcentration * Math.max(0, Vp),
    }
  };
}
