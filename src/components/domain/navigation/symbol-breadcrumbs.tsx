import React from 'react';
import { Instrument } from '../../../core/market-data';

export interface SymbolBreadcrumbsProps {
  instrument: Instrument;
  className?: string;
}

export const SymbolBreadcrumbs: React.FC<SymbolBreadcrumbsProps> = ({
  instrument: item,
  className = '',
}) => {
  const isIndia = item.country === 'IN' || ['NSE', 'BSE'].includes(item.exchange);
  const countryName = item.country === 'IN' ? 'India' : item.country === 'US' ? 'United States' : item.country === 'JP' ? 'Japan' : item.country === 'UK' ? 'UK' : 'Global';
  const assetLabel =
    item.assetType === 'index'
      ? 'Indices'
      : item.assetType === 'mf'
      ? 'Mutual Funds'
      : item.assetType === 'etf'
      ? 'ETFs'
      : item.assetType === 'bonds'
      ? 'Bonds & Gilts'
      : item.assetType === 'ipo'
      ? 'IPOs'
      : 'Stocks';

  let sector = item.sector || 'Energy Minerals';
  let industry = item.industry || 'Oil Refining/Marketing';

  if (item.symbol === 'RELIANCE') {
    sector = 'Energy Minerals';
    industry = 'Oil Refining/Marketing';
  } else if (item.symbol === 'TCS' || item.symbol === 'INFY' || item.symbol === 'WIPRO') {
    sector = 'Technology Services';
    industry = 'Information Technology Services';
  } else if (item.symbol === 'HDFCBANK' || item.symbol === 'ICICIBANK' || item.symbol === 'SBIN') {
    sector = 'Finance';
    industry = 'Major Banks';
  } else if (item.symbol === 'TATAMOTORS' || item.symbol === 'MARUTI') {
    sector = 'Consumer Durables';
    industry = 'Motor Vehicles';
  }

  const crumbs = [
    { label: 'Markets', href: '/index.html' },
    { label: countryName, href: `/index.html?market=${item.country}` },
    { label: assetLabel, href: `/instrument.html?category=${item.assetType || 'stocks'}` },
    { label: sector, href: '#' },
    { label: industry, href: '#' },
    { label: item.symbol, href: `/instrument.html?symbol=${encodeURIComponent(item.symbol)}`, isCurrent: true },
  ];

  return (
    <div className={`inst-hero-breadcrumbs ${className}`}>
      {crumbs.map((crumb, idx) => (
        <React.Fragment key={crumb.label}>
          {idx > 0 && <span className="inst-breadcrumb-sep">/</span>}
          {crumb.isCurrent ? (
            <span className="inst-breadcrumb-active">
              {crumb.label}
            </span>
          ) : (
            <a href={crumb.href} className="inst-breadcrumb-link">
              {crumb.label}
            </a>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
