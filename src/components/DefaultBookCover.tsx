interface DefaultBookCoverProps {
  title: string;
  author: string;
  className?: string;
}

const spineColors = [
  'from-book-1 to-book-1/80',
  'from-book-2 to-book-2/80',
  'from-book-3 to-book-3/80',
  'from-book-4 to-book-4/80',
  'from-book-5 to-book-5/80',
  'from-book-6 to-book-6/80',
];

export const DefaultBookCover = ({ title, author, className = '' }: DefaultBookCoverProps) => {
  // Generate a consistent color based on title
  const colorIndex = title.charCodeAt(0) % spineColors.length;
  const colorClass = spineColors[colorIndex];

  return (
    <div 
      className={`bg-gradient-to-br ${colorClass} rounded-lg flex flex-col items-center justify-center p-4 text-center ${className}`}
    >
      {/* Decorative lines at top */}
      <div className="w-12 h-0.5 bg-white/30 mb-2 rounded-full" />
      <div className="w-8 h-0.5 bg-white/20 mb-4 rounded-full" />
      
      {/* Title */}
      <h3 className="text-white font-bold text-sm leading-tight line-clamp-3 mb-2">
        {title}
      </h3>
      
      {/* Author */}
      <p className="text-white/70 text-xs line-clamp-2">
        {author}
      </p>
      
      {/* Decorative lines at bottom */}
      <div className="mt-auto pt-4">
        <div className="w-8 h-0.5 bg-white/20 mb-2 rounded-full" />
        <div className="w-12 h-0.5 bg-white/30 rounded-full" />
      </div>
    </div>
  );
};
