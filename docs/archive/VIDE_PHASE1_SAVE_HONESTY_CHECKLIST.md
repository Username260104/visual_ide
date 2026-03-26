# VIDE Phase 1 실행 체크리스트

작성일: 2026-03-25  
단계: `Phase 1. 기록의 정직성 확보`  
기준 문서:
- [VIDE_PURPOSE_REVIEW.md](C:/Work/Projects/Hire/visual_ide/VIDE_PURPOSE_REVIEW.md)
- [VIDE_IMPLEMENTATION_PREP.md](C:/Work/Projects/Hire/visual_ide/VIDE_IMPLEMENTATION_PREP.md)

## 1. 문서 목적

이 문서는 `VIDE_PURPOSE_REVIEW.md`에서 제안한 개선사항 중 가장 먼저 적용해야 하는 `기록의 정직성 확보`를 충돌 없이 구현하기 위한 코드 수준 체크리스트다.

이번 단계의 목표는 단순하다.

1. 저장 실패가 콘솔에만 남지 않게 한다.
2. 디자이너가 지금 상태가 `저장 중`, `저장 완료`, `저장 실패` 중 무엇인지 바로 알 수 있게 한다.
3. 실패 시 클라이언트 상태와 서버 상태가 조용히 어긋나지 않게 한다.
4. 이 단계에서는 스키마 변경 없이 해결한다.

## 2. 이번 단계의 범위

이번 Phase 1에서 직접 다루는 범위는 아래로 제한한다.

- `Node` 수정 저장 정직성
- `Node` 삭제 저장 정직성
- `Direction` 수정 저장 정직성
- `Direction` 삭제 저장 정직성
- 저장 상태를 보여주는 최소 UX

이번 단계에서 하지 않는다.

- Prisma schema 변경
- `prompt -> userIntent / resolvedPrompt` 분리
- soft delete / archive 도입
- event 모델 추가
- 생성 결과 staging UX
- 비교 화면, 브랜치 접기, 검색 강화

## 3. 현재 코드 기준 핵심 리스크

현재 구현은 대부분 `optimistic update + fire-and-forget` 패턴이다. 즉, 화면은 먼저 바뀌고 서버 실패는 뒤늦게 콘솔로만 남는다.

직접 영향 파일:

- [nodeStore.ts](C:/Work/Projects/Hire/visual_ide/src/stores/nodeStore.ts)
- [directionStore.ts](C:/Work/Projects/Hire/visual_ide/src/stores/directionStore.ts)
- [DetailPanel.tsx](C:/Work/Projects/Hire/visual_ide/src/components/detail/DetailPanel.tsx)
- [NodeGraph.tsx](C:/Work/Projects/Hire/visual_ide/src/components/graph/NodeGraph.tsx)
- [ImageNode.tsx](C:/Work/Projects/Hire/visual_ide/src/components/graph/ImageNode.tsx)
- [Sidebar.tsx](C:/Work/Projects/Hire/visual_ide/src/components/layout/Sidebar.tsx)
- [StatusBar.tsx](C:/Work/Projects/Hire/visual_ide/src/components/layout/StatusBar.tsx)
- [uiStore.ts](C:/Work/Projects/Hire/visual_ide/src/stores/uiStore.ts)

특히 위험한 지점은 아래와 같다.

- `nodeStore.updateNode`: 로컬을 먼저 바꾸고, 실패해도 롤백이나 사용자 알림이 없다.
- `nodeStore.deleteNode`: 노드를 먼저 제거한 뒤 실패 시 복구하지 않는다.
- `directionStore.updateDirection`: 수정 실패가 콘솔에만 남는다.
- `directionStore.deleteDirection`: 삭제 실패 시 direction이 이미 로컬에서 사라질 수 있다.
- [DetailPanel.tsx](C:/Work/Projects/Hire/visual_ide/src/components/detail/DetailPanel.tsx): 메모 입력이 매 키 입력마다 전송되어 실패/성공 상태가 사용자에게 보이지 않는다.
- [Sidebar.tsx](C:/Work/Projects/Hire/visual_ide/src/components/layout/Sidebar.tsx): direction 삭제가 `연결 노드 해제 -> direction 삭제`의 다단계 작업인데, 각 단계 실패가 UX에 드러나지 않는다.

## 4. Phase 1 구현 원칙

### 4.1 스키마를 건드리지 않는다

이번 단계는 DB schema, migration, Prisma type을 바꾸지 않는다. 저장 정직성은 현재 모델 위에서 먼저 해결한다.

### 4.2 새 토스트 시스템보다 기존 `StatusBar`를 우선 활용한다

현재 레이아웃에는 이미 [StatusBar.tsx](C:/Work/Projects/Hire/visual_ide/src/components/layout/StatusBar.tsx)가 존재한다. Phase 1의 1차 저장 피드백은 여기에 붙이는 것이 가장 안전하다.

이유:

- 새 전역 알림 시스템을 만들지 않아도 된다.
- 모든 저장 상태를 한 군데에서 보여줄 수 있다.
- 레이아웃 변경 범위가 작다.

권장 UX:

- 평상시: `노드 N개 / 방향 N개 / 줌`
- 저장 중: `저장 중...`
- 저장 완료 직후: `저장됨`
- 저장 실패: `저장 실패: 메모가 저장되지 않았습니다`

### 4.3 mutation 종류별로 저장 전략을 다르게 가져간다

모든 저장을 같은 방식으로 처리하면 UX가 오히려 나빠질 수 있다. 이번 단계에서는 mutation 성격에 따라 아래처럼 나눈다.

| 작업 | 권장 방식 | 이유 |
| --- | --- | --- |
| 상태 변경 | 낙관적 갱신 + 실패 시 롤백 | 선택형 입력이라 롤백이 자연스럽다 |
| direction 변경 | 낙관적 갱신 + 실패 시 롤백 | 선택형 입력이라 롤백이 자연스럽다 |
| 노드 위치 변경 | 낙관적 갱신 + 실패 시 롤백 | 드래그 UX는 즉시 반응성이 중요하다 |
| 메모 입력 | 로컬 draft 유지 + 지연 저장 또는 blur 저장 | 매 키 입력 롤백은 UX를 해친다 |
| 노드 삭제 | 비관적 삭제 | 사라졌다가 되돌아오는 UX가 더 혼란스럽다 |
| direction 삭제 | 비관적 삭제 + 실패 시 전체 동기화 | 다단계 작업이라 부분 실패 복구가 어렵다 |

## 5. 권장 상태 모델

### 5.1 `uiStore`에 저장 피드백 상태를 추가한다

별도 notification 시스템을 만들지 말고 [uiStore.ts](C:/Work/Projects/Hire/visual_ide/src/stores/uiStore.ts)에 아래 수준의 상태를 추가한다.

권장 필드 예시:

```ts
type SaveLifecycle = 'idle' | 'saving' | 'saved' | 'error';

interface SaveFeedbackEntry {
  key: string;
  entityType: 'node' | 'direction';
  entityId: string;
  action:
    | 'note'
    | 'status'
    | 'direction'
    | 'position'
    | 'delete'
    | 'name'
    | 'color'
    | 'bulk-delete';
  status: SaveLifecycle;
  message?: string;
  updatedAt: number;
}
```

최소 액션:

- `startSave(entry)`
- `markSaveSuccess(key, message?)`
- `markSaveError(key, message)`
- `clearSaveFeedback(key)`
- `clearExpiredSuccess()`

### 5.2 키 전략을 단순하게 유지한다

권장 키 예시:

- `node:123:note`
- `node:123:status`
- `node:123:direction`
- `node:123:position`
- `node:123:delete`
- `direction:456:update`
- `direction:456:delete`

이번 단계에서는 과도하게 일반화하지 않는다. `mutation queue`, `offline sync`, `retry worker` 같은 구조는 만들지 않는다.

## 6. 파일별 실행 체크리스트

## 6.1 [uiStore.ts](C:/Work/Projects/Hire/visual_ide/src/stores/uiStore.ts)

해야 할 일:

- 저장 피드백 상태 저장 필드 추가
- 저장 시작/성공/실패/정리 액션 추가
- 최근 저장 상태 1건을 조회하는 selector를 만들지, 배열 자체를 StatusBar에서 가공할지 결정

권장 방향:

- `saveFeedbackByKey: Record<string, SaveFeedbackEntry>` 형태를 추천
- StatusBar가 최근 갱신 1건을 읽을 수 있도록 작은 selector helper를 함께 둔다

하지 말 것:

- domain store와 강하게 결합된 비즈니스 로직 넣기
- `project`, `node`, `direction` 전체 데이터를 여기 옮기기

## 6.2 [StatusBar.tsx](C:/Work/Projects/Hire/visual_ide/src/components/layout/StatusBar.tsx)

해야 할 일:

- 저장 상태를 시각적으로 노출
- 저장 중/성공/실패에 따라 문구와 색상 토큰 분기
- 기존 `nodeCount`, `directionCount`, `zoomLevel` 정보는 유지

권장 표시 우선순위:

1. 에러가 있으면 에러 우선
2. 저장 중이 있으면 저장 중 표시
3. 최근 성공이 있으면 짧게 성공 표시
4. 그 외엔 기본 정보 표시

권장 문구 예시:

- `저장 중...`
- `저장됨`
- `저장 실패: 상태 변경이 저장되지 않았습니다`

권장 구현 메모:

- 성공 상태는 1.5초에서 2초 사이 자동 소거
- 실패 상태는 사용자가 다시 작업하거나 명시적으로 닫기 전까지 조금 더 오래 보이게 유지

## 6.3 [nodeStore.ts](C:/Work/Projects/Hire/visual_ide/src/stores/nodeStore.ts)

해야 할 일:

- 현재 `void` 기반 mutation을 `Promise` 기반으로 바꾸거나, 최소한 내부에서 `await` 가능한 경로를 따로 만든다
- discrete update와 delete를 분리해 처리 전략을 명확히 한다
- 저장 시작/성공/실패를 `uiStore`에 기록한다

권장 작업 순서:

1. 내부 공용 helper를 만든다. 예: `runNodeMutation`
2. discrete update용 helper를 만든다. 예: `updateNodeWithRollback`
3. delete용 helper를 만든다. 예: `deleteNodeWithPending`

권장 세부 규칙:

- 상태 변경, direction 변경, 위치 변경은 기존 값을 snapshot으로 잡고 실패 시 local rollback
- 성공 시 서버 응답값으로 다시 store를 덮어써서 local drift를 줄인다
- 실패 시 `console.error`만 하지 말고 사용자 메시지를 남긴다

삭제 관련 권장 규칙:

- 노드를 먼저 UI에서 지우지 않는다
- 삭제 요청 시작 시 `deleting` 상태를 저장 피드백으로 노출한다
- 서버 성공 후에만 실제 store에서 제거한다

주의:

- [ReparentNodeDialog.tsx](C:/Work/Projects/Hire/visual_ide/src/components/graph/ReparentNodeDialog.tsx)의 `patchNode`는 이미 `Promise` 기반이다
- 이번 단계에서는 `patchNode`를 강제로 같은 구조로 합치기보다, 우선 `updateNode/deleteNode` 경로를 안정화하는 데 집중한다

## 6.4 [directionStore.ts](C:/Work/Projects/Hire/visual_ide/src/stores/directionStore.ts)

해야 할 일:

- `updateDirection`에 rollback과 저장 피드백 연결
- `deleteDirection`을 비관적 삭제로 전환

권장 규칙:

- 수정은 기존 값 snapshot 저장 후 실패 시 롤백
- 삭제는 서버 성공 전까지 목록에서 제거하지 않음

주의:

- direction 삭제는 실제로 [Sidebar.tsx](C:/Work/Projects/Hire/visual_ide/src/components/layout/Sidebar.tsx)에서 노드 업데이트와 함께 묶여 동작하므로, store 단독 수정만으로 끝나지 않는다

## 6.5 [DetailPanel.tsx](C:/Work/Projects/Hire/visual_ide/src/components/detail/DetailPanel.tsx)

해야 할 일:

- 메모 입력을 로컬 draft 기반으로 바꾼다
- `node.note`를 textarea에 직접 바인딩하는 현재 구조를 끊는다
- 저장 중/실패 상태를 메모 영역에서 최소한으로 보여준다

권장 UX:

- 입력 중: textarea는 로컬 draft 유지
- blur 또는 debounce 시 저장 요청
- 저장 중이면 `저장 중...`
- 저장 실패면 `저장 실패, 다시 시도 필요`

권장 이유:

- 현재처럼 매 키 입력마다 store를 바꾸면 실패 시 롤백이 입력 경험을 깨뜨린다
- 메모는 discrete select와 달리 draft 보존이 중요하다

함께 점검할 것:

- 상태 변경 selector
- direction selector
- 노트 섹션 라벨 아래에 작은 상태 문구를 붙일 위치

## 6.6 [NodeGraph.tsx](C:/Work/Projects/Hire/visual_ide/src/components/graph/NodeGraph.tsx)

해야 할 일:

- 드래그 후 위치 저장 실패 시 노드 위치를 복원할 수 있게 snapshot 기반 처리 확인
- 컨텍스트 메뉴 삭제를 비관적 삭제 흐름으로 맞춘다

권장 검토 포인트:

- 위치 저장이 drag stop 시점 1회인지 확인
- 실패 시 현재 React Flow 좌표와 store 좌표를 어떻게 동기화할지 정리

안전 장치:

- 롤백 후 그래프가 어긋나면 `setNodes` 수준 임시 보정 대신 store 기준 재렌더를 우선 고려

## 6.7 [ImageNode.tsx](C:/Work/Projects/Hire/visual_ide/src/components/graph/ImageNode.tsx)

해야 할 일:

- 인라인 상태 변경 액션이 있다면 `updateNode`의 Promise/rollback 정책과 충돌하지 않는지 점검
- 저장 중일 때 중복 클릭이 가능한지 확인

주의:

- 이 파일은 시각 상태와 상호작용이 섞여 있을 가능성이 높아, 저장 정직성 변경이 node 카드 반응성과 충돌하지 않게 봐야 한다

## 6.8 [Sidebar.tsx](C:/Work/Projects/Hire/visual_ide/src/components/layout/Sidebar.tsx)

해야 할 일:

- direction 삭제 로직을 `fire-and-forget`에서 `순차 await` 흐름으로 바꾼다
- 다단계 실패 시 부분 성공 상태를 조용히 남기지 않게 한다

권장 삭제 순서:

1. 삭제 대상 direction과 연결된 node 목록 snapshot 확보
2. UI에 `direction 삭제 중...` 표시
3. 연결 노드의 `directionId -> null` 작업을 순차 또는 `Promise.allSettled`로 수행
4. 하나라도 실패하면 direction 삭제 중단
5. 실패 시 `loadNodes`와 `loadDirections`를 다시 호출해 전체 동기화
6. 모든 해제가 성공한 경우에만 direction 삭제 요청
7. direction 삭제 성공 후 최종 성공 메시지 표시

중요:

- 이 다단계 작업은 rollback보다 `재동기화`가 더 안전하다
- 이번 단계에서는 server-side transaction을 새로 만들지 않는다

## 6.9 [clientApi.ts](C:/Work/Projects/Hire/visual_ide/src/lib/clientApi.ts)

현재 [clientApi.ts](C:/Work/Projects/Hire/visual_ide/src/lib/clientApi.ts)는 `ApiError`와 메시지 추출 구조를 이미 갖고 있다. 이 파일은 최소 수정만 권장한다.

점검 항목:

- `ApiError.message`를 UI 메시지로 그대로 써도 되는지 검토
- 공통 오류 메시지 포맷 함수가 필요하면 작게 추가

하지 말 것:

- fetch layer 전체를 다시 설계하기
- retry, cancellation, interceptor 구조를 이번 단계에 도입하기

## 7. 구현 순서 권장안

가장 안전한 순서는 아래와 같다.

1. [uiStore.ts](C:/Work/Projects/Hire/visual_ide/src/stores/uiStore.ts)에 저장 피드백 상태 추가
2. [StatusBar.tsx](C:/Work/Projects/Hire/visual_ide/src/components/layout/StatusBar.tsx)에 저장 상태 표시 추가
3. [nodeStore.ts](C:/Work/Projects/Hire/visual_ide/src/stores/nodeStore.ts)의 discrete update 안정화
4. [DetailPanel.tsx](C:/Work/Projects/Hire/visual_ide/src/components/detail/DetailPanel.tsx)의 메모 draft 분리
5. [NodeGraph.tsx](C:/Work/Projects/Hire/visual_ide/src/components/graph/NodeGraph.tsx) 위치 저장 실패 복원
6. [nodeStore.ts](C:/Work/Projects/Hire/visual_ide/src/stores/nodeStore.ts)의 delete를 비관적 삭제로 전환
7. [directionStore.ts](C:/Work/Projects/Hire/visual_ide/src/stores/directionStore.ts) 수정/삭제 안정화
8. [Sidebar.tsx](C:/Work/Projects/Hire/visual_ide/src/components/layout/Sidebar.tsx)의 다단계 direction 삭제 재작성
9. 전체 수동 검증

한 번에 너무 많이 건드리지 않기 위해 PR도 최소 2개로 쪼개는 것을 권장한다.

- PR A: 저장 피드백 인프라 + node discrete update
- PR B: note draft + delete 흐름 + direction delete 안정화

## 8. 수동 검증 체크리스트

## 8.1 성공 시나리오

- 노트 수정 후 저장 중/저장 완료가 보인다
- 상태 변경 후 저장 완료가 보인다
- direction 변경 후 저장 완료가 보인다
- 노드 위치 변경 후 저장 완료가 보인다
- 노드 삭제 후 성공 시에만 카드가 사라진다
- direction 삭제 후 성공 시에만 목록에서 사라진다

## 8.2 실패 시나리오

- 노트 저장 실패 시 입력값이 조용히 사라지지 않는다
- 상태 변경 실패 시 이전 값으로 복원되며 실패 메시지가 보인다
- direction 변경 실패 시 이전 값으로 복원되며 실패 메시지가 보인다
- 위치 저장 실패 시 원래 좌표로 돌아가거나 재동기화된다
- 노드 삭제 실패 시 노드가 사라지지 않는다
- direction 삭제 중 일부 노드 해제가 실패하면 direction 삭제가 중단되고 전체 재동기화된다

## 8.3 회귀 체크

- `npm run build`
- `npm run lint`
- 프로젝트 최초 진입 로딩
- 노드 선택/상세 패널 열기
- variation 만들기 기본 동작
- generate dialog 열기/닫기

## 9. 완료 기준

Phase 1은 아래 조건을 만족해야 완료로 본다.

1. 위 범위 내 mutation 실패가 더 이상 콘솔에만 남지 않는다.
2. 디자이너가 화면에서 저장 상태를 확인할 수 있다.
3. 실패 시 local state와 server state가 조용히 어긋나지 않는다.
4. schema 변경 없이 `build`와 `lint`를 통과한다.
5. 이후 Phase 2, Phase 3 작업과 충돌할 만한 과도한 추상화를 만들지 않는다.

## 10. 이번 단계에서 일부러 하지 말아야 할 것

아래는 유혹적이지만 이번 PR 범위를 불필요하게 키우므로 보류한다.

- shadcn toast 도입
- 범용 mutation framework 구축
- queue / offline sync / retry 정책 추가
- server action 전면 전환
- schema 변경 동반한 저장 로그 테이블 추가
- direction 삭제를 위한 새로운 transaction API 추가

## 11. 다음 단계로 자연스럽게 이어지는 산출물

Phase 1이 끝나면 다음 문서를 바로 이어서 만들 수 있어야 한다.

- `Phase 2 destructive action 안전화` 상세 체크리스트
- `prompt provenance` schema 초안
- `event 모델` 최소 필드 초안

즉, 이번 단계의 핵심은 기능을 많이 만드는 것이 아니라 `현재 기록을 믿을 수 있는 상태`를 만드는 것이다.
