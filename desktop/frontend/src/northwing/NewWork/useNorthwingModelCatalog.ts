import { useCallback, useEffect, useState } from "react";
import { app } from "../../lib/bridge";
import type { EffortInfo, ModelInfo } from "../../lib/types";

const unsupportedEffort: EffortInfo = {
  supported: false,
  current: "",
  default: "",
  levels: [],
};

export type NorthwingModelCatalogState = {
  models: ModelInfo[];
  effort: EffortInfo;
  loading: boolean;
  error?: string;
  reload: () => Promise<void>;
};

export function useNorthwingModelCatalog(): NorthwingModelCatalogState {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [effort, setEffort] = useState<EffortInfo>(unsupportedEffort);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const reload = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const nextModels = await app.Models();
      setModels(nextModels);
      try {
        setEffort(await app.Effort());
      } catch {
        setEffort(unsupportedEffort);
      }
    } catch (err) {
      setModels([]);
      setEffort(unsupportedEffort);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const handleCatalogChanged = () => void reload();
    window.addEventListener("reasonix:model-catalog-changed", handleCatalogChanged);
    return () => window.removeEventListener("reasonix:model-catalog-changed", handleCatalogChanged);
  }, [reload]);

  return { models, effort, loading, error, reload };
}
