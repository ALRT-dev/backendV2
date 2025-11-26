export interface AIPromptConfiguration {
  userReportedAlertReviewAndSummarizePromptId: {
    infoPromptId: string;
    monitorPromptId: string;
    actionPromptId: string;
    criticalPromptId: string;
  };
  officialAlertSummarizationPromptId: {
    infoPromptId: string;
    monitorPromptId: string;
    actionPromptId: string;
    criticalPromptId: string;
  };
  officialAwsAlertSummarizationPromptId: {
    infoPromptId: string;
    monitorPromptId: string;
    actionPromptId: string;
    criticalPromptId: string;
  };
  airQualityAlertCategoryPromptId: {
    infoPromptId: string;
    monitorPromptId: string;
    actionPromptId: string;
    criticalPromptId: string;
  };
  extractLocationPromptId: string;
}
