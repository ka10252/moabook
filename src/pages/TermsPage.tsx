import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SECTIONS = [
  {
    title: '제1조 (목적)',
    content: `이 약관은 Moa(이하 "서비스")의 이용과 관련하여 운영자와 이용자 간의 권리·의무 및 책임 사항, 기타 필요한 사항을 규정함을 목적으로 합니다.`,
  },
  {
    title: '제2조 (정의)',
    content: `① "서비스"란 운영자가 제공하는 책 대여·공유·커뮤니티 플랫폼 Moa 및 관련 제반 서비스를 의미합니다.
② "이용자"란 본 약관에 동의하고 서비스를 이용하는 모든 회원을 말합니다.
③ "P2P 거래"란 이용자 간 직접 책을 대여하거나 양도·판매하는 행위를 말합니다.
④ "게시물"이란 이용자가 서비스에 게시한 텍스트, 이미지, 댓글 등 일체의 정보를 말합니다.`,
  },
  {
    title: '제3조 (약관의 효력 및 변경)',
    content: `① 본 약관은 서비스 화면에 게시하거나 기타 방법으로 이용자에게 공지함으로써 효력이 발생합니다.
② 운영자는 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 적용일로부터 7일 전(이용자에게 불리한 경우 30일 전)에 공지합니다.
③ 이용자가 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.`,
  },
  {
    title: '제4조 (서비스 이용 계약)',
    content: `① 이용 계약은 이용자가 약관 및 개인정보 처리방침에 동의한 후 회원가입을 완료함으로써 성립합니다.
② 서비스는 현재 대한민국 거주자를 대상으로 운영됩니다.
③ 다음에 해당하는 경우 가입을 거부하거나 이용 계약을 해지할 수 있습니다.
  - 타인의 정보를 도용하여 가입한 경우
  - 허위 정보를 기재한 경우
  - 관련 법령 또는 본 약관을 위반한 경우`,
  },
  {
    title: '제5조 (서비스 이용)',
    content: `① 운영자는 다음 서비스를 제공합니다.
  - 책 등록, 검색, 대여/판매 요청 기능
  - 이용자 간 채팅(메시지) 기능
  - 커뮤니티(독서 모임) 생성·참여 기능
  - 찜 목록, 알림 등 부가 기능
② 서비스는 연중무휴 24시간 제공을 원칙으로 하나, 정기 점검·설비 장애·기타 운영상 이유로 일시 중단될 수 있습니다.
③ 운영자는 서비스의 전부 또는 일부를 사전 공지 후 변경·종료할 수 있습니다.`,
  },
  {
    title: '제6조 (P2P 거래 관련)',
    content: `① 서비스는 이용자 간 책 대여·판매를 위한 플랫폼을 제공할 뿐이며, 거래 당사자가 아닙니다.
② 이용자 간 거래에서 발생하는 분쟁, 손해, 불이행 등에 대해 운영자는 책임을 지지 않습니다.
③ 거래 시 발생하는 배송비·비용 등은 거래 당사자 간 합의에 따릅니다.
④ 이용자는 타인의 책을 훼손·분실하지 않도록 주의해야 하며, 문제 발생 시 당사자 간 원만히 해결하여야 합니다.`,
  },
  {
    title: '제7조 (이용자 의무)',
    content: `이용자는 다음 행위를 하여서는 안 됩니다.
① 타인의 정보를 무단으로 이용하거나 도용하는 행위
② 허위 정보를 게시하거나 사기, 기망 행위
③ 욕설·혐오·음란 등 타인에게 불쾌감을 주는 게시물 작성
④ 서비스의 정상적 운영을 방해하는 행위 (스팸, 악성코드 배포 등)
⑤ 저작권 등 제3자의 권리를 침해하는 행위
⑥ 상업적 광고·홍보 등 영리 목적의 무단 이용
⑦ 관련 법령을 위반하는 일체의 행위`,
  },
  {
    title: '제8조 (게시물 관련)',
    content: `① 이용자가 서비스에 게시한 게시물의 저작권은 해당 이용자에게 있습니다.
② 운영자는 서비스 운영·홍보 목적으로 이용자의 게시물을 무상으로 게재·수정·배포할 수 있습니다.
③ 다음에 해당하는 게시물은 사전 통보 없이 삭제할 수 있습니다.
  - 타인의 명예를 훼손하거나 권리를 침해하는 내용
  - 음란물 또는 청소년 유해 매체물
  - 허위 사실 또는 사기성 내용
  - 기타 관련 법령에 위반되는 내용
④ 이용자는 자신의 게시물이 타인의 권리를 침해하지 않음을 보장해야 합니다.`,
  },
  {
    title: '제9조 (서비스 이용 제한)',
    content: `① 운영자는 이용자가 이 약관의 의무를 위반하거나 서비스의 정상적인 운영을 방해하는 경우, 서비스 이용을 경고·일시 정지·영구 이용 정지 등으로 제한할 수 있습니다.
② 이용 제한이 이루어지는 경우 운영자는 이용자에게 해당 사실을 통보합니다.`,
  },
  {
    title: '제10조 (책임의 제한)',
    content: `① 운영자는 천재지변, 전쟁, 불가항력적 사유로 인한 서비스 중단에 대해 책임을 지지 않습니다.
② 운영자는 이용자의 귀책 사유로 인한 서비스 이용 장애에 대해 책임을 지지 않습니다.
③ 운영자는 이용자가 서비스에 게시한 정보의 정확성·신뢰성에 대해 보증하지 않습니다.
④ 운영자는 무료로 제공하는 서비스와 관련하여 관련 법령에 특별한 규정이 없는 한 손해를 배상하지 않습니다.`,
  },
  {
    title: '제11조 (회원 탈퇴 및 자격 상실)',
    content: `① 이용자는 언제든지 서비스 내 탈퇴 기능을 통해 탈퇴를 요청할 수 있으며, 운영자는 즉시 처리합니다.
② 탈퇴 시 이용자의 게시물은 삭제되며, 진행 중인 거래가 있을 경우 상대방에게 불이익이 발생하지 않도록 사전 처리 후 탈퇴할 것을 권고합니다.
③ 탈퇴한 이용자의 아이디(이메일)는 재사용되지 않을 수 있습니다.`,
  },
  {
    title: '제12조 (분쟁 해결 및 준거법)',
    content: `① 서비스 이용과 관련하여 분쟁이 발생한 경우 운영자와 이용자는 원만한 해결을 위해 성실히 협의합니다.
② 협의가 이루어지지 않을 경우, 대한민국 법령에 따라 관할 법원에 소를 제기할 수 있습니다.
③ 이 약관은 대한민국 법률에 따라 해석됩니다.`,
  },
];

const TermsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display text-lg font-medium">이용약관</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">시행일: 2026년 5월 6일</p>
          <p className="text-sm text-muted-foreground">서비스명: Moa (모아)</p>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Moa 서비스를 이용해 주셔서 감사합니다. 본 약관은 이용자와 운영자 사이의 서비스 이용에 관한
          권리·의무 및 책임 사항을 규정합니다. 서비스 이용 전 반드시 읽어보시기 바랍니다.
        </p>

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

        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            문의: <a href="mailto:leeyjin212@gmail.com" className="underline">leeyjin212@gmail.com</a>
          </p>
        </div>
      </main>
    </div>
  );
};

export default TermsPage;
