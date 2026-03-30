# VIDE Lightweight Node Sync Plan

## Purpose

VIDE 캔버스에 피그마급 협업 엔진을 바로 넣지 않고, 가장 가벼운 방식으로 "다른 사용자의 노드 위치 변경이 몇 초 안에 보이는 상태"를 먼저 만든다.

이번 문서는 현재 코드 기준 최종 검토와 1차 구현 범위를 함께 정리한 최신 결정 문서다.

## Final Review

결론부터 말하면 현재 요구사항에는 큰 구조적 blocker가 없다.

다만 이번 단계는 "실시간 협업"이 아니라 "가벼운 자동 수렴"으로 정의해야 한다.

즉:

- 다른 사용자의 노드 위치 변경이 짧은 간격 안에 반영된다.
- 같은 노드를 동시에 움직여도 앱이 충돌 에러로 뻗기보다는 마지막 저장값 기준으로 수렴한다.
- 커서 공유, 드래그 중 실시간 전파, 편집 잠금, CRDT 같은 피그마급 기능은 이번 범위에 넣지 않는다.

현재 서버의 노드 PATCH는 위치를 단순 덮어쓰는 구조이므로, 동시 이동 시 기본 동작은 `last write wins`다. 이 동작은 이번 1차 목표와는 충돌하지 않는다.

## Scope

이번 1차 구현 범위:

- 활성 프로젝트 화면에서 노드 목록을 주기적으로 재동기화
- 위치뿐 아니라 노드 단위의 서버 반영 결과를 몇 초 내 수렴
- 로딩 화면이나 캔버스 UX를 흔들지 않는 조용한 백그라운드 동기화

이번 범위에서 제외:

- 웹소켓
- Supabase Realtime
- 사용자 presence
- 드래그 중 실시간 위치 브로드캐스트
- 충돌 감지 및 병합
- direction 목록의 주기 동기화

## Final Architecture

### 1. Focused polling only

프로젝트가 `ready` 상태일 때만 노드 재동기화를 시작한다.

- 기본 간격: `2500ms`
- 브라우저 탭이 visible일 때만 실행
- 이전 요청이 끝나지 않았으면 다음 요청은 건너뜀

이 방식은 불필요한 중복 요청을 막으면서도 체감상 "몇 초 안에 따라오는" 동작을 만든다.

### 2. Silent node reload

기존 `loadNodes()`는 초기 진입 로딩 상태까지 함께 제어했다.

폴링에 그대로 쓰면 백그라운드 동기화가 화면 로딩 상태를 건드릴 수 있으므로, 이번 단계에서는 `silent` 옵션을 추가해 조용한 재로드를 지원한다.

원칙:

- 초기 진입: 기존 로딩 UX 유지
- 백그라운드 동기화: 로딩 UI 미표시

### 3. Skip polling while node save is pending

노드 저장이 진행 중일 때 폴링이 끼어들면, 서버에 아직 반영되지 않은 옛 데이터를 다시 받아와서 optimistic UI가 잠깐 되돌아가는 문제가 생길 수 있다.

이를 막기 위해 이번 단계에서는 `saveFeedbackByKey` 기준으로 node 저장이 `saving` 상태일 때 폴링을 건너뛴다.

이 가드는 아래 케이스를 안정화한다.

- 위치 저장 중
- 노트 저장 중
- 상태 변경 저장 중
- 타입 변경 저장 중
- direction 변경 저장 중

### 4. Guard against stale project responses

프로젝트를 빠르게 전환할 때 이전 프로젝트의 늦은 응답이 새 프로젝트 상태를 덮는 레이스가 발생할 수 있다.

이번 정리에서는 `nodeStore`, `directionStore` 모두 현재 `projectId`가 요청 시점의 프로젝트와 같을 때만 응답을 반영하도록 가드를 추가한다.

이 조치는 폴링 기능과 별개로 프로젝트 전환 안전성을 높인다.

## Implemented Changes

### `src/hooks/useProjectLoader.ts`

- `NODE_SYNC_INTERVAL_MS = 2500`
- `ready` 상태에서만 노드 폴링 시작
- hidden 탭에서는 polling skip
- in-flight 요청 중복 방지
- node 저장 중이면 polling skip
- 백그라운드에서는 `loadNodes(projectId, { silent: true })` 사용

### `src/stores/nodeStore.ts`

- `loadNodes(projectId, options?: { silent?: boolean })`로 확장
- silent reload 시 로딩 UI를 건드리지 않도록 조정
- 늦게 도착한 다른 프로젝트 응답 무시

### `src/stores/directionStore.ts`

- 프로젝트 전환 중 늦게 도착한 이전 응답 무시

## Why This Is Enough For Now

이번 단계의 목표는 "다중 사용자 협업 엔진"이 아니라 "같은 프로젝트를 여러 명이 열어도 너무 오래 어긋나지 않는 상태"다.

그 기준에서는 polling 기반 접근이 충분히 합리적이다.

이유:

- 구현이 작다.
- 현재 Next.js + Prisma 구조와 잘 맞는다.
- 서버 구조를 크게 바꾸지 않는다.
- 실패 시 되돌리기 쉽다.
- 추후 웹소켓 기반으로 올릴 때도 현재 polling guard와 store 정리는 재사용 가능하다.

## Known Limits

이번 방식의 한계는 명확하다.

- 같은 노드를 동시에 움직이면 마지막 저장값 기준으로 덮인다.
- 드래그 중인 움직임이 실시간으로 흐르듯 보이지는 않는다.
- 노드 수가 많아질수록 전체 목록 재조회 비용이 증가한다.
- direction 자체 변경은 주기 동기화 대상이 아니다.

즉, 이번 구현은 "협업 느낌"의 출발점이지 최종형이 아니다.

## Manual Check List

릴리즈 전 수동 확인 항목:

- 같은 프로젝트를 브라우저 두 개에서 열고 한쪽에서 노드를 이동했을 때 다른 쪽에 2.5초 내 반영되는지
- 한쪽에서 노드를 연속 이동할 때 저장 실패 없이 수렴하는지
- 노트 저장 직후 polling 때문에 이전 값으로 잠깐 되돌아가지 않는지
- 프로젝트 A에서 B로 빠르게 이동했을 때 이전 프로젝트 노드가 섞여 보이지 않는지
- hidden 탭 상태에서 불필요한 요청이 줄어드는지

## Rollout Decision

이번 기능은 바로 운영 가능한 최소안으로 본다.

단, 아래 조건이 보이면 다음 단계로 넘어간다.

- 같은 프로젝트 동시 작업자가 늘어남
- 드래그 반영 지연에 대한 불만이 생김
- 전체 노드 재조회 비용이 커짐
- direction 변경 실시간성이 필요해짐

## Next Step If We Upgrade

2차 확장 우선순위:

1. `updatedAt` 또는 `revision` 기반 delta fetch
2. directions 주기 동기화 또는 이벤트 기반 refresh
3. drag 중 위치 브로드캐스트
4. 웹소켓 또는 Supabase Realtime
5. presence와 충돌 처리

현재로서는 1번 이전에는 더 무거운 설계를 넣지 않는다.
