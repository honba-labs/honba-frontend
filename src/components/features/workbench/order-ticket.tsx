import React, { useState } from 'react';
import { useWorkbenchStore } from '../../../core/workbench/store';
import type { HonbaClient } from '../../../core/api/generated/client';
import { MarketDepth } from './market-depth';
import { ArrowDownUp, Check, X } from 'lucide-react';

interface OrderTicketProps {
  client?: HonbaClient;
}

export const OrderTicket: React.FC<OrderTicketProps> = ({ client }) => {
  const { orderTicket, setTicketField, placeOrder, tradingState, closeOrderTicket } = useWorkbenchStore();
  const [showDepth, setShowDepth] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isBuy = orderTicket.side === 'buy';
  const isMarket = orderTicket.orderType === 'market';
  const isStop = orderTicket.orderType === 'stop_market' || orderTicket.orderType === 'stop_limit';
  const effectivePrice = isMarket ? orderTicket.price : orderTicket.price;
  const orderValue = Number((effectivePrice * orderTicket.quantity).toFixed(2));
  const marginRequired = Number((orderValue * (orderTicket.product === 'intraday' ? 0.2 : 1.0)).toFixed(2));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await placeOrder(client);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-subtle)',
        width: 320,
        minWidth: 320,
        height: '100%',
        overflowY: 'auto',
        padding: 14,
        gap: 12,
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{orderTicket.symbol}</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>NSE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setShowDepth(!showDepth)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              padding: '2px 6px',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              background: showDepth ? 'var(--bg-surface-elevated)' : 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <ArrowDownUp size={11} /> Depth
          </button>
          <button
            onClick={closeOrderTicket}
            title="Close Order Ticket"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              border: 'none',
              borderRadius: 4,
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {showDepth && <MarketDepth symbol={orderTicket.symbol} />}

      {/* Buy / Sell Toggle */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <button
          onClick={() => setTicketField('side', 'buy')}
          style={{
            padding: '7px 0',
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 4,
            cursor: 'pointer',
            border: isBuy ? '1px solid var(--bullish)' : '1px solid var(--border-subtle)',
            background: isBuy ? 'var(--bullish)' : 'var(--bullish-subtle)',
            color: isBuy ? '#ffffff' : 'var(--bullish)',
            transition: 'all 0.15s ease',
          }}
        >
          BUY
        </button>
        <button
          onClick={() => setTicketField('side', 'sell')}
          style={{
            padding: '7px 0',
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 4,
            cursor: 'pointer',
            border: !isBuy ? '1px solid var(--bearish)' : '1px solid var(--border-subtle)',
            background: !isBuy ? 'var(--bearish)' : 'var(--bearish-subtle)',
            color: !isBuy ? '#ffffff' : 'var(--bearish)',
            transition: 'all 0.15s ease',
          }}
        >
          SELL
        </button>
      </div>

      {/* Product Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Product</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {(['intraday', 'delivery'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setTicketField('product', p)}
              style={{
                padding: '4px 0',
                fontSize: 11,
                borderRadius: 4,
                border: '1px solid var(--border-subtle)',
                background: orderTicket.product === p ? 'var(--bg-surface-elevated)' : 'var(--bg-app)',
                color: orderTicket.product === p ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: orderTicket.product === p ? 600 : 400,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {p === 'intraday' ? 'Intraday (MIS 5x)' : 'Delivery (CNC)'}
            </button>
          ))}
        </div>
      </div>

      {/* Order Type Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Order Type</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
          {(['market', 'limit', 'stop_market', 'stop_limit'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTicketField('orderType', t)}
              style={{
                padding: '4px 0',
                fontSize: 10,
                borderRadius: 4,
                border: '1px solid var(--border-subtle)',
                background: orderTicket.orderType === t ? 'var(--accent-primary)' : 'var(--bg-app)',
                color: orderTicket.orderType === t ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: orderTicket.orderType === t ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {t === 'market' ? 'MKT' : t === 'limit' ? 'LMT' : t === 'stop_market' ? 'SL-M' : 'SL'}
            </button>
          ))}
        </div>
      </div>

      {/* Quantity & Steppers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
          <span>QUANTITY</span>
          <span>Lot: 1</span>
        </div>
        <input
          type="number"
          min="1"
          value={orderTicket.quantity}
          onChange={(e) => setTicketField('quantity', Math.max(1, parseInt(e.target.value) || 1))}
          style={{
            background: 'var(--bg-app)',
            border: '1px solid var(--border-medium)',
            color: 'var(--text-primary)',
            padding: '6px 8px',
            borderRadius: 4,
            fontSize: 12,
            fontFamily: 'var(--font-family-mono)',
          }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {[10, 25, 50, 100].map((step) => (
            <button
              key={step}
              onClick={() => setTicketField('quantity', orderTicket.quantity + step)}
              style={{
                flex: 1,
                fontSize: 10,
                padding: '2px 0',
                borderRadius: 3,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface-elevated)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              +{step}
            </button>
          ))}
        </div>
      </div>

      {/* Price Input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Price (₹)</span>
        <input
          type="number"
          step="0.05"
          disabled={isMarket}
          value={isMarket ? '' : orderTicket.price}
          placeholder={isMarket ? `Market (LTP ₹${orderTicket.price})` : 'Enter limit price'}
          onChange={(e) => setTicketField('price', parseFloat(e.target.value) || 0)}
          style={{
            background: isMarket ? 'var(--bg-surface-hover)' : 'var(--bg-app)',
            border: '1px solid var(--border-medium)',
            color: 'var(--text-primary)',
            padding: '6px 8px',
            borderRadius: 4,
            fontSize: 12,
            fontFamily: 'var(--font-family-mono)',
            opacity: isMarket ? 0.6 : 1,
          }}
        />
      </div>

      {/* Trigger Price */}
      {isStop && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Trigger Price (₹)</span>
          <input
            type="number"
            step="0.05"
            value={orderTicket.triggerPrice}
            onChange={(e) => setTicketField('triggerPrice', parseFloat(e.target.value) || 0)}
            style={{
              background: 'var(--bg-app)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              padding: '6px 8px',
              borderRadius: 4,
              fontSize: 12,
              fontFamily: 'var(--font-family-mono)',
            }}
          />
        </div>
      )}

      {/* Cost & Margin Summary */}
      <div
        style={{
          background: 'var(--bg-app)',
          borderRadius: 4,
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          fontSize: 11,
          fontFamily: 'var(--font-family-mono)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
          <span>Order Value:</span>
          <span>₹{orderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)', fontWeight: 600 }}>
          <span>Margin Req:</span>
          <span>₹{marginRequired.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={submitting || tradingState === 'halted'}
        style={{
          marginTop: 'auto',
          padding: '10px 0',
          fontSize: 13,
          fontWeight: 700,
          borderRadius: 6,
          border: 'none',
          cursor: tradingState === 'halted' ? 'not-allowed' : 'pointer',
          background:
            tradingState === 'halted'
              ? 'var(--text-disabled)'
              : isBuy
              ? 'var(--bullish)'
              : 'var(--bearish)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          transition: 'all 0.15s ease',
        }}
      >
        {submitting ? 'Placing...' : (
          <>
            <Check size={14} />
            {isBuy ? 'Place BUY Order' : 'Place SELL Order'}
          </>
        )}
      </button>
    </div>
  );
};
