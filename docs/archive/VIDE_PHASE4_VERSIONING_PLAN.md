# VIDE Phase 4 버전 규칙 재설계 계획
작성일: 2026-03-25
현재 위치:
- 완료: `Phase 0 ~ Phase 3`
- 다음 단계: `Phase 4. version 규칙 재설계`

기준 문서:
- [VIDE_PURPOSE_REVIEW.md](C:/Work/Projects/Hire/visual_ide/VIDE_PURPOSE_REVIEW.md)
- [VIDE_IMPLEMENTATION_PREP.md](C:/Work/Projects/Hire/visual_ide/VIDE_IMPLEMENTATION_PREP.md)

## 1. 문서 목적
이 문서는 현재 VIDE의 `versionNumber`가 만들어내는 의미 혼선을 해소하고, 이후 `Event 모델`, `staging UX`, `전략 컨텍스트 확장`과 충돌 없이 이어질 수 있는 버전 규칙을 먼저 고정하기 위한 Phase 4 실행 계획서다.

이번 단계의 핵심 목표는 하나다.

> 하나의 숫자에 `식별`, `순서`, `브랜치 단계`, `설명 라벨` 역할을 동시에 맡기지 않는다.

## 2. 현재 상태 요약
현재 노드 생성 시 `versionNumber`는 “같은 project + 같은 direction의 active node 개수 + 1”로 계산된다.

근거:
- [nodes/route.ts](C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/nodes/route.ts)
- [ReparentNodeDialog.tsx](C:/Work/Projects/Hire/visual_ide/src/components/graph/ReparentNodeDialog.tsx)
- [types.ts](C:/Work/Projects/Hire/visual_ide/src/lib/types.ts)

이 구조의 문제는 다음과 같다.

1. `v7`이 브랜치의 7번째 단계라는 뜻이 아니다.
2. direction 기준이라, 다른 branch지만 같은 direction이면 같은 번호 체계 안에 섞인다.
3. 부모를 바꿔도 번호가 유지돼서 “순서”로 읽히기 어렵다.
4. 삭제와 archive 이후에도 번호 체계 설명력이 약하다.
5. UI가 `v번호`를 강한 식별자처럼 보여줘서 실제 의미보다 더 큰 신뢰를 준다.

즉, 현재의 `versionNumber`는 버전이라기보다 “레거시 표시 숫자”에 가깝다.

## 3. 이번 Phase의 목표
이번 Phase 4에서 달성해야 하는 목표는 아래 4가지다.

1. 노드마다 **변하지 않는 단조 증가 식별 순서**를 만든다.
2. 브랜치 맥락은 별도 정보로 보여주고, 하나의 숫자에 억지로 담지 않는다.
3. 삭제, archive, 복구, reparent 이후에도 의미가 무너지지 않게 한다.
4. 기존 데이터와 UI를 한 번에 깨지 않도록 additive-first로 이행한다.

## 4. 이번 Phase에서 하지 않는 것
이번 단계에서 의도적으로 하지 않는 것은 아래와 같다.

- `Event` 테이블 도입
- 비교 UI
- 브랜치 타임라인
- 최종 의사결정 로그
- staging tray
- direction/project 전략 필드 확장

이 Phase는 “버전의 의미를 정직하게 만들기”까지만 다룬다.

## 5. 권장 설계안
### 5.1 핵심 원칙
권장안은 `하나의 숫자`를 고치는 것이 아니라, 역할을 분리하는 것이다.

- **저장용 안정 식별 순서**: `nodeOrdinal`
- **브랜치 설명 정보**: 계산값
- **UI 표시 라벨**: 파생값

### 5.2 권장 데이터 모델
Phase 4에서는 아래 필드를 추가하는 것을 권장한다.

#### 저장 필드
- `Node.nodeOrdinal`
  - 프로젝트 단위 단조 증가 정수
  - 한 번 부여되면 절대 바뀌지 않음
  - delete, archive, restore, reparent 이후에도 유지

#### 계산 필드
- `rootOrdinal`
  - 루트 조상을 따라가 계산
- `lineageDepth`
  - 현재 노드가 루트에서 몇 단계 떨어졌는지 계산
- `siblingOrder`
  - 같은 부모 아래에서 생성 시점 기준 정렬해 계산

#### UI 표시
- 기본 badge: `v{nodeOrdinal}`
- 보조 정보:
  - `루트 v{rootOrdinal}`
  - `단계 {lineageDepth}`
  - 필요 시 `부모 아래 {siblingOrder}번째`

### 5.3 왜 이 방식이 좋은가
이 방식의 장점은 명확하다.

1. `nodeOrdinal`은 안정적이다.
2. 브랜치 설명은 별도 메타로 보여줄 수 있다.
3. reparent나 archive 이후에도 숫자 자체는 거짓말하지 않는다.
4. 이벤트 모델이 붙더라도 충돌이 적다.

### 5.4 이번 단계에서 권장하지 않는 설계
아래 설계는 이번 단계에서 피하는 것을 권장한다.

- `versionNumber`를 즉시 재해석해서 project-wide sequence로 덮어쓰기
- `v1.2.3` 같은 계층형 라벨을 저장 필드로 고정
- direction별 번호 체계를 유지한 채 UI 설명만 덧붙이기
- sibling order를 저장 필드로 먼저 고정

이유는 다음과 같다.

- 계층형 라벨은 reparent 시 의미가 흔들린다.
- direction 번호는 이미 문제의 원인이다.
- sibling order는 계산값으로 먼저 검증한 뒤 저장해도 늦지 않다.

## 6. 권장 스키마 변경
Phase 4 스키마 초안:

```prisma
model Node {
  // existing
  versionNumber Int @default(1) @map("version_number")

  // new
  nodeOrdinal   Int? @map("node_ordinal")

  @@index([projectId, nodeOrdinal])
}
```

초기에는 nullable로 추가하고, backfill 완료 후 non-null + uniqueness 검토를 권장한다.

권장 이행 순서:

1. `nodeOrdinal` nullable 추가
2. 기존 active + archived node 전체 backfill
3. create API에서 새 노드부터 `nodeOrdinal` 부여
4. UI가 `nodeOrdinal`을 우선 사용하도록 전환
5. 충분히 안정화된 후 `versionNumber`의 역할 축소 여부 결정

## 7. 백엔드 변경 범위
직접 영향 파일:

- [schema.prisma](C:/Work/Projects/Hire/visual_ide/prisma/schema.prisma)
- [types.ts](C:/Work/Projects/Hire/visual_ide/src/lib/types.ts)
- [mappers.ts](C:/Work/Projects/Hire/visual_ide/src/lib/mappers.ts)
- [nodes/route.ts](C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/nodes/route.ts)
- [[nodeId]/route.ts](C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/nodes/[nodeId]/route.ts)
- [[nodeId]/restore/route.ts](C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/nodes/[nodeId]/restore/route.ts)

### 7.1 생성 규칙
새 노드 생성 시 `projectId` 기준 최대 `nodeOrdinal` + 1을 부여한다.

중요:
- direction 기준 count를 더 이상 “버전” 의미로 사용하지 않는다.
- `nodeOrdinal`은 project-wide monotonic sequence로만 부여한다.

### 7.2 reparent 규칙
부모 변경 시:

- `nodeOrdinal` 유지
- `versionNumber`도 우선 유지
- 브랜치 정보는 계산 결과만 달라짐

즉, reparent는 계보를 바꾸지만, 노드의 생성 순번 정체성은 바꾸지 않는다.

### 7.3 archive / restore 규칙
- archive해도 `nodeOrdinal` 유지
- restore해도 `nodeOrdinal` 유지
- 따라서 “삭제 후 번호 재사용” 문제를 원천 차단한다

## 8. UI 변경 범위
직접 영향 가능성이 큰 파일:

- [ImageNode.tsx](C:/Work/Projects/Hire/visual_ide/src/components/graph/ImageNode.tsx)
- [DetailPanel.tsx](C:/Work/Projects/Hire/visual_ide/src/components/detail/DetailPanel.tsx)
- [VariationPanel.tsx](C:/Work/Projects/Hire/visual_ide/src/components/detail/VariationPanel.tsx)
- [ReparentNodeDialog.tsx](C:/Work/Projects/Hire/visual_ide/src/components/graph/ReparentNodeDialog.tsx)
- [ArchiveSettingsPanel.tsx](C:/Work/Projects/Hire/visual_ide/src/components/layout/ArchiveSettingsPanel.tsx)

### 8.1 UI 원칙
UI는 이제 `v번호 하나만 크게` 보여주지 말고, 아래처럼 분리해서 보여주는 것을 권장한다.

- 주 배지: `v{nodeOrdinal}`
- 보조 텍스트:
  - `루트 v12`
  - `깊이 2단계`
  - `부모: v9`

### 8.2 즉시 바꿔야 하는 문구
특히 아래 문구는 위험하다.

- “부모만 변경합니다. direction과 버전 번호는 그대로 유지됩니다.”

이 문구는 새 체계 기준으로 다음처럼 바꾸는 것이 좋다.

- “부모만 변경합니다. 노드의 고유 순번은 유지되고, 계보 정보만 다시 계산됩니다.”

## 9. 데이터 마이그레이션 계획
### 9.1 backfill 원칙
기존 노드에 대한 `nodeOrdinal`은 아래 기준으로 backfill한다.

- project 단위
- `createdAt ASC`, `id ASC` 순 정렬
- 1부터 순차 부여

이 기준의 장점:

- 사람이 이해하기 쉽다
- archived node 포함 여부가 명확하다
- 복구 후에도 순서가 뒤틀리지 않는다

### 9.2 uniqueness
backfill 완료 후 권장 조건:

- `(project_id, node_ordinal)` unique

단, 첫 migration에서는 nullable + index까지만 넣고, backfill 확인 후 두 번째 migration에서 unique를 걸어도 된다.

## 10. PR 분할 권장안
Phase 4는 최소 2개, 권장 3개 PR로 나누는 편이 안전하다.

### PR A. schema + backfill + API
범위:
- Prisma schema
- migration
- mapper
- type
- node create path

목표:
- 새 필드를 저장 가능하게 만들기

### PR B. UI 표시 전환
범위:
- 노드 카드
- detail panel
- reparent dialog
- archive panel

목표:
- UI가 더 이상 `versionNumber`를 과잉 해석하지 않게 만들기

### PR C. cleanup + copy
범위:
- 레거시 문구 정리
- fallback 제거 여부 판단
- QA 문서 갱신

## 11. 수동 검증 체크리스트
### 생성
- 새 root node 생성 시 `nodeOrdinal`이 증가한다
- 같은 direction에 새 node를 만들어도 기존 번호를 재사용하지 않는다

### variation
- 부모가 있는 node를 생성해도 `nodeOrdinal`은 전역 증가한다
- detail panel에서 루트/깊이 정보가 올바르게 보인다

### reparent
- 부모 변경 후 `nodeOrdinal`은 유지된다
- lineage depth와 parent 표시는 새 구조 기준으로 바뀐다

### archive / restore
- archive 후 복구해도 `nodeOrdinal`이 유지된다
- 복구한 node가 새 번호를 받지 않는다

### 전체
- `npm run lint`
- `npm run build`
- 주요 UI에서 레거시 문구가 남아 있지 않은지 확인

## 12. 완료 기준
Phase 4는 아래 조건을 만족할 때 완료로 본다.

1. 새 노드에 project-wide monotonic sequence가 부여된다.
2. reparent, archive, restore가 그 sequence를 깨지 않는다.
3. UI가 버전 숫자를 branch step처럼 오해하게 만들지 않는다.
4. 기존 데이터가 backfill 이후 안정적으로 조회된다.
5. 다음 `Event 모델` Phase와 충돌하지 않는다.

## 13. 다음 Phase와의 연결
Phase 4가 끝나면 그다음은 자연스럽게 `Phase 5: Event 모델`로 이어진다.

이유는 분명하다.

- `Prompt provenance`는 이미 분리되었다.
- `nodeOrdinal`이 생기면 이벤트 대상 식별도 더 안정적이 된다.
- 이후 decision / feedback / comparison 기록이 “어느 버전에 대해 일어난 일인가”를 더 정직하게 연결할 수 있다.

## 14. 권장 결론
다음 구현은 곧바로 코드에 들어가기보다, **이 문서를 기준으로 `PR A: schema + backfill + API`부터 시작하는 방식**이 가장 안전하다.

현재 컨텍스트 기준으로 Phase 진행 상태는 다음과 같다.

- 완료: `Phase 1 save honesty`
- 완료: `Phase 2 archive safety`
- 완료: `Phase 3 prompt provenance`
- 다음 착수: `Phase 4 versioning redesign`

즉, 지금은 전체 로드맵의 “기록이 정직해진 뒤, 기록의 버전 의미를 바로잡는 단계”에 와 있다.
