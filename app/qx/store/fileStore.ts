import { createToken } from "@/app/qx/store/util";
import { Exception } from "sass";

const fs = require("fs");
let userCache = new Map<string, StoreBean>();
const FILE_USER_CACHE = "./cache/userCache.json";
console.log("---------userCache read start ------------");
try {
  if (fs.existsSync(FILE_USER_CACHE)) {
    const data = fs.readFileSync(FILE_USER_CACHE, "utf8");
    const map = JSON.parse(data);
    userCache = new Map(map);
    console.log(`1read  :${userCache.size}`);
  }
} catch (e) {
  console.log(`error:${e}`);
}

console.log("---------userCache read over -----------");
export function saveUser() {
  const cacheData = JSON.stringify(Array.from(userCache));
  console.log(`saveUser cacheData:${cacheData},${userCache.size}`);
  fs.writeFile(FILE_USER_CACHE, cacheData, (err: any) => {
    if (err) {
      console.error("saveUser error", err);
    } else {
      console.log("save success");
    }
  });
}

class FileStore implements IStore {
  addTokenCount(key: string, add: number): StoreBean | null | undefined {
    const storeBean = userCache.get(key);
    if (storeBean != null) {
      storeBean.tokenCount = storeBean.tokenCount + add;
    }
    return storeBean;
  }

  createStore(count: number, day: number): StoreBean {
    const token = createToken(count, day);
    const storeBean = {
      tokenCount: count,
      key: token,
      tokenUse: count,
    };

    userCache.set(token, storeBean);
    return storeBean;
  }

  getEffectiveToken(key: string): number {
    return userCache.get(key)?.tokenUse ?? 0;
  }

  useToken(key: string, use: number): StoreBean | null | undefined {
    const storeBean = userCache.get(key);
    if (storeBean != null) {
      const allUse = storeBean.tokenUse + use;
      if (allUse > storeBean.tokenCount) {
        throw new Error(
          `token超出限制，请充值,总共:${storeBean.tokenCount},已使用:${storeBean.tokenUse},输入需要:${use}`,
        );
      }
    }
    return storeBean;
  }
}

export const store = new FileStore();
