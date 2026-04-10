# TODO_list

소프트웨어 공학 미니 프로젝트용 Todo 앱입니다.

## 현재 구현 상태

MVP 기준 기능이 구현되어 있습니다.

- Todo 추가
- Todo 목록 조회
- Todo 완료 체크
- Todo 삭제

## 프로젝트 구조

```text
.
├── frontend/
└── backend/
```

## 사용 기술

- Frontend: React + Vite
- Backend: Express
- Data: MongoDB Atlas + Mongoose

## 실행 방법

### 1. 백엔드 실행

먼저 `backend/.env.example`을 참고해서 `backend/.env` 파일을 만듭니다.

예시:

```env
PORT=5000
MONGODB_URI=여기에_Atlas_연결문자열
CORS_ORIGIN=http://localhost:5173
```

```bash
cd backend
npm install
npm run dev
```

기본 주소: `http://localhost:5000`

`CORS_ORIGIN`은 프론트엔드 주소를 허용하는 값입니다. 여러 주소를 허용하려면 쉼표로 구분합니다.
예시: `CORS_ORIGIN=http://localhost:5173,https://your-frontend.vercel.app`

### 2. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

기본 주소: `http://localhost:5173`

## API 경로

- `GET /api/todos`
- `POST /api/todos`
- `PUT /api/todos/:id`
- `DELETE /api/todos/:id`

## 다음 단계

- 마감일 추가
- 카테고리 추가
- 정렬 기능 추가
- 반복 기능 추가
- Vercel 배포
