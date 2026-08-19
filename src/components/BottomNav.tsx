import { BookOpen, Search, Upload, Users, User } from 'lucide-react';
import { motion } from 'framer-motion';

type NavItem = 'shelf' | 'wishlist' | 'upload' | 'community' | 'profile';

interface BottomNavProps {
  activeTab: NavItem;
  onTabChange: (tab: NavItem) => void;
}

const navItems = [
  { id: 'shelf' as NavItem, icon: BookOpen, label: '책장' },
  { id: 'wishlist' as NavItem, icon: Search, label: '위시리스트' },
  { id: 'upload' as NavItem, icon: Upload, label: '등록' },
  { id: 'community' as NavItem, icon: Users, label: '커뮤니티' },
  { id: 'profile' as NavItem, icon: User, label: '프로필' },
];

export const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  return (
    /* 높이를 min-h-20(80px) → min-h-14(56px) 로 줄였다.
       ⚠️ 고정 높이(h-)가 아니라 min-h- 여야 한다 — 안전영역 padding 이 더해지는데
          고정 높이면 홈 인디케이터가 있는 기종에서 안쪽이 눌린다.
       safe-bottom 이 홈 인디케이터만큼 아래를 더 밀어주므로 여백은 그쪽에서 나온다. */
    <nav className="nav-bar safe-bottom fixed bottom-0 left-0 right-0 z-40 min-h-14 flex flex-col">
      {/* flex-1 로 안쪽이 탭바 높이를 다 쓴다 — 안 그러면 내용이 위로 붙고 아래에 빈 띠가 남는다
          (안전영역 padding 은 nav 가 갖고 있으므로 그 위쪽만 채운다) */}
      <div className="flex-1 flex items-stretch justify-around px-2 max-w-[520px] mx-auto w-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            // 활성 표시는 색(코랄)과 굵기로 충분하다. 점을 더하면 중복 신호다.
            <button
              key={item.id}
              // 온보딩 스포트라이트가 이 버튼을 실제로 조준한다
              data-onboarding={`nav-${item.id}`}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onTabChange(item.id)}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[11px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
      
    </nav>
  );
};
