import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_OAUTH_CLIENT_ID_WEB);

export default client;
