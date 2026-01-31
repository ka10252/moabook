
# 구현 계획: 거래 요청 플로우 및 UI 개선

## 개요
이 계획은 4가지 주요 기능을 구현합니다:
1. 책등/북커버 뷰 전환 시 헤더 레이아웃 안정화
2. "대여 요청" / "구매 요청" 버튼으로 변경 및 거래 플로우 구현
3. 채팅 내 "대여 수락" 버튼 및 거래 확정 플로우
4. 책 등록 시 이미지 업로드 기능 개선

---

## 1. 헤더 레이아웃 안정화 (뷰 토글 및 드롭다운)

### 문제점
책등 → 북커버 뷰 전환 시 상단 헤더의 ViewToggle과 DropdownMenu 컴포넌트 크기가 변경됨

### 해결 방안
- ViewToggle과 DropdownMenu에 고정 너비(min-width) 적용
- 헤더 레이아웃을 flex-shrink-0으로 고정

### 변경 파일
- `src/components/ViewToggle.tsx` - 고정 너비 스타일 추가
- `src/components/Bookshelf.tsx` - 헤더 영역 레이아웃 안정화

---

## 2. "대여 요청" / "구매 요청" 버튼 구현

### 현재 상태
- BookDetailWithActions에서 비소유자는 "채팅하기" 버튼만 표시

### 변경 사항
- **버튼 라벨 변경**: 책의 `mode`에 따라 자동으로 표시
  - `mode === 'rent'` → "대여 요청"
  - `mode === 'sell'` → "구매 요청"
  
- **클릭 시 동작**:
  1. 채팅 화면 열기 (onChat 호출)
  2. 자동으로 책 정보 컴포넌트를 첫 번째 메시지로 전송
  3. BookCardPreview가 채팅 상단이 아닌 메시지 형태로 표시

### 변경 파일
- `src/components/BookDetailWithActions.tsx` - 버튼 라벨 동적 변경
- `src/hooks/useChat.ts` - 대화 시작 시 자동 메시지 전송 기능 추가
- `src/components/chat/ChatView.tsx` - 책 정보 메시지를 일반 메시지처럼 렌더링
- `src/components/BookCardPreview.tsx` - 메시지 버블 형태 스타일 추가

### 구현 세부사항
```text
[채팅 화면]
┌─────────────────────────────────┐
│  ← 상대방 닉네임                 │
├─────────────────────────────────┤
│                                 │
│  ┌──────────────────────┐       │
│  │ 📚 책 제목            │  ← 첫 번째 메시지로 전송됨
│  │    저자               │       │
│  │    [썸네일]           │       │
│  │                      │       │
│  │  [대여 수락]         │  ← 책 주인에게만 표시
│  └──────────────────────┘       │
│                                 │
│  안녕하세요, 이 책 대여...       │
│                                 │
└─────────────────────────────────┘
```

---

## 3. "대여 수락" 버튼 및 거래 확정 플로우

### 새로운 컴포넌트: AcceptRentalModal
책 주인이 대여를 수락할 때 표시되는 모달

### 플로우
1. 책 주인이 채팅에서 책 정보 컴포넌트 하단의 "대여 수락" 버튼 클릭
2. AcceptRentalModal 열림:
   - 책 정보 표시
   - 대여하는 유저 이름 표시
   - 대여 시작일 (기본값: 오늘)
   - 반납 예정일 (선택사항, 미설정 시 "미정")
3. "수락" 버튼 클릭
4. "수락하시겠습니까?" 확인 알림
5. 확인 시:
   - transactions 테이블에 새 레코드 생성
   - books 테이블의 status를 'rented'로 변경
   - 거래 대시보드에서 확인 가능

### 새로운 파일
- `src/components/chat/AcceptRentalModal.tsx` - 대여 수락 모달

### 변경 파일
- `src/components/chat/ChatView.tsx` - BookCardPreview에 "대여 수락" 버튼 추가
- `src/hooks/useTransactions.ts` - createTransaction 함수 활용

### 데이터 구조
```text
transactions 테이블:
- book_id: 대여할 책 ID
- owner_id: 책 주인 ID
- borrower_id: 대여자 ID
- type: 'rent' | 'purchase'
- status: 'active'
- start_date: 대여 시작일
- return_date: 반납 예정일 (nullable)
```

---

## 4. 책 등록 시 이미지 업로드 기능 개선

### 현재 상태
- UploadBookForm에 이미 이미지 업로드 기능 구현됨
- 책 검색 후 표지가 없을 때만 업로드 버튼 표시

### 변경 사항
- 책 정보가 있든 없든 항상 이미지 업로드 버튼 표시
- 버튼 하단에 안내 문구 추가: "책상태를 파악할 수 있게 실제 책사진을 업로드해주세요"
- 업로드 시 토스트 알림으로도 안내

### 변경 파일
- `src/components/upload/UploadBookForm.tsx` - 업로드 버튼 항상 표시, 안내 문구 추가

---

## 기술적 세부사항

### useChat.ts 수정
```typescript
// 대화 시작 시 자동으로 책 요청 메시지 전송
const startConversationWithRequest = async (
  otherUserId: string, 
  bookId: string, 
  requestType: 'rent' | 'purchase'
) => {
  const { conversation } = await startConversation(otherUserId, bookId);
  if (conversation) {
    // 자동 메시지 전송 (책 정보 + 요청 타입)
    const messageContent = requestType === 'rent' 
      ? '[대여 요청] 이 책을 대여하고 싶습니다.'
      : '[구매 요청] 이 책을 구매하고 싶습니다.';
    await sendMessage(conversation.id, messageContent);
  }
  return { conversation };
};
```

### ChatView 책 정보 메시지 렌더링
```typescript
// 메시지 중 [대여 요청] 또는 [구매 요청]으로 시작하는 메시지 감지
// 해당 메시지에 BookCardPreview 컴포넌트 함께 렌더링
// 책 주인인 경우 "대여 수락" 버튼 표시
```

### AcceptRentalModal 구조
```typescript
interface AcceptRentalModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: { id: string; title: string; author: string; cover_url?: string };
  borrower: { id: string; nickname: string };
  requestType: 'rent' | 'purchase';
  onAccept: (startDate: string, returnDate?: string) => Promise<void>;
}
```

---

## 구현 순서

1. **헤더 레이아웃 안정화** (ViewToggle, Bookshelf)
2. **책 등록 이미지 업로드 개선** (UploadBookForm)
3. **대여/구매 요청 버튼** (BookDetailWithActions, useChat)
4. **채팅 책 정보 메시지 형태로 변경** (ChatView, BookCardPreview)
5. **대여 수락 모달** (AcceptRentalModal 생성)
6. **거래 생성 연동** (useTransactions 활용)

---

## 예상 결과

- 뷰 전환 시 헤더가 안정적으로 유지됨
- 책 클릭 시 mode에 따라 "대여 요청" 또는 "구매 요청" 버튼 표시
- 요청 클릭 시 자동으로 책 정보가 메시지로 전송됨
- 책 주인은 "대여 수락" 버튼으로 거래를 확정할 수 있음
- 확정된 거래는 거래 대시보드에서 관리 가능
- 책 등록 시 항상 이미지 업로드 옵션 제공
