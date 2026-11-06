# Durume 3D Library for Excel

Next.js + Three.js 기반의 경량 3D 도서관 MVP입니다. Graph/Excel 모드에서는 OneDrive에 있는
**단일 Excel workbook**이 원본(source of truth)이며, SharePoint 리스트나 로컬 DB에 동시에
기록하지 않습니다. 자격 증명이 없는 환경에서는 합성 데이터만 사용하는 로컬 데모 모드로 전체
사용자 흐름을 확인할 수 있습니다.

## 제공 기능

- 3D 서가 회전·확대, 서가 선택과 검색/분류 필터
- 한국어/영어 화면 전환, 자연스러운 한국어 데모 도서 제목·저자 표시
- DDC/KDC 표시 전환, 도서 상세 정보에서 상세 패널을 유지한 채 3D 서가 위치 강조
- 대출 신청, 예약, 반납 신청, 반납 예정일/연체 표시, 앱 내부 알림
- 관리자 도서 등록·수정·삭제·서가 배치, 회원/역할 관리, 대출 승인, 반납 처리
- Microsoft Entra delegated OAuth와 Microsoft Graph Excel 테이블 읽기/쓰기
- 안정 ID/버전 기반 낙관적 동시성 검사와 서버 측 역할 기반 접근 제어
- 기본 520권의 재현 가능한 합성 도서가 있는 Excel 워크북 생성기

## 빠른 시작: 자격 증명 없는 로컬 데모

요구 사항은 Node.js 20 이상과 npm입니다.

```powershell
npm install
Copy-Item .env.example .env.local
# .env.local의 DATA_MODE=demo 확인
npm run dev
```

`http://localhost:3000`을 엽니다. 화면에 `LOCAL DEMO DATA`가 표시되어야 합니다.

- 상단 사용자 선택기에서 `Member view`와 `Admin view`를 전환할 수 있습니다.
- 기본 회원 계정: 안정 ID `user-demo-member`, 이름 `Demo Member`
- 기본 관리자 계정: 안정 ID `user-demo-admin`, 이름 `Demo Librarian`
- 관리자 탭은 `Admin view`에서만 활성화됩니다.
- 데모 이메일은 실제 계정이 아닌 `*.example.invalid` 주소입니다.

데모 변경은 Node.js 프로세스 메모리에만 저장되므로 서버를 다시 시작하면 초기화됩니다.
실제 사용자 데이터나 운영 데이터에는 사용하지 마십시오.

## 로컬 데모와 Graph/Excel 모드

| 항목 | 로컬 데모 | Graph/Excel |
| --- | --- | --- |
| 서버 설정 | `DATA_MODE=demo` | `DATA_MODE=graph` |
| 데이터 원본 | `src/lib/demo-data.ts`의 프로세스 메모리 | 설정한 OneDrive workbook의 Excel tables |
| 로그인 | 상단 데모 사용자 선택기 | Microsoft 로그인(`/api/auth/signin`) |
| 역할 | 데모 회원/관리자 선택 | workbook `Users`의 `role` |
| 변경 영속성 | 서버 재시작 시 초기화 | OneDrive workbook에 저장 |
| 오류 시 | 로컬 데모만 사용 | 오류를 반환하며 데모로 자동 전환하지 않음 |

`NEXT_PUBLIC_DATA_MODE`는 UI 표시용 보조 값일 뿐 서버의 권한이나 데이터 원본 결정에는 사용되지
않습니다. 실제 원본은 서버의 `DATA_MODE`가 결정합니다.

## OneDrive에서 Graph/Excel 실행하기

아래 순서는 실제 구현의 표/환경 변수명과 동일합니다.

### 1. Workbook 생성 및 OneDrive 업로드

```powershell
npm run generate:workbook
```

기본 산출물은
[`artifacts/3d-library-demo.xlsx`](artifacts/3d-library-demo.xlsx)이며 520권의 합성 도서를
포함합니다. `Books` 표의 선택적 `titleKo`/`authorKo` 열은 한국어 화면에 표시할 제목과 저자
번역이며, 원본 `title`/`author`와 함께 workbook에 저장됩니다. 이 파일을 로그인하려는 사용자의
OneDrive에 업로드합니다.

이 선택 열은 기존 workbook과의 호환성을 위해 필수 열이 아닙니다. 열이 없으면 해당 도서의
영문 metadata가 한국어 화면에서도 그대로 표시되고, 열이 있는 workbook에서는 읽기·쓰기 시
실제 표의 열 순서를 따라 번역 값도 보존됩니다.

권장 예시:

```text
OneDrive 루트
└── 3d-library
    └── 3d-library-demo.xlsx
```

Excel/OneDrive에서 파일이 열리는지 확인한 뒤 파일 이름이나 폴더를 함부로 바꾸지 마십시오.
초기 실행 시 이 파일은 OneDrive에 **실제 파일로 존재**해야 하고, 로그인할 사용자가
읽기/쓰기 권한을 가져야 합니다.

> 이 앱은 파일 경로를 환경 변수로 받지 않습니다. Graph URL에 사용하는
> `GRAPH_DRIVE_ID`와 `GRAPH_WORKBOOK_ITEM_ID`를 받습니다.

### 2. OneDrive 파일의 Graph drive/item ID 확인

1. [Microsoft Graph Explorer](https://developer.microsoft.com/graph/graph-explorer)를 엽니다.
2. 업로드한 파일을 소유한 Microsoft 계정으로 로그인하고, 해당 계정의 OneDrive에 접근할 수
   있는 Microsoft Graph delegated 권한에 동의합니다.
3. 파일이 OneDrive 루트에 있으면 다음 `GET` 요청을 실행합니다.

   ```text
   https://graph.microsoft.com/v1.0/me/drive/root:/3d-library-demo.xlsx
   ```

   위 권장 폴더 예시를 사용했다면 다음처럼 요청합니다.

   ```text
   https://graph.microsoft.com/v1.0/me/drive/root:/3d-library/3d-library-demo.xlsx
   ```

4. 응답에서 다음 값을 확인합니다.

   ```json
   {
     "id": "<GRAPH_WORKBOOK_ITEM_ID로 사용할 파일 item ID>",
     "parentReference": {
       "driveId": "<GRAPH_DRIVE_ID로 사용할 drive ID>"
     }
   }
   ```

5. URL에서 공백이나 한글 파일명이 포함되면 Graph URL 규칙에 따라 경로를 URL 인코딩합니다.
   식별자가 한 번 확인되면 이후에도 파일을 이동하거나 이름을 변경하지 않는 것이 안전합니다.

확인한 `driveId`는 실제 Drive 식별자이고, 파일의 `id`는 Excel workbook item 식별자입니다.
사용자 ID, Excel 행 번호, 테이블 행의 `id`가 아닙니다.

### 3. Microsoft Entra 앱 등록

1. Microsoft Entra 관리 센터에서 **App registrations > New registration**을 선택합니다.
2. 지원 계정 유형은 테스트할 사용자와 파일 소유자에 맞게 선택합니다.
   - 조직 OneDrive 계정만 사용할 경우: 현재 조직의 단일 테넌트(권장)
   - 여러 조직 또는 개인 Microsoft 계정까지 허용할 경우: 두 계정 유형을 모두 포함하는 옵션
3. **Web** 플랫폼을 추가하고 정확한 redirect URI를 등록합니다.

   로컬 개발:

   ```text
   http://localhost:3000/api/auth/callback/azure-ad
   ```

   배포 시에는 실제 HTTPS 주소로 같은 경로를 추가합니다. 예:

   ```text
   https://library.example.com/api/auth/callback/azure-ad
   ```

4. 앱 등록의 **Certificates & secrets**에서 client secret을 만들고 **Value**를 저장합니다.
   Secret ID는 `AZURE_AD_CLIENT_SECRET`로 사용하지 않습니다.
5. **API permissions > Add a permission > Microsoft Graph > Delegated permissions**에서
   `Files.ReadWrite.All`과 `User.Read`를 추가합니다.
6. 로그인 과정에서는 다음 scope도 요청합니다.

   ```text
   openid profile email offline_access Files.ReadWrite.All User.Read
   ```

`Files.ReadWrite.All`은 로그인 사용자가 접근할 수 있는 파일 읽기/쓰기를 허용하는 강한 권한입니다.
사용자 동의가 허용되어 있으면 사용자가 로그인 시 직접 동의할 수 있습니다. 테넌트 정책이나
`Files.ReadWrite.All` 승인 정책상 사용자 동의가 금지된 조직에서는 테넌트 관리자가
**Grant admin consent**를 수행해야 합니다. 이 저장소나 코드만으로 테넌트 동의를 자동 처리하지는
않습니다.

### 4. `.env.local` 설정

다음은 OneDrive `3d-library/3d-library-demo.xlsx`를 사용하는 예시입니다. 실제 ID와 secret은
예시 값을 그대로 사용하면 안 됩니다.

```dotenv
DATA_MODE=graph
NEXT_PUBLIC_DATA_MODE=graph

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=use-a-long-random-value-of-at-least-32-characters

AZURE_AD_CLIENT_ID=00000000-0000-0000-0000-000000000000
AZURE_AD_CLIENT_SECRET=<Entra client secret의 Value>
# 단일 테넌트 앱이면 Directory (tenant) ID를 넣습니다.
AZURE_AD_TENANT_ID=11111111-1111-1111-1111-111111111111

# 위 Graph GET 응답의 parentReference.driveId
GRAPH_DRIVE_ID=b!example-drive-id
# 위 Graph GET 응답의 id
GRAPH_WORKBOOK_ITEM_ID=01EXAMPLEFILEITEM
```

전체 변수 목록과 기본값은 [`.env.example`](.env.example)을 참고하십시오.

- `DATA_MODE`: `demo` 또는 `graph`. 다른 값은 코드에서 데모로 처리됩니다.
- `NEXT_PUBLIC_DATA_MODE`: 브라우저 표시용 `demo`/`graph`
- `NEXTAUTH_URL`: OAuth callback을 계산하는 앱 외부 URL
- `NEXTAUTH_SECRET`: NextAuth 세션 암호화/서명용 비밀값
- `AZURE_AD_CLIENT_ID`: Entra 앱 Application (client) ID
- `AZURE_AD_CLIENT_SECRET`: Entra client secret의 **Value**
- `AZURE_AD_TENANT_ID`: Directory (tenant) ID, 또는 지원 계정에 맞춰 `common`
- `GRAPH_DRIVE_ID`: Graph item 응답의 `parentReference.driveId`
- `GRAPH_WORKBOOK_ITEM_ID`: Graph item 응답의 파일 `id`

secret, access token, Graph ID를 소스에 커밋하지 마십시오. `.env.local`은 `.gitignore`에 포함됩니다.

### 5. 첫 Graph 사용자 실행

앱이 Graph 모드에서는 workbook `Users` 테이블에 등록된 사용자만 접근할 수 있습니다. 처음 로그인하기
전에 OneDrive에서 workbook을 열어 `Users` 표를 수정합니다.

1. 로그인할 실제 이메일 주소가 들어갈 새 행을 추가하거나, 기존 데모 행을 복사해 새 안정 `id`를
   부여합니다. 예:

   ```text
   id: user-actual-admin-001
   version: 1
   authId: admin
   displayName: Library Admin
   email: library.admin@example.org
   role: admin
   ```

2. 최소 한 명은 `role=admin`으로 등록합니다. 운영자가 일반 회원 화면도 확인하려면 같은 방법으로
   `role=member` 행도 추가합니다.
3. 앱은 `Users.authId`를 로그인 token의 `sub` 값과 비교한 뒤, 대소문자를 무시해 `Users.email`도
   비교합니다. 초기 설정에서는 **실제 계정의 이메일을 정확히 넣는 방법이 가장 간단**합니다.
4. `id`는 테이블 안에서 유일하고 불변이어야 합니다. `authId` 또는 email을 맞추기 위해 `id`를
   실제 Microsoft 계정 ID로 재사용할 필요는 없습니다.
5. Excel 변경을 저장하고, `npm run dev`로 개발 서버를 시작한 뒤 `http://localhost:3000`을 엽니다.
6. 화면에서 Microsoft 로그인 링크를 따라 `/api/auth/signin` 경로로 로그인합니다. 실제 callback은
   `/api/auth/callback/azure-ad`입니다.
7. 로그인 후 `My library`에서 회원 대출/예약과 알림을 확인합니다. `Admin desk`는
   workbook의 `role=admin` 사용자에게만 활성화됩니다.
8. Graph/Excel 모드에서도 서버 API가 `role`을 다시 확인하므로 회원이 관리자 요청을 직접 보내면
   HTTP 403으로 차단됩니다.

## 실행 명령

```powershell
# 의존성 설치
npm install

# 기본 520권 workbook 생성
npm run generate:workbook

# 750권의 다른 workbook 생성 예시
$env:DEMO_BOOK_COUNT=750
npm run generate:workbook -- artifacts/library-fixture.xlsx

# demo/graph 설정을 가진 .env.local 준비
Copy-Item .env.example .env.local

# 개발 서버
npm run dev
```

워크북 생성기는 500권 미만 요청도 자동으로 최소 500권으로 보정합니다. 생성 데이터는 합성
도서명/저자명과 예약된 `example.invalid` 이메일만 사용하며 실제 서지 정보를 복제하지 않습니다.

## Excel 편집과 앱 읽기/쓰기 확인

1. OneDrive에서 설정한 workbook을 Excel for the web으로 엽니다.
2. 예를 들어 `Books` 표의 `book-...` 행에서 `title`을 테스트 값으로 변경하고 저장합니다.
   `id`나 `version`은 임의로 바꾸지 않습니다.
3. 앱 화면을 새로고침하면 `/api/library`가 workbook의 7개 테이블을 다시 읽습니다. 검색에서
   변경한 제목이 보여야 합니다.
4. 관리자 화면에서 다른 테스트 도서의 제목 또는 서가 배치를 변경합니다. 앱은 `/api/actions`를
   통해 Graph workbook row를 수정합니다.
5. OneDrive의 Excel 표를 새로고침하거나 다시 열어 같은 행의 제목/`shelfId`/`bin`과 증가한
   `version`이 저장됐는지 확인합니다.
6. 회원으로 대출 신청을 하고, 관리자 화면에서 승인한 뒤 `Loans.status`, `approvedAt`,
   `dueAt`, `version`이 workbook에 반영되는지 확인합니다.

앱과 Excel을 동시에 편집할 때에는 같은 행을 오래 열어 둔 뒤 양쪽에서 수정하지 마십시오. 앱은
안정 ID와 `version`으로 충돌을 검사하며, 현재 워크북이 예상 버전과 다르면 HTTP 409
`CONFLICT`를 반환합니다.

## Workbook 표 계약

파일에는 다음 Excel table 이름과 정확한 header가 있어야 합니다.

| Table | Columns |
| --- | --- |
| `Books` | `id`, `version`, `title`, `author`, `year`, `ddc`, `kdc`, `classIndex`, `locationId`, `shelfId`, `bin`, `coverColor`, `demo` |
| `Shelves` | `id`, `version`, `name`, `locationId`, `zone`, `floor`, `capacity` |
| `Locations` | `id`, `version`, `name`, `floor`, `zone` |
| `Users` | `id`, `version`, `authId`, `displayName`, `email`, `role` |
| `Loans` | `id`, `version`, `bookId`, `userId`, `status`, `requestedAt`, `approvedAt`, `dueAt`, `returnedAt` |
| `Reservations` | `id`, `version`, `bookId`, `userId`, `status`, `createdAt` |
| `Settings` | `id`, `version`, `key`, `value` |

규칙:

- 관계는 항상 `id`를 사용하며 Excel 행 번호는 내부 구현에만 사용합니다.
- 각 표의 `id`는 불변·유일해야 합니다.
- `version`은 의미 있는 수정마다 증가하는 0 이상의 정수입니다.
- 날짜는 ISO 8601 UTC 문자열입니다.
- `Settings`에는 `key=schemaVersion`, `value=1`인 행이 있어야 합니다.
- 대출 상태: `requested`, `approved`, `overdue`, `return_requested`, `returned`, `rejected`
- 예약 상태: `waiting`, `ready`, `fulfilled`, `cancelled`
- 역할: `member`, `admin`
- 표, sheet, header 이름을 바꾸거나 추가 관계를 숫자 행 번호로 저장하지 마십시오.

## 자주 발생하는 오류

| 증상/API 코드 | 원인 | 대응 |
| --- | --- | --- |
| Graph `404`, 앱의 `GRAPH_ERROR` | `GRAPH_DRIVE_ID`/`GRAPH_WORKBOOK_ITEM_ID`가 다른 파일을 가리키거나 파일이 삭제/이동됨 | Graph GET 요청을 다시 실행해 `driveId`와 `id`를 갱신하고 서버를 재시작 |
| 로그인 사용자가 `Users`에 없음: HTTP 403 `FORBIDDEN` | `Users.authId` 또는 `email`이 실제 로그인 사용자와 일치하지 않음 | workbook `Users`에서 정확한 email을 추가하고 `role`을 설정 |
| Graph HTTP 403, 앱의 `GRAPH_ERROR` | delegated permission 또는 파일 쓰기 권한/테넌트 동의 부족 | Entra에서 `Files.ReadWrite.All`, `User.Read`와 동의 상태를 확인하고, OneDrive 파일 접근 권한을 확인 |
| HTTP 401 `AUTH_REQUIRED` | Microsoft 로그인 세션/Graph access token 없음 | `/api/auth/signin`으로 다시 로그인 |
| HTTP 401 `AUTH_EXPIRED` | Graph access token 또는 세션 만료 | 로그아웃 후 Microsoft에 다시 로그인; Entra client secret 만료 여부도 확인 |
| HTTP 422 `SCHEMA_ERROR` | 필수 table/header 누락, 타입/관계 오류, `schemaVersion` 불일치 | 생성된 workbook을 기준으로 표/컬럼을 복구하고 `Settings.schemaVersion=1` 확인 |
| workbook/table 오류가 `GRAPH_ERROR`로 표시됨 | workbook이 `.xlsx`가 아니거나 Excel table이 Graph에서 인식되지 않음 | Excel에서 파일 형식과 `Books` 등 7개 Table 이름을 확인 |
| HTTP 409 `CONFLICT` | 다른 사용자가 같은 `version`을 먼저 변경함 | 앱 새로고침 후 작업을 다시 실행; 수동 편집 시 `version`을 임의로 낮추지 않음 |
| HTTP 409 `INVALID_STATE` | 이미 대출 중인 도서, 중복 신청, 잘못된 상태 전이/서가-구역 조합 | 도서/대출/예약의 현재 상태를 확인하고 유효한 다음 동작만 실행 |

Graph 인증이 만료되거나 workbook 로드가 실패해도 앱은 데모 모드로 자동 전환하지 않습니다.
이는 운영 파일에 저장되지 않았다고 오해하는 일을 방지하기 위한 동작입니다.

## 실제 OneDrive 자격 증명이 없을 때 검증 범위

자격 증명 없이도 다음은 검증할 수 있습니다.

- 로컬 데모 UI, 3D 서가, 검색, DDC/KDC 전환
- 회원 대출/예약/반납 요청과 관리자 승인/반납 처리
- 서버 RBAC, 중복 방지, 상태 전이, 데모 데이터 충돌 처리
- 520권 이상 workbook 생성, Excel table 이름/컬럼/관계 검증
- Graph adapter의 인증 만료, 스키마, workbook session, 버전 충돌 경로는 mock 테스트로 검증
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`

다음은 실제 OneDrive workbook과 Entra 계정이 있어야 검증할 수 있으며, 이 README 업데이트 환경에서는
**미검증**입니다.

- 실제 Microsoft 로그인/tenant consent
- 특정 OneDrive 파일의 Graph drive/item ID 접근
- 실제 workbook table에 대한 영속 읽기/쓰기
- 사용자의 실제 email 또는 `sub`와 `Users` 행 매칭
- 조직의 Conditional Access, consent 정책, MFA 및 Graph throttling

## 구현 검증 명령

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

테스트는 합성 workbook 무결성, 500권 이상, 안정 ID/관계, 상태 전이, 중복 방지, RBAC,
낙관적 동시성 충돌, Graph adapter mock 및 UI 검색/상세 동작을 다룹니다.

## 아키텍처 및 운영 제한

Repository 계약은 `src/lib/domain.ts`의 `LibraryRepository`입니다. 현재 구현 adapter는
`src/lib/repositories/local.ts`와 `src/lib/repositories/excel.ts`뿐입니다. UI는 Graph를 직접
호출하지 않고 `/api/library`, `/api/actions` 서버 경계를 사용합니다. 이 구조는 나중에
SharePoint list adapter를 추가할 수 있는 경계를 제공하지만, 이번 MVP에는 Excel↔SharePoint
실시간 동기화나 dual-write가 없습니다.

Excel API는 데이터베이스 수준의 serializable transaction을 제공하지 않습니다. 이 MVP는
workbook session 안에서 `version`을 다시 확인하고 row 변경을 적용하지만, 사용량이 큰 배포에서는
transactional 저장소로 adapter를 교체하거나 서버 측 직렬화를 추가해야 합니다.

실제 배포에서는 정확한 HTTPS callback을 등록하고, 환경 변수는 플랫폼 secret 저장소에 두며,
`NEXTAUTH_SECRET`과 Entra client secret을 정기적으로 교체하십시오.
