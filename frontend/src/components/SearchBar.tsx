import React from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  return (
    <div className="p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md sticky top-0 z-10 shadow-sm transition-colors">
      <div className="relative">
        <input
          type="text"
          placeholder="搜索课程..."
          className="w-full px-4 py-2 rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          onChange={(e) => onSearch(e.target.value)}
        />
        <span className="absolute right-3 top-2.5 text-gray-400 dark:text-gray-500">
          🔍
        </span>
      </div>
    </div>
  );
};
