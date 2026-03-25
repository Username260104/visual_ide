# VIDE 목적 적합성 재검토 보고서

작성일: 2026-03-25

본 문서는 최초 재검토 보고서와 [VIDE_CLAUDE_REVIEW.md](C:/Work/Projects/Hire/visual_ide/VIDE_CLAUDE_REVIEW.md)의 독립 리뷰를 교차 검증하여 통합한 개정판이다.

## 요약

이 앱은 자신의 목적 중 절반에는 꽤 잘 맞고, 나머지 절반에는 아직 구조적으로 부족합니다.

- 다수의 AI 이미지 버전을 시각적으로 계보화하고 관리하는 도구로서는 이미 강한 MVP입니다.
- 브랜딩 에이전시의 암묵지를 소실 없이 축적하는 시스템으로 보기에는 아직 핵심 계층이 빠져 있습니다.

정밀 재검토 후의 평가는 다음과 같습니다.

- 버전 및 분기 관리: 7.5/10
- 소규모~중간 규모 프로젝트에서의 인지부하 절감: 6.5/10
- 암묵지 포착력: 3/10
- 지식의 무손실 보존: 2.5/10
- 실제 이미지 수정 워크플로 적합성: 4/10
- 종합 목적 적합성: 5/10

다만 이 점수는 상대 비교용 보조 지표일 뿐이며, 실제 판단은 `적합 / 부분 적합 / 부적합`의 질적 구분으로 읽는 편이 더 정직합니다.

현재 이 제품을 가장 정확하게 설명하면 다음과 같습니다.

> AI 이미지 탐색을 위한 유망한 분기-버전 시각화 캔버스이지만, 브랜딩 에이전시의 제도적 기억 시스템으로 보기에는 아직 부족하다.

여기에 한 가지를 더 보태면, 현재 시스템의 더 큰 위험은 "없는 기능" 그 자체보다 "기록되었다고 믿게 하지만 실제로는 신뢰할 수 없는 기록"을 만드는 기능들입니다.

## 검토 범위와 방법

이번 재검토에서는 아래 네 가지 질문을 중심으로 구현을 다시 읽었습니다.

1. 이미지 버전이 많이 쌓일 때 디자이너의 작업 기억 부담을 실제로 줄여주는가?
2. 순서, 분기, 출처를 시간이 지나도 읽히는 방식으로 보존하는가?
3. 개인 메모 수준을 넘어, 에이전시 단위에서 활용 가능한 의사결정 과정과 이유를 담아내는가?
4. "생성하고 수정하여 최종 이미지로 수렴"한다는 실제 워크플로와 구현이 일치하는가?

검토 대상은 Prisma 스키마, 상태 저장소, 프로젝트/노드/디렉션 API, 그래프/디테일/생성 UI, 생성 파이프라인 전반입니다. 또한 `npm run build`로 빌드 성공 여부를 확인했고, 별도로 작성된 Claude 독립 리뷰와 교차 검증하여 "빠진 기능"뿐 아니라 "잘못된 신뢰를 주는 기능"까지 다시 점검했습니다.

## 핵심 논지

이 앱이 가장 잘한 판단은 "기본 단위는 파일이 아니라, 계보와 메타데이터를 가진 이미지 노드"라고 본 점입니다. 이 판단 자체는 매우 좋습니다.

다만 현재 시스템이 주로 저장하는 것은 다음입니다.

- 어떤 이미지가 존재하는가
- 어디서 왔는가
- 어떤 분기나 방향에 속하는가
- 간단한 메모나 상태 이유

반면 충분히 저장하지 못하는 것은 다음입니다.

- 누가 어떤 결정을 했는가
- 왜 판단이 바뀌었는가
- 어떤 피드백이 분기를 만들었는가
- 어떤 대안끼리 비교되었는가
- 기각된 안에서 무엇을 배웠는가
- 브랜드 전략과 클라이언트 맥락이 어떻게 제약으로 작동했는가

이 차이가 곧 "유용한 버전 캔버스"와 "조직의 암묵지를 축적하는 시스템" 사이의 차이입니다.

그리고 이번 통합 재검토에서 더 선명해진 점은, 현재의 위험이 단순한 기능 부재에만 있지 않다는 것입니다. 몇몇 기능은 사용자가 "기록됐다", "버전이 있다", "분류가 유지된다"고 믿게 만들지만, 실제로는 그 의미나 저장 성공이 충분히 보장되지 않습니다. 암묵지 시스템에서는 이 지점이 특히 치명적입니다.

## 현재 앱이 잘하고 있는 점

### 1. 버전 계보를 폴더나 파일명이 아니라 데이터 모델로 다룬다

`Node` 모델은 `parentNodeId`, `directionId`, 상태, 메타데이터, 캔버스 위치를 함께 저장합니다. 이 문제를 다루는 방식으로는 매우 적절한 출발입니다.

근거:

- `prisma/schema.prisma:45-46`의 `Node.parentNodeId`, `Node.directionId`
- `src/components/graph/NodeGraph.tsx:84`의 부모-자식 엣지 렌더링
- `src/components/graph/ReparentNodeDialog.tsx:54`의 부모 재지정 로직

의미:

- 디자이너의 머릿속에 있던 관계 기억을 도구 바깥으로 꺼냅니다.
- 단순 자산 목록이 아니라 분기 탐색 과정을 구조로 표현할 수 있습니다.

### 2. 업로드 이미지와 AI 생성 이미지를 같은 그래프 모델 아래 통합한다

이 앱은 수동 업로드 이미지와 AI 생성 이미지를 동일한 노드 타입으로 취급합니다. 실제 에이전시 업무에 매우 중요한 판단입니다.

근거:

- `prisma/schema.prisma:49`의 `source`
- `src/hooks/useImageDrop.ts`의 업로드 플로우
- `src/components/layout/GenerateDialog.tsx:173-181`의 초기 생성 노드 생성
- `src/components/detail/VariationPanel.tsx:176-187`의 변형 생성 노드 생성

의미:

- 실제 작업은 대부분 하이브리드입니다.
- Midjourney, Replicate, Photoshop 결과물을 별도 체계로 분리하지 않고 하나의 작업 계보 안에서 볼 수 있습니다.

### 3. 작업 세션 중의 맥락 복원 능력은 꽤 좋다

그래프, direction 색상, 루트/자식 구조, 오른쪽 상세 패널, 이미지 미리보기는 "지금 내가 어디까지 왔는가"를 빠르게 복원하는 데 도움이 됩니다.

근거:

- `src/components/graph/NodeGraph.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/graph/ImageNode.tsx`
- `src/components/detail/DetailPanel.tsx`

이 부분은 현재 제품의 가장 강한 가치입니다. 적어도 작업 중 디자이너의 단기 기억을 덜어주는 방향은 분명히 잡혀 있습니다.

## stated purpose 대비 부족한 지점

### 1. 현재 상태는 남기지만, 의사결정의 이력은 남기지 않는다

가장 큰 구조적 한계입니다.

노드 편집은 기존 레코드를 덮어씁니다. 별도의 이벤트 로그, 감사 추적, 리뷰 기록, 피드백 엔티티, 비교 기록이 없습니다.

근거:

- 도메인 모델이 사실상 `Project`, `Direction`, `Node` 세 개뿐입니다. `prisma/schema.prisma:10`, `:24`, `:38`
- 노드 PATCH가 현재 값을 직접 갱신합니다. `src/app/api/projects/[id]/nodes/[nodeId]/route.ts:53-68`
- direction PATCH도 직접 갱신입니다. `src/app/api/projects/[id]/directions/[dirId]/route.ts:11-18`

의미:

- 메모가 바뀌면 이전 메모는 사라집니다.
- `promising`에서 `dropped`로 상태가 바뀌어도 그 변화 과정 자체는 저장되지 않습니다.
- direction이 바뀌어도 왜 재분류했는지는 남지 않습니다.

즉, 현재 앱은 "지식의 무손실 축적"이 아니라 "최신 상태의 시각화된 보관"에 더 가깝습니다.

### 2. 의사결정 근거의 표현력이 너무 얇다

현재 노드에 남는 판단 관련 정보는 사실상 아래뿐입니다.

- `intentTags`
- `changeTags`
- `note`
- `statusReason`

근거:

- `prisma/schema.prisma:60-66`
- 메모 편집 `src/components/detail/DetailPanel.tsx:149-155`
- 상태 이유 입력 조건 `src/components/detail/StatusSelector.tsx:25-31`, `:97`

왜 부족한가:

- 에이전시의 암묵지는 "왜 final인가" 혹은 "왜 dropped인가"만으로 구성되지 않습니다.
- 클라이언트 반응, 내부 비평, 브랜드 적합 기준, 팀 간 논의, 기각 사유의 축적이 핵심입니다.
- 현재 구조는 이를 1급 데이터로 다루지 못합니다.

결과적으로 이 앱은 "조직적 학습"보다는 "조각난 메모 축적"에 가까운 형태로 지식을 남기게 됩니다.

### 3. 누가 무엇을 했는지 알 수 없다

데이터 모델과 API에서 사용자 식별, 작성자, 리뷰어, 승인자, 협업 주체 추적 필드를 찾지 못했습니다.

근거:

- 앱 코드와 스키마 전반에서 `userId`, `createdBy`, `updatedBy`, `reviewer`, `author`, `collaborator` 등 협업 주체 필드 부재

의미:

- 나중에 "이 판단은 누가 내렸는가", "어떤 아트디렉터의 피드백이었는가", "누가 이 브랜치를 기각했는가"를 복원할 수 없습니다.
- 조직의 암묵지는 사람과 맥락을 잃는 순간 재사용성이 크게 떨어집니다.

### 4. "수정"보다는 "새 변형 생성"에 더 가깝다

말씀하신 목적은 생성 후 수정하여 최종 이미지로 가는 흐름입니다. 하지만 현재 구현은 기존 이미지를 조건으로 삼아 편집하는 방식보다는, 부모 프롬프트를 기반으로 새 변형을 재생성하는 방식에 가깝습니다.

근거:

- 변형 요청은 부모 이미지 자체가 아니라 `parentPrompt`, 태그, 메모, 모델, 비율을 보냅니다. `src/components/detail/VariationPanel.tsx:160-167`
- variation API는 새 프롬프트를 만들고 일반 생성 입력을 구성합니다. `src/app/api/generate-variation/route.ts:35-50`
- 입력 빌더는 텍스트 프롬프트와 크기 관련 값만 세팅합니다. `src/lib/imageGeneration.ts:98-121`
- 모델 정의에는 `supportsImg2Img`가 있으나 실제 파이프라인에서 쓰이지 않습니다. `src/lib/constants.ts:67`

의미:

- 현재 앱은 "탐색적 브랜치 생성"에는 적합하지만, "기존 이미지의 세밀한 수정" 워크플로에는 아직 충분히 맞지 않습니다.
- 브랜딩 실무에서는 이 차이가 매우 큽니다.

### 5. 재현성과 프롬프트 provenance가 모두 부족하다

스키마에는 `seed` 필드가 있으나 실제 생성 경로에서는 시드를 포함한 재현성 핵심 정보가 충분히 남지 않습니다. 더 근본적으로는, 사용자 의도와 AI가 해석한 최종 프롬프트가 분리 저장되지 않습니다.

근거:

- 스키마는 `seed`를 지원합니다. `prisma/schema.prisma:51`
- 노드 생성 API도 `seed`를 받을 수 있습니다. `src/app/api/projects/[id]/nodes/route.ts:52`
- 상세 패널에서도 시드 표시 로직이 있습니다. `src/components/detail/DetailPanel.tsx:437-438`
- 그러나 generate-image API는 `imageUrls`만 반환합니다. `src/app/api/generate-image/route.ts:59`
- GenerateDialog는 `guidance`, `steps`, `resolution`을 API로 보내지만, 노드 저장 시에는 `prompt`, `modelUsed`, `aspectRatio`, 일부 크기 정도만 남깁니다. `src/components/layout/GenerateDialog.tsx:154-180`
- VariationPanel도 `prompt`, `modelUsed`, `aspectRatio`, 태그, 메모 정도만 저장합니다. `src/components/detail/VariationPanel.tsx:176-187`
- `AI 개선` 버튼은 사용자 프롬프트를 AI가 재작성한 결과로 textarea를 덮어씁니다. `src/components/layout/GenerateDialog.tsx:121-125`
- variation 생성도 부모 프롬프트, 태그, 메모를 바탕으로 새 프롬프트를 생성하지만, 변환 전후의 관계를 별도 메타데이터로 보존하지 않습니다. `src/app/api/generate-variation/route.ts:35-39`, `:62`

의미:

- 과거 결과물을 동일 조건으로 다시 재현하기 어렵습니다.
- 장기적인 조직 기억 시스템으로서 신뢰성이 낮아집니다.
- 사람이 처음 쓴 의도와 AI가 해석하여 만든 실행 프롬프트가 하나의 `prompt` 필드로 합쳐집니다.
- 따라서 "디자이너가 지시한 결과"와 "AI가 해석한 결과"를 나중에 구분하기 어렵습니다.

### 6. Direction이 전략 객체가 아니라 시각적 버킷에 가깝다

현재 `Direction`은 사실상 이름과 색상만 가집니다.

근거:

- `prisma/schema.prisma:24-34`
- 생성 UI `src/components/layout/DirectionDialog.tsx`

의미:

- 현재 direction은 "색이 있는 분류 라벨"에 가깝고, "전략적 방향성"을 담는 객체는 아닙니다.
- 브랜드 의미, 의도 감정, 적합 기준, 금지 요소, 대표 레퍼런스 같은 정보가 direction에 귀속되지 않습니다.
- 더 나아가 variation 생성 시 자식 노드는 부모의 `directionId`를 자동 상속합니다. `src/components/detail/VariationPanel.tsx:184`
- 즉, 의미적으로는 이미 다른 방향으로 이탈한 변형도 사용자가 수동으로 재분류하지 않으면 기존 direction 안에 계속 남습니다.

이 점은 큰 기회 손실입니다. 원래 direction은 조직의 암묵지를 담는 가장 강한 컨테이너가 될 수 있기 때문입니다.

### 7. 브랜드/프로젝트 컨텍스트가 운영 맥락으로 작동하지 않는다

프로젝트에는 `name`, `description`, `thumbnailUrl`이 있지만, 이 정보가 생성이나 리뷰 과정의 능동적 제약 조건으로 거의 작동하지 않습니다. 설정 영역도 아직 placeholder입니다.

근거:

- 프로젝트 필드 `prisma/schema.prisma:12-16`
- 설정 placeholder `src/components/layout/Sidebar.tsx:170`
- `thumbnailUrl`은 매핑, 프로젝트 카드 표시, 프로젝트 PATCH API 외에는 거의 쓰이지 않습니다.

의미:

- 브랜드 브리프가 작업 흐름 안으로 들어와 있지 않습니다.
- 프로젝트 컨텍스트는 라벨 수준이지, 판단 엔진 수준은 아닙니다.

### 8. 파괴적 삭제가 가능하여 "소실 없이 축적"과 충돌한다

이건 목적 진술과 직접 충돌하는 부분입니다.

근거:

- 노드 삭제는 하드 삭제입니다. `src/app/api/projects/[id]/nodes/[nodeId]/route.ts:81-85`
- 부모 노드를 지우면 자식의 `parentNodeId`가 `null`이 되는 구조입니다. `prisma/schema.prisma:78`
- direction 삭제 시 해당 노드들의 `directionId`를 전부 `null`로 바꾼 뒤 direction을 삭제합니다. `src/app/api/projects/[id]/directions/[dirId]/route.ts:33-35`

의미:

- 역사적으로 중요한 분기 구조가 사라질 수 있습니다.
- 기각된 안도 "폐기된 지식"이 아니라 "학습 자산"이어야 하는데, 현재는 쉽게 구조를 잃습니다.

이 제품 비전에서는 삭제보다 보관과 아카이브가 기본이어야 합니다.

### 9. 버전 번호가 실제 branch sequence를 뜻하지 않는다

새 노드의 `versionNumber`는 부모-자식 깊이가 아니라, 같은 프로젝트 내 동일 direction 노드 수를 기준으로 계산됩니다.

근거:

- 카운트 기준 `src/app/api/projects/[id]/nodes/route.ts:41`
- `versionNumber: count + 1` `src/app/api/projects/[id]/nodes/route.ts:62`
- 부모 변경 시에도 버전 번호와 direction은 유지된다고 UI에서 명시합니다. `src/components/graph/ReparentNodeDialog.tsx:99`

의미:

- `v7`이 "이 브랜치의 7번째 단계"라는 뜻이 아닐 수 있습니다.
- 표면적으로는 정밀해 보이지만, 실제 의미는 느슨한 라벨에 가깝습니다.
- 더 나아가 이 로직은 삭제나 이동 이후에도 의미를 보장하지 못합니다.
- 노드 삭제 후 동일 direction에서 새 노드를 만들면 이전 번호가 다시 나올 수 있고, 노드를 다른 direction으로 옮겨도 번호는 유지됩니다.
- 또한 count와 create가 분리되어 있어 동시 생성 시 같은 번호가 부여될 경쟁 조건도 있습니다.

### 10. 실제 에이전시 규모로 커질 때 다시 인지부하가 올라갈 가능성이 크다

코드상 검색, 비교, 히스토리, 타임라인, 리뷰 큐, 브랜치 접기, 고급 필터링 기능을 찾지 못했습니다. 그래프는 현재 메모리에 로드된 노드를 한 번에 렌더링합니다.

근거:

- `Object.values(nodesById)` 기반 렌더링 `src/components/graph/NodeGraph.tsx:42`
- 사이드바는 direction 수와 미분류 수 중심입니다. `src/components/layout/Sidebar.tsx:24-37`
- 별도 검색/비교/리뷰 모듈 부재

의미:

- 수십 장 수준에서는 유용할 수 있습니다.
- 수백 장 이상의 실제 분기 탐색에서는 다시 그래프 혼잡이 커질 수 있습니다.

### 11. 프로젝트 최신성 추적과 최종안 표면화가 약하다

운영적으로 중요한 부분이지만 현재는 약합니다.

근거:

- 프로젝트 목록 정렬은 `updatedAt` 기준입니다. `src/app/api/projects/route.ts:8`
- 프로젝트 카드는 `updatedAt`과 `thumbnailUrl`을 표시합니다. `src/components/projects/ProjectCard.tsx:36-39`, `:96`
- 그러나 노드나 direction 수정이 `Project.updatedAt`을 갱신하는 로직은 보이지 않습니다.
- `thumbnailUrl`도 자동으로 최종안과 연결되는 로직을 찾지 못했습니다.

추론:

- 저장소 밖에 DB 트리거나 별도 처리 로직이 없다면, 실제 작업 최신성이 프로젝트 카드에 반영되지 않을 수 있습니다.
- "현재 최선의 결과물"이 프로젝트 수준에서 자동 승격되지 않기 때문에 팀 관점에서 읽기 어렵습니다.

### 12. 일부 mutation route는 신뢰 경계가 일관되지 않다

이 부분은 제품 개념보다는 시스템 신뢰성 문제지만, 지식 시스템은 신뢰 가능해야 하므로 중요합니다.

근거:

- node PATCH는 해당 node가 route의 project에 속하는지 확인합니다. `src/app/api/projects/[id]/nodes/[nodeId]/route.ts:13-19`
- 하지만 node DELETE는 같은 검증 없이 바로 삭제합니다. `src/app/api/projects/[id]/nodes/[nodeId]/route.ts:81-85`
- direction PATCH/DELETE도 route project 소속 검증이 없습니다. `src/app/api/projects/[id]/directions/[dirId]/route.ts`

의미:

- 현재는 단일 사용자/단일 프로젝트 환경이라 체감되지 않을 수 있지만, 향후 무결성 리스크가 됩니다.

### 13. 저장 실패가 사용자에게 드러나지 않아 "축적된 것처럼 보이는" 문제가 있다

이 부분은 클로드 리뷰가 가장 날카롭게 짚은 지점이며, 저도 중요도를 높게 봅니다.

현재 `updateNode`, `deleteNode`, `updateDirection`, `deleteDirection`은 낙관적 갱신 후 서버 호출 실패를 `console.error`로만 처리합니다.

근거:

- `src/stores/nodeStore.ts:79-103`의 `updateNode`
- `src/stores/nodeStore.ts:106-118`의 `deleteNode`
- `src/stores/directionStore.ts:58-81`의 `updateDirection`
- `src/stores/directionStore.ts:83-95`의 `deleteDirection`

의미:

- 사용자는 상태 변경이나 메모 수정이 저장되었다고 믿습니다.
- 그러나 서버가 실패하면 UI는 성공처럼 유지되고, 다음 새로고침에서 값이 사라질 수 있습니다.
- 이는 "기록을 안 하는 것"보다 더 나쁜 문제입니다. 시스템이 "기록되었다"고 암묵적으로 말하기 때문입니다.

### 14. 분기는 보이지만, 실제 탐색의 순서는 보이지 않는다

현재 그래프는 부모-자식 관계는 잘 보여주지만, 형제 노드 간 어떤 순서로 시도했는지는 표현하지 못합니다.

근거:

- `children` 관계에 별도 순서 필드가 없습니다. `prisma/schema.prisma:78-79`
- `getChildren`은 필터만 하고 정렬 기준이 없습니다. `src/stores/nodeStore.ts:120-124`
- 그래프 렌더링에도 형제 탐색 순서를 드러내는 로직이 없습니다. `src/components/graph/NodeGraph.tsx`

의미:

- "A를 먼저 시도하고, B로 갔다가, 다시 A에서 C를 파생했다"는 시간적 서사를 복원하기 어렵습니다.
- 분기는 보여도, 탐색의 리듬과 맥락은 남지 않습니다.

### 15. AI는 중요한 참여자이지만, 시스템 안에서는 유령처럼 취급된다

현재 모델은 이미지의 출처가 `ai-generated`인지 `imported`인지 정도만 구분합니다. 하지만 실제로는 AI가 이미지 생성자일 뿐 아니라 프롬프트 해석자이기도 합니다.

근거:

- `source` 필드는 `ai-generated | imported` 수준입니다. `prisma/schema.prisma:49`
- 직접 프롬프트 생성, AI 개선 후 생성, variation 생성 모두 결과적으로는 동일한 `ai-generated`로 기록됩니다. `src/components/layout/GenerateDialog.tsx:176`, `src/components/detail/VariationPanel.tsx:179`
- 프롬프트 생성/개선 로직은 별도 존재하지만, 그 개입 정도가 메타데이터로 남지 않습니다. `src/lib/promptGeneration.ts`

의미:

- "디자이너가 직접 지시한 결과"와 "AI가 해석을 많이 개입한 결과"를 나중에 구분하기 어렵습니다.
- 이는 암묵지 관점에서 매우 중요합니다. 두 결과는 다른 종류의 학습을 의미하기 때문입니다.

### 16. 생성 파이프라인의 부분 실패가 고아 이미지를 만들 수 있다

이미지 생성과 저장이 부분 성공/부분 실패할 경우, 어떤 노드에도 연결되지 않은 파일이 스토리지에 남을 수 있습니다.

근거:

- 다수 생성은 병렬 `Promise.all`입니다. `src/lib/imageGeneration.ts:134-158`
- 저장도 병렬 `Promise.all`입니다. `src/lib/imageGeneration.ts:170-187`
- 업로드 성공 후 이를 되돌리는 삭제 함수는 보이지 않습니다. `src/lib/storage.ts`
- generate-image API는 catch에서 cleanup 없이 에러만 반환합니다. `src/app/api/generate-image/route.ts:60-63`

의미:

- 사용자는 생성 실패로 인식하지만, 실제 스토리지에는 일부 이미지가 이미 남아 있을 수 있습니다.
- 추적 불가능한 아티팩트가 쌓이면 운영 비용뿐 아니라 시스템의 신뢰성도 떨어집니다.

### 17. 캔버스 위치는 의미적 레이아웃이 아니라 수동 좌표에 가깝다

노드 위치는 DB에 저장되는 좌표이지만, 관계 변화에 따라 의미적으로 재정렬되는 구조는 아닙니다.

근거:

- `positionX`, `positionY`는 수동 저장 필드입니다. `prisma/schema.prisma:72-73`
- variation은 부모 기준 오프셋으로 배치됩니다. `src/components/detail/VariationPanel.tsx:188-191`
- 초기 생성은 단순 격자 배치입니다. `src/components/layout/GenerateDialog.tsx:182-185`
- 자동 재배치나 의미적 레이아웃 복원 로직은 보이지 않습니다.

의미:

- 프로젝트가 커질수록 공간 배치의 의미가 서서히 부식될 수 있습니다.
- 시각 도구에서 위치는 단순 좌표가 아니라 서사이므로, 이 문제는 시간이 갈수록 중요해집니다.

## 디자이너 UX 관점의 최종 보완 검토

위 항목들은 주로 제품 목적과 데이터 구조를 중심으로 분석한 결과다. 그러나 실제로 디자이너가 매일 사용하는 도구라는 점에서, "정보가 남는가" 못지않게 "작업 중 어떤 마찰을 겪는가"도 중요하다. 이 관점에서 보면 현재 VIDE는 개념적으로는 유망하지만, 실사용 UX에서 몇 가지 치명적인 거칠음이 남아 있다.

### 1. 저장 상태가 보이지 않아 사용자가 불안하다

현재 메모 수정, 상태 변경, direction 변경, 노드 위치 변경은 대부분 즉시 화면에 반영된다. 하지만 저장 중인지, 저장됐는지, 실패했는지 UI에서 알 수 없다.

근거:

- `src/stores/nodeStore.ts:79-103`
- `src/stores/directionStore.ts:58-81`
- `src/components/detail/DetailPanel.tsx:153`

디자이너 UX 관점의 문제:

- 디자이너는 "남겼다"고 믿고 넘어가지만, 실제로는 저장되지 않았을 수 있다.
- 특히 메모나 상태 이유처럼 사고 흔적을 기록하는 행위는 신뢰가 핵심인데, 지금 UX는 그 신뢰를 보장하지 못한다.

개선 방향:

- 필드 단위 저장 상태 표시
- 저장 중 스피너 또는 subtle badge
- 실패 시 즉시 토스트 + 재시도
- 자동 저장이라면 마지막 저장 시각 표시

### 2. 생성 결과가 바로 그래프를 오염시킨다

초기 생성과 변형 생성 모두 결과가 즉시 노드로 추가된다. "후보를 먼저 보고, 쓸 만한 것만 채택"하는 단계가 없다.

근거:

- `src/components/layout/GenerateDialog.tsx:173-181`
- `src/components/detail/VariationPanel.tsx:153-187`

디자이너 UX 관점의 문제:

- 좋은 안을 고르기 전에 그래프가 먼저 복잡해진다.
- 생성과 정리가 분리되지 않아, 탐색이 곧 정돈되지 않은 누적으로 이어진다.

개선 방향:

- 생성 결과를 먼저 tray 또는 staging area에 표시
- "노드로 추가"를 명시적 채택 행위로 분리
- 일괄 폐기 / 일괄 채택 / 비교 후 선택 지원

### 3. AI 개선 UX가 디자이너의 원문 흔적을 지운다

`AI 개선`은 원래 프롬프트를 바로 덮어쓴다.

근거:

- `src/components/layout/GenerateDialog.tsx:108-125`

디자이너 UX 관점의 문제:

- 내 초안이 사라진다.
- AI가 무엇을 바꿨는지 보이지 않는다.
- 결과가 좋아져도 학습이 안 되고, 결과가 나빠져도 어디서 틀어졌는지 알기 어렵다.

개선 방향:

- before / after 비교 UI
- "원문 유지", "AI 제안 적용", "부분 적용" 옵션
- diff 시각화

### 4. 부모 선택 UX가 규모에 취약하다

이미지 업로드 후 부모를 고르는 다이얼로그는 최신순 리스트, 작은 썸네일, `v번호`, 잘린 ID 정도만 보여준다.

근거:

- `src/components/graph/ParentSelectDialog.tsx:20`
- `src/components/graph/ParentSelectDialog.tsx:149`

디자이너 UX 관점의 문제:

- 노드가 많아지면 어떤 부모가 맞는지 찾기 어렵다.
- direction, 상태, 메모, 최근 작업 맥락이 안 보인다.
- 잘못 연결하면 계보 자체가 왜곡된다.

개선 방향:

- 검색
- direction 필터
- 현재 선택 중인 드롭 이미지 미리보기
- 부모 후보에 썸네일 + direction + 상태 + 메모 요약 표시

### 5. 삭제와 분류 해제의 위험이 UX에서 충분히 설명되지 않는다

노드 삭제와 direction 삭제는 시스템적으로도 위험하지만, UX적으로도 너무 가볍게 처리된다.

근거:

- `src/components/graph/NodeGraph.tsx:210-216`
- `src/components/layout/Sidebar.tsx:42-43`

디자이너 UX 관점의 문제:

- 삭제의 결과가 "이미지 하나 제거"가 아니라 "계보 구조 손상"일 수 있는데, 현재 confirm은 이 차이를 설명하지 못한다.
- direction 삭제도 "연결된 노드가 모두 미분류 처리된다"는 의미를 강하게 체감시키지 못한다.

개선 방향:

- 단순 confirm 대신 영향 요약 모달
- 삭제 대신 archive 기본화
- 실행 후 undo 제공

### 6. 상태(reason) 입력 UX가 실제 사고 흐름과 맞지 않는다

현재는 `final`과 `dropped`에서만 이유 입력의 강도가 올라간다.

근거:

- `src/components/detail/StatusSelector.tsx:25`
- `src/components/detail/StatusSelector.tsx:97`

디자이너 UX 관점의 문제:

- 실제로는 `promising`이 된 이유, direction을 바꾼 이유, 변형을 만든 이유가 더 자주 중요하다.
- 지금 UX는 사고의 중간 과정이 아니라 끝점만 기록하게 유도한다.

개선 방향:

- 상태 전이마다 짧은 이유를 남길 수 있게 하기
- direction 변경 시 이유를 받기
- 변형 생성 전 "왜 이 변형을 만드는가"를 더 구조적으로 받기

### 7. 프로젝트 설정이 살아 있는 작업 도구가 아니다

사이드바의 Settings는 존재하지만 실질적으로 비어 있다.

근거:

- `src/components/layout/Sidebar.tsx:170`

디자이너 UX 관점의 문제:

- 브랜드 가이드, 금지 요소, 목표 톤, 클라이언트 제약을 작업 중 바로 확인하거나 수정할 수 없다.
- 결국 디자이너는 다시 외부 문서와 기억에 의존한다.

개선 방향:

- 프로젝트 brief 패널
- 항상 참조 가능한 브랜드 제약 영역
- 생성/변형 시 brief를 컨텍스트로 노출

### 8. 업로드 실패가 사용자에게 보이지 않는다

드래그앤드롭 업로드는 일부 실패해도 콘솔에만 남는다.

근거:

- `src/hooks/useImageDrop.ts:70`

디자이너 UX 관점의 문제:

- 5장을 넣었는데 3장만 나타나면, 무엇이 실패했는지 알 수 없다.
- 사용자는 시스템 오류인지 자신의 실수인지 판단할 수 없다.

개선 방향:

- 업로드 결과 요약
- 실패 파일명 표시
- 재업로드 액션

### 9. 그래프 탐색 UX가 커질수록 급격히 힘들어진다

현재 그래프는 전체 노드를 다 보여주고, React Flow 기본 control 외에는 길찾기 도구가 거의 없다.

근거:

- `src/components/graph/NodeGraph.tsx:42`
- `src/components/graph/NodeGraph.tsx:252`

디자이너 UX 관점의 문제:

- 큰 프로젝트에서 "지금 봐야 할 것"보다 "모든 것"이 먼저 보인다.
- 비교와 선택보다 탐색 비용이 커진다.

개선 방향:

- final only / promising only 필터
- 선택 노드 주변만 집중하는 focus mode
- 브랜치 접기
- 비교 모드

### UX 관점의 종합 판단

현재 VIDE는 "구조는 맞는데, 디자이너가 안심하고 오래 쓰기엔 마찰이 남아 있는 도구"에 가깝다.

특히 UX적으로 가장 큰 문제는 다음 세 가지다.

1. 저장의 정직성이 사용자에게 보이지 않는다.
2. 생성 결과가 스테이징 없이 곧바로 캔버스를 복잡하게 만든다.
3. 파괴적 액션이 너무 가볍게 노출된다.

이 세 가지는 미학의 문제가 아니라, 실사용 지속성의 문제다. 디자이너가 도구를 믿지 못하면 기록도 남기지 않고, 기록을 남기지 않으면 이 제품의 핵심 가치가 무너진다.

## 목적 적합성에 대한 정밀 평가

### 이미 잘 맞는 부분

- 부모-자식 기반 버전 분기 시각화
- 업로드/생성 이미지 통합 관리
- 작업 중 맥락 복원
- 탐색형 워크플로 지원

### 부분적으로만 맞는 부분

- 왜 이 분기가 존재하는지의 설명
- direction의 의미 전달
- 생성 결과의 재현 가능성
- 프로젝트 수준의 최종안 표면화
- AI 개입 수준의 provenance 추적

### 아직 본질적으로 맞지 않는 부분

- 조직 암묵지의 무손실 축적
- 협업형 의사결정 과정 기록
- 실제 이미지 수정 중심 워크플로
- 대규모 프로젝트에서의 지속적 인지부하 절감
- 저장 실패를 정직하게 드러내는 기록 신뢰성

## 가장 중요한 결론

만약 목표가 다음이라면:

> "디자이너가 수많은 이미지 변형안을 다루면서 길을 잃지 않게 한다"

현재 앱은 이미 꽤 좋은 방향에 와 있습니다.

하지만 목표가 다음이라면:

> "브랜딩 에이전시 내부의 의사결정 분기, 과정, 이유, 암묵지를 소실 없이 축적한다"

현재 구조는 한 층이 비어 있습니다.

그리고 그 빈 층은 단순 UI 개선이 아니라, 조직의 기억을 표현하는 도메인 모델 계층입니다.

다만 통합 재검토를 거치며 한 가지 우선순위 조정이 필요해졌습니다. 새 계층을 얹기 전에 먼저 해야 할 일은, 현재 기록이 정직하게 저장되고 의미가 보존되도록 만드는 것입니다. 기록 시스템에서 "없는 기능"은 나중에 추가할 수 있지만, "기록된 것처럼 보이지만 신뢰할 수 없는 데이터"는 시스템 전체의 기반을 무너뜨립니다.

## 가장 레버리지가 큰 다음 단계

### 우선순위 1: 기록의 정직성부터 확보

가장 먼저 해결해야 할 것은 "저장되었다고 보이지만 실제로는 실패할 수 있는" 상태를 없애는 일입니다.

- 낙관적 갱신 실패 시 롤백 또는 사용자 알림
- 저장 중/저장 실패 상태 표시
- 재시도 UX 제공
- node/direction mutation route의 project ownership 검증 일관화

이 단계가 해결되지 않으면, 이후 어떤 이벤트 모델을 올려도 기반 데이터 자체를 신뢰하기 어렵습니다.

### 우선순위 2: `prompt`를 의도와 실행으로 분리

현재는 사람의 의도와 AI의 해석이 하나의 `prompt`로 합쳐집니다. 이를 분리해야 합니다.

- `userIntent`
- `resolvedPrompt`
- `promptSource` 또는 `promptTransform`
- AI 개입 여부와 개입 방식 메타데이터

이 변화는 재현성과 암묵지 해석력 모두를 동시에 끌어올립니다.

### 우선순위 3: 버전과 순서의 의미를 다시 설계

현재의 `versionNumber`는 강한 식별자처럼 보이지만 실제로는 그렇지 않습니다.

- 삭제 이후에도 재사용되지 않는 monotonic sequence 도입
- branch 또는 sibling 단위의 순서 필드 도입
- "언제 어떤 탐색 순서로 파생되었는가"를 표현할 수 있는 구조 추가

### 우선순위 4: 하드 삭제 대신 archive-first 구조로 전환

이 제품에서 삭제는 지식 손실과 거의 동의어입니다.

- soft delete / archived 상태
- 기본 뷰에서 숨김
- 복구 가능
- 계보 유지
- 부분 실패 시 업로드된 고아 파일 cleanup 정책 추가

### 우선순위 5: 이벤트 계층은 단순한 형태로 먼저 도입

이전 보고서에서는 여러 엔티티를 제안했지만, 통합 판단으로는 처음부터 세분화하기보다 하나의 다형적 `Event` 모델로 시작하는 편이 더 현실적입니다.

예:

- `Event`
- `type`: `decision`, `feedback`, `review`, `status-change`, `direction-change`, `comparison`
- `actor`
- `timestamp`
- `targetNodeId` / `targetDirectionId`
- `payload`

이후 실제 사용 패턴을 본 뒤 세분화하는 것이 안전합니다.

### 우선순위 6: Direction과 Project를 전략 객체로 승격

Direction과 Project는 단순 라벨이 아니라 전략 기억 컨테이너여야 합니다.

- direction thesis
- fit criteria
- anti-goal
- reference set
- project brief
- target audience
- client constraint

그리고 variation 생성 시 direction 자동 상속만 할 것이 아니라, 의미적 이탈을 감지하거나 재분류를 유도해야 합니다.

### 우선순위 7: 재현성 수준의 provenance와 실제 edit 워크플로 추가

최소한 다음은 저장되어야 합니다.

- 정확한 모델 ID 또는 버전
- seed
- guidance
- steps
- resolution
- aspect ratio
- source image reference
- prompt transformation input/output

그리고 "수정하여 최종안으로 간다"는 비전을 유지하려면, prompt-only variation을 넘어 source-image-conditioned edit 흐름이 필요합니다.

### 우선순위 8: 대규모 인지 관리 도구 추가

그래프가 실제 실무에서 오래 버티려면 다음이 필요합니다.

- 검색
- 비교
- 브랜치 접기
- 상태 필터
- 리뷰 큐
- final candidate 뷰
- timeline 또는 activity stream
- 의미적 재배치 또는 정렬 기능

그리고 UX 차원에서는 아래를 함께 묶어 추진해야 한다.

- 생성 결과 스테이징 영역
- 저장 상태 피드백
- archive/undo 중심의 안전한 파괴적 액션 UX
- 부모 선택 검색/필터
- AI 개선 before/after 비교

그렇지 않으면 노드 수가 늘수록 다시 인지부하가 올라갑니다.

## 최종 판정

이 앱은 목적과 어긋난 제품은 아닙니다. 오히려 "이미지 작업을 노드 계보 그래프로 본다"는 중심 통찰은 매우 좋습니다.

다만 현재는 목적의 운영적 측면은 어느 정도 충족하지만, 인식론적 측면, 즉 조직이 학습을 축적하는 기능은 아직 매우 약합니다.

현재의 VIDE는 다음에 가깝습니다.

- 좋은 시각적 버전 관리 MVP
- 약한 조직 기억 시스템

여기에 통합 리뷰를 통해 추가된 가장 중요한 문장은 다음입니다.

> 현재 VIDE의 더 큰 위험은 기능이 부족한 것보다, 이미 존재하는 기능이 "기록되었다", "버전이 있다", "분류가 유지된다"고 믿게 만들지만 실제로는 그 신뢰가 완전하지 않다는 점이다.

반대로 말하면, 먼저 기록의 정직성을 확보하고, 그 위에 이벤트 계층, 비파괴적 히스토리, 재현성 수준의 provenance, 실제 수정 워크플로를 쌓아 올린다면 이 앱은 말씀하신 브랜딩 에이전시용 도구와 훨씬 강하게 정렬될 수 있습니다.
