<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class SheetsService
{
    private const CACHE_KEY = 'sheets_data';
    private const CACHE_TTL = 300; // 5 menit fallback jika webhook tidak datang

    /**
     * Ambil data dari Google Apps Script Web App.
     * Di-cache 5 menit; webhook invalidate cache saat ada perubahan.
     */
    public function getData(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {
            return $this->fetchFromSheets();
        });
    }

    /** Hapus cache agar fetch ulang pada request berikutnya. */
    public function invalidate(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    private function fetchFromSheets(): array
    {
        $url = config('services.sheets.webapp_url');

        $response = Http::timeout(15)->get($url);
        $raw = $response->json();

        return [
            'skus'       => $this->buildSkus($raw),
            'categories' => $this->buildCategories($raw),
        ];
    }

    // -------------------------------------------------------------------------
    // Transform helpers
    // -------------------------------------------------------------------------

    private function buildSkus(array $raw): array
    {
        $health  = collect($raw['health']  ?? []);
        $weekly  = collect($raw['weekly']  ?? []);
        $aging   = collect($raw['aging']   ?? []);

        // Kelompokkan weekly per SKU
        $weeklyBySku = $weekly->groupBy('sku_name');

        // Kelompokkan aging (batches) per SKU
        $agingBySku = $aging->groupBy('sku_name');

        return $health->map(function ($row) use ($weeklyBySku, $agingBySku) {
            $name    = $row['sku_name'];
            $weeks   = $weeklyBySku->get($name, collect());
            $batches = $agingBySku->get($name, collect());

            $forecast     = array_fill(0, 5, 0);
            $realization  = array_fill(0, 5, 0);

            foreach ($weeks as $w) {
                $idx = (int) $w['week_num'] - 1;
                if ($idx >= 0 && $idx < 5) {
                    $forecast[$idx]    = (int) $w['forecast_qty'];
                    $realization[$idx] = (int) $w['realization_qty'];
                }
            }

            return [
                'name'         => $name,
                'cat'          => $row['category']        ?? '',
                'f_trend'      => $forecast,
                'r_trend'      => $realization,
                'po'           => (int)   ($row['incoming_po']     ?? 0),
                'safety'       => (int)   ($row['safety_stock']    ?? 0),
                'daily_demand' => (float) ($row['avg_daily_demand'] ?? 0),
                'tipe_stock'   => '',
                'target_simpan'=> 0,
                'batches'      => $batches->map(fn ($b) => [
                    'id'       => 0,
                    'date'     => $b['incoming_date'] ?? '',
                    'qty_in'   => (int) ($b['incoming_qty'] ?? 0),
                    'qty_used' => (int) ($b['used_qty']     ?? 0),
                    'sisa'     => (int) ($b['sisa']         ?? 0),
                ])->values()->all(),
            ];
        })->values()->all();
    }

    private function buildCategories(array $raw): array
    {
        $health = collect($raw['health'] ?? []);
        $weekly = collect($raw['weekly'] ?? []);

        $cats = $health->pluck('category')->unique()->filter();

        return $cats->mapWithKeys(function ($cat) use ($weekly) {
            $rows = $weekly->where('category', $cat);

            $forecast    = array_fill(0, 5, 0);
            $realization = array_fill(0, 5, 0);

            foreach ($rows as $w) {
                $idx = (int) $w['week_num'] - 1;
                if ($idx >= 0 && $idx < 5) {
                    $forecast[$idx]    += (int) $w['forecast_qty'];
                    $realization[$idx] += (int) $w['realization_qty'];
                }
            }

            return [$cat => [
                'f_trend' => $forecast,
                'r_trend' => $realization,
            ]];
        })->all();
    }
}
