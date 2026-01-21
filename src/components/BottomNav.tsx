import { BookOpen, Heart, Upload, Library, User } from 'lucide-react';
import { motion } from 'framer-motion';

type NavItem = 'shelf' | 'wishlist' | 'upload' | 'library' | 'profile';

interface BottomNavProps {
  activeTab: NavItem;
  onTabChange: (tab: NavItem) => void;
}

const navItems = [
  { id: 'shelf' as NavItem, icon: BookOpen, label: "Everybody's" },
  { id: 'wishlist' as NavItem, icon: Heart, label: 'Wishlist' },
  { id: 'upload' as NavItem, icon: Upload, label: 'Upload' },
  { id: 'library' as NavItem, icon: Library, label: 'My Library' },
  { id: 'profile' as NavItem, icon: User, label: 'Profile' },
];

export const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  return (
    <nav className="nav-bar fixed bottom-0 left-0 right-0 z-40">
      <div className="flex items-center justify-around py-2 px-4 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              className={`nav-item relative ${isActive ? 'active' : ''}`}
              onClick={() => onTabChange(item.id)}
            >
              {isActive && (
                <motion.div
                  className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                  layoutId="navIndicator"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
      
      {/* Safe area padding for iOS */}
      <div className="h-safe-area-inset-bottom bg-card" />
    </nav>
  );
};
