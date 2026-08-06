import OpenAI from "openai";
import { config } from "./config.js";

const openai = new OpenAI({
  apiKey: config.openAI.apiKey,
  // Bound each call so a slow upstream can't hang a hazard submission for
  // minutes (the SDK default is a 10-minute timeout). Retry transient failures.
  timeout: 15000,
  maxRetries: 2,
});

export default openai;
