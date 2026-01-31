import { Book as BookIcon } from 'lucide-react';

interface BookCardPreviewProps {
  title: string;
  author: string;
  coverUrl?: string | null;
  className?: string;
}

export const BookCardPreview = ({ title, author, coverUrl, className = '' }: BookCardPreviewProps) => {
  return (
    <div className={`bg-muted/80 rounded-xl p-3 flex gap-3 items-start ${className}`}>
      {coverUrl ? (
        <img
          src={coverUrl}
          alt={title}
          className="w-12 h-16 object-cover rounded-lg flex-shrink-0"
        />
      ) : (
        <div className="w-12 h-16 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
          <BookIcon className="w-5 h-5 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground text-sm line-clamp-2">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{author}</p>
      </div>
    </div>
  );
};
