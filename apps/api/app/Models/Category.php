<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name'])]
class Category extends Model
{
    /**
     * @return HasMany<CategoryWeekly, $this>
     */
    public function weeklies(): HasMany
    {
        return $this->hasMany(CategoryWeekly::class);
    }

    /**
     * @return HasMany<Sku, $this>
     */
    public function skus(): HasMany
    {
        return $this->hasMany(Sku::class);
    }

    /**
     * Category aggregate in the shape the UI expects:
     * { forecast: number[5], realisasi: number[5] }.
     *
     * @return array{forecast: list<int>, realisasi: list<int>}
     */
    public function toDashboardArray(): array
    {
        $forecast = array_fill(0, Sku::WEEKS, 0);
        $realisasi = array_fill(0, Sku::WEEKS, 0);

        foreach ($this->weeklies as $row) {
            if ($row->week >= 1 && $row->week <= Sku::WEEKS) {
                $forecast[$row->week - 1] = $row->forecast;
                $realisasi[$row->week - 1] = $row->realisasi;
            }
        }

        return ['forecast' => $forecast, 'realisasi' => $realisasi];
    }
}
