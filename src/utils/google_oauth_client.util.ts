import { OAuth2Client } from "google-auth-library";
import { config } from "./config.js";

const googleOAuthClient = new OAuth2Client(config.googleOAuth.clientIdWeb);

export default googleOAuthClient;
