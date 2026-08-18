import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SECTIONS = [
  {
    title: '제1조 (개인정보의 처리 목적)',
    content: `Moa(이하 "서비스")는 다음의 목적을 위하여 개인정보를 처리합니다. 처리한 개인정보는 다음의 목적 이외의 용도로는 사용되지 않으며, 이용 목적이 변경될 시에는 사전 동의를 구할 예정입니다.

① 회원 가입 및 관리: 회원 식별, 서비스 이용 자격 확인, 불량 회원 제재
② 서비스 제공: 책 등록·대여·판매 기능, 커뮤니티 기능, 채팅 기능 제공
③ 민원 처리: 민원인 식별, 민원 처리 결과 통보
④ 서비스 개선 및 통계: 접속 빈도 파악, 서비스 이용 통계 분석`,
  },
  {
    title: '제2조 (처리하는 개인정보 항목)',
    content: `① 회원가입 시 수집 항목
  - 필수: 이메일 주소, 비밀번호(암호화 저장), 닉네임, 거주 국가
  - 선택: 프로필 이미지

② 서비스 이용 과정에서 자동 생성·수집되는 항목
  - 서비스 이용 기록 (등록 도서, 거래 내역, 채팅 메시지)
  - 접속 IP 주소, 접속 시간, 브라우저 정보 (Supabase 인증 로그)

③ 미성년자의 개인정보
  - 서비스는 만 14세 미만 아동의 가입을 허용하지 않습니다.`,
  },
  {
    title: '제3조 (개인정보의 처리 및 보유 기간)',
    content: `① 서비스는 법령에 따른 개인정보 보유·이용 기간 또는 이용자로부터 개인정보 수집 시 동의받은 기간 내에서 개인정보를 처리·보유합니다.

② 각 개인정보 처리 및 보유 기간은 다음과 같습니다.
  - 회원 정보: 탈퇴 시까지 (탈퇴 즉시 파기)
  - 거래 내역: 거래 완료 후 1년 (분쟁 해결 목적)
  - 채팅 메시지: 대화 삭제 또는 탈퇴 시까지

③ 관련 법령에 의해 보존이 필요한 경우
  - 전자상거래 소비자 보호에 관한 법률: 계약·청약 기록 5년, 불만·분쟁 처리 기록 3년`,
  },
  {
    title: '제4조 (개인정보의 제3자 제공)',
    content: `서비스는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 다음의 경우에는 예외로 합니다.

① 이용자가 사전에 동의한 경우
② 법령의 규정에 의거하거나 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우`,
  },
  {
    title: '제5조 (개인정보 처리 위탁)',
    content: `서비스는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를 위탁하고 있습니다.

① Supabase Inc.
  - 위탁 업무: 데이터베이스 관리, 인증 서비스, 파일 스토리지
  - 위탁 기간: 서비스 이용 기간
  - 서버 위치: 아시아-태평양(싱가포르)

② 위탁 업체들은 개인정보 보호법에 따라 보안 및 기밀 유지 의무를 준수합니다.`,
  },
  {
    title: '제6조 (이용자의 권리·의무 및 행사 방법)',
    content: `① 이용자는 언제든지 다음의 권리를 행사할 수 있습니다.
  - 개인정보 처리 현황 열람 요청
  - 오류 정정 요청
  - 삭제 요청 (단, 법령에서 의무 보유하는 경우 제외)
  - 처리 정지 요청

② 권리 행사는 서비스 내 설정 메뉴 또는 이메일(leeyjin212@gmail.com)을 통해 요청하실 수 있습니다.
③ 요청을 받은 날로부터 10일 이내에 조치 결과를 알려드립니다.`,
  },
  {
    title: '제7조 (개인정보의 파기)',
    content: `① 서비스는 개인정보 보유 기간이 경과하거나 처리 목적이 달성되면 지체 없이 해당 개인정보를 파기합니다.

② 파기 방법
  - 전자적 파일 형태: 복구·재생이 불가능한 방법으로 영구 삭제
  - 기타 기록물: 파쇄 또는 소각

③ 회원 탈퇴 시 처리
  - 탈퇴 즉시 이메일·비밀번호·닉네임 등 개인 식별 정보 삭제
  - 단, 진행 중인 거래 분쟁 해결을 위해 거래 기록은 최대 1년 보관 후 파기`,
  },
  {
    title: '제8조 (개인정보 보호책임자)',
    content: `이용자의 개인정보 관련 문의, 불만 처리, 피해 구제 등에 관한 사항을 처리하기 위해 다음과 같이 개인정보 보호책임자를 지정하고 있습니다.

  - 성명: MOA운영팀
  - 이메일: leeyjin212@gmail.com
  - 연락처: leeyjin212@gmail.com (이메일 문의)

※ 개인정보 관련 문의는 이메일로 접수하며, 10일 이내에 답변 드립니다.`,
  },
  {
    title: '제9조 (개인정보 자동 수집 장치의 설치·운영 및 거부)',
    content: `① 서비스는 이용자에게 편리하고 맞춤화된 서비스를 제공하기 위해 브라우저의 로컬 스토리지(LocalStorage)를 사용합니다.
  - 사용 목적: 로그인 상태 유지, 다크모드 설정, 온보딩 완료 여부 저장

② 이용자는 브라우저 설정을 통해 로컬 스토리지 데이터를 삭제할 수 있습니다.
  - 단, 삭제 시 로그인 상태 등 일부 서비스 이용이 불편해질 수 있습니다.`,
  },
  {
    title: '제10조 (개인정보 처리방침의 변경)',
    content: `① 이 개인정보 처리방침은 2026년 5월 6일부터 적용됩니다.
② 내용 추가·삭제 및 정정이 있을 경우 변경 사항의 시행 7일 전(중요 변경의 경우 30일 전)에 공지사항을 통해 고지합니다.`,
  },
];

const PrivacyPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="header-safe sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display text-lg font-medium">개인정보 처리방침</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">시행일: 2026년 5월 6일</p>
          <p className="text-sm text-muted-foreground">서비스명: Moa (모아)</p>
        </div>

        <div className="bg-muted/50 rounded-xl p-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Moa(이하 "서비스")는 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 보호하고
            이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보 처리방침을
            수립·공개합니다.
          </p>
        </div>

        <div className="space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2 className="font-semibold text-foreground">{section.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {section.content}
              </p>
            </section>
          ))}
        </div>

        <div className="pt-4 border-t border-border space-y-2">
          <p className="text-xs text-muted-foreground">
            개인정보 침해 관련 신고·상담은 아래 기관에 문의하실 수 있습니다.
          </p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• 개인정보 침해신고센터: <a href="https://privacy.kisa.or.kr" className="underline" target="_blank" rel="noopener noreferrer">privacy.kisa.or.kr</a> (118)</li>
            <li>• 개인정보 분쟁조정위원회: <a href="https://www.kopico.go.kr" className="underline" target="_blank" rel="noopener noreferrer">kopico.go.kr</a> (1833-6972)</li>
            <li>• 대검찰청 사이버수사과: <a href="https://www.spo.go.kr" className="underline" target="_blank" rel="noopener noreferrer">spo.go.kr</a> (1301)</li>
            <li>• 경찰청 사이버안전국: <a href="https://ecrm.cyber.go.kr" className="underline" target="_blank" rel="noopener noreferrer">ecrm.cyber.go.kr</a> (182)</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPage;
