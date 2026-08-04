<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'category_id',
    'name',
    'po',
    'safety',
    'daily_demand',
    'tipe_stock',
    'target_simpan',
])]
class Sku extends Model
{
    /** Planning horizon: the dashboard always charts 5 weeks. */
    public const WEEKS = 5;

    protected function casts(): array
    {
        return [
            'po' => 'integer',
            'safety' => 'integer',
            'daily_demand' => 'float',
            'target_simpan' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Category, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * @return HasMany<SkuWeekly, $this>
     */
    public function weeklies(): HasMany
    {
        return $this->hasMany(SkuWeekly::class);
    }

    /**
     * @return HasMany<Batch, $this>
     */
    public function batches(): HasMany
    {
        return $this->hasMany(Batch::class);
    }

    /**
     * Raw SKU shape consumed by the dashboard (lib/dashboard.ts `Sku`). All
     * derived fields (stock, aging, coverage, status) stay client-side in
     * enrichAll() so this stays a pure representation of what is stored.
     *
     * @return array<string, mixed>
     */
    public function toDashboardArray(): array
    {
        $forecast = array_fill(0, self::WEEKS, 0);
        $realization = array_fill(0, self::WEEKS, 0);

        foreach ($this->weeklies as $row) {
            if ($row->week >= 1 && $row->week <= self::WEEKS) {
                $forecast[$row->week - 1] = $row->forecast;
                $realization[$row->week - 1] = $row->realization;
            }
        }

        return [
            'name' => $this->name,
            'cat' => $this->category->name,
            'f_trend' => $forecast,
            'r_trend' => $realization,
            'po' => $this->po,
            'safety' => $this->safety,
            'daily_demand' => $this->daily_demand,
            'tipe_stock' => $this->tipe_stock,
            'target_simpan' => $this->target_simpan,
            'batches' => $this->batches
                ->sortBy('date')
                ->values()
                ->map(fn (Batch $b) => $b->toDashboardArray())
                ->all(),
        ];
    }
}
