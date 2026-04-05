import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { config } from "./config.js";

const bedrockClient = new BedrockRuntimeClient({
  region: config.aws.bedrock.region,
  credentials: {
    accessKeyId: config.aws.bedrock.accessKeyId,
    secretAccessKey: config.aws.bedrock.secretAccessKey,
  },
});

export default bedrockClient;
