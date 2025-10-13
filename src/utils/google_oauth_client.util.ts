import { OAuth2Client } from "google-auth-library";
import { config } from "./config.js";

const client = new OAuth2Client(config.googleOAuth.clientIdWeb);

export default client;
