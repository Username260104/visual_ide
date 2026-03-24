import { NodeStatus } from './types';

export const STATUS_COLORS: Record<NodeStatus, string> = {
  unclassified: 'var(--status-unclassified)',
  reviewing: 'var(--status-reviewing)',
  promising: 'var(--status-promising)',
  final: 'var(--status-final)',
  dropped: 'var(--status-dropped)',
};

export const STATUS_LABELS: Record<NodeStatus, string> = {
  unclassified: '미분류',
  reviewing: '검토 중',
  promising: '유망',
  final: '최종',
  dropped: '탈락',
};

export const INTENT_TAG_OPTIONS = [
  '톤 조정',
  '구도 정리',
  '분위기 변경',
  '디테일 추가',
  '스타일 변경',
  '요소 제거',
  '요소 추가',
  '비율 조정',
];

export const CHANGE_TAG_OPTIONS = [
  '배경',
  '조명',
  '색상',
  '인물',
  '오브젝트',
  '텍스처',
  '타이포',
  '레이아웃',
];

export const DIRECTION_COLOR_PRESETS = [
  '#4fc1ff',
  '#4ec9b0',
  '#dcdcaa',
  '#ce9178',
  '#c586c0',
  '#6a9955',
  '#f44747',
  '#d7ba7d',
];

export interface ModelDef {
  id: string;
  replicateId: string;
  name: string;
  desc: string;
  supportsBatch: boolean;
  maxOutputs: number;
  supportsCustomSize: boolean;
  maxWidth: number;
  maxHeight: number;
  sizeMultiple: number;
  aspectRatios: string[];
  supportsGuidance: boolean;
  defaultSteps: number | null;
  maxSteps: number | null;
  supportsImg2Img: boolean;
  resolutionOptions: string[] | null;
}

export const MODELS: ModelDef[] = [
  {
    id: 'flux-schnell',
    replicateId: 'black-forest-labs/flux-schnell',
    name: 'FLUX.1 Schnell',
    desc: '빠른 생성, 초안 탐색용',
    supportsBatch: true,
    maxOutputs: 4,
    supportsCustomSize: false,
    maxWidth: 0,
    maxHeight: 0,
    sizeMultiple: 0,
    aspectRatios: [
      '1:1',
      '16:9',
      '21:9',
      '3:2',
      '2:3',
      '4:5',
      '5:4',
      '3:4',
      '4:3',
      '9:16',
      '9:21',
    ],
    supportsGuidance: false,
    defaultSteps: 4,
    maxSteps: 4,
    supportsImg2Img: false,
    resolutionOptions: ['1', '0.25'],
  },
  {
    id: 'flux-dev',
    replicateId: 'black-forest-labs/flux-dev',
    name: 'FLUX.1 Dev',
    desc: '더 높은 품질, 균형형',
    supportsBatch: true,
    maxOutputs: 4,
    supportsCustomSize: false,
    maxWidth: 0,
    maxHeight: 0,
    sizeMultiple: 0,
    aspectRatios: [
      '1:1',
      '16:9',
      '21:9',
      '3:2',
      '2:3',
      '4:5',
      '5:4',
      '3:4',
      '4:3',
      '9:16',
      '9:21',
    ],
    supportsGuidance: true,
    defaultSteps: 28,
    maxSteps: 50,
    supportsImg2Img: true,
    resolutionOptions: ['1', '0.25'],
  },
  {
    id: 'flux-1.1-pro',
    replicateId: 'black-forest-labs/flux-1.1-pro',
    name: 'FLUX 1.1 Pro',
    desc: '고품질 결과, 커스텀 해상도 지원',
    supportsBatch: false,
    maxOutputs: 1,
    supportsCustomSize: true,
    maxWidth: 1440,
    maxHeight: 1440,
    sizeMultiple: 32,
    aspectRatios: [
      'custom',
      '1:1',
      '16:9',
      '3:2',
      '2:3',
      '4:5',
      '5:4',
      '9:16',
      '3:4',
      '4:3',
    ],
    supportsGuidance: false,
    defaultSteps: null,
    maxSteps: null,
    supportsImg2Img: false,
    resolutionOptions: null,
  },
  {
    id: 'flux-2-pro',
    replicateId: 'black-forest-labs/flux-2-pro',
    name: 'FLUX.2 Pro',
    desc: '최신 상위 품질, 최대 2048px',
    supportsBatch: false,
    maxOutputs: 1,
    supportsCustomSize: true,
    maxWidth: 2048,
    maxHeight: 2048,
    sizeMultiple: 16,
    aspectRatios: [
      'custom',
      '1:1',
      '16:9',
      '3:2',
      '2:3',
      '4:5',
      '5:4',
      '9:16',
      '3:4',
      '4:3',
    ],
    supportsGuidance: false,
    defaultSteps: null,
    maxSteps: null,
    supportsImg2Img: true,
    resolutionOptions: ['0.5 MP', '1 MP', '2 MP', '4 MP'],
  },
  {
    id: 'seedream-4.5',
    replicateId: 'bytedance/seedream-4.5',
    name: 'Seedream 4.5',
    desc: 'ByteDance 계열, 4K 대응',
    supportsBatch: false,
    maxOutputs: 1,
    supportsCustomSize: false,
    maxWidth: 0,
    maxHeight: 0,
    sizeMultiple: 0,
    aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'],
    supportsGuidance: false,
    defaultSteps: null,
    maxSteps: null,
    supportsImg2Img: false,
    resolutionOptions: null,
  },
  {
    id: 'ideogram-v3-turbo',
    replicateId: 'ideogram-ai/ideogram-v3-turbo',
    name: 'Ideogram V3 Turbo',
    desc: '텍스트와 타이포 표현에 강점',
    supportsBatch: false,
    maxOutputs: 1,
    supportsCustomSize: false,
    maxWidth: 0,
    maxHeight: 0,
    sizeMultiple: 0,
    aspectRatios: [
      '1:1',
      '16:9',
      '9:16',
      '4:3',
      '3:4',
      '3:2',
      '2:3',
      '4:5',
      '5:4',
      '2:1',
      '1:2',
      '16:10',
      '10:16',
      '3:1',
      '1:3',
    ],
    supportsGuidance: false,
    defaultSteps: null,
    maxSteps: null,
    supportsImg2Img: false,
    resolutionOptions: null,
  },
  {
    id: 'recraft-v4',
    replicateId: 'recraft-ai/recraft-v4',
    name: 'Recraft V4',
    desc: '브랜딩과 그래픽 스타일에 강점',
    supportsBatch: false,
    maxOutputs: 1,
    supportsCustomSize: false,
    maxWidth: 0,
    maxHeight: 0,
    sizeMultiple: 0,
    aspectRatios: [
      '1:1',
      '4:3',
      '3:4',
      '3:2',
      '2:3',
      '16:9',
      '9:16',
      '1:2',
      '2:1',
      '14:10',
      '10:14',
      '4:5',
      '5:4',
      '6:10',
    ],
    supportsGuidance: false,
    defaultSteps: null,
    maxSteps: null,
    supportsImg2Img: false,
    resolutionOptions: null,
  },
];

export const MODEL_MAP: Record<string, ModelDef> = Object.fromEntries(
  MODELS.map((model) => [model.id, model])
);

export const RATIO_PIXELS: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1344, height: 768 },
  '9:16': { width: 768, height: 1344 },
  '21:9': { width: 1536, height: 640 },
  '9:21': { width: 640, height: 1536 },
  '4:3': { width: 1152, height: 896 },
  '3:4': { width: 896, height: 1152 },
  '3:2': { width: 1216, height: 832 },
  '2:3': { width: 832, height: 1216 },
  '4:5': { width: 896, height: 1088 },
  '5:4': { width: 1088, height: 896 },
  '1:2': { width: 768, height: 1536 },
  '2:1': { width: 1536, height: 768 },
  '1:3': { width: 512, height: 1536 },
  '3:1': { width: 1536, height: 512 },
  '16:10': { width: 1280, height: 800 },
  '10:16': { width: 800, height: 1280 },
  '14:10': { width: 1120, height: 800 },
  '10:14': { width: 800, height: 1120 },
  '6:10': { width: 768, height: 1280 },
};

export const NODE_BASE_WIDTH = 152;
export const NODE_MIN_HEIGHT = 60;
export const NODE_MAX_HEIGHT = 280;

export function getNodeDisplaySize(
  aspectRatio: string | null,
  width?: number | null,
  height?: number | null
): { w: number; h: number } {
  let ratio = 1;

  if (width && height && width > 0 && height > 0) {
    ratio = height / width;
  } else if (aspectRatio) {
    const preset = RATIO_PIXELS[aspectRatio];

    if (preset) {
      ratio = preset.height / preset.width;
    } else {
      const parts = aspectRatio.split(':').map(Number);
      if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
        ratio = parts[1] / parts[0];
      }
    }
  }

  const heightValue = Math.round(NODE_BASE_WIDTH * ratio);

  return {
    w: NODE_BASE_WIDTH,
    h: Math.max(NODE_MIN_HEIGHT, Math.min(NODE_MAX_HEIGHT, heightValue)),
  };
}
