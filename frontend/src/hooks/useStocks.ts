import { useState, useEffect, useCallback } from 'react';
import type { Stock } from '../types';
import { fetchStockList } from '../services/api';

export function useStocks() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [asset, setAsset] = useState('');
  const [page, setPage] = useState(1);

  const loadStocks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchStockList({ keyword, asset, page, page_size: 50 });
      setStocks(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load stocks:', err);
    } finally {
      setLoading(false);
    }
  }, [keyword, asset, page]);

  useEffect(() => {
    loadStocks();
  }, [loadStocks]);

  return { stocks, total, loading, keyword, setKeyword, asset, setAsset, page, setPage, reload: loadStocks };
}
