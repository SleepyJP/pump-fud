import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  CrosshairMode,
} from 'lightweight-charts'
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  AreaData,
  HistogramData,
  Time,
  MouseEventParams,
} from 'lightweight-charts'
import { formatEther } from 'viem'

type ChartType = 'candle' | 'line' | 'area'
type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'

interface CandlestickChartProps {
  tokenAddress: string
  reserveBalance: bigint
  tokensSold: bigint
  launchTime: number
  themeColor?: string
}

interface OHLCData {
  time: Time
  open: number
  high: number
  low: number
  close: number
  volume: number
}

const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
}

// DexScreener-style colors
const DEXSCREENER_COLORS = {
  upColor: '#00ff88',
  downColor: '#ff3366',
  volumeUpColor: 'rgba(0, 255, 136, 0.35)',
  volumeDownColor: 'rgba(255, 51, 102, 0.35)',
  gridColor: 'rgba(255, 255, 255, 0.04)',
  textColor: '#9ca3af',
  crosshairColor: '#666',
}

export function CandlestickChart({
  reserveBalance,
  tokensSold,
  launchTime,
  themeColor = '#00ff88',
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const mainSeriesRef = useRef<ISeriesApi<'Candlestick' | 'Line' | 'Area'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)

  const [chartType, setChartType] = useState<ChartType>('candle')
  const [timeframe, setTimeframe] = useState<Timeframe>('15m')
  const [crosshairData, setCrosshairData] = useState<{
    price: string
    time: string
    open: string
    high: string
    low: string
    close: string
    change: string
    volume: string
    isUp: boolean
  } | null>(null)

  // Calculate current price from bonding curve
  const currentPrice = useMemo(() => {
    if (!tokensSold || tokensSold === 0n) return 0.00001
    if (!reserveBalance || reserveBalance === 0n) return 0.00001
    const sold = Number(formatEther(tokensSold))
    const reserve = Number(formatEther(reserveBalance))
    if (sold === 0) return 0.00001
    return reserve / sold
  }, [reserveBalance, tokensSold])

  // Generate OHLC data from bonding curve simulation
  const ohlcData = useMemo((): OHLCData[] => {
    const data: OHLCData[] = []
    const now = Math.floor(Date.now() / 1000)
    const startTime = launchTime > 0 ? launchTime : now - 86400

    const INITIAL_PRICE = 0.00001
    const CURVE_STEEPNESS = 0.000001

    const intervalSeconds = TIMEFRAME_SECONDS[timeframe]
    const totalSold = Number(formatEther(tokensSold || 0n))
    const numCandles = Math.min(100, Math.floor((now - startTime) / intervalSeconds))

    if (numCandles <= 0) {
      return [{
        time: now as Time,
        open: INITIAL_PRICE,
        high: INITIAL_PRICE,
        low: INITIAL_PRICE,
        close: INITIAL_PRICE,
        volume: 0,
      }]
    }

    // Create realistic price action with randomness
    let prevClose = INITIAL_PRICE
    for (let i = 0; i < numCandles; i++) {
      const candleTime = startTime + (i * intervalSeconds)
      const progress = i / numCandles
      const nextProgress = (i + 1) / numCandles

      const baseSoldAtPoint = totalSold * progress
      const baseSoldAtNext = totalSold * nextProgress

      const targetPrice = INITIAL_PRICE + (CURVE_STEEPNESS * baseSoldAtNext)

      // Add realistic variance
      const volatility = 0.08 + Math.random() * 0.12
      const trend = targetPrice > prevClose ? 0.6 : 0.4

      const isUp = Math.random() < trend
      const bodySize = volatility * Math.random()
      const wickSize = volatility * 0.5 * Math.random()

      let open = prevClose
      let close: number
      let high: number
      let low: number

      if (isUp) {
        close = open * (1 + bodySize)
        high = close * (1 + wickSize)
        low = open * (1 - wickSize * 0.5)
      } else {
        close = open * (1 - bodySize)
        low = close * (1 - wickSize)
        high = open * (1 + wickSize * 0.5)
      }

      // Ensure positive values
      open = Math.max(0.000001, open)
      close = Math.max(0.000001, close)
      high = Math.max(high, Math.max(open, close))
      low = Math.min(low, Math.min(open, close))
      low = Math.max(0.000001, low)

      // Volume simulation
      const volumeBase = baseSoldAtNext - baseSoldAtPoint
      const volume = Math.abs(volumeBase) * (0.5 + Math.random())

      data.push({
        time: candleTime as Time,
        open,
        high,
        low,
        close,
        volume,
      })

      prevClose = close
    }

    // Add current candle
    if (data.length > 0) {
      const lastCandle = data[data.length - 1]
      const currentOpen = lastCandle.close
      data.push({
        time: now as Time,
        open: currentOpen,
        high: Math.max(currentOpen, currentPrice) * 1.002,
        low: Math.min(currentOpen, currentPrice) * 0.998,
        close: currentPrice,
        volume: 0,
      })
    }

    return data
  }, [tokensSold, launchTime, timeframe, currentPrice])

  // Convert OHLC to format needed for each chart type
  const candleData = useMemo((): CandlestickData<Time>[] =>
    ohlcData.map(d => ({
      time: d.time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    })), [ohlcData])

  const lineData = useMemo((): LineData<Time>[] =>
    ohlcData.map(d => ({
      time: d.time,
      value: d.close,
    })), [ohlcData])

  const areaData = useMemo((): AreaData<Time>[] =>
    ohlcData.map(d => ({
      time: d.time,
      value: d.close,
    })), [ohlcData])

  const volumeData = useMemo((): HistogramData<Time>[] =>
    ohlcData.map(d => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? DEXSCREENER_COLORS.volumeUpColor : DEXSCREENER_COLORS.volumeDownColor,
    })), [ohlcData])

  // Format numbers for display
  const formatPrice = (price: number) => {
    if (price < 0.00000001) return price.toExponential(2)
    if (price < 0.0001) return price.toFixed(10)
    if (price < 1) return price.toFixed(8)
    return price.toFixed(4)
  }

  const formatVolume = (vol: number) => {
    if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`
    if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`
    if (vol >= 1_000) return `${(vol / 1_000).toFixed(2)}K`
    return vol.toFixed(2)
  }

  // Crosshair handler - DexScreener style
  const handleCrosshairMove = useCallback((param: MouseEventParams<Time>) => {
    if (!param.time || !param.point) {
      setCrosshairData(null)
      return
    }

    const data = ohlcData.find(d => d.time === param.time)
    if (data) {
      const change = ((data.close - data.open) / data.open * 100)
      const isUp = data.close >= data.open
      setCrosshairData({
        price: formatPrice(data.close),
        time: new Date(Number(data.time) * 1000).toLocaleString(),
        open: formatPrice(data.open),
        high: formatPrice(data.high),
        low: formatPrice(data.low),
        close: formatPrice(data.close),
        change: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
        volume: formatVolume(data.volume),
        isUp,
      })
    }
  }, [ohlcData])

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    const container = chartContainerRef.current
    const rect = container.getBoundingClientRect()
    const width = rect.width || 600
    const height = rect.height || 350

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: DEXSCREENER_COLORS.textColor,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      },
      grid: {
        vertLines: { color: DEXSCREENER_COLORS.gridColor },
        horzLines: { color: DEXSCREENER_COLORS.gridColor },
      },
      width,
      height,
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
        secondsVisible: timeframe === '1m',
        tickMarkFormatter: (time: Time) => {
          const date = new Date(Number(time) * 1000)
          if (timeframe === '1d') {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
          }
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: DEXSCREENER_COLORS.crosshairColor,
          labelBackgroundColor: '#1f2937',
          width: 1,
          style: 2,
        },
        horzLine: {
          color: DEXSCREENER_COLORS.crosshairColor,
          labelBackgroundColor: '#1f2937',
          width: 1,
          style: 2,
        },
      },
    })

    chartRef.current = chart
    chart.subscribeCrosshairMove(handleCrosshairMove)

    // RALPH LOOP 1: Chart Initialization Check
    console.log('[RALPH LOOP 1] Chart initialized:', {
      chartExists: !!chart,
      containerWidth: width,
      containerHeight: height,
      chartType,
      seriesType: chartType === 'candle' ? 'CandlestickSeries' : chartType === 'line' ? 'LineSeries' : 'AreaSeries',
    })

    // Create main series based on chart type
    if (chartType === 'candle') {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: DEXSCREENER_COLORS.upColor,
        downColor: DEXSCREENER_COLORS.downColor,
        borderUpColor: DEXSCREENER_COLORS.upColor,
        borderDownColor: DEXSCREENER_COLORS.downColor,
        wickUpColor: DEXSCREENER_COLORS.upColor,
        wickDownColor: DEXSCREENER_COLORS.downColor,
        priceFormat: {
          type: 'price',
          precision: 8,
          minMove: 0.00000001,
        },
      })
      series.setData(candleData)
      mainSeriesRef.current = series

      // RALPH LOOP 2: Data Load Check
      console.log('[RALPH LOOP 2] Candle data loaded:', {
        dataLength: candleData.length,
        hasData: candleData.length > 0,
        firstCandle: candleData[0],
        lastCandle: candleData[candleData.length - 1],
      })

      // RALPH LOOP 3: OHLC Structure Check
      if (candleData.length > 0) {
        const sample = candleData[0]
        console.log('[RALPH LOOP 3] OHLC structure validation:', {
          hasOpen: typeof sample.open === 'number',
          hasHigh: typeof sample.high === 'number',
          hasLow: typeof sample.low === 'number',
          hasClose: typeof sample.close === 'number',
          hasTime: typeof sample.time === 'number',
          sampleCandle: sample,
        })
      }

      // RALPH LOOP 4: Direction/Color Check
      const upCandles = candleData.filter(c => c.close >= c.open).length
      const downCandles = candleData.filter(c => c.close < c.open).length
      console.log('[RALPH LOOP 4] Direction validation:', {
        upCandles,
        downCandles,
        total: candleData.length,
        upColor: DEXSCREENER_COLORS.upColor,
        downColor: DEXSCREENER_COLORS.downColor,
      })

      // RALPH LOOP 5: Time Axis Direction Check
      if (candleData.length >= 2) {
        const firstTime = Number(candleData[0].time)
        const lastTime = Number(candleData[candleData.length - 1].time)
        console.log('[RALPH LOOP 5] Axis direction validation:', {
          firstCandleTime: new Date(firstTime * 1000).toISOString(),
          lastCandleTime: new Date(lastTime * 1000).toISOString(),
          timeSortedCorrectly: firstTime < lastTime,
          chronological: firstTime < lastTime ? 'PASS - oldest left, newest right' : 'FAIL - wrong order',
        })
      }

      // RALPH LOOP 6: Render Check
      console.log('[RALPH LOOP 6] Render validation:', {
        seriesRef: !!mainSeriesRef.current,
        chartRef: !!chartRef.current,
        candlestickSeriesActive: chartType === 'candle',
        expectedVisual: 'Individual candle bars with wicks, NOT area fill',
      })
    } else if (chartType === 'line') {
      const series = chart.addSeries(LineSeries, {
        color: themeColor,
        lineWidth: 2,
        priceFormat: {
          type: 'price',
          precision: 8,
          minMove: 0.00000001,
        },
      })
      series.setData(lineData)
      mainSeriesRef.current = series
    } else {
      const series = chart.addSeries(AreaSeries, {
        lineColor: themeColor,
        topColor: `${themeColor}30`,
        bottomColor: `${themeColor}05`,
        lineWidth: 2,
        priceFormat: {
          type: 'price',
          precision: 8,
          minMove: 0.00000001,
        },
      })
      series.setData(areaData)
      mainSeriesRef.current = series
    }

    // Create volume series
    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    })
    volSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    })
    volSeries.setData(volumeData)
    volumeSeriesRef.current = volSeries

    chart.timeScale().fitContent()

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect
        if (w > 0 && h > 0) {
          chart.applyOptions({ width: w, height: h })
        }
      }
    })
    resizeObserver.observe(container)

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove)
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
      mainSeriesRef.current = null
      volumeSeriesRef.current = null
    }
  }, [chartType, timeframe, themeColor, candleData, lineData, areaData, volumeData, handleCrosshairMove])

  // Calculate stats
  const stats = useMemo(() => {
    if (ohlcData.length < 2) return { change: 0, changePercent: '0.00', high24h: 0, low24h: 0, volume24h: 0 }

    const first = ohlcData[0].open
    const last = ohlcData[ohlcData.length - 1].close
    const change = last - first
    const changePercent = ((change / first) * 100).toFixed(2)

    let high24h = 0
    let low24h = Infinity
    let volume24h = 0
    const dayAgo = Math.floor(Date.now() / 1000) - 86400

    for (const candle of ohlcData) {
      if (Number(candle.time) >= dayAgo) {
        high24h = Math.max(high24h, candle.high)
        low24h = Math.min(low24h, candle.low)
        volume24h += candle.volume
      }
    }

    if (low24h === Infinity) low24h = first

    return { change, changePercent, high24h, low24h, volume24h }
  }, [ohlcData])

  const isPositive = parseFloat(stats.changePercent) >= 0

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      minHeight: '350px',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    }}>
      {/* Header Stats Bar - DexScreener Style */}
      <div style={{
        position: 'absolute',
        top: '8px',
        left: '12px',
        right: '12px',
        zIndex: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        {/* Left: Price Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Current Price */}
          <div>
            <div style={{
              fontSize: '22px',
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1,
            }}>
              {formatPrice(currentPrice)}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
              PLS
            </div>
          </div>

          {/* Change Badge */}
          <div style={{
            padding: '6px 12px',
            borderRadius: '6px',
            backgroundColor: isPositive ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 51, 102, 0.15)',
            border: `1px solid ${isPositive ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 51, 102, 0.3)'}`,
          }}>
            <span style={{
              fontSize: '14px',
              fontWeight: 700,
              color: isPositive ? DEXSCREENER_COLORS.upColor : DEXSCREENER_COLORS.downColor,
            }}>
              {isPositive ? '▲' : '▼'} {isPositive ? '+' : ''}{stats.changePercent}%
            </span>
          </div>

          {/* 24h Stats */}
          <div style={{ display: 'flex', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase' }}>24h High</div>
              <div style={{ fontSize: '12px', color: DEXSCREENER_COLORS.upColor, fontWeight: 600 }}>
                {formatPrice(stats.high24h)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase' }}>24h Low</div>
              <div style={{ fontSize: '12px', color: DEXSCREENER_COLORS.downColor, fontWeight: 600 }}>
                {formatPrice(stats.low24h)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase' }}>24h Vol</div>
              <div style={{ fontSize: '12px', color: '#fff', fontWeight: 600 }}>
                {formatVolume(stats.volume24h)}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Chart Type Toggle */}
          <div style={{
            display: 'flex',
            backgroundColor: 'rgba(0,0,0,0.6)',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.1)',
            overflow: 'hidden',
          }}>
            {([
              { type: 'candle' as ChartType, icon: '📊', label: 'Candle' },
              { type: 'line' as ChartType, icon: '📈', label: 'Line' },
              { type: 'area' as ChartType, icon: '📉', label: 'Area' },
            ]).map(({ type, icon }) => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                style={{
                  padding: '6px 10px',
                  backgroundColor: chartType === type ? 'rgba(0,255,136,0.2)' : 'transparent',
                  border: 'none',
                  color: chartType === type ? DEXSCREENER_COLORS.upColor : '#6b7280',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title={type}
              >
                {icon}
              </button>
            ))}
          </div>

          {/* Timeframe Selector */}
          <div style={{
            display: 'flex',
            backgroundColor: 'rgba(0,0,0,0.6)',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.1)',
            overflow: 'hidden',
          }}>
            {(['1m', '5m', '15m', '1h', '4h', '1d'] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                style={{
                  padding: '6px 8px',
                  backgroundColor: timeframe === tf ? 'rgba(0,255,136,0.2)' : 'transparent',
                  border: 'none',
                  color: timeframe === tf ? DEXSCREENER_COLORS.upColor : '#6b7280',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                }}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Crosshair OHLC Info - DexScreener Style */}
      {crosshairData && (
        <div style={{
          position: 'absolute',
          top: '60px',
          left: '12px',
          zIndex: 20,
          padding: '10px 14px',
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px',
          }}>
            <span style={{ fontSize: '11px', color: '#6b7280' }}>
              {crosshairData.time}
            </span>
            <span style={{
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: crosshairData.isUp ? 'rgba(0,255,136,0.2)' : 'rgba(255,51,102,0.2)',
              fontSize: '11px',
              fontWeight: 700,
              color: crosshairData.isUp ? DEXSCREENER_COLORS.upColor : DEXSCREENER_COLORS.downColor,
            }}>
              {crosshairData.change}
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
          }}>
            {[
              { label: 'O', value: crosshairData.open },
              { label: 'H', value: crosshairData.high, color: DEXSCREENER_COLORS.upColor },
              { label: 'L', value: crosshairData.low, color: DEXSCREENER_COLORS.downColor },
              { label: 'C', value: crosshairData.close },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ fontSize: '10px', color: '#6b7280' }}>{label}</div>
                <div style={{ fontSize: '11px', color: color || '#fff', fontWeight: 600 }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{ fontSize: '10px', color: '#6b7280' }}>Vol</span>
            <span style={{ fontSize: '11px', color: '#fff', fontWeight: 600 }}>
              {crosshairData.volume}
            </span>
          </div>
        </div>
      )}

      {/* Chart Container */}
      <div
        ref={chartContainerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* Powered By Badge */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        right: '12px',
        zIndex: 20,
        fontSize: '10px',
        color: '#4b5563',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}>
        <span>Powered by</span>
        <span style={{ color: '#00ff88', fontWeight: 600 }}>PUMP.FUD</span>
      </div>
    </div>
  )
}
