import React, { useState } from 'react';
import { useWorkbenchStore } from '../../../core/workbench/store';
import type { HonbaClient } from '../../../core/api/generated/client';
import { HbModal } from '../../ui/hb-modal';
import { MarketDepth } from './market-depth';
import { ArrowDownUp, Check, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';

interface OrderModalProps {
  client?: HonbaClient;
}

export const OrderModal: React.FC<OrderModalProps> = ({ client }) => {
  const {
    isOrderModalOpen,
    closeOrderModal,
    orderTicket,
    setTicketField,
    placeOrder,
    tradingState,
  } = useWorkbenchStore();

  const [showDepth, setShowDepth] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOrderModalOpen) return null;

  const isBuy = orderTicket.side === 'buy';
  const isMarket = orderTicket.orderType === 'market';
  const isStop =
    orderTicket.orderType === 'stop_market' || orderTicket.orderType === 'stop_limit';
  const effectivePrice = isMarket ? orderTicket.price : orderTicket.price;
  const orderValue = Number((effectivePrice * orderTicket.quantity).toFixed(2));
  const marginRequired = Number(
    (orderValue * (orderTicket.product === 'intraday' ? 0.2 : 1.0)).toFixed(2)
  );

  const handleSubmit = async () => {
    if (tradingState === 'halted') return;
    setSubmitting(true);
    try {
      await placeOrder(client);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        closeOrderModal();
      }, 500);
    } finally {
      setSubmitting(false);
    }
  };

  const quickIncrements = [1, 10, 25, 50, 100, 250];

  return (
    <HbModal
      isOpen={isOrderModalOpen}
      onClose={closeOrderModal}
      width={460}
      maxWidth="94vw"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.04em',
              background: isBuy ? 'var(--bullish)' : 'var(--bearish)',
              color: '#ffffff',
            }}
          >
            {isBuy ? 'BUY' : 'SELL'}
          </span>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {orderTicket.symbol}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--text-muted)',
              background: 'var(--bg-app)',
              padding: '2px 6px',
              borderRadius: 3,
              border: '1px solid var(--border-subtle)',
            }}
          >
            NSE EQ
          </span>
        </div>
      }
      subtitle={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            LTP:{' '}
            <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-family-mono)' }}>
              ₹{orderTicket.price.toFixed(2)}
            </strong>
          </span>
          <span style={{ color: 'var(--border-subtle)' }}>•</span>
          <button
            type="button"
            onClick={() => setShowDepth(!showDepth)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 11,
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-primary)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <ArrowDownUp size={11} />
            {showDepth ? 'Hide Market Depth' : 'Show Market Depth'}
          </button>
        </div>
      }
      footer={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Margin Required
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-family-mono)',
              }}
            >
              ₹{marginRequired.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={closeOrderModal}
              style={{
                padding: '7px 14px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 4,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface-elevated)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || tradingState === 'halted'}
              onClick={() => void handleSubmit()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 20px',
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 4,
                border: 'none',
                background: isBuy ? 'var(--bullish)' : 'var(--bearish)',
                color: '#ffffff',
                cursor: submitting || tradingState === 'halted' ? 'not-allowed' : 'pointer',
                opacity: submitting || tradingState === 'halted' ? 0.6 : 1,
                boxShadow: `0 2px 8px ${isBuy ? 'var(--bullish-subtle)' : 'var(--bearish-subtle)'}`,
                transition: 'all 0.15s ease',
              }}
            >
              {success ? (
                <>
                  <Check size={14} /> Placed
                </>
              ) : submitting ? (
                'Placing...'
              ) : (
                `${isBuy ? 'BUY' : 'SELL'} ${orderTicket.symbol}`
              )}
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Trading Halted Banner */}
        {tradingState === 'halted' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 6,
              background: 'var(--bearish-subtle)',
              border: '1px solid var(--bearish)',
              color: 'var(--bearish)',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <AlertTriangle size={15} />
            Trading engine is currently HALTED. Orders cannot be submitted.
          </div>
        )}

        {/* Market Depth Accordion */}
        {showDepth && (
          <div
            style={{
              padding: 10,
              background: 'var(--bg-app)',
              borderRadius: 6,
              border: '1px solid var(--border-subtle)',
            }}
          >
            <MarketDepth symbol={orderTicket.symbol} />
          </div>
        )}

        {/* Side Toggle: Buy / Sell */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            type="button"
            onClick={() => setTicketField('side', 'buy')}
            style={{
              padding: '8px 0',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 6,
              cursor: 'pointer',
              border: isBuy ? '1px solid var(--bullish)' : '1px solid var(--border-subtle)',
              background: isBuy ? 'var(--bullish)' : 'var(--bg-app)',
              color: isBuy ? '#ffffff' : 'var(--bullish)',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Zap size={13} /> BUY
          </button>
          <button
            type="button"
            onClick={() => setTicketField('side', 'sell')}
            style={{
              padding: '8px 0',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 6,
              cursor: 'pointer',
              border: !isBuy ? '1px solid var(--bearish)' : '1px solid var(--border-subtle)',
              background: !isBuy ? 'var(--bearish)' : 'var(--bg-app)',
              color: !isBuy ? '#ffffff' : 'var(--bearish)',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Zap size={13} /> SELL
          </button>
        </div>

        {/* Product Type (MIS vs CNC) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Product Type
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {orderTicket.product === 'intraday' ? '5x Leverage Intraday' : 'Zero Leverage Delivery'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {(['intraday', 'delivery'] as const).map((p) => {
              const active = orderTicket.product === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTicketField('product', p)}
                  style={{
                    padding: '8px 10px',
                    fontSize: 12,
                    borderRadius: 6,
                    border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    background: active ? 'var(--accent-subtle)' : 'var(--bg-app)',
                    color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{p === 'intraday' ? 'Intraday (MIS)' : 'Longterm (CNC)'}</span>
                  {active && <ShieldCheck size={13} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Order Type Tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Order Type
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
            {[
              { id: 'market', label: 'Market' },
              { id: 'limit', label: 'Limit' },
              { id: 'stop_limit', label: 'SL' },
              { id: 'stop_market', label: 'SL-M' },
            ].map((t) => {
              const active = orderTicket.orderType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTicketField('orderType', t.id as any)}
                  style={{
                    padding: '6px 0',
                    fontSize: 11,
                    borderRadius: 4,
                    border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    background: active ? 'var(--accent-subtle)' : 'var(--bg-app)',
                    color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quantity & Quick Chips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Quantity (Shares)
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Lot size: 1</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => setTicketField('quantity', Math.max(1, orderTicket.quantity - 1))}
              style={{
                width: 34,
                height: 34,
                borderRadius: 4,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-app)',
                color: 'var(--text-primary)',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              -
            </button>
            <input
              type="number"
              min="1"
              value={orderTicket.quantity}
              onChange={(e) =>
                setTicketField('quantity', Math.max(1, parseInt(e.target.value) || 1))
              }
              style={{
                flex: 1,
                height: 34,
                textAlign: 'center',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'var(--font-family-mono)',
                borderRadius: 4,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-app)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => setTicketField('quantity', orderTicket.quantity + 1)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 4,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-app)',
                color: 'var(--text-primary)',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              +
            </button>
          </div>

          {/* Quick Increment Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            {quickIncrements.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setTicketField('quantity', orderTicket.quantity + chip)}
                style={{
                  padding: '2px 8px',
                  borderRadius: 3,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-app)',
                  color: 'var(--text-secondary)',
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                +{chip}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTicketField('quantity', 1)}
              style={{
                padding: '2px 8px',
                borderRadius: 3,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-app)',
                color: 'var(--text-muted)',
                fontSize: 10,
                cursor: 'pointer',
                marginLeft: 'auto',
              }}
            >
              Reset (1)
            </button>
          </div>
        </div>

        {/* Price & Trigger Price Inputs Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Price (₹)
            </span>
            <input
              type="number"
              step="0.05"
              value={isMarket ? '' : orderTicket.price}
              placeholder={isMarket ? `MKT (${orderTicket.price.toFixed(2)})` : '0.00'}
              disabled={isMarket}
              onChange={(e) =>
                setTicketField('price', Math.max(0, parseFloat(e.target.value) || 0))
              }
              style={{
                height: 32,
                padding: '0 8px',
                borderRadius: 4,
                border: '1px solid var(--border-subtle)',
                background: isMarket ? 'var(--bg-surface-elevated)' : 'var(--bg-app)',
                color: isMarket ? 'var(--text-muted)' : 'var(--text-primary)',
                fontFamily: 'var(--font-family-mono)',
                fontSize: 12,
                fontWeight: 600,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Trigger Price (₹)
            </span>
            <input
              type="number"
              step="0.05"
              value={isStop ? orderTicket.triggerPrice || '' : ''}
              placeholder={isStop ? 'Trigger' : 'N/A'}
              disabled={!isStop}
              onChange={(e) =>
                setTicketField('triggerPrice', Math.max(0, parseFloat(e.target.value) || 0))
              }
              style={{
                height: 32,
                padding: '0 8px',
                borderRadius: 4,
                border: '1px solid var(--border-subtle)',
                background: !isStop ? 'var(--bg-surface-elevated)' : 'var(--bg-app)',
                color: !isStop ? 'var(--text-muted)' : 'var(--text-primary)',
                fontFamily: 'var(--font-family-mono)',
                fontSize: 12,
                fontWeight: 600,
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Validity & Order Value Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: 6,
            background: 'var(--bg-app)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Validity:</span>
            {(['day', 'ioc'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setTicketField('tif', v)}
                style={{
                  padding: '2px 6px',
                  borderRadius: 3,
                  border: orderTicket.tif === v ? '1px solid var(--accent-primary)' : '1px solid transparent',
                  background: orderTicket.tif === v ? 'var(--accent-subtle)' : 'transparent',
                  color: orderTicket.tif === v ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                {v}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            Value:{' '}
            <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-family-mono)' }}>
              ₹{orderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </strong>
          </div>
        </div>
      </div>
    </HbModal>
  );
};
