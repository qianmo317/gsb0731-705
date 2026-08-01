import { useMemo, useState } from 'react';

// Define a generic interface for searchable items
interface SearchableItem {
  id: string;
  title: string;
  category: string;
  keywords?: string[];
  [key: string]: any;
}

export const useSearch = <T extends SearchableItem>(items: T[]) => {
  const [query, setQuery] = useState('');

  const filteredItems = useMemo(() => {
    if (!query) return items;

    const lowerQuery = query.toLowerCase();
    
    return items.filter((item) => {
      const titleMatch = item.title.toLowerCase().includes(lowerQuery);
      const categoryMatch = item.category.toLowerCase().includes(lowerQuery);
      const keywordMatch = item.keywords?.some(k => k.toLowerCase().includes(lowerQuery));

      return titleMatch || categoryMatch || keywordMatch;
    });
  }, [items, query]);

  return {
    query,
    setQuery,
    filteredItems
  };
};
