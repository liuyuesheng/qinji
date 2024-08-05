import { BAIDU_OATUH_URL } from "../constant";
import { qxlog } from "@/app/qx/util";
/**
 * 使用 AK，SK 生成鉴权签名（Access Token）
 * @return 鉴权签名信息
 */
export async function getAccessToken(
  clientId: string,
  clientSecret: string,
): Promise<{
  access_token: string;
  expires_in: number;
  error?: number;
}> {
  qxlog("通过ak 从百度获取token .");
  const res = await fetch(
    `${BAIDU_OATUH_URL}?grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
    {
      method: "POST",
      mode: "cors",
    },
  );
  const resJson = await res.json();
  return resJson;
}
