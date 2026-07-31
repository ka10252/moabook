import { BookOpen, BookPlus, Upload, Users, User } from 'lucide-react';
import { motion } from 'framer-motion';

type NavItem = 'shelf' | 'wishlist' | 'upload' | 'community' | 'profile';

interface BottomNavProps {
  activeTab: NavItem;
  onTabChange: (tab: NavItem) => void;
}

const navItems = [
  { id: 'shelf' as NavItem, icon: BookOpen, label: '책장' },
  { id: 'wishlist' as NavItem, icon: BookPlus, label: '위시리스트' },
  { id: 'upload' as NavItem, icon: Upload, label: '등록' },
  { id: 'community' as NavItem, icon: Users, label: '커뮤니티' },
  { id: 'profile' as NavItem, icon: User, label: '프로필' },
];

export const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  return (
    <nav className="nav-bar fixed bottom-0 left-0 right-0 z-40 h-20">
      <div className="flex items-center justify-around px-2 max-w-[520px] mx-auto w-full h-full">
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
              <span className="text-[9px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
      
      {/* Safe area padding for iOS */}
      <div className="h-safe-area-inset-bottom bg-card" />
    </nav>
  );
};
