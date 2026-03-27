import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { MODELS } from '@/lib/constants';
import { getDefaultAspectRatio, getModelDefinition, getSelectableOutputCounts } from '@/lib/imageGeneration';

const DEFAULT_MODEL_ID = MODELS[0]?.id ?? 'flux-schnell';
const DEFAULT_MODEL = getModelDefinition(DEFAULT_MODEL_ID);
const DEFAULT_ASPECT_RATIO = getDefaultAspectRatio(DEFAULT_MODEL, {
  includeCustom: true,
});
const DEFAULT_OUTPUT_COUNT = getSelectableOutputCounts(DEFAULT_MODEL).at(-1) ?? 1;

interface GenerationSettingsStore {
  defaultModelId: string;
  defaultAspectRatio: string;
  defaultOutputCount: number;
  setDefaultModelId: (modelId: string) => void;
  setDefaultAspectRatio: (aspectRatio: string) => void;
  setDefaultOutputCount: (count: number) => void;
  resetDefaults: () => void;
}

export const useGenerationSettingsStore = create<GenerationSettingsStore>()(
  persist(
    (set) => ({
      defaultModelId: DEFAULT_MODEL_ID,
      defaultAspectRatio: DEFAULT_ASPECT_RATIO,
      defaultOutputCount: DEFAULT_OUTPUT_COUNT,
      setDefaultModelId: (defaultModelId) => set({ defaultModelId }),
      setDefaultAspectRatio: (defaultAspectRatio) => set({ defaultAspectRatio }),
      setDefaultOutputCount: (defaultOutputCount) => set({ defaultOutputCount }),
      resetDefaults: () =>
        set({
          defaultModelId: DEFAULT_MODEL_ID,
          defaultAspectRatio: DEFAULT_ASPECT_RATIO,
          defaultOutputCount: DEFAULT_OUTPUT_COUNT,
        }),
    }),
    {
      name: 'visual-ide-generation-defaults',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
