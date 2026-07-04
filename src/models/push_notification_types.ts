export enum PushNotificationType {
  viewHazard = "viewHazard",

  // Family Mode — all deep-link into the family hub unless noted
  familyCheckIn = "familyCheckIn",
  familyCheckInRequest = "familyCheckInRequest",
  familyPlaceEvent = "familyPlaceEvent",
  familySos = "familySos", // deep-links into the SOS receiver screen
  familySosResponse = "familySosResponse",
  familySosResolved = "familySosResolved",
  familyHazardProximity = "familyHazardProximity", // deep-links into the hazard
  familyCircleUpdate = "familyCircleUpdate",
  familyLocationRequest = "familyLocationRequest", // opens the Share once / Not now screen
  familyLocationShared = "familyLocationShared",
}
