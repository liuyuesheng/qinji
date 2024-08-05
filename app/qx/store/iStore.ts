interface StoreBean {
  key: string;
  tokenCount: number;
  tokenUse: number;
}

interface IStore {
  createStore(count: number, day: number): StoreBean;
  getEffectiveToken(key: string): number;
  useToken(key: string, use: number): StoreBean | null | undefined;

  addTokenCount(key: string, add: number): StoreBean | null | undefined;
}
