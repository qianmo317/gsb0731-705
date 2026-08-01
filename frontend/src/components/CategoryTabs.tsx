import React from 'react';

interface CategoryTabsProps {
  categories: string[];
  selectedCategory: string;
  onSelect: (category: string) => void;
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({ categories, selectedCategory, onSelect }) => {
  return (
    <div className="relative group">
       {/* Left Fade */}
       <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white dark:from-gray-900 to-transparent pointer-events-none z-10 hidden md:block"></div>
       
       <div className="flex overflow-x-auto space-x-2 p-2 scrollbar-hide scroll-smooth whitespace-nowrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => onSelect(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all active:scale-95 flex-shrink-0
                 ${selectedCategory === cat 
                   ? 'bg-blue-600 text-white shadow-md' 
                   : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}
              `}
            >
              {cat}
            </button>
          ))}
       </div>

       {/* Right Fade */}
       <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-gray-900 to-transparent pointer-events-none z-10"></div>
    </div>
  );
};
