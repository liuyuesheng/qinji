import { useMemo } from "react";
import { useAccessStore, useAppConfig } from "../store";
import { collectModelsWithDefaultModel } from "./model";
import { qxlog } from "@/app/qx/util";

//qx:设置里所有model的来源
export function useAllModels() {
  //qxlog("useAllModels");
  const accessStore = useAccessStore();
  const configStore = useAppConfig();
  qxlog("useMemo(factory,dep),hook方法 dep发生变化的时候触发factory");
  const models = useMemo(() => {
    qxlog("factory execute");
    // configStore.models.forEach((a)=>{
    //   qxlog(`configStore.model:${a.name}`)
    // })
    return collectModelsWithDefaultModel(
      configStore.models,
      [configStore.customModels, accessStore.customModels].join(","),
      accessStore.defaultModel,
    );
  }, [
    accessStore.customModels,
    accessStore.defaultModel,
    configStore.customModels,
    configStore.models,
  ]);
  models.forEach((a) => {
    console.log(`model name:${a.name}`);
  });

  return models;
}
