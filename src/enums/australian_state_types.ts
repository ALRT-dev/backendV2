export enum AustralianStates {
  NSW = "New South Wales",
  VIC = "Victoria",
  QLD = "Queensland",
  SA = "South Australia",
  WA = "Western Australia",
  TAS = "Tasmania",
  ACT = "Australian Capital Territory",
  NT = "Northern Territory",
}

// Helper to get shortform of state names
export const AustralianStatesShort: Record<AustralianStates, string> = {
  [AustralianStates.NSW]: "NSW",
  [AustralianStates.VIC]: "VIC",
  [AustralianStates.QLD]: "QLD",
  [AustralianStates.SA]: "SA",
  [AustralianStates.WA]: "WA",
  [AustralianStates.TAS]: "TAS",
  [AustralianStates.ACT]: "ACT",
  [AustralianStates.NT]: "NT",
};

export const AustralianStateBomAPIs: Record<AustralianStates, string> = {
  [AustralianStates.NSW]:
    "https://www.bom.gov.au/fwo/IDZ00054.warnings_nsw.xml",
  [AustralianStates.VIC]:
    "https://www.bom.gov.au/fwo/IDZ00059.warnings_vic.xml",
  [AustralianStates.QLD]:
    "https://www.bom.gov.au/fwo/IDZ00056.warnings_qld.xml",
  [AustralianStates.SA]: "https://www.bom.gov.au/fwo/IDZ00057.warnings_sa.xml",
  [AustralianStates.WA]: "https://www.bom.gov.au/fwo/IDZ00060.warnings_wa.xml",
  [AustralianStates.TAS]:
    "https://www.bom.gov.au/fwo/IDZ00058.warnings_tas.xml",
  [AustralianStates.ACT]: "",
  [AustralianStates.NT]: "https://www.bom.gov.au/fwo/IDZ00055.warnings_nt.xml",
};
