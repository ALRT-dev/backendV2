import { S3Client } from "@aws-sdk/client-s3";
import { config } from "./config.js";

const s3Client = new S3Client({
  region: config.aws.s3.region,
  credentials: {
    accessKeyId: config.aws.s3.accessKeyId,
    secretAccessKey: config.aws.s3.secretAccessKey,
  },
});

export default s3Client;
