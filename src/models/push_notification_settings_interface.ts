export interface PushNotificationSettings {
  awsEmergency: boolean;

  awsWatchAndAct: boolean;

  awsAdvice: boolean;

  officialNonAws: boolean;

  userReported: boolean;

  subscribedCategoryIds: string[];
}
