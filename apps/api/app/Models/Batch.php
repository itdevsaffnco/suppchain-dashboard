<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['sku_id', 'batch_code', 'date', 'qty_in', 'qty_used', 'sisa'])]
class Batch extends Model
{
    protected function casts(): array
    {
        return [
            'date' => 'date',
            'qty_in' => 'integer',
            'qty_used' => 'integer',
            'sisa' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Sku, $this>
     */
    public function sku(): BelongsTo
    {
        return $this->belongsTo(Sku::class);
    }

    /**
     * Batch shape expected by the UI, where `id` is the human batch label.
     *
     * @return array{id: string, date: string, qty_in: int, qty_used: int, sisa: int}
     */
    public function toDashboardArray(): array
    {
        return [
            'id' => $this->batch_code,
            'date' => $this->date->format('Y-m-d'),
            'qty_in' => $this->qty_in,
            'qty_used' => $this->qty_used,
            'sisa' => $this->sisa,
        ];
    }
}
