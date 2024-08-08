"use client";
import {
  ApiPath,
  Baidu,
  BAIDU_BASE_URL,
  baiduModels,
  REQUEST_TIMEOUT_MS,
} from "@/app/constant";
import { useAccessStore, useAppConfig, useChatStore } from "@/app/store";
import { getAccessToken } from "@/app/utils/baidu";

import {
  ChatOptions,
  getHeaders,
  LLMApi,
  LLMModel,
  MultimodalContent,
  RequestMessage,
} from "../api";
import Locale from "../../locales";
import {
  EventStreamContentType,
  fetchEventSource,
} from "@fortaine/fetch-event-source";
import { prettyObject } from "@/app/utils/format";
import { getClientConfig } from "@/app/config/client";
import { getMessageTextContent } from "@/app/utils";
import { qxlog } from "@/app/qx/util";

export interface OpenAIListModelResponse {
  object: string;
  data: Array<{
    id: string;
    object: string;
    root: string;
  }>;
}

interface RequestPayload {
  messages: {
    role: "system" | "user" | "assistant";
    content: string | MultimodalContent[];
  }[];
  stream?: boolean;
  model: string;
  temperature: number;
  presence_penalty: number;
  frequency_penalty: number;
  top_p: number;
  max_tokens?: number;
  system?: string;
}

export class ErnieApi implements LLMApi {
  path(path: string): string {
    const accessStore = useAccessStore.getState();

    let baseUrl = "";

    if (accessStore.useCustomConfig) {
      baseUrl = accessStore.baiduUrl;
    }

    if (baseUrl.length === 0) {
      const isApp = !!getClientConfig()?.isApp;
      // do not use proxy for baidubce api
      baseUrl = isApp ? BAIDU_BASE_URL : ApiPath.Baidu;
    }

    if (baseUrl.endsWith("/")) {
      baseUrl = baseUrl.slice(0, baseUrl.length - 1);
    }
    if (!baseUrl.startsWith("http") && !baseUrl.startsWith(ApiPath.Baidu)) {
      baseUrl = "https://" + baseUrl;
    }

    console.log("[Proxy Endpoint] ", baseUrl, path);

    return [baseUrl, path].join("/");
  }
  //保证奇数
  formatData(data: RequestMessage[]) {
    const alen = data.length;
    //偶数个,删除第一个
    if (alen % 2 == 0) {
      //长度为1，放一个空数据
      if (alen == 0) {
        data.unshift({
          role: "user",
          content: " ",
        });
      }
      //大于0 至少为2，删除一个变成奇数
      else {
        data.splice(0, 1);
      }
    }
  }
  async chat(options: ChatOptions) {
    if (options.messages && options.messages.length > 0) {
      //预设我自己写
      options.messages.filter((v) => v.role != "system");
    }

    console.log("原始数据:" + JSON.stringify(options.messages));
    this.formatData(options.messages);
    //从后往前推。必须是user assistant
    const reverseData = [...options.messages].reverse();
    let index = 0;
    const realData: RequestMessage[] = [];
    for (const v of reverseData) {
      const isRight =
        (index % 2 == 0 && v.role == "user") ||
        (index % 2 == 1 && v.role == "assistant");
      if (isRight) {
        //往前添加元素
        realData.unshift(v);
      }
      //前面错误的数据都不要
      else {
        break;
      }
      index++;
    }
    this.formatData(realData);
    console.log("realData:" + JSON.stringify(realData));
    const messages = realData;
    const modelConfig = {
      ...useAppConfig.getState().modelConfig,
      ...useChatStore.getState().currentSession().mask.modelConfig,
      ...{
        model: options.config.model,
      },
    };
    const system =
      "有一个女孩子名叫腿腿，职业是一家工程造价公司的老板，你是的她的专职秘书，名字叫老刘。\
                             你有专业的工程造价知识，也有多年的考公考编经验，同时你是最了解的腿腿的人。\
                             比如你知道她喜欢的奶粉牌子是伊利，喜欢的烧烤是南门湾的烧烤\
                             同时请在回复前帮我获取当前时间，如果当前时间是北京时间20点以后，你要在回复前加上，该早点休息啦腿腿\
                             ";

    const shouldStream = !!options.config.stream;
    const requestPayload: RequestPayload = {
      messages,
      system,
      stream: shouldStream,
      model: modelConfig.model,
      temperature: modelConfig.temperature,
      presence_penalty: modelConfig.presence_penalty,
      frequency_penalty: modelConfig.frequency_penalty,
      top_p: modelConfig.top_p,
    };

    console.log("[Request] Baidu payload: ", requestPayload);

    const controller = new AbortController();
    options.onController?.(controller);

    try {
      let chatPath = this.path(Baidu.ChatPath(modelConfig.model));

      // getAccessToken can not run in browser, because cors error
      if (!!getClientConfig()?.isApp) {
        const accessStore = useAccessStore.getState();
        if (accessStore.useCustomConfig) {
          if (accessStore.isValidBaidu()) {
            const { access_token } = await getAccessToken(
              accessStore.baiduApiKey,
              accessStore.baiduSecretKey,
            );
            chatPath = `${chatPath}${
              chatPath.includes("?") ? "&" : "?"
            }access_token=${access_token}`;
          }
        }
      }
      const chatPayload = {
        method: "POST",
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
        headers: getHeaders(),
      };

      // make a fetch request
      const requestTimeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS,
      );
      qxlog(`baidu 流式:${shouldStream}`);
      if (shouldStream) {
        let responseText = "";
        let remainText = "";
        let finished = false;

        // animate response to make it looks smooth
        function animateResponseText() {
          if (finished || controller.signal.aborted) {
            responseText += remainText;
            console.log("[Response Animation] finished");
            if (responseText?.length === 0) {
              options.onError?.(new Error("empty response from server"));
            }
            return;
          }

          if (remainText.length > 0) {
            const fetchCount = Math.max(1, Math.round(remainText.length / 60));
            const fetchText = remainText.slice(0, fetchCount);
            responseText += fetchText;
            remainText = remainText.slice(fetchCount);
            options.onUpdate?.(responseText, fetchText);
          }

          requestAnimationFrame(animateResponseText);
        }

        // start animaion
        animateResponseText();

        const finish = () => {
          if (!finished) {
            finished = true;
            options.onFinish(responseText + remainText);
          }
        };

        controller.signal.onabort = finish;
        qxlog(`baidu chatPayload:${JSON.stringify(chatPayload)}`);
        fetchEventSource(chatPath, {
          ...chatPayload,
          async onopen(res) {
            clearTimeout(requestTimeoutId);
            const contentType = res.headers.get("content-type");
            console.log("[Baidu] request response content type: ", contentType);
            qxlog("baidu open");
            if (contentType?.startsWith("text/plain")) {
              responseText = await res.clone().text();
              return finish();
            }

            if (
              !res.ok ||
              !res.headers
                .get("content-type")
                ?.startsWith(EventStreamContentType) ||
              res.status !== 200
            ) {
              const responseTexts = [responseText];
              let extraInfo = await res.clone().text();
              try {
                const resJson = await res.clone().json();
                extraInfo = prettyObject(resJson);
              } catch {}

              if (res.status === 401) {
                responseTexts.push(Locale.Error.Unauthorized);
              }

              if (extraInfo) {
                responseTexts.push(extraInfo);
              }

              responseText = responseTexts.join("\n\n");

              return finish();
            }
          },
          onmessage(msg) {
            qxlog("baidu on text");
            if (msg.data === "[DONE]" || finished) {
              return finish();
            }
            const text = msg.data;
            try {
              const json = JSON.parse(text);
              const delta = json?.result;
              if (delta) {
                remainText += delta;
              }
            } catch (e) {
              console.error("[Request] parse error", text, msg);
            }
          },
          onclose() {
            finish();
          },
          onerror(e) {
            options.onError?.(e);
            throw e;
          },
          openWhenHidden: true,
        });
      } else {
        const res = await fetch(chatPath, chatPayload);
        clearTimeout(requestTimeoutId);

        const resJson = await res.json();
        const message = resJson?.result;
        options.onFinish(message);
      }
    } catch (e) {
      console.log("[Request] failed to make a chat request", e);
      options.onError?.(e as Error);
    }
  }
  async usage() {
    return {
      used: 0,
      total: 0,
    };
  }

  async models(): Promise<LLMModel[]> {
    return baiduModels.map((name) => ({
      name,
      available: true,
      provider: {
        id: "baidu",
        providerName: "Baidu",
        providerType: "baidu",
      },
    }));
  }
}
export { Baidu };
