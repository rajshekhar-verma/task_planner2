import { useState, useEffect } from 'react';
import { ExchangeRateResponse, Project } from '../types';

export function useExchangeRate() {
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchExchangeRate = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Try to use API key if provided in env vars
      const apiKey = import.meta.env.VITE_EXCHANGE_RATE_API_KEY;
      
      let url = 'https://api.frankfurter.app/latest?from=USD&to=INR';
      
      // If API key is provided, use a premium service
      if (apiKey) {
        url = `https://api.apilayer.com/exchangerates_data/latest?base=USD&symbols=INR&apikey=${apiKey}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.rates || !data.rates.INR) {
        throw new Error('Invalid response format');
      }
      
      setExchangeRate(data.rates.INR);
      setLastUpdated(new Date());
      
      // Store in localStorage for offline use
      localStorage.setItem('exchangeRate', data.rates.INR.toString());
      localStorage.setItem('exchangeRateUpdated', new Date().toISOString());
      
    } catch (err) {
      console.error('Error fetching exchange rate:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch exchange rate');
      
      // Try to use cached rate from localStorage
      const cachedRate = localStorage.getItem('exchangeRate');
      const cachedUpdated = localStorage.getItem('exchangeRateUpdated');
      
      if (cachedRate) {
        setExchangeRate(parseFloat(cachedRate));
        if (cachedUpdated) {
          setLastUpdated(new Date(cachedUpdated));
        }
      } else {
        // Fallback to a reasonable default if API fails and no cache
        setExchangeRate(83.5); // Approximate USD to INR rate
        setLastUpdated(new Date());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Try to use cached rate first for immediate display
    const cachedRate = localStorage.getItem('exchangeRate');
    const cachedUpdated = localStorage.getItem('exchangeRateUpdated');
    
    if (cachedRate) {
      setExchangeRate(parseFloat(cachedRate));
      if (cachedUpdated) {
        setLastUpdated(new Date(cachedUpdated));
      }
    }
    
    // Then fetch fresh rate
    fetchExchangeRate();
    
    // Refresh exchange rate every hour
    const interval = setInterval(fetchExchangeRate, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const convertUSDtoINR = (amountUSD: number, project?: Project): number => {
    if (!amountUSD || exchangeRate === null) return 0;
    
    // If project has a custom conversion factor, use it
    if (project?.inr_conversion_factor) {
      return amountUSD * exchangeRate * project.inr_conversion_factor;
    }
    
    // Default conversion
    return amountUSD * exchangeRate;
  };

  return {
    exchangeRate,
    loading,
    error,
    lastUpdated,
    convertUSDtoINR,
    refreshRate: fetchExchangeRate
  };
}