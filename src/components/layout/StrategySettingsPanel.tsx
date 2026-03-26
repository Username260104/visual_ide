'use client';

import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from 'react';
import { fetchJson } from '@/lib/clientApi';
import type { Direction, Project } from '@/lib/types';
import { useDirectionStore } from '@/stores/directionStore';
import { useNodeStore } from '@/stores/nodeStore';
import {
  createSaveFeedbackKey,
  useUIStore,
} from '@/stores/uiStore';

type ProjectStrategyField =
  | 'brief'
  | 'constraints'
  | 'targetAudience'
  | 'brandTone';
type DirectionStrategyField =
  | 'thesis'
  | 'fitCriteria'
  | 'antiGoal'
  | 'referenceNotes';

interface ProjectStrategyDraft {
  brief: string;
  constraints: string;
  targetAudience: string;
  brandTone: string;
}

interface DirectionStrategyDraft {
  thesis: string;
  fitCriteria: string;
  antiGoal: string;
  referenceNotes: string;
}

const PROJECT_FIELD_META: Array<{
  field: ProjectStrategyField;
  label: string;
  placeholder: string;
  rows: number;
}> = [
  {
    field: 'brief',
    label: '프로젝트 브리프',
    placeholder:
      '이번 프로젝트가 해결해야 할 목표와 핵심 메시지를 적어 주세요.',
    rows: 4,
  },
  {
    field: 'brandTone',
    label: '브랜드 톤',
    placeholder:
      '브랜드가 유지해야 할 인상과 무드를 정리해 주세요.',
    rows: 3,
  },
  {
    field: 'targetAudience',
    label: '타깃 오디언스',
    placeholder:
      '어떤 사람을 위한 이미지인지 구체적으로 적어 주세요.',
    rows: 3,
  },
  {
    field: 'constraints',
    label: '제약 조건',
    placeholder:
      '피해야 할 요소, 필수 요소, 실행 제약을 정리해 주세요.',
    rows: 4,
  },
];

const DIRECTION_FIELD_META: Array<{
  field: DirectionStrategyField;
  label: string;
  placeholder: string;
  rows: number;
}> = [
  {
    field: 'thesis',
    label: '방향 가설',
    placeholder:
      '이 방향이 왜 유효한지, 무엇을 노리는지 적어 주세요.',
    rows: 4,
  },
  {
    field: 'fitCriteria',
    label: '적합 기준',
    placeholder:
      '이 방향이 잘 됐다고 판단하는 기준을 적어 주세요.',
    rows: 3,
  },
  {
    field: 'antiGoal',
    label: '피해야 할 느낌',
    placeholder:
      '이 방향에서 나오면 안 되는 톤이나 요소를 적어 주세요.',
    rows: 3,
  },
  {
    field: 'referenceNotes',
    label: '참고 메모',
    placeholder:
      '레퍼런스 해석이나 추가 메모를 적어 주세요.',
    rows: 3,
  },
];

export function StrategySettingsPanel() {
  const nodeProjectId = useNodeStore((state) => state.projectId);
  const directionProjectId = useDirectionStore((state) => state.projectId);
  const directionsById = useDirectionStore((state) => state.directions);
  const startSaveFeedback = useUIStore((state) => state.startSaveFeedback);
  const markSaveFeedbackSuccess = useUIStore(
    (state) => state.markSaveFeedbackSuccess
  );
  const markSaveFeedbackError = useUIStore(
    (state) => state.markSaveFeedbackError
  );

  const projectId = nodeProjectId ?? directionProjectId;
  const directionList = useMemo(
    () => Object.values(directionsById),
    [directionsById]
  );

  const [project, setProject] = useState<Project | null>(null);
  const [projectDraft, setProjectDraft] = useState<ProjectStrategyDraft>({
    brief: '',
    constraints: '',
    targetAudience: '',
    brandTone: '',
  });
  const [projectLoadError, setProjectLoadError] = useState('');
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [selectedDirectionId, setSelectedDirectionId] = useState<string | null>(
    null
  );
  const [directionDrafts, setDirectionDrafts] = useState<
    Record<string, DirectionStrategyDraft>
  >({});

  const projectFeedbackKey = projectId
    ? createSaveFeedbackKey('project', projectId, 'update')
    : null;
  const projectFeedback = useUIStore((state) =>
    projectFeedbackKey ? state.saveFeedbackByKey[projectFeedbackKey] ?? null : null
  );
  const directionFeedbackKey = selectedDirectionId
    ? createSaveFeedbackKey('direction', selectedDirectionId, 'update')
    : null;
  const directionFeedback = useUIStore((state) =>
    directionFeedbackKey
      ? state.saveFeedbackByKey[directionFeedbackKey] ?? null
      : null
  );

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setProjectDraft({
        brief: '',
        constraints: '',
        targetAudience: '',
        brandTone: '',
      });
      setProjectLoadError('');
      setIsLoadingProject(false);
      return;
    }

    let cancelled = false;
    setProject(null);
    setIsLoadingProject(true);
    setProjectLoadError('');

    void fetchJson<Project>(`/api/projects/${projectId}`)
      .then((nextProject) => {
        if (cancelled) {
          return;
        }

        setProject(nextProject);
        setProjectDraft(extractProjectDraft(nextProject));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setProjectLoadError(
          error instanceof Error
            ? error.message
            : '프로젝트 전략 정보를 불러오지 못했습니다.'
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingProject(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    setDirectionDrafts((current) => {
      const next = { ...current };
      let changed = false;

      for (const direction of directionList) {
        if (!next[direction.id]) {
          next[direction.id] = extractDirectionDraft(direction);
          changed = true;
        }
      }

      for (const directionId of Object.keys(next)) {
        if (!directionsById[directionId]) {
          delete next[directionId];
          changed = true;
        }
      }

      return changed ? next : current;
    });

    setSelectedDirectionId((current) => {
      if (current && directionsById[current]) {
        return current;
      }

      return directionList[0]?.id ?? null;
    });
  }, [directionList, directionsById]);

  const selectedDirection = selectedDirectionId
    ? directionsById[selectedDirectionId] ?? null
    : null;
  const selectedDirectionDraft = selectedDirectionId
    ? directionDrafts[selectedDirectionId] ?? null
    : null;
  const projectMeta = getFeedbackMeta(projectFeedback);
  const directionMeta = getFeedbackMeta(directionFeedback);

  const saveProjectField = async (field: ProjectStrategyField) => {
    if (!projectId || !project) {
      return;
    }

    const nextValue = projectDraft[field];
    if (nextValue === project[field]) {
      return;
    }

    const feedbackKey = startSaveFeedback({
      entityType: 'project',
      entityId: projectId,
      action: 'update',
      message: `${getProjectFieldLabel(field)} 저장 중...`,
    });

    try {
      const updatedProject = await fetchJson<Project>(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: nextValue }),
      });

      setProject(updatedProject);
      setProjectDraft(extractProjectDraft(updatedProject));
      markSaveFeedbackSuccess(
        feedbackKey,
        `${getProjectFieldLabel(field)}이 저장되었습니다.`
      );
    } catch (error) {
      markSaveFeedbackError(
        feedbackKey,
        error instanceof Error
          ? error.message
          : `${getProjectFieldLabel(field)}을 저장하지 못했습니다.`
      );
    }
  };

  const saveDirectionField = async (field: DirectionStrategyField) => {
    if (!projectId || !selectedDirectionId || !selectedDirection || !selectedDirectionDraft) {
      return;
    }

    const nextValue = selectedDirectionDraft[field];
    if (nextValue === selectedDirection[field]) {
      return;
    }

    const feedbackKey = startSaveFeedback({
      entityType: 'direction',
      entityId: selectedDirectionId,
      action: 'update',
      message: `${getDirectionFieldLabel(field)} 저장 중...`,
    });

    try {
      const updatedDirection = await fetchJson<Direction>(
        `/api/projects/${projectId}/directions/${selectedDirectionId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: nextValue }),
        }
      );

      useDirectionStore.setState((state) => ({
        directions: {
          ...state.directions,
          [updatedDirection.id]: updatedDirection,
        },
      }));
      setDirectionDrafts((current) => ({
        ...current,
        [updatedDirection.id]: extractDirectionDraft(updatedDirection),
      }));
      markSaveFeedbackSuccess(
        feedbackKey,
        `${getDirectionFieldLabel(field)}이 저장되었습니다.`
      );
    } catch (error) {
      markSaveFeedbackError(
        feedbackKey,
        error instanceof Error
          ? error.message
          : `${getDirectionFieldLabel(field)}을 저장하지 못했습니다.`
      );
    }
  };

  if (!projectId) {
    return (
      <section
        className="rounded border p-3"
        style={{
          borderColor: 'var(--border-default)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          프로젝트를 불러오면 전략 설정을 편집할 수 있습니다.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <section
        className="rounded border p-3"
        style={{
          borderColor: 'var(--border-default)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div className="flex flex-col gap-1">
          <h3
            className="text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            프로젝트 전략
          </h3>
        </div>

        {isLoadingProject ? (
          <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            프로젝트 전략을 불러오는 중입니다.
          </p>
        ) : projectLoadError ? (
          <p className="mt-3 text-xs" style={{ color: 'var(--status-dropped)' }}>
            {projectLoadError}
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {PROJECT_FIELD_META.map((meta) => (
              <StrategyTextarea
                key={meta.field}
                label={meta.label}
                placeholder={meta.placeholder}
                rows={meta.rows}
                value={projectDraft[meta.field]}
                onChange={(value) =>
                  setProjectDraft((current) => ({ ...current, [meta.field]: value }))
                }
                onCommit={() => void saveProjectField(meta.field)}
              />
            ))}

            {projectMeta && (
              <p className="text-[10px]" style={{ color: projectMeta.color }}>
                {projectMeta.message}
              </p>
            )}
          </div>
        )}
      </section>

      <section
        className="rounded border p-3"
        style={{
          borderColor: 'var(--border-default)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div className="flex flex-col gap-1">
          <h3
            className="text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            방향 전략
          </h3>
        </div>

        {directionList.length === 0 ? (
          <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            아직 편집할 브랜치가 없습니다.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                편집할 브랜치
              </label>
              <select
                value={selectedDirectionId ?? ''}
                onChange={(event) => setSelectedDirectionId(event.target.value || null)}
                className="w-full rounded px-3 py-2 text-sm"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                }}
              >
                {directionList.map((direction) => (
                  <option key={direction.id} value={direction.id}>
                    {direction.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedDirection && selectedDirectionDraft ? (
              <>
                <div
                  className="rounded px-3 py-2 text-xs"
                  style={{
                    backgroundColor: 'var(--bg-active)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  현재 브랜치: <strong>{selectedDirection.name}</strong>
                </div>

                {DIRECTION_FIELD_META.map((meta) => (
                  <StrategyTextarea
                    key={meta.field}
                    label={meta.label}
                    placeholder={meta.placeholder}
                    rows={meta.rows}
                    value={selectedDirectionDraft[meta.field]}
                    onChange={(value) =>
                      setDirectionDrafts((current) => ({
                        ...current,
                        [selectedDirection.id]: {
                          ...current[selectedDirection.id],
                          [meta.field]: value,
                        },
                      }))
                    }
                    onCommit={() => void saveDirectionField(meta.field)}
                  />
                ))}

                {directionMeta && (
                  <p className="text-[10px]" style={{ color: directionMeta.color }}>
                    {directionMeta.message}
                  </p>
                )}
              </>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function StrategyTextarea({
  label,
  placeholder,
  rows,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  placeholder: string;
  rows: number;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      onCommit();
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onCommit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-none rounded px-3 py-2 text-sm focus:outline-none"
        style={{
          backgroundColor: 'var(--bg-input)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-default)',
        }}
      />
    </div>
  );
}

function extractProjectDraft(project: Project): ProjectStrategyDraft {
  return {
    brief: project.brief,
    constraints: project.constraints,
    targetAudience: project.targetAudience,
    brandTone: project.brandTone,
  };
}

function extractDirectionDraft(direction: Direction): DirectionStrategyDraft {
  return {
    thesis: direction.thesis,
    fitCriteria: direction.fitCriteria,
    antiGoal: direction.antiGoal,
    referenceNotes: direction.referenceNotes,
  };
}

function getProjectFieldLabel(field: ProjectStrategyField) {
  return PROJECT_FIELD_META.find((meta) => meta.field === field)?.label ?? field;
}

function getDirectionFieldLabel(field: DirectionStrategyField) {
  return DIRECTION_FIELD_META.find((meta) => meta.field === field)?.label ?? field;
}

function getFeedbackMeta(
  feedback:
    | {
        status: 'saving' | 'saved' | 'error';
        message: string;
      }
    | null
) {
  if (!feedback) {
    return null;
  }

  if (feedback.status === 'error') {
    return { color: 'var(--status-dropped)', message: feedback.message };
  }

  if (feedback.status === 'saved') {
    return { color: 'var(--status-final)', message: feedback.message };
  }

  return { color: 'var(--text-accent)', message: feedback.message };
}
