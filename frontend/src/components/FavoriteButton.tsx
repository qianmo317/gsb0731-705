// This component is mainly for the heart icon button, 
// to be used in list items or the player.
import React from 'react';
import { Heart } from 'lucide-react';

interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggle: (e: React.MouseEvent) => void;
  className?: string;
}

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({ isFavorite, onToggle, className = "" }) => {
  return (
    <button onClick={onToggle} className={`p-2 rounded-full transition-transform active:scale-90 ${className}`}>
      <Heart 
        size={20} 
        className={isFavorite ? "fill-red-500 text-red-500" : "text-gray-400 dark:text-gray-500"} 
      />
    </button>
  );
};
