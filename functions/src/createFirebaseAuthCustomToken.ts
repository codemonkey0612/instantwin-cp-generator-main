import * as admin from "firebase-admin";
import axios from "axios";
import * as functions from "firebase-functions/v2";

/**
 * LINE のログイン関係の API のレスポンスを定義する。
 * 参考：https://developers.line.biz/ja/reference/line-login/
 */

// /**
//  * GET https://api.line.me/oauth2/v2.1/verify のレスポンス。
//  * https://developers.line.biz/ja/reference/line-login/#verify-access-token
//  */
// interface LINEGetVerifyAPIResponse {
//   scope: string;
//   client_id: string;
//   expires_in: number;
// }

/** GET https://api.line.me/v2/profile のレスポンス。 */
/**
 * GET https://api.line.me/v2/profile のレスポンス。
 * https://developers.line.biz/ja/reference/line-login/#get-user-profile
 */
interface LINEGetProfileResponse {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

/**
 * LINE アクセストークンを検証し、LINE プロフィール情報を取得して、Firebase Auth のカスタムトークンを生成する
 * @param {Object} callableRequest - Firebase Functions から提供されるリクエストオブジェクト。
 * @param {string} callableRequest.data.accessToken - ユーザーから提供される LINE アクセストークン。
 * @returns {Promise<{customToken: string}>} 生成された Firebase Auth のカスタムトークンを含むオブジェクト。
 * @throws {Error} LINE アクセストークンの検証に失敗した場合、または LINE プロフィール情報の取得に失敗した場合、またはカスタムトークンの生成に失敗した場合、またはユーザードキュメントの設定に失敗した場合にエラーをスローする。
 */
export const createFirebaseAuthCustomToken = functions.https.onCall<{
  code: string;
  redirectUri: string;
}>(
  {
    secrets: ["LINE_CHANNEL_ID", "LINE_CHANNEL_SECRET"],
  },
  async (callableRequest) => {
    if (!process.env.LINE_CHANNEL_ID || !process.env.LINE_CHANNEL_SECRET) {
      throw new Error(
        "LINE_CHANNEL_ID または LINE_CHANNEL_SECRET が設定されていません。",
      );
    }

    const { code, redirectUri } = callableRequest.data;
    const { accessToken } = await issueAccessToken(code, redirectUri);
    // await verifyAccessToken(accessToken);
    const { lineUserId } = await getLINEProfile(accessToken);
    const customToken = await admin.auth().createCustomToken(lineUserId);
    return { customToken };
  },
);

/**
 * LINEのアクセストークンを発行する
 * @param {string} code - LINEの認可コード
 * @param {string} state - CSRF対策のための状態パラメータ
 * @param {string} redirectUri - リダイレクトURI
 * @returns {Promise<{ accessToken: string; idToken: string }>} 発行されたアクセストークンとIDトークンを含むオブジェクトを返す Promise.
 * @throws エラーが発生した場合、エラーメッセージが含まれる Error オブジェクトがスローされる。
 */
const issueAccessToken = async (
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; idToken: string }> => {
  const result = await axios.post(
    "https://api.line.me/oauth2/v2.1/token",
    {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: process.env.LINE_CHANNEL_ID,
      client_secret: process.env.LINE_CHANNEL_SECRET,
    },
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );
  if (result.status !== 200) {
    throw new Error(`[${result.status}]: POST /oauth2/v2.1/token`);
  }
  return {
    accessToken: result.data.access_token,
    idToken: result.data.id_token,
  };
};

// /**
//  * LINE の Verify API を呼び出して、アクセストークンの有効性を確認する。
//  * @param {string} accessToken - 検証する LINE のアクセストークン。
//  * @throws {Error} API のレスポンスステータスが 200 でない場合、または LINE チャネル ID が正しくない場合、またはアクセストークンの有効期限が過ぎている場合にエラーをスローする。
//  * @returns {Promise<void>} アクセストークンが有効であると確認された場合に解決する Promise.
//  */
// const verifyAccessToken = async (accessToken: string): Promise<void> => {
//   const response = await axios.get<LINEGetVerifyAPIResponse>(
//     `https://api.line.me/oauth2/v2.1/verify?access_token=${accessToken}`,
//   );
//   if (response.status !== 200) {
//     throw new Error(`[${response.status}]: GET /oauth2/v2.1/verify`);
//   }

//   const channelId = response.data.client_id;
//   if (channelId !== process.env.LINE_CHANNEL_ID) {
//     throw new Error(`LINE Login チャネル ID が正しくありません。`);
//   }

//   const expiresIn = response.data.expires_in;
//   if (expiresIn <= 0) {
//     throw new Error(`アクセストークンの有効期限が過ぎています。`);
//   }
// };

/**
 * LINE のプロフィール情報を取得する。
 * @param {string} accessToken - LINE のアクセストークン。
 * @returns {Promise<{ lineUserId: string; name: string; imageUrl?: string }>} ユーザーの LINE ID、名前、画像URL（存在する場合）を含むオブジェクトを返す Promise.
 * @throws エラーが発生した場合、エラーメッセージが含まれる Error オブジェクトがスローされる。
 */
const getLINEProfile = async (
  accessToken: string,
): Promise<{ lineUserId: string; name: string; imageUrl?: string }> => {
  const response = await axios.get<LINEGetProfileResponse>(
    `https://api.line.me/v2/profile`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (response.status !== 200) {
    throw new Error(`[${response.status}]: GET /v2/profile`);
  }
  return {
    lineUserId: response.data.userId,
    name: response.data.displayName,
    imageUrl: response.data.pictureUrl,
  };
};
