export enum SocketEvent {
  newHazard = "newHazard",
  updateHazard = "updateHazard",
  deleteHazard = "deleteHazard",

  updateUserXp = "updateUserXp",
  badgeEarned = "badgeEarned",
  updateUserUpvotesReceivedCount = "updateUserUpvotesReceivedCount",

  // Family Mode
  familyCircleUpdate = "familyCircleUpdate", // membership / circle metadata changed
  familyLocationUpdate = "familyLocationUpdate", // a member's live location moved
  familyCheckIn = "familyCheckIn", // a member checked in
  familyCheckInRequest = "familyCheckInRequest", // someone requested a check-in
  familyPlaceEvent = "familyPlaceEvent", // arrival/departure at a saved place
  familyLocationRequest = "familyLocationRequest", // target only: someone asked where you are
  familySos = "familySos", // SOS triggered
  familySosResponse = "familySosResponse", // seen / on my way / called
  familySosResolved = "familySosResolved", // SOS resolved or cancelled
  familyHazardProximity = "familyHazardProximity", // a member is near an active hazard
}
