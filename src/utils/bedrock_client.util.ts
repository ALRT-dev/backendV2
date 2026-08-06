import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { config } from "./config.js";

const bedrockClient = new BedrockRuntimeClient({
  region: config.aws.bedrock.region,
  ...(config.aws.bedrock.accessKeyId && config.aws.bedrock.secretAccessKey
    ? {
        credentials: {
          accessKeyId: config.aws.bedrock.accessKeyId,
          secretAccessKey: config.aws.bedrock.secretAccessKey,
        },
      }
    : {}),
});

export default bedrockClient;
