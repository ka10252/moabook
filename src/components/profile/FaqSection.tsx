import { useState, type ReactNode } from 'react';
import { ChevronDown, Search, Heart, Share } from 'lucide-react';

/** 버튼/탭 이름은 볼드 대신 '박스 칩'으로 표시 */
const Chip = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center rounded-md border border-border bg-muted px-1.5 py-[1px] text-[13px] font-semibold text-foreground align-middle mx-0.5">
    {children}
  </span>
);

const IconInline = ({ icon: Icon }: { icon: typeof Search }) => (
  <Icon className="inline w-3.5 h-3.5 align-text-bottom text-primary mx-0.5" />
);

/** 자주 묻는 질문 — 위쪽일수록 자주 물을 것 같은 순 */
const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: '책을 어떻게 빌리나요?',
    a: (
      <>책장에서 책등을 탭하면 상세가 열려요. <Chip>대여 신청</Chip>을 누르면 책 주인과 채팅이 시작돼요. 만날 약속을 잡고 직접 만나서 받으면 됩니다.</>
    ),
  },
  {
    q: '알림을 못 받아요. 어떻게 켜나요?',
    a: (
      <>
        프로필 › <Chip>알림 설정</Chip>에서 앱 알림을 켜거나 텔레그램을 연동하세요.<br />
        <b className="text-foreground">아이폰</b>은 홈 화면에 추가해야 알림이 와요:
        <ol className="mt-1.5 ml-1 space-y-1">
          <li>1. Safari 하단 <IconInline icon={Share} /> 공유(Share) 버튼</li>
          <li>2. <Chip>홈 화면에 추가</Chip> (Add to Home Screen)</li>
          <li>3. 홈 화면의 MOA Book 아이콘으로 다시 열기</li>
          <li>4. <Chip>알림 허용</Chip> (Allow Notifications)</li>
        </ol>
      </>
    ),
  },
  {
    q: '책은 어떻게 등록하나요?',
    a: (
      <>하단 <Chip>등록</Chip> 탭에서 <b className="text-foreground">제목만 입력</b>하면 표지·저자·소개가 자동으로 채워져요. 잠깐 기다렸다 자동완성 목록에서 내 책을 고르고, 상태와 거래 방식만 정하면 끝.</>
    ),
  },
  {
    q: '관심 도서와 위시리스트는 뭐가 다른가요?',
    a: (
      <>
        <IconInline icon={Heart} /> <b className="text-foreground">관심</b>은 이미 이웃에게 <b className="text-foreground">있는</b> 책을 찜해두는 것,{' '}
        <IconInline icon={Search} /> <b className="text-foreground">위시리스트</b>는 아직 아무도 안 올린, <b className="text-foreground">구하고 싶은</b> 책을 남기는 곳이에요.
      </>
    ),
  },
  {
    q: '반납은 어떻게 하나요?',
    a: (
      <>책을 돌려주면, <b className="text-foreground">책 주인이</b> 채팅의 대여 카드에서 <Chip>반납 완료</Chip>를 눌러요.</>
    ),
  },
  {
    q: '돈은 어떻게 주고받나요?',
    a: (
      <>앱은 결제를 중개하지 않아요. 판매·구매는 <Chip>PayNow</Chip> <Chip>PayLah</Chip>로 이웃과 직접 거래하세요.</>
    ),
  },
  {
    q: '대여·판매·나눔은 뭐가 다른가요?',
    a: (
      <>책 등록 시 셋 중 골라요. <Chip>대여</Chip> 정해진 기간 빌려주고 돌려받기 · <Chip>판매</Chip> 값을 받고 넘기기 · <Chip>나눔</Chip> 무료로 주기.</>
    ),
  },
  {
    q: '커뮤니티는 뭔가요?',
    a: (
      <>동네·모임 단위 책장이에요. 비밀번호나 초대 링크로 가입하고, 책 등록 시 <b className="text-foreground">그 커뮤니티에만 공개</b>로 올릴 수도 있어요.</>
    ),
  },
  {
    q: '대여 기간(반납일)은 누가 정하나요?',
    a: <>책 주인이 대여를 <b className="text-foreground">수락할 때</b> 반납 예정일을 정해요.</>,
  },
  {
    q: '모르는 사람과 거래하는 게 걱정돼요.',
    a: (
      <><b className="text-foreground">신고·차단</b> 기능이 있어요. 같은 <b className="text-foreground">커뮤니티 안에서</b> 아는 이웃끼리 거래하면 더 안심할 수 있어요.</>
    ),
  },
  {
    q: '판매하는 책은 왜 사진이 필요한가요?',
    a: <>상태를 직접 확인할 수 있게 <b className="text-foreground">실제 사진</b>이 필요해요. (대여·나눔은 선택)</>,
  },
  {
    q: '가상 도서관(캐릭터)에서 뭘 할 수 있나요?',
    a: (
      <>픽셀 캐릭터로 돌아다니며 다른 접속자와 <b className="text-foreground">근접 채팅·이모트</b>를 하고, 머리 위에 <b className="text-foreground">지금 읽는 책</b>을 보여줄 수 있어요. 커뮤니티룸에선 책장·게시판으로도 이동해요.</>
    ),
  },
  {
    q: "'지금 읽는 책'은 어떻게 지정하나요?",
    a: (
      <>프로필 › <Chip>캐릭터 꾸미기</Chip>(또는 가상 도서관 입장 시)에서 책을 검색해 지정하면, 캐릭터 머리 위 말풍선에 표지가 떠요.</>
    ),
  },
  {
    q: '텔레그램 연동이 안 돼요.',
    a: (
      <>봇 <Chip>t.me/MOAbook_bot</Chip>을 열고 대화창에 <Chip>/start</Chip>를 입력하면 연결돼요.</>
    ),
  },
  {
    q: '프로필(닉네임·사진)은 어떻게 바꾸나요?',
    a: <>프로필 › <Chip>프로필 편집</Chip>에서 바꿀 수 있어요.</>,
  },
  {
    q: '이 서비스는 어디서 쓸 수 있나요?',
    a: <>현재 <b className="text-foreground">싱가포르</b> 거주자를 대상으로 운영해요.</>,
  },
  {
    q: '회원 탈퇴는 어떻게 하나요?',
    a: <>프로필 › 계정 설정에서 탈퇴할 수 있어요. 탈퇴 시 내 정보와 등록한 책이 삭제돼요.</>,
  },
];

export const FaqSection = () => {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mt-4 space-y-2">
      {FAQS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="rounded-[14px] border border-border bg-card overflow-hidden">
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-center gap-2.5 text-left px-4 py-3.5"
            >
              <span className="shrink-0 text-[14px] font-bold text-primary tabular-nums">Q{i + 1}.</span>
              <span className="flex-1 text-[15px] font-bold text-foreground">{item.q}</span>
              <ChevronDown className={`w-4 h-4 text-faint shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 -mt-1 text-[14.5px] text-muted-foreground leading-relaxed">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
