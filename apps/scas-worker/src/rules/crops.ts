export interface CropCalendar {
  /** Months (1-12) in which a Sowing Attestation makes sense. */
  sowingMonths: number[];
  /** NDVI band of bare or emerging soil after sowing. */
  sowingNdvi: [number, number];
  /** Expected NDVI range per month (1-12) during vegetation. */
  vegetation: Record<number, [number, number]>;
  harvestMonths: number[];
  /** The season peak must reach at least this NDVI. */
  harvestPeakMin: number;
  /** After harvest the latest NDVI must be at most this. */
  harvestLatestMax: number;
  source: string;
}

/**
 * DEMO ASSUMPTION. Spring wheat in northern Kazakhstan (Akmola, Kostanay, North
 * Kazakhstan regions): sowing mid-May to early June, peak canopy in July,
 * ripening in August, harvest late August to September. Ranges are generous
 * hand-set bands for a demo, not calibrated against ground truth.
 */
export const CROP_CALENDARS: Record<string, CropCalendar> = {
  wheat: {
    sowingMonths: [5, 6],
    sowingNdvi: [0.05, 0.4],
    vegetation: { 6: [0.2, 0.65], 7: [0.45, 0.9], 8: [0.3, 0.8] },
    harvestMonths: [8, 9],
    harvestPeakMin: 0.5,
    harvestLatestMax: 0.35,
    source: "demo assumption: spring wheat, northern Kazakhstan; not calibrated",
  },
};

export function calendarFor(crop: string): CropCalendar | undefined {
  return CROP_CALENDARS[crop.trim().toLowerCase()];
}
