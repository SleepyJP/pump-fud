import { useEffect, useRef, useMemo } from 'react'
import { createChart, ColorType, AreaSeries } from 'lightweight-charts'
import type { IChartApi, ISeriesApi, AreaData, Time } from 'lightweight-charts'
import { formatEther } from 'viem'

interface PriceChartProps {
  tokenAddress: string
  reserveBalance: bigint
  tokensSold: bigint
  launchTime: number
  themeColor: string
}

export function PriceChart({ reserveBalance, tokensSold, launchTime, themeColor }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)

  const chartData = useMemo(() => {
    const data: AreaData<Time>[] = []
    const now = Math.floor(Date.now() / 1000)
    const startTime = launchTime > 0 ? launchTime : now - 3600

    const INITIAL_PRICE = 0.00001
    const CURVE_STEEPNESS = 0.000001

    if (!tokensSold || tokensSold === 0n) {
      const interval = Math.max(1, (now - startTime) / 50)
      for (let i = 0; i <= 50; i++) {
        const time = startTime + Math.floor(interval * i)
        data.push({
          time: time as Time,
          value: INITIAL_PRICE,
        })
      }
      return data
    }

    const totalSold = Number(formatEther(tokensSold))
    const steps = 50
    const interval = Math.max(1, (now - startTime) / steps)

    for (let i = 0; i <= steps; i++) {
      const progress = i / steps
      const soldAtPoint = totalSold * progress
      const price = INITIAL_PRICE + (CURVE_STEEPNESS * soldAtPoint)
      const time = startTime + Math.floor(interval * i)
      data.push({
        time: time as Time,
        value: price,
      })
    }

    return data
  }, [tokensSold, launchTime])

  const currentPrice = useMemo(() => {
    if (!tokensSold || tokensSold === 0n) return 0.00001
    if (!reserveBalance || reserveBalance === 0n) return 0.00001
    const sold = Number(formatEther(tokensSold))
    const reserve = Number(formatEther(reserveBalance))
    if (sold === 0) return 0.00001
    return reserve / sold
  }, [reserveBalance, tokensSold])

  useEffect(() => {
    if (!chartContainerRef.current) return

    const container = chartContainerRef.current

    // Ensure container has dimensions before creating chart
    const rect = container.getBoundingClientRect()
    const width = rect.width || 400
    const height = rect.height || 280

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#888',
        fontFamily: 'monospace',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      width,
      height,
      timeScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        scaleMargins: { top: 0.15, bottom: 0.1 },
      },
      crosshair: {
        vertLine: { color: themeColor, labelBackgroundColor: themeColor },
        horzLine: { color: themeColor, labelBackgroundColor: themeColor },
      },
    })

    chartRef.current = chart

    // Create area series with v5 API
    const series = chart.addSeries(AreaSeries, {
      lineColor: themeColor,
      topColor: `${themeColor}50`,
      bottomColor: `${themeColor}08`,
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 8,
        minMove: 0.00000001,
      },
    })

    seriesRef.current = series

    if (chartData.length > 0) {
      series.setData(chartData)
      chart.timeScale().fitContent()
    }

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
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [themeColor])

  // Update data when chartData changes (without recreating chart)
  useEffect(() => {
    if (seriesRef.current && chartData.length > 0) {
      seriesRef.current.setData(chartData)
      chartRef.current?.timeScale().fitContent()
    }
  }, [chartData])

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      minHeight: '280px',
    }}>
      {/* Current Price Display */}
      <div style={{
        position: 'absolute',
        top: '8px',
        right: '12px',
        zIndex: 10,
        padding: '8px 14px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: '8px',
        border: `1px solid ${themeColor}40`,
      }}>
        <span style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '2px' }}>
          Price
        </span>
        <span style={{
          fontFamily: 'monospace',
          fontSize: '14px',
          color: themeColor,
          fontWeight: 'bold',
        }}>
          {currentPrice.toFixed(8)} PLS
        </span>
      </div>

      {/* Reserve Display */}
      <div style={{
        position: 'absolute',
        top: '8px',
        left: '12px',
        zIndex: 10,
        padding: '8px 14px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: '8px',
        border: '1px solid rgba(34,197,94,0.3)',
      }}>
        <span style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '2px' }}>
          Reserve
        </span>
        <span style={{
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#22c55e',
          fontWeight: 'bold',
        }}>
          {Number(formatEther(reserveBalance || 0n)).toFixed(2)} PLS
        </span>
      </div>

      {/* Chart Container - Absolute positioned to fill parent */}
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
    </div>
  )
}
