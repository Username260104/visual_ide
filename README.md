# VIDE

VIDE는 AI 이미지 작업을 위한 시각적 워크스페이스입니다.  
이미지를 단순 파일이 아니라 `노드(node)`로 다루고, 부모-자식 관계, 브랜치, 상태, 메모, 프롬프트, 비교 기록까지 함께 저장해 이미지 탐색 과정을 추적할 수 있도록 설계되었습니다.

현재 저장소 기준으로 VIDE는 다음 흐름을 지원합니다.

- 프로젝트를 만들고 브리프, 제약, 타깃, 브랜드 톤을 정리
- 캔버스에서 이미지 노드의 계보와 브랜치 구조를 시각적으로 관리
- Replicate 모델로 이미지를 생성하거나 기존 이미지를 변형
- 생성 결과를 바로 캔버스에 넣지 않고 `검토함(staging tray)`에서 비교 후 채택
- 노드별 상태, 타입, 태그, 메모, 프롬프트 출처, 소스 메타데이터 기록
- 활동 로그와 수동 이벤트 기록으로 결정 근거 보존
- 이미지 브릿지로 로컬 이미지 import/export 및 메타데이터 export
- 프로젝트, 브랜치, 노드 단위의 보관 및 복구

## 주요 기능

### 1. 시각적 이미지 계보 관리

- React Flow 기반 캔버스에서 노드 간 부모-자식 관계를 연결해 버전 흐름을 확인할 수 있습니다.
- 노드는 `moodboard`, `reference`, `main` 타입과 `reviewing`, `promising`, `final`, `dropped` 상태를 가집니다.
- 노드에는 프롬프트, 의도 태그, 변경 태그, 메모, 크기, 비율, 생성 모델 등의 정보가 함께 저장됩니다.

### 2. 브랜치 중심 탐색

- `Direction`을 통해 브랜치를 만들고, 각 브랜치에 thesis, fit criteria, anti-goal, reference notes를 연결할 수 있습니다.
- 사이드바에서 브랜치별로 노드를 필터링하며 탐색할 수 있습니다.

### 3. AI 생성 및 변형 워크플로우

- Replicate를 통해 이미지를 생성합니다.
- 현재 모델 목록은 FLUX.1 Schnell, FLUX.1 Dev, FLUX 1.1 Pro, FLUX.2 Pro, Seedream 4.5, Ideogram V3 Turbo, Recraft V4입니다.
- 변형 생성은 `prompt-only`, `image-to-image`, `inpaint` 모드를 지원합니다.
- Anthropic API가 설정되어 있으면 프롬프트 개선과 변형 프롬프트 생성을 보조합니다. API 키가 없어도 기본 fallback 문구로 동작합니다.

### 4. 검토함 기반 채택 흐름

- 생성 결과는 즉시 노드가 되지 않고 검토함에 쌓입니다.
- 후보 이미지를 비교하면서 채택/제외를 나누고, 채택 이유를 남긴 뒤 캔버스에 반영할 수 있습니다.
- 이 과정은 `comparison-recorded` 활동 이벤트로 기록됩니다.

### 5. 활동 로그와 보관함

- 노드 생성, 재배치, 상태 변경, 타입 변경, 브랜치 변경, 메모 저장, 보관/복구 등의 이벤트를 남깁니다.
- 프로젝트, 브랜치, 노드는 soft delete 방식으로 보관되며 복구 API가 준비되어 있습니다.

### 6. 이미지 브릿지

- 로컬 이미지를 업로드해 현재 프로젝트에 직접 추가할 수 있습니다.
- 선택한 노드 이미지를 파일로 export 하거나, 해당 노드 메타데이터를 JSON으로 export 할 수 있습니다.

## 기술 스택

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- Zustand
- React Flow
- Prisma 7
- PostgreSQL
- Supabase Database / Storage
- Replicate
- Anthropic SDK

## 빠른 시작

### 1. 요구 사항

- Node.js 20 이상 권장
- npm
- PostgreSQL 데이터베이스
- Supabase 프로젝트
- Replicate API 토큰

### 2. 의존성 설치

```bash
npm install
```

`postinstall`에서 Prisma Client가 자동 생성됩니다.

### 3. 환경변수 설정

`.env.example`을 복사해 `.env`를 만든 뒤 값을 채워 주세요.

```bash
cp .env.example .env
```

Windows PowerShell에서는 다음처럼 복사할 수 있습니다.

```powershell
Copy-Item .env.example .env
```

주요 환경변수는 아래와 같습니다.

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `DATABASE_URL` | 예 | Prisma 애플리케이션 연결용 PostgreSQL URL |
| `DIRECT_URL` | 선택 | Prisma CLI 작업용 direct/session 연결 URL |
| `NEXT_PUBLIC_SUPABASE_URL` | 예 | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 예 | 브라우저용 Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 예 | 서버 업로드/삭제용 service role key |
| `REPLICATE_API_TOKEN` | 예 | 이미지 생성 및 변형용 Replicate 토큰 |
| `ANTHROPIC_API_KEY` | 선택 | 프롬프트 개선 및 변형 프롬프트 생성용 |
| `ANTHROPIC_MODEL` | 선택 | Anthropic 모델 오버라이드. 기본값은 `claude-sonnet-4-20250514` |

추가로 Supabase Storage에 `images` 버킷이 있어야 합니다.

### 4. 데이터베이스 마이그레이션 적용

기존 마이그레이션을 적용합니다.

```bash
npx prisma migrate deploy
```

상태를 확인하려면 다음 명령을 사용할 수 있습니다.

```bash
npx prisma migrate status
```

### 5. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열면 됩니다.

## 스크립트

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## 데이터 모델 요약

### Project

- 프로젝트 이름, 설명, 브리프
- 제약 사항, 타깃 오디언스, 브랜드 톤
- 대표 썸네일
- 보관 상태

### Direction

- 브랜치 이름과 색상
- thesis, fit criteria, anti-goal, reference notes
- 프로젝트 내 노드 묶음 기준

### Node

- 이미지 URL과 생성 시각
- 부모 노드, 브랜치, 캔버스 위치
- 소스(`ai-generated`, `imported`)
- 프롬프트, user intent, resolved prompt, prompt source
- 모델, 시드, 이미지 크기, 비율
- 의도 태그, 변경 태그, 메모
- 타입, 상태, 상태 사유
- 프로젝트 내 순번과 버전 번호

### ActivityEvent

- 프로젝트/노드/브랜치 단위 활동 로그
- 시스템 이벤트와 수동 이벤트 모두 저장
- 비교 기록, 의사결정 근거, 변경 이력 추적용

## 디렉터리 구조

```text
.
|-- prisma/
|   |-- migrations/
|   `-- schema.prisma
|-- src/
|   |-- app/
|   |   |-- api/
|   |   |-- project/[id]/
|   |   `-- page.tsx
|   |-- components/
|   |   |-- activity/
|   |   |-- detail/
|   |   |-- graph/
|   |   |-- layout/
|   |   |-- projects/
|   |   `-- staging/
|   |-- hooks/
|   |-- lib/
|   |-- stores/
|   `-- generated/prisma/
|-- docs/
|-- .env.example
`-- README.md
```

## 현재 구조에서 기억해 둘 점

- Prisma Client 출력 경로는 `src/generated/prisma`입니다.
- 이미지 파일은 Supabase Storage `images` 버킷에 업로드됩니다.
- 프로젝트 상세 화면은 `src/app/project/[id]/page.tsx`에서 `IDELayout`과 `NodeGraph`를 중심으로 구성됩니다.
- API는 `src/app/api` 아래에 모여 있으며 프로젝트, 노드, 브랜치, 활동 로그, 생성, 업로드를 분리해 다룹니다.

## 문서

- `docs/`에는 UX 개편안, 썸네일 정책, 워크스페이스 정리 계획 등 현재 구현과 맞닿아 있는 설계 문서가 들어 있습니다.
- 루트의 `VIDE_Final.md`, `VIDE_PURPOSE_REVIEW.md`는 제품 의도와 리뷰 맥락을 담고 있습니다.

## 참고

- 이 저장소에는 아직 별도 테스트 스위트가 크지 않으므로, 주요 변경 후에는 `npm run build`와 실제 워크플로우 점검을 함께 권장합니다.
- README 내용은 2026-03-30 기준 저장소 상태를 바탕으로 정리했습니다.
